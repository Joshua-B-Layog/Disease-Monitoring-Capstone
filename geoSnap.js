// geoSnap.js - server-side barangay polygon helpers.
// Reads the SAME choropleth GeoJSON used by the frontend maps
// (frontend/src/data/cabuyao_barangays.geojson.json) so a case's stored
// coordinates can be checked against - and, when they fall outside -
// snapped back into - their assigned barangay's geographic boundary.
// Port of the point-in-polygon + in-polygon point scan from
// frontend/src/data/coordinates.js so the backend mirrors the map math.
const fs = require('fs');
const path = require('path');

let GEOJSON = null;

const GEOJSON_TO_DB = {
  'Baclaran': 'Baclaran',
  'Banaybanay': 'Banay-Banay',
  'Banlic': 'Banlic',
  'Butong': 'Butong',
  'Bigaa': 'Bigaa',
  'Casile': 'Casile',
  'Gulod': 'Gulod',
  'Mamatid': 'Mamatid',
  'Marinig': 'Marinig',
  'Niugan': 'Niugan',
  'Pittland': 'Pittland',
  'Pulo': 'Pulo',
  'Sala': 'Sala',
  'San Isidro': 'San Isidro',
  'Diezmo': 'Diezmo',
  'Barangay Uno (Pob.)': 'Barangay Uno (Poblacion)',
  'Barangay Dos (Pob.)': 'Barangay Dos (Poblacion)',
  'Barangay Tres (Pob.)': 'Barangay Tres (Poblacion)',
};
const DB_TO_GEOJSON = {};
Object.entries(GEOJSON_TO_DB).forEach(([adm, db]) => { DB_TO_GEOJSON[db] = adm; });

function loadPolygons() {
  if (GEOJSON) return GEOJSON;
  try {
    const p = path.join(__dirname, 'frontend', 'src', 'data', 'cabuyao_barangays.geojson.json');
    GEOJSON = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log(`geoSnap: loaded ${GEOJSON.features ? GEOJSON.features.length : 0} barangay polygon(s).`);
  } catch (err) {
    GEOJSON = null;
    console.warn('geoSnap: GeoJSON not found; case location clamping / re-snap disabled.', err.message);
  }
  return GEOJSON;
}

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInFeature(lng, lat, geometry) {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') return pointInRing(lng, lat, geometry.coordinates[0]);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some(poly => pointInRing(lng, lat, poly[0]));
  return false;
}

function getBoundingBox(geometry) {
  let coords = [];
  if (geometry.type === 'Polygon') coords = geometry.coordinates[0];
  else if (geometry.type === 'MultiPolygon') geometry.coordinates.forEach(poly => { coords = coords.concat(poly[0]); });
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  coords.forEach(([lng, lat]) => {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
  return { minLng, maxLng, minLat, maxLat };
}

function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
  return ((h >>> 0) % 1000000) / 1000000;
}

function getPointInBarangay(geometry, seedKey) {
  if (!geometry) return null;
  const { minLng, maxLng, minLat, maxLat } = getBoundingBox(geometry);
  if (seedKey === 'Niugan|Mabitac Phase 1' || seedKey === 'Niugan|Phase 1') return [14.2602, 121.1283];
  if (seedKey === 'Niugan|Mabitac Phase 2' || seedKey === 'Niugan|Phase 2') return [14.2613, 121.1285];
  const w = maxLng - minLng;
  const h = maxLat - minLat;
  let col, row;
  const purokMatch = seedKey.match(/Purok\s+(\d+)/);
  if (purokMatch) {
    const num = parseInt(purokMatch[1], 10);
    const mapping = { 1: [0, 0], 2: [1, 0], 3: [2, 0], 4: [0, 1], 5: [1, 1] };
    if (mapping[num]) { col = mapping[num][0]; row = mapping[num][1]; }
    else { const i = Math.floor(seededRandom(seedKey + '_cell') * 6); col = i % 3; row = Math.floor(i / 3); }
  } else {
    const i = Math.floor(seededRandom(seedKey + '_cell') * 6);
    col = i % 3;
    row = Math.floor(i / 3);
  }
  const cellMinLng = minLng + col * (w / 3);
  const cellMaxLng = minLng + (col + 1) * (w / 3);
  const cellMinLat = minLat + row * (h / 2);
  const cellMaxLat = minLat + (row + 1) * (h / 2);
  const cellW = cellMaxLng - cellMinLng;
  const cellH = cellMaxLat - cellMinLat;
  const GRID = 16;
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const dither = seededRandom(seedKey + '_d_' + gy + '_' + gx);
      const lng = cellMinLng + (gx + dither * 0.9) * cellW / GRID;
      const lat = cellMinLat + (gy + dither * 0.9) * cellH / GRID;
      if (pointInFeature(lng, lat, geometry)) return [lat, lng];
    }
  }
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const dither = seededRandom(seedKey + '_fb_d_' + gy + '_' + gx);
      const lng = minLng + (gx + dither * 0.9) * w / GRID;
      const lat = minLat + (gy + dither * 0.9) * h / GRID;
      if (pointInFeature(lng, lat, geometry)) return [lat, lng];
    }
  }
  return null;
}

