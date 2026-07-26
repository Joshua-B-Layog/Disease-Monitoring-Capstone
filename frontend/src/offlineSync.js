import db from './db';

export function isOnline() {
  return navigator.onLine;
}

// ── Cases ──
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

// ── Diseases ──
export async function cacheDiseases(diseases) {
  if (!diseases || diseases.length === 0) return;
  try {
    await db.diseases.clear();
    await db.diseases.bulkPut(diseases);
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

// ── Barangays ──
export async function cacheBarangays(barangays) {
  if (!barangays || barangays.length === 0) return;
  try {
    await db.barangays.clear();
    await db.barangays.bulkPut(barangays);
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

// ── Combined reference data ──
export async function cacheReferenceData(diseases, barangays) {
  await cacheDiseases(diseases);
  await cacheBarangays(barangays);
}

// ── Users ──
export async function cacheUsers(users) {
  try {
    await db.users.clear();
    if (users && users.length > 0) {
      await db.users.bulkPut(users.map(u => ({
        ...u,
        user_id: u.id || u.user_id
      })));
    }
    await db.referenceData.put({ key: 'users_cached_at', value: Date.now() });
  } catch (err) {
    console.warn('[OfflineSync] Failed to cache users:', err.message);
  }
}

export async function getCachedUsers() {
  try {
    return await db.users.toArray();
  } catch {
    return [];
  }
}

export async function upsertCachedUser(user) {
  try {
    await db.users.put({ ...user, user_id: user.id || user.user_id });
  } catch (err) {
    console.warn('[OfflineSync] Failed to upsert user:', err.message);
  }
}

// ── Audit Logs ──
export async function cacheAuditLogs(logs) {
  try {
    await db.auditLogs.clear();
    if (logs && logs.length > 0) {
      await db.auditLogs.bulkPut(logs.map((l, i) => ({
        ...l,
        id: l.id || i + 1
      })));
    }
    await db.referenceData.put({ key: 'auditLogs_cached_at', value: Date.now() });
  } catch (err) {
    console.warn('[OfflineSync] Failed to cache audit logs:', err.message);
  }
}

export async function getCachedAuditLogs() {
  try {
    return await db.auditLogs.toArray();
  } catch {
    return [];
  }
}

// ── Generated Reports ──
export async function cacheGeneratedReports(reports) {
  try {
    await db.generatedReports.clear();
    if (reports && reports.length > 0) {
      await db.generatedReports.bulkPut(reports);
    }
    await db.referenceData.put({ key: 'generatedReports_cached_at', value: Date.now() });
  } catch (err) {
    console.warn('[OfflineSync] Failed to cache generated reports:', err.message);
  }
}

export async function getCachedGeneratedReports() {
  try {
    return await db.generatedReports.toArray();
  } catch {
    return [];
  }
}

// ── User Profile ──
export async function cacheUserProfile(userId, profile) {
  try {
    await db.userProfiles.put({ userId, ...profile });
    await db.referenceData.put({ key: `profile_${userId}_cached_at`, value: Date.now() });
  } catch (err) {
    console.warn('[OfflineSync] Failed to cache user profile:', err.message);
  }
}

export async function getCachedUserProfile(userId) {
  try {
    return await db.userProfiles.get(userId);
  } catch {
    return null;
  }
}

// ── Weekly Summary ──
export async function cacheWeeklySummary(key, data) {
  try {
    await db.weeklySummaries.put({ key, ...data });
  } catch (err) {
    console.warn('[OfflineSync] Failed to cache weekly summary:', err.message);
  }
}

export async function getCachedWeeklySummary(key) {
  try {
    return await db.weeklySummaries.get(key);
  } catch {
    return null;
  }
}

// ── Cache timestamp helper ──
export async function getLastCacheTime(key) {
  try {
    const entry = await db.referenceData.get(key);
    return entry ? entry.value : null;
  } catch {
    return null;
  }
}
