// waterRisk.js — water & environmental ("zonal") risk, v1.
//
// The leader's requirement: an area is prone not only because it has CASES (red
// zone) but because of the ENVIRONMENT it sits in (blue zone) — water first, heat
// second. "If there's like a pond of water that is big then it's blue, same thing
// will happen if there's a heat within summer or other diseases — water is just a
// best example and the red is cases."
//
// Drivers
//   laguna_de_bay  a barangay/zone edge within `lakeBufferM` of the Laguna de Bay
//                  shoreline (OSM relation 79348, clipped + simplified).
//   inland_water   a water body of >= `minWaterBodyM2` (pond / reservoir / lake /
//                  basin) within `waterBodyBufferM`, or such a body sitting INSIDE
//                  the polygon (checked by its centroid).
//   flood          rain / flood-pin driven exposure — evaluated by the zone engine
//                  (it already has rainfall + pins); exposed here only as a label.
//   heat           Extreme Heat hazard (>= heatTempC) or, in summer
//                  (Tag-init), >= heatSummerTempC.
//
// Why the lake + big bodies and not "any water": measured against the real OSM
// data, EVERY Cabuyao barangay is within 250 m of some stream, so "near any water"
// does not discriminate. The lake shoreline and large bodies split the city 10/8 in
// a way that matches the map (Gulod/Marinig/Butong/Bigaa/Baclaran/Mamatid on the
// lake; Banlic/Diezmo/Pittland/Casile on inland ponds). Rivers are reported as
// context ("nearest water") but do not by themselves flag a blue zone.
//
// The bundled geometry is `data/water_bodies.geojson.json` (OpenStreetMap, ODbL),
// also read by server.js so the CHO double-check screen and the weekly/5-min
// exposure alerts agree with the map. Anything the CHO draws by hand is stored in
// the `water_features` table and merged into the same index (feeding the engine).

import * as waterGeoModule from './data/water_bodies.geojson.json' with { type: 'json' };
// The app already has a Philippine-season module (seasonalDiseases.js: SEASONS /
// seasonForMonth / seasonalDiseases) used by the Disaster Disease Map. Reuse it for
// the Tag-init (hot dry) check rather than introducing a second season definition.
import { seasonForMonth } from './seasonalDiseases';

// Vite/Node expose a JSON module's FeatureCollection either as `default` (ESM
// interop) or at the top level; accept both.
const WATER_GEO = waterGeoModule && waterGeoModule.default ? waterGeoModule.default : waterGeoModule;

/** The bundled OSM water FeatureCollection (read-only). */
export const WATER_BODIES = WATER_GEO;

export const WATER_RISK_DEFAULTS = {
  lakeBufferM: 300,      // distance to the Laguna de Bay shoreline
  waterBodyBufferM: 300, // distance to a large inland water body
  minWaterBodyM2: 2000,  // "big" water body = 0.2 ha (matches the leader's "big pond")
  heatTempC: 35,         // Extreme Heat hazard threshold (see server.js)
  heatSummerTempC: 33,   // softer trigger that only applies in Tag-init
};

export const WATER_DRIVER_ORDER = ['laguna_de_bay', 'inland_water', 'flood', 'heat'];

export const WATER_DRIVER_LABELS = {
  laguna_de_bay: 'Near Laguna de Bay',
  inland_water: 'Near / inside a large water body',
  flood: 'Flood-prone (rain / flood)',
  heat: 'Extreme heat',
};

export const WATER_DRIVER_SHORT = {
  laguna_de_bay: 'Lakeshore',
  inland_water: 'Water body',
  flood: 'Flood',
  heat: 'Heat',
};

export const WATER_DRIVER_ICONS = {
  laguna_de_bay: '🌊',
  inland_water: '💧',
  flood: '🌧️',
  heat: '🌡️',
};

