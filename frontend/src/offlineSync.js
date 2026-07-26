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

// ── Inbox Items (Referrals) ──
export async function cacheInboxItems(items) {
  try {
    await db.inboxItems.clear();
    if (items && items.length > 0) {
      await db.inboxItems.bulkPut(items.map((item, i) => ({
        ...item,
        id: item.id || item.case_id || i + 1
      })));
    }
    await db.referenceData.put({ key: 'inboxItems_cached_at', value: Date.now() });
  } catch (err) {
    console.warn('[OfflineSync] Failed to cache inbox items:', err.message);
  }
}

export async function getCachedInboxItems() {
  try {
    return await db.inboxItems.toArray();
  } catch {
    return [];
  }
}

// ── Contact Messages ──
export async function cacheContactMessages(messages) {
  try {
    await db.contactMessages.clear();
    if (messages && messages.length > 0) {
      await db.contactMessages.bulkPut(messages.map(m => ({
        ...m,
        id: m.id || m.message_id
      })));
    }
    await db.referenceData.put({ key: 'contactMessages_cached_at', value: Date.now() });
  } catch (err) {
    console.warn('[OfflineSync] Failed to cache contact messages:', err.message);
  }
}

export async function getCachedContactMessages() {
  try {
    return await db.contactMessages.toArray();
  } catch {
    return [];
  }
}

// ── Edit Requests (CHO inbox + BHW my-requests) ──
export async function cacheEditRequests(requests) {
  try {
    await db.editRequests.clear();
    if (requests && requests.length > 0) {
      await db.editRequests.bulkPut(requests.map((r, i) => ({
        ...r,
        id: r.id || r.request_id || i + 1
      })));
    }
    await db.referenceData.put({ key: 'editRequests_cached_at', value: Date.now() });
  } catch (err) {
    console.warn('[OfflineSync] Failed to cache edit requests:', err.message);
  }
}

export async function getCachedEditRequests() {
  try {
    return await db.editRequests.toArray();
  } catch {
    return [];
  }
}

// ── Outbox Items ──
export async function cacheOutboxItems(items) {
  try {
    await db.outboxItems.clear();
    if (items && items.length > 0) {
      await db.outboxItems.bulkPut(items.map((item, i) => ({
        ...item,
        id: item.id || item.case_id || i + 1
      })));
    }
    await db.referenceData.put({ key: 'outboxItems_cached_at', value: Date.now() });
  } catch (err) {
    console.warn('[OfflineSync] Failed to cache outbox items:', err.message);
  }
}

export async function getCachedOutboxItems() {
  try {
    return await db.outboxItems.toArray();
  } catch {
    return [];
  }
}

// ── Pending Registrations ──
export async function cachePendingRegistrations(registrations) {
  try {
    await db.pendingRegistrations.clear();
    if (registrations && registrations.length > 0) {
      await db.pendingRegistrations.bulkPut(registrations.map((r, i) => ({
        ...r,
        id: r.id || r.user_id || i + 1
      })));
    }
    await db.referenceData.put({ key: 'pendingRegistrations_cached_at', value: Date.now() });
  } catch (err) {
    console.warn('[OfflineSync] Failed to cache pending registrations:', err.message);
  }
}

export async function getCachedPendingRegistrations() {
  try {
    return await db.pendingRegistrations.toArray();
  } catch {
    return [];
  }
}

// ── Notifications ──
export async function cacheNotifications(notifications) {
  try {
    await db.notifications.clear();
    if (notifications && notifications.length > 0) {
      await db.notifications.bulkPut(notifications.map(n => ({
        ...n,
        id: n.id || n.notification_id
      })));
    }
    await db.referenceData.put({ key: 'notifications_cached_at', value: Date.now() });
  } catch (err) {
    console.warn('[OfflineSync] Failed to cache notifications:', err.message);
  }
}

export async function getCachedNotifications() {
  try {
    return await db.notifications.toArray();
  } catch {
    return [];
  }
}
