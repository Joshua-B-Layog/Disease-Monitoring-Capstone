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

  for (let attempt = 0; attempt < 60; attempt++) {
    const rx = seededRandom(seedKey + '#' + attempt);
    const ry = seededRandom(seedKey + '@' + attempt);
    const lng = minLng + rx * (maxLng - minLng);
    const lat = minLat + ry * (maxLat - minLat);
    if (pointInFeature(lng, lat, geometry)) {
      return [lat, lng];
    }
  }
  return null;
}

export default {};