// Prone diseases per driver — what to watch for once an area is flagged. Kept as
// arrays so callers can render chips directly. The blue (exposure) lists mirror the
// zone engine's RAINY_SEASON_DISEASES / SUMMER_SEASON_DISEASES (zoneHotspots.js);
// waterRisk.js cannot import that file (it imports this one), so the names are
// repeated here deliberately.
const WATER_BORNE = ['Dengue', 'Leptospirosis', 'Typhoid Fever', 'Diarrhea', 'Cholera', 'Hepatitis A'];
const HEAT_RELATED = ['Diarrhea', 'Cholera', 'Hepatitis A', 'Sore Eyes'];
export const WATER_PRONE_DISEASES = {
  laguna_de_bay: WATER_BORNE,
  inland_water: ['Leptospirosis', 'Typhoid Fever', 'Hepatitis A', 'Diarrhea', 'Dengue', 'Cholera'],
  flood: WATER_BORNE,
  heat: HEAT_RELATED,
};

// Blue = environmental driver with no case signal; red = case hotspot.
export const WATER_ZONE_KINDS = {
  blue: { key: 'blue', label: 'Blue Zone (environmental risk)', color: '#2563eb', icon: '💧' },
  red: { key: 'red', label: 'Red Zone (case hotspot)', color: '#dc2626', icon: '🔥' },
  linked: { key: 'linked', label: 'Case hotspot in an exposed area', color: '#7c3aed', icon: '⚠️' },
};

// ── geometry helpers (equirectangular metres around Cabuyao) ──────────────────
const M_LAT = 110574;
const M_LNG = 111320 * Math.cos(14.26 * Math.PI / 180);
const proj = (lat, lng) => [lng * M_LNG, lat * M_LAT];
const CELL_DEG = 0.01;            // ~1.1 km grid cell for the segment index
const CELL_M = CELL_DEG * M_LAT;

function segDist2(px, py, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return (px - a[0]) * (px - a[0]) + (py - a[1]) * (py - a[1]);
  let t = ((px - a[0]) * dx + (py - a[1]) * dy) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = a[0] + t * dx;
  const cy = a[1] + t * dy;
  return (px - cx) * (px - cx) + (py - cy) * (py - cy);
}

// GeoJSON rings are [lng, lat]; sample the outline every `stepM` so a body in the
// middle of a ~1 km zone cell is still seen (vertex-only sampling would miss it).
function sampleRing(ring, stepM = 100) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (!a || !b) continue;
    const ax = a[0] * M_LNG, ay = a[1] * M_LAT;
    const bx = b[0] * M_LNG, by = b[1] * M_LAT;
    const dx = bx - ax, dy = by - ay;
    const n = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / stepM));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push([ax + t * dx, ay + t * dy]);
    }
  }
  return out;
}

/** Rings/lines of a GeoJSON geometry, in GeoJSON [lng, lat] order. */
export function geometryRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  // Shorelines and rivers are LineStrings — they must be indexed too, otherwise the
  // whole Laguna de Bay shoreline is invisible to the distance search.
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  return [];
}

/** Rings of a barangay GeoJSON feature. */
export function featureRings(feature) {
  return geometryRings(feature && feature.geometry);
}

// ── the water index ──────────────────────────────────────────────────────────
const gridKey = (x, y) => `${Math.floor(x / CELL_M)}:${Math.floor(y / CELL_M)}`;

/**
 * Build a searchable index over water features.
 * @param {Array} features  GeoJSON features (defaults to the bundled OSM set)
 * @param {object} opts     WATER_RISK_DEFAULTS overrides
 */
