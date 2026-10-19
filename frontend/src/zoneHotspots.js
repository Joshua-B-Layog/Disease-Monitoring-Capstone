// zoneHotspots.js — purok-level ("zone") hotspot engine, Phase 1.
//
// A ZONE is one cell of the 3x2 grid the app already uses to place cases onto the
// map (frontend/src/data/coordinates.js and geoSnap.js): Purok 1 -> cell (0,0),
// Purok 2 -> (1,0), Purok 3 -> (2,0), Purok 4 -> (0,1), Purok 5 -> (1,1), and any
// other location unit (Blk/Lot/Phase/Southville) -> a deterministic seeded cell.
// cases of the same unit therefore already cluster into the same sub-region, so we
// name and shade that cluster instead of inventing new geometry. When the City
// supplies real purok boundary polygons (table `purok_areas`, uploaded from
// Settings -> Data Management) `zonesForBarangay` returns those instead and the
// 6-cell proxy is not used for that barangay: cases are matched to a purok by the
// unit named in their address ("Purok 3"), with a deterministic fallback.
//
// The epidemiological rule this encodes (the panelist point):
//   flooding alone            -> an EXPOSURE WATCH  (this zone is vulnerable now)
//   cases over threshold      -> a CASE HOTSPOT     (ordinary endemic clustering)
//   cases over threshold AND
//     a flooded/raining zone  -> a WEATHER-LINKED HOTSPOT (the flood is the reason)
// Flooding is the exposure/driver, never the case count.

// Water / environmental ("blue zone") drivers. waterRisk.js imports only
// seasonalDiseases.js, so this direction is safe (no import cycle).
import { waterDriversForRings, waterDriverReason } from './waterRisk';

export const ZONE_COLS = 3;
export const ZONE_ROWS = 2;

// When the map is zoomed in to ZONE_FINE_ZOOM the coarse grid cell is too big to
// point at a purok/blk (one cell is up to 1/6 of the barangay bbox, so a Blk 4
// cluster looks like it covers half the barangay). At that zoom the barangay is
// divided into a finer grid - ZONE_COLS*6 x ZONE_ROWS*6 = 18 x 12 cells (~180 x
// 250 m in Niugan, ~1/18 of the barangay bbox per box) - and ONLY the fine cells
// that actually hold case COORDINATES are shaded. So the hotspot reads as a small
// box on the right block instead of a slab over its neighbours, and two units whose
// cases share one fine cell share one box ("Blk 4 . Lot 5"). Detection is untouched
// - it still runs on the coarse cell; this is presentation only.
export const ZONE_FINE_COLS = ZONE_COLS * 6;
export const ZONE_FINE_ROWS = ZONE_ROWS * 6;

// Fallback subdivision (k x k of the coarse cell) used ONLY for a unit whose cases
// carry no usable coordinates, so the unit still shows somewhere stable instead of
// vanishing from the close-up view.
const SUB_FALLBACK = 3;

// Tunable detection consts (mirror the server-side EPI_ALERT_* naming style).
export const ZONE_WINDOW_DAYS = 7;      // case window

// Rapid-rise window: the map also flags a zone whose case count is climbing fast
// over a short window (the "rapid outbreak" rule the server uses for barangays:
// RAPID_OUTBREAK_WINDOW_DAYS / MIN_CASES / RATIO in server.js). 5 recent cases at
// 1.5x the 5 days before marks the purok/blk driving a barangay-level outbreak.
export const RAPID_WINDOW_DAYS = 5;
export const RAPID_MIN_CASES = 5;
export const RAPID_RATIO = 1.5;

// Sensitivity presets. `standard` is the panel rule; `sensitive` lowers every
// gate so an early signal surfaces sooner, `strict` raises them when the CHO
// wants only unambiguous clusters. The CHO picks one in the Zone Hotspots
// sidebar card (persisted in localStorage) and buildZoneHotspots receives the
// chosen set as `thresholds`. `watchMin` is the near-threshold tier.
export const ZONE_PRESETS = {
  sensitive: { caseMin: 3, surgeMin: 2, surgeRatio: 1.5, rain24: 60,  rain72: 100, watchMin: 2 },
  standard:  { caseMin: 5, surgeMin: 3, surgeRatio: 1.5, rain24: 100, rain72: 150, watchMin: 3 },
  strict:    { caseMin: 8, surgeMin: 5, surgeRatio: 2.0, rain24: 150, rain72: 200, watchMin: 5 },
};
export const DEFAULT_ZONE_SENSITIVITY = 'standard';

// Legacy named exports = the `standard` preset (kept so anything importing the
// individual constants keeps working).
export const ZONE_CASE_MIN = ZONE_PRESETS.standard.caseMin;       // cases(D, zone, 7d) >= 5 ...
export const ZONE_SURGE_MIN = ZONE_PRESETS.standard.surgeMin;      // ... OR >= 3 cases AND
export const ZONE_SURGE_RATIO = ZONE_PRESETS.standard.surgeRatio;  //     >= 1.5x the zone's previous 7d
export const ZONE_RAIN_72H_MM = ZONE_PRESETS.standard.rain72;      // PAGASA orange-ballpark 72h accumulation
export const ZONE_RAIN_24H_MM = ZONE_PRESETS.standard.rain24;      // PAGASA orange 24h accumulation

