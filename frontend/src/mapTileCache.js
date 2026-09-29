// Offline map tile pre-cache.
// Downloads tiles for a bounding box across zoom levels and writes them into the
// SAME Cache Storage caches the service worker uses (osm-tiles / esri-imagery-tiles),
// so the SW's CacheFirst handler serves them offline at any zoom inside the area.

const LAYER_CACHE = {
  osm: { name: 'osm-tiles', url: (z, x, y) => `https://${['a', 'b', 'c'][(x + y) % 3]}.tile.openstreetmap.org/${z}/${x}/${y}.png` },
  esri: { name: 'esri-imagery-tiles', url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}` },
};

const PER_ZOOM_CAP = 2500;
const TOTAL_CAP = 6000;
const CONCURRENCY = 6;

function tileX(lon, z) {
  return ((lon + 180) / 360) * 2 ** z;
}

function tileY(lat, z) {
  const rad = (Math.PI / 180) * lat;
  return (1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2 * 2 ** z;
}

// bounds = [[minLat, minLng], [maxLat, maxLng]] (south-west, north-east)
function tileList(bounds, minZoom, maxZoom) {
  const [[sLat, wLng], [nLat, eLng]] = bounds;
  const tiles = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const maxCoord = 2 ** z - 1;
    const clampN = (n) => Math.max(0, Math.min(maxCoord, Math.floor(n)));
    const x0 = clampN(tileX(wLng, z));
    const x1 = clampN(tileX(eLng, z));
    const y0 = clampN(tileY(nLat, z));
    const y1 = clampN(tileY(sLat, z));
    const count = (x1 - x0 + 1) * (y1 - y0 + 1);
    if (count > PER_ZOOM_CAP) continue;
    if (tiles.length + count > TOTAL_CAP) break;
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        tiles.push({ z, x, y });
      }
    }
  }
  return tiles;
}

// Pre-caches tiles for `layers` (array of 'osm' / 'esri').
// Reports progress via onProgress(done, total).
// Resolves to { total, succeeded } - callers can warn when nothing was cached.
export async function precacheTiles(bounds, minZoom, maxZoom, layers, onProgress) {
  if (typeof caches === 'undefined' || !navigator.onLine) {
    throw new Error('Offline tile caching is unavailable.');
  }
  const tiles = tileList(bounds, minZoom, maxZoom);
  const all = [];
  layers.forEach((layer) => tiles.forEach((t) => all.push({ ...t, layer })));
  let done = 0;
  let succeeded = 0;

  for (let i = 0; i < all.length; i += CONCURRENCY) {
    const batch = all.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (item) => {
      try {
        const spec = LAYER_CACHE[item.layer];
        if (!spec) return;
        const url = spec.url(item.z, item.x, item.y);
        const cache = await caches.open(spec.name);
        if (await cache.match(url)) {
          succeeded++;
          return;
        }
        const res = await fetch(url);
        if (!res.ok) return;
        const blob = await res.blob();
        await cache.put(url, new Response(blob, { headers: { 'Content-Type': 'image/png' } }));
        succeeded++;
      } catch (e) {
        // Skip individual tile failures (rate limits, timeouts, CORS, etc.)
      } finally {
        done++;
      }
    }));
    if (onProgress) onProgress(done, all.length);
  }
  return { total: all.length, succeeded };
}