export function buildWaterIndex(features = (WATER_GEO ? WATER_GEO.features : []), opts = {}) {
  const o = { ...WATER_RISK_DEFAULTS, ...opts };
  const segments = [];
  const bigCentroids = [];
  for (const f of features || []) {
    const pr = (f && f.properties) || {};
    const geom = (f && f.geometry) || null;
    if (!geom) continue;
    const isLake = pr.kind === 'shoreline' || pr.kind === 'lagoon';
    const area = Number(pr.area_m2) || 0;
    const isBig = area >= o.minWaterBodyM2;
    const name = pr.name || null;
    const kind = pr.kind || 'water';
    const rings = geometryRings(geom);
    for (const ring of rings) {
      if (!Array.isArray(ring) || ring.length < 2) continue;
      const P = ring.map(c => proj(c[1], c[0]));
      for (let i = 1; i < P.length; i++) {
        segments.push({
          a: P[i - 1], b: P[i],
          x: (P[i - 1][0] + P[i][0]) / 2,
          y: (P[i - 1][1] + P[i][1]) / 2,
          isLake, isBig, name, kind, area,
        });
      }
    }
    if (isBig && (geom.type === 'Polygon' || geom.type === 'MultiPolygon')) {
      const first = geometryRings(geom)[0] || [];
      if (first.length >= 3) {
        let sx = 0, sy = 0;
        first.forEach(c => { sx += c[0]; sy += c[1]; });
        bigCentroids.push({ lng: sx / first.length, lat: sy / first.length, name, kind, area });
      }
    }
  }
  const grid = new Map();
  const pushCell = (k, i) => {
    let arr = grid.get(k);
    if (!arr) { arr = []; grid.set(k, arr); }
    arr.push(i);
  };
  segments.forEach((s, i) => {
    // Register the segment in every cell its BOUNDING BOX touches, not just the cell
    // holding its midpoint: the shoreline is simplified to ~8 m, so a single segment
    // can be long, and midpoint-only bucketing would hide it from a nearby query.
    const x0 = Math.min(s.a[0], s.b[0]);
    const x1 = Math.max(s.a[0], s.b[0]);
    const y0 = Math.min(s.a[1], s.b[1]);
    const y1 = Math.max(s.a[1], s.b[1]);
    const cx0 = Math.floor(x0 / CELL_M);
    const cx1 = Math.floor(x1 / CELL_M);
    const cy0 = Math.floor(y0 / CELL_M);
    const cy1 = Math.floor(y1 / CELL_M);
    if ((cx1 - cx0 + 1) * (cy1 - cy0 + 1) > 400) { pushCell(gridKey(s.x, s.y), i); return; }
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) pushCell(`${cx}:${cy}`, i);
    }
  });
  return { segments, grid, bigCentroids, features: features || [], opts: o };
}

let _defaultIndex = null;
/** Memoised index over the bundled water set. */
export function getWaterIndex(opts = {}) {
  if (!_defaultIndex || Object.keys(opts).length > 0) return buildWaterIndex(undefined, opts);
  if (!_defaultIndex) _defaultIndex = buildWaterIndex();
  return _defaultIndex;
}

// Nearest water segment to a projected point, over grid rings 1..2, stopping as soon
// as nothing further out can win. One scan yields the nearest overall / lake / large
// body at once (three separate scans tripled the cost for no benefit).
//
// Correctness: a segment is registered in every cell its bounding box touches, so if
// it comes within d of the point, one of its cells is within ring ceil(d/CELL_M). After
// searching ring r, any unsearched cell (ring >= r+1) is at least (r-1)*CELL_M away, so
// once the overall best is below that bound no unsearched segment can beat it.
function nearestAt(index, x, y) {
  const { grid, segments } = index;
  let bestAny = Infinity, segAny = null;
  let bestLake = Infinity, segLake = null;
  let bestBig = Infinity, segBig = null;
  for (let ring = 1; ring <= 2; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const arr = grid.get(gridKey(x + dx * CELL_M, y + dy * CELL_M));
        if (!arr) continue;
        for (const i of arr) {
          const s = segments[i];
          const d = segDist2(x, y, s.a, s.b);
          if (d < bestAny) { bestAny = d; segAny = s; }
          if (s.isLake && d < bestLake) { bestLake = d; segLake = s; }
          if (s.isBig && d < bestBig) { bestBig = d; segBig = s; }
        }
      }
    }
    if (segAny && Math.sqrt(bestAny) <= (ring - 1) * CELL_M) break;
  }
  return {
    any: segAny ? { meters: Math.sqrt(bestAny), seg: segAny } : null,
    lake: segLake ? { meters: Math.sqrt(bestLake), seg: segLake } : null,
    big: segBig ? { meters: Math.sqrt(bestBig), seg: segBig } : null,
  };
}

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