// Rain-driven (water-borne / vector-borne) diseases — weighted in the rainy season.
export const RAINY_SEASON_DISEASES = [
  'Dengue', 'Leptospirosis', 'Typhoid Fever', 'Diarrhea', 'Cholera', 'Hepatitis A',
];
// Summer / hot-dry concerns — heat and water-quality.
export const SUMMER_SEASON_DISEASES = ['Diarrhea', 'Cholera', 'Hepatitis A', 'Sore Eyes'];

// Water-related manual hazard pins that count as an environmental gate.
export const FLOOD_EVENT_TYPES = ['Flood', 'Typhoon', 'Heavy Rain'];

export const ZONE_KINDS = {
  // BLUE ZONE — an environmental driver is present (water proximity, flood/rain,
  // extreme heat) whether or not cases are: "if there's a big pond of water then
  // it's blue". Kept on the internal key `exposure` so the existing alerts /
  // alert_kind / intervention plumbing keeps working; only the colour + label are
  // the leader's blue. RED ZONES are the case side: `case` (cases, no driver) and
  // `weather` (a case hotspot sitting inside an exposed area).
  exposure: { key: 'exposure', label: 'Blue Zone (environmental risk)', color: '#2563eb', icon: '💧' },
  case: { key: 'case', label: 'Case Hotspot (red)', color: '#dc2626', icon: '🔥' },
  weather: { key: 'weather', label: 'Case Hotspot + exposure (red)', color: '#b91c1c', icon: '🌧️' },
  // Below the hotspot gate but at/above the sensitivity's watchMin: an early
  // signal, not a hotspot. No warning is created, so logging a proactive
  // intervention against one carries no mandatory remarks.
  watch: { key: 'watch', label: 'Near Threshold', color: '#0891b2', icon: '👀' },
};

// Zone-level alert kinds (also whitelisted server-side in ALERT_KINDS).
export const ZONE_ALERT_KIND = { case: 'zone_disease_density', weather: 'zone_disease_flood', exposure: 'zone_disease_flood' };

// Which zone kinds each map mode presents. The HOTSPOT Disease Map is CASES ONLY
// (the red side: `case` = cases with no environmental driver, `weather` = a case
// hotspot sitting inside an exposed area, `watch` = climbing but below the gate).
// The DISASTER Disease Map carries the ENVIRONMENT (the blue side: `exposure` = an
// environmental driver with no case signal — water, rain, flood or heat). Keeping
// the split here lets the map layers and the sidebar counters stay mode-agnostic
// and simply follow the rows they are handed.
export const ZONE_MODE_KINDS = {
  hotspot: ['case', 'weather', 'watch'],
  disaster: ['exposure'],
};

/** True when a zone row of `kind` belongs on the given map mode. */
export function zoneKindFitsMode(kind, mode) {
  const kinds = ZONE_MODE_KINDS[mode];
  return !kinds || kinds.includes(kind);
}

// ── deterministic cell selection (port of coordinates.js / geoSnap.js) ────────
function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
  return ((h >>> 0) % 1000000) / 1000000;
}

const PUROK_CELL = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };

// Location unit (from extractLocationUnit) + barangay -> 0..5 zone index, in
// reading order (row * ZONE_COLS + col) so Zone 1..Zone 6 are human-friendly.
export function zoneIndexForUnit(barangayName, unit) {
  const seedKey = `${barangayName}|${unit || 'C'}`;
  const m = /Purok\s+(\d+)/i.exec(unit || '');
  if (m) {
    const num = parseInt(m[1], 10);
    if (PUROK_CELL[num] != null) return PUROK_CELL[num];
  }
  return Math.floor(seededRandom(seedKey + '_cell') * 6);
}

export function zoneLabel(idx) {
  return `Zone ${idx + 1}`;
}

// ── cell re-homing ───────────────────────────────────────────────────────────
// Cells are a fixed 3x2 division of the barangay bbox, so the ideal (unclipped)
// centre of cell `idx` is the same normalized point for every barangay.
function cellCentre(idx) {
  const col = idx % ZONE_COLS;
  const row = Math.floor(idx / ZONE_COLS);
  return { x: (col + 0.5) / ZONE_COLS, y: (row + 0.5) / ZONE_ROWS };
}

// A concave barangay outline can leave a cell of its OWN bbox with no barangay
// land at all (verified: Niugan's top-right cell — 7 of 18 barangays have one).
// geoSnap.js still snaps cases to that cell, so instead of dropping them we
// re-home each case to the nearest cell the barangay actually has. Zone geometry
// is unchanged; only the assignment is, and the popup names the folded unit.
export function resolveZoneIdx(idx, availableIdx) {
  if (!availableIdx || availableIdx.has(idx)) return { idx, folded: false };
  const c = cellCentre(idx);
  let best = null, bestD = Infinity;
  availableIdx.forEach(a => {
    const ca = cellCentre(a);
    const d = (ca.x - c.x) ** 2 + (ca.y - c.y) ** 2;
    if (d < bestD) { bestD = d; best = a; }
  });
  return best == null ? { idx, folded: false } : { idx: best, folded: true };
}

// ── geometry: barangay outer rings ───────────────────────────────────────────
function outerRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates[0]];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map(poly => poly[0]);
  return [];
}

function boundingBox(rings) {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  rings.forEach(ring => ring.forEach(([lng, lat]) => {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }));
  return { minLng, maxLng, minLat, maxLat };
}

