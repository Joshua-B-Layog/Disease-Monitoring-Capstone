function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
  return ((h >>> 0) % 1000000) / 1000000;
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
  if (geometry.type === 'Polygon') {
    return pointInRing(lng, lat, geometry.coordinates[0]);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some(poly => pointInRing(lng, lat, poly[0]));
  }
  return false;
}

function getBoundingBox(geometry) {
  let coords = [];
  if (geometry.type === 'Polygon') coords = geometry.coordinates[0];
  else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(poly => { coords = coords.concat(poly[0]); });
  }
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  coords.forEach(([lng, lat]) => {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
  return { minLng, maxLng, minLat, maxLat };
}

export function getPointInBarangay(geoJsonFeature, seedKey) {
  if (!geoJsonFeature || !geoJsonFeature.geometry) return null;
  const geometry = geoJsonFeature.geometry;
  const { minLng, maxLng, minLat, maxLat } = getBoundingBox(geometry);

  const w = maxLng - minLng;
  const h = maxLat - minLat;

  // Assign a grid cell (3 cols × 2 rows) so puroks spread horizontally and vertically
  let col, row;
  const purokMatch = seedKey.match(/Purok\s+(\d+)/);
  if (purokMatch) {
    const num = parseInt(purokMatch[1], 10);
    const mapping = { 1: [0,0], 2: [1,0], 3: [2,0], 4: [0,1], 5: [1,1] };
    if (mapping[num]) {
      col = mapping[num][0];
      row = mapping[num][1];
    } else {
      const i = Math.floor(seededRandom(seedKey + '_cell') * 6);
      col = i % 3;
      row = Math.floor(i / 3);
    }
  } else {
    const i = Math.floor(seededRandom(seedKey + '_cell') * 6);
    col = i % 3;
    row = Math.floor(i / 3);
  }

  // Cell boundaries
  const cellMinLng = minLng + col * (w / 3);
  const cellMaxLng = minLng + (col + 1) * (w / 3);
  const cellMinLat = minLat + row * (h / 2);
  const cellMaxLat = minLat + (row + 1) * (h / 2);

  const cellW = cellMaxLng - cellMinLng;
  const cellH = cellMaxLat - cellMinLat;
  const GRID = 16;

  // Systematic 16x16 scan of the cell with per-subcell dithering
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const dither = seededRandom(seedKey + '_d_' + gy + '_' + gx);
      const lng = cellMinLng + (gx + dither * 0.9) * cellW / GRID;
      const lat = cellMinLat + (gy + dither * 0.9) * cellH / GRID;
      if (pointInFeature(lng, lat, geometry)) {
        return [lat, lng];
      }
    }
  }

  // Fallback: full bbox 16x16 scan
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const dither = seededRandom(seedKey + '_fb_d_' + gy + '_' + gx);
      const lng = minLng + (gx + dither * 0.9) * w / GRID;
      const lat = minLat + (gy + dither * 0.9) * h / GRID;
      if (pointInFeature(lng, lat, geometry)) {
        return [lat, lng];
      }
    }
  }

  return null;
}

export default {};