// Parse a Purok/Blk/Lot/Phase/Subdivision unit from an address (same rules as
// the frontend), so spread seeds and display grouping stay consistent.
function extractLocationUnit(address) {
  if (!address) return null;
  const a = String(address).toUpperCase();
  const found = { blk: null, lot: null, phase: null, purok: null };

  const blkMatch = a.match(/\bBLOCK\s*(\d+[A-Z]?)\b/)
    || a.match(/\bBLK\.?\s*(\d+[A-Z]?)\b/)
    || a.match(/\bB\.?\s*(\d+[A-Z]?)(?=\s|,|$|[A-Z])/);
  if (blkMatch) found.blk = blkMatch[1];

  const lotMatch = a.match(/\bLOT\.?\s*(\d+[A-Z]?)\b/)
    || a.match(/\bL\.?\s*(\d+[A-Z]?)(?=\s|,|$|[A-Z])/);
  if (lotMatch) found.lot = lotMatch[1];

  const mabitacMatch = a.match(/\bMABITAC\s+PHASE\s*(\d+)\b/);
  if (mabitacMatch) return `Mabitac Phase ${mabitacMatch[1]}`;

  const phaseMatch = a.match(/\bPHASE\s*(\d+)\b/)
    || a.match(/\bPH\.?\s*(\d+)\b/);
  if (phaseMatch) found.phase = phaseMatch[1];

  const purokMatch = a.match(/\bPUROK\s*(\d+)\b/)
    || a.match(/\bPRK\.?\s*(\d+)\b/);
  if (purokMatch) found.purok = purokMatch[1];

  const hasExplicitWord = /\b(BLK|BLOCK|LOT|PHASE|PH\.|PUROK|PRK)\b/.test(a);
  if (!hasExplicitWord && !found.phase && !found.purok) {
    const bareCount = (found.blk ? 1 : 0) + (found.lot ? 1 : 0);
    if (bareCount < 2) return null;
  }

  const parts = [];
  if (found.phase) parts.push(`Phase ${found.phase}`);
  if (found.blk) parts.push(`Blk ${found.blk}`);
  if (found.lot) parts.push(`Lot ${found.lot}`);
  if (found.purok) parts.push(`Purok ${found.purok}`);
  if (parts.length > 0) return parts.join(' ');

  const knownSubds = ['SOUTHVILLE 1A', 'SOUTHVILLE 1B', 'SOUTHVILLE 2', 'SOUTHVILLE 3'];
  for (const subd of knownSubds) {
    if (a.includes(subd)) return subd;
  }
  return null;
}