// Sutherland–Hodgman: the SUBJECT may be concave, the CLIP boundary must be a
// half-plane (convex) — which is exactly how we clip the barangay outline to a
// grid cell, so the result is correct for irregular barangays.
function clipToHalfPlane(ring, inside, intersect) {
  if (ring.length === 0) return [];
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i];
    const prev = ring[(i - 1 + ring.length) % ring.length];
    const curIn = inside(cur);
    const prevIn = inside(prev);
    if (curIn) {
      if (!prevIn) out.push(intersect(prev, cur));
      out.push(cur);
    } else if (prevIn) {
      out.push(intersect(prev, cur));
    }
  }
  return out;
}

const atLat = (lat) => ({
  inside: (p) => p[1] >= lat,
  intersect: (a, b) => {
    if (b[1] === a[1]) return [a[0], lat];
    const t = (lat - a[1]) / (b[1] - a[1]);
    return [a[0] + t * (b[0] - a[0]), lat];
  },
});
const atLatMax = (lat) => ({
  inside: (p) => p[1] <= lat,
  intersect: (a, b) => {
    if (b[1] === a[1]) return [a[0], lat];
    const t = (lat - a[1]) / (b[1] - a[1]);
    return [a[0] + t * (b[0] - a[0]), lat];
  },
});
const atLng = (lng) => ({
  inside: (p) => p[0] >= lng,
  intersect: (a, b) => {
    if (b[0] === a[0]) return [lng, a[1]];
    const t = (lng - a[0]) / (b[0] - a[0]);
    return [lng, a[1] + t * (b[1] - a[1])];
  },
});
const atLngMax = (lng) => ({
  inside: (p) => p[0] <= lng,
  intersect: (a, b) => {
    if (b[0] === a[0]) return [lng, a[1]];
    const t = (lng - a[0]) / (b[0] - a[0]);
    return [lng, a[1] + t * (b[1] - a[1])];
  },
});

function stripClosingDup(ring) {
  if (ring.length > 1) {
    const a = ring[0], b = ring[ring.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1);
  }
  return ring.slice();
}

function clipRingToCell(ring, minLng, maxLng, minLat, maxLat) {
  let r = stripClosingDup(ring);
  if (r.length < 3) return null;
  for (const boundary of [atLat(minLat), atLatMax(maxLat), atLng(minLng), atLngMax(maxLng)]) {
    r = clipToHalfPlane(r, boundary.inside, boundary.intersect);
    if (r.length < 3) return null;
  }
  return r;
}

function ringCentroid(ring) {
  if (!ring || ring.length === 0) return null;
  let x = 0, y = 0;
  ring.forEach(([lng, lat]) => { x += lng; y += lat; });
  return [y / ring.length, x / ring.length]; // [lat, lng] for Leaflet
}

// ── real purok boundaries (optional) ─────────────────────────────────────────
// A "purok area" is a boundary the City supplied: `{ name, rings }` with rings in
// GeoJSON [lng, lat] order. When a barangay has them, the 6-cell proxy grid is
// not used for that barangay at all — the zones ARE the real puroks.
const normUnitKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function purokNumber(s) {
  const m = /purok\s*(\d+)/i.exec(String(s || ''));
  return m ? m[1] : null;
}

// The idx of the purok a location unit names, in a REAL-purok zone set. Returns
// null when the zones are the proxy grid or the unit names no purok (Blk/Lot).
export function purokIdxForUnit(zones, unit) {
  if (!Array.isArray(zones) || zones.length === 0 || !zones[0].real) return null;
  const num = purokNumber(unit);
  if (num != null) {
    const byNum = zones.find(z => purokNumber(z.label) === num);
    if (byNum) return byNum.idx;
  }
  const u = normUnitKey(unit);
  if (!u) return null;
  const exact = zones.find(z => normUnitKey(z.label) === u);
  return exact ? exact.idx : null;
}

// Parse /api/purok-areas rows into { [barangay_name]: [{ id, name, source, rings }] }.
// The API returns `geometry` (already parsed); `geojson` is accepted as a fallback.
// `id`/`source` are carried through so the map can edit/delete a specific zone.
export function purokRowsToAreas(rows) {
  const out = {};
  (Array.isArray(rows) ? rows : []).forEach(row => {
    if (!row || !row.barangay_name) return;
    let geometry = row.geometry != null ? row.geometry : row.geojson;
    if (typeof geometry === 'string') {
      try { geometry = JSON.parse(geometry); } catch { return; }
    }
    const rings = outerRings(geometry);
    if (rings.length === 0) return;
    if (!out[row.barangay_name]) out[row.barangay_name] = [];
    const name = row.name || `Purok ${out[row.barangay_name].length + 1}`;
    out[row.barangay_name].push({ id: row.id != null ? row.id : null, name, source: row.source || 'import', rings });
  });
  return out;
}