/**
 * Environmental (blue-zone) drivers for a polygon given as GeoJSON rings.
 * @returns {{
 *   drivers: string[], blue: boolean,
 *   lagunaM: number|null, waterBodyM: number|null,
 *   nearest: { name: string|null, kind: string, meters: number }|null,
 *   contained: Array<{ name: string|null, kind: string, area: number }>
 * }}
 */
export function waterDriversForRings(rings, { index, opts } = {}) {
  const idx = index || getWaterIndex();
  const o = { ...idx.opts, ...(opts || {}) };
  const pts = [];
  (rings || []).forEach(r => pts.push(...sampleRing(r, 100)));
  let lake = null;
  let big = null;
  let any = null;
  for (const p of pts) {
    const near = nearestAt(idx, p[0], p[1]);
    if (near.lake && (!lake || near.lake.meters < lake.meters)) lake = near.lake;
    if (near.big && (!big || near.big.meters < big.meters)) big = near.big;
    if (near.any && (!any || near.any.meters < any.meters)) any = near.any;
  }
  const contained = idx.bigCentroids.filter(c => (rings || []).some(r => pointInRing(c.lng, c.lat, r)));

  const drivers = [];
  if (lake && lake.meters <= o.lakeBufferM) drivers.push('laguna_de_bay');
  if ((big && big.meters <= o.waterBodyBufferM) || contained.length > 0) drivers.push('inland_water');

  return {
    drivers,
    blue: drivers.length > 0,
    lagunaM: lake ? Math.round(lake.meters) : null,
    waterBodyM: big ? Math.round(big.meters) : null,
    nearest: any ? { name: any.seg.name, kind: any.seg.kind, meters: Math.round(any.meters) } : null,
    contained: contained.map(c => ({ name: c.name, kind: c.kind, area: c.area })),
  };
}

/** Same, for a barangay GeoJSON feature. */
export function waterDriversForFeature(feature, opts = {}) {
  return waterDriversForRings(featureRings(feature), opts);
}

/**
 * Heat driver. `tempC` comes from the same Open-Meteo call the hazard sweep uses;
 * `monthIndex` is a JS month (0-11) for the Tag-init check.
 * @returns {'heat'|null}
 */
export function heatDriverFor({ tempC, monthIndex }, opts = {}) {
  const o = { ...WATER_RISK_DEFAULTS, ...opts };
  if (tempC == null || !Number.isFinite(Number(tempC))) return null;
  const t = Number(tempC);
  if (t >= o.heatTempC) return 'heat';
  if (seasonForMonth(monthIndex).id === 'hot' && t >= o.heatSummerTempC) return 'heat';
  return null;
}

/** Human label for a driver key. */
export function waterDriverLabel(driver) {
  return WATER_DRIVER_LABELS[driver] || driver;
}

/** Human reason string, e.g. "Within 19 m of Laguna de Bay". */
export function waterDriverReason(driver, detail) {
  if (!detail) return waterDriverLabel(driver);
  if (driver === 'laguna_de_bay') {
    return detail.lagunaM != null ? `Within ${detail.lagunaM} m of Laguna de Bay` : 'Near Laguna de Bay';
  }
  if (driver === 'inland_water') {
    if (detail.contained && detail.contained.length) {
      const c = detail.contained[0];
      return c.name ? `Water body inside the area (${c.name})` : 'Large water body inside the area';
    }
    return detail.waterBodyM != null ? `Within ${detail.waterBodyM} m of a large water body` : 'Near a large water body';
  }
  return waterDriverLabel(driver);
}

/** Union of prone diseases for a set of drivers (deduped, stable order). */
export function waterProneDiseases(drivers = []) {
  const out = [];
  for (const d of WATER_DRIVER_ORDER) {
    if (!drivers.includes(d)) continue;
    for (const disease of (WATER_PRONE_DISEASES[d] || [])) {
      if (!out.includes(disease)) out.push(disease);
    }
  }
  return out;
}

