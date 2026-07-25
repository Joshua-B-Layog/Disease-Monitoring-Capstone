import db from './db';

export function isOnline() {
  return navigator.onLine;
}

export async function cacheCases(cases) {
  try {
    await db.cases.clear();
    if (cases && cases.length > 0) {
      await db.cases.bulkPut(cases);
    }
    await db.referenceData.put({ key: 'cases_cached_at', value: Date.now() });
  } catch (err) {
    console.warn('[OfflineSync] Failed to cache cases:', err.message);
  }
}

export async function getCachedCases() {
  try {
    return await db.cases.toArray();
  } catch {
    return [];
  }
}

export async function cacheDiseases(diseases) {
  try {
    await db.diseases.clear();
    if (diseases && diseases.length > 0) {
      await db.diseases.bulkPut(diseases);
    }
    await db.referenceData.put({ key: 'diseases_cached_at', value: Date.now() });
  } catch (err) {
    console.warn('[OfflineSync] Failed to cache diseases:', err.message);
  }
}

export async function getCachedDiseases() {
  try {
    return await db.diseases.toArray();
  } catch {
    return [];
  }
}

export async function cacheBarangays(barangays) {
  try {
    await db.barangays.clear();
    if (barangays && barangays.length > 0) {
      await db.barangays.bulkPut(barangays);
    }
    await db.referenceData.put({ key: 'barangays_cached_at', value: Date.now() });
  } catch (err) {
    console.warn('[OfflineSync] Failed to cache barangays:', err.message);
  }
}

export async function getCachedBarangays() {
  try {
    return await db.barangays.toArray();
  } catch {
    return [];
  }
}

export async function cacheReferenceData(diseases, barangays) {
  await cacheDiseases(diseases);
  await cacheBarangays(barangays);
}

export async function getLastCacheTime(key) {
  try {
    const entry = await db.referenceData.get(key);
    return entry ? entry.value : null;
  } catch {
    return null;
  }
}