// Even-odd point-in-ring, GeoJSON [lng, lat] ring.
export function pointInZones(lat, lng, rings) {
  for (const ring of rings) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

// The zone polygons of a barangay. When real purok boundaries are supplied they
// ARE the zones (idx = position, label = purok name). Otherwise the 6-cell grid:
// each bbox cell clipped to the barangay outline; cells that do not intersect the
// barangay are dropped.
export function zonesForBarangay(barangayName, feature, purokAreas = null) {
  if (Array.isArray(purokAreas) && purokAreas.length > 0) {
    return purokAreas
      .filter(a => a && a.name && Array.isArray(a.rings) && a.rings.length > 0)
      .map((a, i) => ({
        id: `${barangayName}|p${i}`,
        barangay: barangayName,
        idx: i,
        col: null,
        row: null,
        label: a.name,
        rings: a.rings,                       // GeoJSON [lng, lat] rings
        centroid: ringCentroid(a.rings[0]),   // [lat, lng]
        real: true,
      }));
  }

  const geometry = feature && feature.geometry;
  const rings = outerRings(geometry);
  if (rings.length === 0) return [];
  const { minLng, maxLng, minLat, maxLat } = boundingBox(rings);
  const w = maxLng - minLng;
  const h = maxLat - minLat;
  if (!(w > 0) || !(h > 0)) return [];

  const zones = [];
  for (let row = 0; row < ZONE_ROWS; row++) {
    for (let col = 0; col < ZONE_COLS; col++) {
      const idx = row * ZONE_COLS + col;
      const cellMinLng = minLng + col * (w / ZONE_COLS);
      const cellMaxLng = minLng + (col + 1) * (w / ZONE_COLS);
      const cellMinLat = minLat + row * (h / ZONE_ROWS);
      const cellMaxLat = minLat + (row + 1) * (h / ZONE_ROWS);
      const cellRings = [];
      rings.forEach(ring => {
        const clipped = clipRingToCell(ring, cellMinLng, cellMaxLng, cellMinLat, cellMaxLat);
        if (clipped) cellRings.push(clipped);
      });
      if (cellRings.length === 0) continue;
      zones.push({
        id: `${barangayName}|z${idx}`,
        barangay: barangayName,
        idx,
        col,
        row,
        label: zoneLabel(idx),
        rings: cellRings,          // GeoJSON [lng, lat] rings
        centroid: ringCentroid(cellRings[0]), // [lat, lng]
      });
    }
  }
  return zones;
}

// ── fine (sub-cell) geometry for close-up viewing ─────────────────────────────
// A unit's fallback sub-cell inside its coarse cell, used only when the unit has no
// usable coordinates. Stable per unit, so the box never jumps between renders.
export function subIdxForUnit(barangayName, unit, k = SUB_FALLBACK) {
  const cells = k * k;
  const m = /Purok\s+(\d+)/i.exec(unit || '');
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n)) return n % cells;
  }
  return Math.floor(seededRandom(`${barangayName}|${unit || 'C'}|_sub`) * cells);
}

// Which fine cell of the barangay-wide fine grid (ZONE_FINE_COLS x ZONE_FINE_ROWS
// over the barangay bbox) a point falls in. THIS is what places a close-up box on
// the actual block: hashing the unit NAME parked "Blk 4" at whatever cell the hash
// picked - often the top of its zone - while its cases sit somewhere else entirely.
export function fineCellForCoords(feature, lat, lng) {
  const rings = outerRings(feature && feature.geometry);
  if (rings.length === 0) return null;
  const { minLng, maxLng, minLat, maxLat } = boundingBox(rings);
  const w = maxLng - minLng;
  const h = maxLat - minLat;
  if (!(w > 0) || !(h > 0)) return null;
  const pLat = parseFloat(lat);
  const pLng = parseFloat(lng);
  if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) return null;
  const col = Math.min(ZONE_FINE_COLS - 1, Math.max(0, Math.floor(((pLng - minLng) / w) * ZONE_FINE_COLS)));
  const row = Math.min(ZONE_FINE_ROWS - 1, Math.max(0, Math.floor(((pLat - minLat) / h) * ZONE_FINE_ROWS)));
  return { col, row, key: `${col}_${row}` };
}

// Clip a set of rings to one lat/lng rectangle, dropping any that lose all their
// land (a concave barangay can leave a cell with no land at all).
function clipRingsToRect(sourceRings, minLng, maxLng, minLat, maxLat) {
  const out = [];
  sourceRings.forEach(r => {
    const clipped = clipRingToCell(r, minLng, maxLng, minLat, maxLat);
    if (clipped) out.push(clipped);
  });
  return out;
}

// The deterministic fallback box for a coordless unit: its sub-cell inside the
// parent coarse cell (barangay outline clipped to that sub-cell).
function fallbackCellRings(rings, barangayName, unit, zoneBox) {
  const s = subIdxForUnit(barangayName, unit, SUB_FALLBACK);
  const sc = s % SUB_FALLBACK;
  const sr = Math.floor(s / SUB_FALLBACK);
  const cw = (zoneBox.maxLng - zoneBox.minLng) / SUB_FALLBACK;
  const ch = (zoneBox.maxLat - zoneBox.minLat) / SUB_FALLBACK;
  const minLng = zoneBox.minLng + sc * cw;
  const minLat = zoneBox.minLat + sr * ch;
  return clipRingsToRect(rings, minLng, minLng + cw, minLat, minLat + ch);
}