// Deterministic scattered in-polygon point. The grid CELL is chosen from
// `unitSeed` only (stable per barangay|unit, so same-unit cases cluster in one
// area), while the dither that positions the point inside the scanned grid is
// seeded by `jitterSeed` (varies per case, so members of the same unit still
// land apart from each other). Returns [lat, lng] or null.
function spreadPointInBarangay(geometry, unitSeed, jitterSeed) {
  if (!geometry) return null;
  const { minLng, maxLng, minLat, maxLat } = getBoundingBox(geometry);
  const w = maxLng - minLng;
  const h = maxLat - minLat;

  let col, row;
  const purokMatch = unitSeed.match(/Purok\s+(\d+)/);
  if (purokMatch) {
    const num = parseInt(purokMatch[1], 10);
    const mapping = { 1: [0, 0], 2: [1, 0], 3: [2, 0], 4: [0, 1], 5: [1, 1] };
    if (mapping[num]) { col = mapping[num][0]; row = mapping[num][1]; }
    else { const i = Math.floor(seededRandom(unitSeed + '_cell') * 6); col = i % 3; row = Math.floor(i / 3); }
  } else {
    const i = Math.floor(seededRandom(unitSeed + '_cell') * 6);
    col = i % 3;
    row = Math.floor(i / 3);
  }

  // Organic (non-lattice) patch per unit: nudge each cell corner by the unit seed
  // so neighbouring units don't line up on shared grid lines, then rejection-sample
  // pseudo-random in-polygon points. Same unit -> same patch (clusters together);
  // same case -> same point across runs; no straight-row artifacts.
  const nudge = (key) => (seededRandom(unitSeed + '_n_' + key) - 0.5) * 0.36;
  const cellMinLng = minLng + (col + 0.1 + nudge('x0')) * (w / 3);
  const cellMaxLng = minLng + (col + 0.9 + nudge('x1')) * (w / 3);
  const cellMinLat = minLat + (row + 0.1 + nudge('y0')) * (h / 2);
  const cellMaxLat = minLat + (row + 0.9 + nudge('y1')) * (h / 2);

  const sampleIn = (lng0, lat0, lng1, lat1, prefix) => {
    const ww = Math.max(lng1 - lng0, 0.00001);
    const hh = Math.max(lat1 - lat0, 0.00001);
    for (let k = 0; k < 40; k++) {
      const rx = seededRandom(jitterSeed + prefix + '_x_' + k);
      const ry = seededRandom(jitterSeed + prefix + '_y_' + k);
      const lng = lng0 + rx * ww;
      const lat = lat0 + ry * hh;
      if (pointInFeature(lng, lat, geometry)) return [lat, lng];
    }
    return null;
  };

  let p = sampleIn(cellMinLng, cellMinLat, cellMaxLng, cellMaxLat, '_p');
  if (p) return p;
  p = sampleIn(minLng, minLat, maxLng, maxLat, '_fb');
  if (p) return p;

  // Very last resort: fall back to the deterministic grid scan (always in-polygon).
  const GRID = 16;
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const dither = seededRandom(jitterSeed + '_g_' + gy + '_' + gx);
      const lng = minLng + (gx + dither * 0.9) * w / GRID;
      const lat = minLat + (gy + dither * 0.9) * h / GRID;
      if (pointInFeature(lng, lat, geometry)) return [lat, lng];
    }
  }
  return null;
}

function getFeatureForBarangay(barangayName) {
  if (!GEOJSON || !GEOJSON.features || !barangayName) return null;
  const adm = DB_TO_GEOJSON[barangayName];
  if (adm) {
    const f = GEOJSON.features.find(x => x.properties.ADM4_EN === adm);
    if (f) return f;
  }
  return GEOJSON.features.find(x => GEOJSON_TO_DB[x.properties.ADM4_EN] === barangayName) || null;
}

// Returns the raw polygon geometry for a barangay (DB name) or null.
function getGeometryForBarangay(barangayName) {
  const f = getFeatureForBarangay(barangayName);
  return f ? f.geometry : null;
}

// Parse a lat/lng value that may be a number or numeric string.
function parseCoord(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

// If (lat,lng) is a valid point inside the barangay's boundary, returns
// the coordinates unchanged. Otherwise returns an in-polygon point
// (deterministic per seedKey) - or null when the polygon is unavailable.
function snapToBarangay(lat, lng, barangayName, seedKey) {
  const geometry = getGeometryForBarangay(barangayName);
  if (!geometry) return null;
  const pLat = parseCoord(lat);
  const pLng = parseCoord(lng);
  if (pLat !== null && pLng !== null && pointInFeature(pLng, pLat, geometry)) return [pLat, pLng];
  const fallbackSeed = seedKey || (barangayName + '|C');
  const snapped = getPointInBarangay(geometry, fallbackSeed);
  if (snapped) return snapped;
  return null;
}

module.exports = {
  loadPolygons,
  pointInFeature,
  extractLocationUnit,
  getPointInBarangay,
  spreadPointInBarangay,
  getGeometryForBarangay,
  snapToBarangay,
  parseCoord,
};