/** Counts of the bundled asset, for the Settings double-check card. */
export function waterAssetInfo() {
  const feats = (WATER_GEO && WATER_GEO.features) || [];
  const byKind = {};
  const named = new Set();
  let bigCount = 0;
  feats.forEach(f => {
    const k = (f.properties && f.properties.kind) || 'water';
    byKind[k] = (byKind[k] || 0) + 1;
    if (f.properties && f.properties.name) named.add(f.properties.name);
    if ((Number(f.properties && f.properties.area_m2) || 0) >= WATER_RISK_DEFAULTS.minWaterBodyM2) bigCount++;
  });
  return {
    features: feats.length,
    byKind,
    named: [...named],
    bigWaterBodies: bigCount,
    source: (WATER_GEO && WATER_GEO.source) || 'OpenStreetMap (ODbL)',
    generated: (WATER_GEO && WATER_GEO.generated) || null,
  };
}

/**
 * Blue/red/linked classification used by the map:
 *   blue    environmental driver, no case signal
 *   red     case signal, no environmental driver
 *   linked  both (a case hotspot inside an exposed area)
 */
export function waterZoneClass({ blue, hasCases }) {
  if (blue && hasCases) return 'linked';
  if (blue) return 'blue';
  if (hasCases) return 'red';
  return null;
}

// ── CHO-drawn water features (feed the algorithm) ────────────────────────────
// A feature added by hand in Settings is stored as a circle (lat/lng + radius_m)
// or as a raw polygon; both are turned into a GeoJSON Feature here so the same
// engine can score it exactly like a bundled OSM body. `properties.area_m2` >=
// minWaterBodyM2 is what makes it a "big" body (the leader's "big pond").
function circleRing(lng, lat, radiusM, steps = 40) {
  const mPerLat = 110574;
  const mPerLng = 111320 * Math.cos((lat * Math.PI) / 180) || 111320;
  const ring = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([lng + (Math.cos(a) * radiusM) / mPerLng, lat + (Math.sin(a) * radiusM) / mPerLat]);
  }
  return ring;
}

/** GeoJSON Feature for one manual water row (null when unusable). */
export function manualWaterFeature(row) {
  if (!row) return null;
  const name = row.name || 'Manual water feature';
  const kind = row.kind || 'manual_water';
  if (row.geojson) {
    let geom = row.geojson;
    if (typeof geom === 'string') { try { geom = JSON.parse(geom); } catch { geom = null; } }
    if (geom && (geom.type === 'Polygon' || geom.type === 'MultiPolygon')) {
      return {
        type: 'Feature',
        properties: { name, kind, area_m2: Number(row.area_m2) || 0, manual: true, id: row.id },
        geometry: geom,
      };
    }
  }
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  const r = Number(row.radius_m);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(r) || r <= 0) return null;
  const area = Number(row.area_m2) || Math.PI * r * r;
  return {
    type: 'Feature',
    properties: { name, kind, area_m2: area, manual: true, id: row.id },
    geometry: { type: 'Polygon', coordinates: [circleRing(lng, lat, r)] },
  };
}

/** Bundled OSM set + the CHO's manual features, ready for `buildWaterIndex`. */
export function mergeWaterFeatures(baseFeatures, rows) {
  const extra = (rows || [])
    .filter(r => r && Number(r.active) !== 0)
    .map(manualWaterFeature)
    .filter(Boolean);
  return [...((baseFeatures || (WATER_GEO ? WATER_GEO.features : [])) || []), ...extra];
}

/** Summary of the manual set for the Settings card. */
export function manualWaterInfo(rows) {
  const list = rows || [];
  const big = list.filter(r => (Number(r.area_m2) || 0) >= WATER_RISK_DEFAULTS.minWaterBodyM2).length;
  return { total: list.length, big, active: list.filter(r => Number(r.active) !== 0).length };
}