// The small shaded boxes for one flagged coarse-grid row: one per fine cell that
// actually holds cases, so a Blk 4 cluster reads as a small box ON Blk 4 and the
// other blocks inside the zone stay unshaded. Units sharing a fine cell are MERGED
// into one box (its label lists them all). Boxes are clipped to the barangay
// outline AND to the parent coarse cell, so a box can never bleed into a
// neighbouring zone. Real-purok rows return [] (the City's polygon is already the
// right shape and size, so there is nothing to subdivide).
export function subCellsForZone(row, feature) {
  if (!row || row.real || row.col == null || row.row == null) return [];
  const rings = outerRings(feature && feature.geometry);
  if (rings.length === 0) return [];
  const { minLng, maxLng, minLat, maxLat } = boundingBox(rings);
  const w = maxLng - minLng;
  const h = maxLat - minLat;
  if (!(w > 0) || !(h > 0)) return [];

  // The parent coarse cell, so a box can never bleed into a neighbouring zone.
  const czw = w / ZONE_COLS;
  const czh = h / ZONE_ROWS;
  const zoneBox = {
    minLng: minLng + row.col * czw, maxLng: minLng + (row.col + 1) * czw,
    minLat: minLat + row.row * czh, maxLat: minLat + (row.row + 1) * czh,
  };

  // Group the zone's units by the fine cell that holds their case coordinates.
  const buckets = new Map();   // cell key -> { col, row, units: [], cases7, coordless }
  (row.breakdown || []).forEach(b => {
    if (!(b.cases7 > 0)) return;
    const cell = b.coords ? fineCellForCoords(feature, b.coords[0], b.coords[1]) : null;
    const key = cell ? `c${cell.key}` : `f${subIdxForUnit(row.barangay, b.unit, SUB_FALLBACK)}`;
    if (!buckets.has(key)) buckets.set(key, { cell, coordless: !cell, units: [], cases7: 0 });
    const g = buckets.get(key);
    g.units.push(b.unit);
    g.cases7 += b.cases7;
  });

  const cw = w / ZONE_FINE_COLS;
  const ch = h / ZONE_FINE_ROWS;
  const out = [];
  buckets.forEach((g, key) => {
    let boxRings = [];
    if (g.cell) {
      const cMinLng = minLng + g.cell.col * cw;
      const cMinLat = minLat + g.cell.row * ch;
      boxRings = clipRingsToRect(rings, cMinLng, cMinLng + cw, cMinLat, cMinLat + ch);
      // Keep the box inside its own coarse zone (a few old seeded rows carry
      // coordinates that disagree with the zone their unit name resolves to).
      boxRings = clipRingsToRect(boxRings, zoneBox.minLng, zoneBox.maxLng, zoneBox.minLat, zoneBox.maxLat);
    }
    if (boxRings.length === 0) {
      // No coordinates, or the clip came out empty: fall back to the unit's
      // deterministic spot inside its own zone cell so it stays visible.
      boxRings = fallbackCellRings(rings, row.barangay, g.units[0], zoneBox);
    }
    if (boxRings.length === 0) return;
    out.push({
      id: `${row.id}|${key}`,
      unit: g.units.join(' · '),
      units: g.units,
      cases7: g.cases7,
      coordless: g.coordless,
      rings: boxRings,
    });
  });
  return out;
}

// ── season helpers ───────────────────────────────────────────────────────────
// PAGASA: Rainy (Tag-ulan) Jun–Nov, Summer/Hot-dry (Tag-init) Mar–May,
// Cool dry (Tag-lamig) Dec–Feb.
export function phSeason(monthIndex) {
  if (monthIndex >= 5 && monthIndex <= 10) return 'rainy';
  if (monthIndex >= 2 && monthIndex <= 4) return 'summer';
  return 'cooldry';
}
function seasonWeights(disease, season) {
  if (season === 'rainy') return RAINY_SEASON_DISEASES.includes(disease);
  if (season === 'summer') return SUMMER_SEASON_DISEASES.includes(disease);
  return false;
}

// ── detection ────────────────────────────────────────────────────────────────
const dayMs = 86400000;

function toDay(v) {
  const s = String(v || '').slice(0, 10);
  if (!s) return null;
  const t = Date.parse(s + 'T00:00:00');
  return Number.isFinite(t) ? t : null;
}

// Build the zone hotspot rows for ONE barangay.
//
// options = {
//   cases: [{ disease_name, date_reported, address }],
//   feature,                 // barangay GeoJSON feature
//   extractUnit,             // (address) => unit | null
//   rainfall: { rain24, rain72 },  // barangay-level (mm); may be null
//   zoneRainfall,            // optional Map(idx -> { rain24, rain72 }), zone-specific
//   purokAreas,              // optional [{ name, rings }] real boundaries for this barangay
//   floodPins: [{ latitude, longitude, event_type, purok }],  // active pins only
//   thresholds,              // a ZONE_PRESETS entry; defaults to `standard`
//   waterOpts,               // CHO buffer overrides for the water driver (or null)
//   now: Date,               // optional, for tests
// }
export function buildZoneHotspots({
  barangayName, cases = [], feature, extractUnit, rainfall = null, floodPins = [], monthIndex,
  thresholds = ZONE_PRESETS.standard, purokAreas = null, zoneRainfall = null,
  waterOpts = null,
}) {
  const th = thresholds || ZONE_PRESETS.standard;
  const zones = zonesForBarangay(barangayName, feature, purokAreas);
  if (zones.length === 0) return [];

  const now = Date.now();
  const day = toDay(new Date(now).toISOString());
  const winStart = day - (ZONE_WINDOW_DAYS - 1) * dayMs;
  const prevStart = winStart - ZONE_WINDOW_DAYS * dayMs;
  const month = monthIndex != null ? monthIndex : new Date(now).getMonth();
  const season = phSeason(month);

  const rain24 = rainfall && Number.isFinite(rainfall.rain24) ? rainfall.rain24 : null;
  const rain72 = rainfall && Number.isFinite(rainfall.rain72) ? rainfall.rain72 : null;
  const rainGate = (rain24 != null && rain24 >= th.rain24) || (rain72 != null && rain72 >= th.rain72);

  // Per-zone rainfall, when the client could compute one (it knows the sub-barangay
  // cell / real purok centroid). Falls back to null so the barangay reading applies.
  const zoneRainFor = (idx) => {
    if (!zoneRainfall) return null;
    const rec = typeof zoneRainfall.get === 'function' ? zoneRainfall.get(idx) : zoneRainfall[idx];
    if (!rec) return null;
    const r24 = Number.isFinite(rec.rain24) ? rec.rain24 : null;
    const r72 = Number.isFinite(rec.rain72) ? rec.rain72 : null;
    return (r24 == null && r72 == null) ? null : { rain24: r24, rain72: r72 };
  };

  // Bucket cases: zoneIdx -> disease -> { cur, prev }. With the proxy grid, cases
  // whose snapped cell has no barangay land are re-homed to the nearest real cell
  // instead of being silently dropped (see resolveZoneIdx). With REAL purok
  // boundaries the unit text is matched to a purok name first ("Purok 3" -> the
  // "Purok 3" polygon); a unit that names no purok (Blk/Lot/Phase) falls back to a
  // deterministic purok so it stays visible and stable.
  const availableIdx = new Set(zones.map(z => z.idx));
  const realZones = !!(zones[0] && zones[0].real);
  const matchPurok = (unit) => purokIdxForUnit(zones, unit);
  // Real (imported or hand-drawn) zones resolve NAME FIRST, then LOCATION: a case
  // whose address names the zone ("Purok 3", or a drawn zone the CHO called
  // "Blk 4") goes there; a case that names no zone is placed by whether its own
  // map point falls inside a zone polygon (the same fallback the flood pins use);
  // only then does it fall back to a deterministic zone so it stays visible.
  const resolveUnit = (unit, caseRec) => {
    if (!realZones) return resolveZoneIdx(zoneIndexForUnit(barangayName, unit), availableIdx);
    const hit = matchPurok(unit);
    if (hit != null) return { idx: hit, folded: false };
    const lat = caseRec ? parseFloat(caseRec.latitude) : NaN;
    const lng = caseRec ? parseFloat(caseRec.longitude) : NaN;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const inside = zones.find(z => pointInZones(lat, lng, z.rings));
      if (inside) return { idx: inside.idx, folded: false };
    }
    const h = Math.floor(seededRandom(`${barangayName}|${unit || 'C'}|_purok`) * zones.length);
    return { idx: zones[h].idx, folded: false };
  };
  const foldedIdx = new Map();   // resolved idx -> Set(original idx that folded in)
  const buckets = new Map();
  const unitsByZone = new Map();
  const unitStats = new Map();   // resolved idx -> Map(unit -> { lat/lng sums, byDisease })
  // Rapid-rise window (subset of the 7-day window): idx -> disease -> { recent, prior }.
  const rapidStart = day - (RAPID_WINDOW_DAYS - 1) * dayMs;
  const rapidPrevStart = rapidStart - RAPID_WINDOW_DAYS * dayMs;
  const rapidBuckets = new Map();
  cases.forEach(c => {
    const unit = extractUnit ? extractUnit(c.address) : null;
    const raw = realZones ? null : zoneIndexForUnit(barangayName, unit);
    const { idx, folded } = resolveUnit(unit, c);
    if (!availableIdx.has(idx)) return;
    if (folded) {
      if (!foldedIdx.has(idx)) foldedIdx.set(idx, new Set());
      foldedIdx.get(idx).add(raw);
    }
    const label = unit || 'Unspecified';
    if (!unitsByZone.has(idx)) unitsByZone.set(idx, new Set());
    unitsByZone.get(idx).add(label);
    if (!unitStats.has(idx)) unitStats.set(idx, new Map());
    const uMap = unitStats.get(idx);
    if (!uMap.has(label)) uMap.set(label, { unit: label, latSum: 0, lngSum: 0, coordCount: 0, byDisease: new Map() });
    const u = uMap.get(label);
    const lat = parseFloat(c.latitude), lng = parseFloat(c.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) { u.latSum += lat; u.lngSum += lng; u.coordCount += 1; }
    const t = toDay(c.date_reported) ?? toDay(c.created_at);
    if (t == null) return;
    const d = c.disease_name || 'Unknown';
    if (!buckets.has(idx)) buckets.set(idx, {});
    const slot = buckets.get(idx);
    if (!slot[d]) slot[d] = { cur: 0, prev: 0 };
    if (t >= winStart) {
      slot[d].cur += 1;
      u.byDisease.set(d, (u.byDisease.get(d) || 0) + 1);
    } else if (t >= prevStart) slot[d].prev += 1;
    // Rapid window: the last 5 days vs the 5 before (drives the `rapid` flag).
    if (t >= rapidPrevStart) {
      if (!rapidBuckets.has(idx)) rapidBuckets.set(idx, {});
      const rb = rapidBuckets.get(idx);
      if (!rb[d]) rb[d] = { recent: 0, prior: 0 };
      if (t >= rapidStart) rb[d].recent += 1;
      else rb[d].prior += 1;
    }
  });

  // Which zones an active flood/rain pin sits in. The pin's own location text is
  // resolved with the SAME mapping the cases use (extractUnit -> purok name / cell),
  // so a pin tagged "Blk 8 Lot 8" lands in the same zone as the cases carrying that
  // address. A pin's real coordinates are the fallback when the text names no unit.
  const floodZoneIdx = new Set();
  const floodReasons = new Map();
  const floodTypes = new Map();
  (floodPins || []).forEach(pin => {
    let hit = null;
    const pinUnit = (extractUnit && pin.purok) ? extractUnit(pin.purok) : null;
    if (pinUnit) hit = realZones ? matchPurok(pinUnit)
      : resolveZoneIdx(zoneIndexForUnit(barangayName, pinUnit), availableIdx).idx;
    if (hit == null) {
      const lat = parseFloat(pin.latitude);
      const lng = parseFloat(pin.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const zone = zones.find(z => pointInZones(lat, lng, z.rings));
        if (zone) hit = zone.idx;
      }
    }
    if (hit == null) return;
    floodZoneIdx.add(hit);
    if (!floodReasons.has(hit)) floodReasons.set(hit, []);
    floodReasons.get(hit).push(`${pin.event_type || 'Flood'}${pin.purok ? ` · ${pin.purok}` : ''}`);
    if (!floodTypes.has(hit)) floodTypes.set(hit, new Set());
    floodTypes.get(hit).add(pin.event_type || 'Flood');
  });

  const rows = [];
  zones.forEach(zone => {
    const slot = buckets.get(zone.idx) || {};
    const qualifying = [];
    const near = [];   // below the hotspot gate, at/above watchMin
    Object.entries(slot).forEach(([disease, { cur, prev }]) => {
      const surge = cur >= th.surgeMin && cur >= th.surgeRatio * prev;
      const caseGate = cur >= th.caseMin || surge;
      if (caseGate) qualifying.push({ disease, cases7: cur, prev7: prev, surge });
      else if (cur >= th.watchMin) near.push({ disease, cases7: cur, prev7: prev, surge: false });
    });
    qualifying.sort((a, b) => b.cases7 - a.cases7);
    near.sort((a, b) => b.cases7 - a.cases7);

    // Rapid-rise detection for this zone (same rule the server uses per barangay:
    // 5+ cases in 5 days at 1.5x the 5 days before). A rapid zone is a real case
    // hotspot, so a disease sitting only in `near` is promoted into `qualifying`.
    const rb = rapidBuckets.get(zone.idx) || {};
    const rapidDiseases = Object.entries(rb)
      .filter(([, v]) => v.recent >= RAPID_MIN_CASES && (v.prior === 0 || v.recent >= RAPID_RATIO * v.prior))
      .map(([disease, v]) => ({ disease, cases5: v.recent, prev5: v.prior }))
      .sort((a, b) => b.cases5 - a.cases5);
    rapidDiseases.forEach(rd => {
      const q = qualifying.find(x => x.disease === rd.disease);
      if (q) { q.rapid = true; q.cases5 = rd.cases5; q.prev5 = rd.prev5; return; }
      const i = near.findIndex(x => x.disease === rd.disease);
      if (i >= 0) {
        const n = near[i];
        near.splice(i, 1);
        qualifying.push({ ...n, surge: true, rapid: true, cases5: rd.cases5, prev5: rd.prev5 });
        return;
      }
      // Defensive: neither the case gate nor the watch gate listed it (only possible
      // if the presets are retuned). A rapid rise is a hotspot regardless, so keep it
      // rather than letting the `qualifying.length === 0` skip below hide the zone.
      qualifying.push({ disease: rd.disease, cases7: rd.cases5, prev7: rd.prev5, surge: true, rapid: true, cases5: rd.cases5, prev5: rd.prev5 });
    });
    if (rapidDiseases.length) qualifying.sort((a, b) => b.cases7 - a.cases7);

    const flood = floodZoneIdx.has(zone.idx);
    // BLUE-ZONE driver, independent of cases. Water proximity comes from the bundled
    // OSM geometry (Laguna de Bay shoreline + large inland water bodies, >= 0.2 ha):
    // "if there's a big pond of water then it's blue". This driver IS spatial, so it
    // belongs at zone (address) level.
    //
    // Heat is deliberately NOT a zone driver: Open-Meteo reports temperature per
    // BARANGAY, so gating zones on it would turn every zone of a hot barangay blue at
    // once and the map would lose its signal. Heat flags the barangay instead (the
    // minimal blue disc), which is the tiering the leader described: minimal weather
    // level at the top, zonal detail once you reach the barangay addresses.
    const waterDetail = waterDriversForRings(zone.rings, waterOpts ? { opts: waterOpts } : undefined);
    const waterGate = !!waterDetail.blue;
    // Prefer the zone's OWN rain reading when the client supplied one — it sees the
    // sub-barangay cell, so it CAN discriminate between two cells and a rain-only
    // gate stands on its own. Otherwise fall back to the barangay reading, which
    // cannot discriminate, so a barangay-only rain gate needs at least one case in
    // the zone. A flood pin (placeable inside a specific zone) always counts.
    const zRain = zoneRainFor(zone.idx);
    const zoneHasCases = Object.values(slot).some(s => s.cur > 0);
    const zoneRainGate = zRain
      && ((zRain.rain24 != null && zRain.rain24 >= th.rain24) || (zRain.rain72 != null && zRain.rain72 >= th.rain72));
    const rainGateOn = zRain ? !!zoneRainGate : (rainGate && zoneHasCases);
    const rainReason = zRain || { rain24, rain72 };
    const rainSource = zRain ? 'zone' : ((rainGate && zoneHasCases) ? 'barangay' : null);
    const envGate = flood || rainGateOn || waterGate;
    const caseTotal7 = Object.values(slot).reduce((n, s) => n + s.cur, 0);

    if (!envGate && qualifying.length === 0 && near.length === 0) return;

    const top = qualifying[0] || near[0] || null;
    const seasonHit = top ? seasonWeights(top.disease, season) : false;
    const score = (caseTotal7 * 2)
      + (qualifying.some(q => q.surge) ? 1 : 0)
      + (rapidDiseases.length ? 1.5 : 0)
      + (envGate ? 1.5 : 0)
      + (seasonHit ? 1 : 0);

    let kind;
    if (qualifying.length === 0) kind = envGate ? 'exposure' : 'watch';
    else if (envGate) kind = 'weather';
    else kind = 'case';

    const envReasons = [];
    if (rainGateOn && rainReason.rain72 != null && rainReason.rain72 >= th.rain72) envReasons.push(`${Math.round(rainReason.rain72)} mm rain / 72h`);
    if (rainGateOn && rainReason.rain24 != null && rainReason.rain24 >= th.rain24) envReasons.push(`${Math.round(rainReason.rain24)} mm rain / 24h`);
    if (flood) envReasons.push(...(floodReasons.get(zone.idx) || ['Flood']).map(r => `flood pin · ${r}`));
    // Blue-zone reason: water (the leader's example). Heat is a barangay-level flag.
    if (waterGate) waterDetail.drivers.forEach(d => envReasons.push(waterDriverReason(d, waterDetail)));

    // Hazard types driving the exposure gate — the popup maps these to the
    // "Watch for" disease list. A rain-only gate stands in as 'Heavy Rain'.
    const hazardTypes = new Set(floodTypes.get(zone.idx) || []);
    if (rainGateOn) hazardTypes.add('Heavy Rain');

    // Per-location-unit breakdown inside the zone (which purok/blk has what),
    // with the mean coordinate of that unit's cases so the map can pin it.
    const uMap = unitStats.get(zone.idx) || new Map();
    const breakdown = [...uMap.values()].map(u => {
      const diseases = [...u.byDisease.entries()]
        .map(([disease, cur]) => ({ disease, cases7: cur }))
        .sort((a, b) => b.cases7 - a.cases7);
      return {
        unit: u.unit,
        cases7: diseases.reduce((n, d) => n + d.cases7, 0),
        diseases,
        coords: u.coordCount > 0 ? [u.latSum / u.coordCount, u.lngSum / u.coordCount] : null,
      };
    }).sort((a, b) => b.cases7 - a.cases7);

    const mergedIdx = [...(foldedIdx.get(zone.idx) || [])];

    rows.push({
      ...zone,
      kind,
      kindMeta: ZONE_KINDS[kind],
      score: Math.round(score * 10) / 10,
      disease: top ? top.disease : '',
      diseases: qualifying,
      near,
      cases7: caseTotal7,
      surge: qualifying.some(q => q.surge),
      rapid: rapidDiseases.length > 0,
      rapidDiseases,
      season,
      seasonHit,
      env: { rain24: rainReason.rain24, rain72: rainReason.rain72, flood, gate: envGate, reasons: envReasons, hazardTypes: [...hazardTypes], rainSource, water: waterDetail, waterGate },
      units: [...(unitsByZone.get(zone.idx) || [])],
      breakdown,
      merged: mergedIdx.length > 0,
      mergedIdx,
      // A `watch` zone is not a warning, so it carries no alert_kind and logging a
      // proactive intervention against it needs no mandatory remarks.
      alertKind: kind === 'watch' ? null
        : ZONE_ALERT_KIND[kind === 'exposure' ? 'exposure' : kind === 'weather' ? 'weather' : 'case'],
    });
  });

  return rows.sort((a, b) => b.score - a.score);
}

// GeoJSON FeatureCollection for the Leaflet layer (rings flipped to [lat, lng]).
export function zonesToFeatureCollection(rows) {
  const features = [];
  rows.forEach(row => {
    row.rings.forEach(ring => {
      features.push({
        type: 'Feature',
        properties: {
          zoneId: row.id, idx: row.idx, kind: row.kind, score: row.score,
          barangay: row.barangay, label: row.label,
        },
        geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] },
      });
    });
  });
  return { type: 'FeatureCollection', features };
}

export default { buildZoneHotspots, zonesForBarangay, zoneIndexForUnit, zonesToFeatureCollection, resolveZoneIdx, purokIdxForUnit, purokRowsToAreas, subCellsForZone, subIdxForUnit, fineCellForCoords, ZONE_PRESETS, ZONE_FINE_COLS, ZONE_FINE_ROWS, DEFAULT_ZONE_SENSITIVITY };
