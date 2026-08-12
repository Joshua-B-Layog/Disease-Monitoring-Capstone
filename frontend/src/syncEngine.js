import { API_URL } from './config';
import db from './db';

let syncing = false;

export async function enqueueOperation(op) {
  await db.syncQueue.add({
    type: op.type,
    endpoint: op.endpoint,
    method: op.method || 'POST',
    payload: op.payload,
    timestamp: Date.now(),
    userId: op.userId || null,
    userName: op.userName || null,
    status: 'pending',
  });
}

export async function getPendingCount() {
  return await db.syncQueue.where('status').equals('pending').count();
}

export async function getAllQueueItems() {
  return await db.syncQueue.orderBy('id').toArray();
}

// Remove pending create ops for a temp-id case that was deleted before ever syncing
export async function removePendingCreatesByCaseId(caseId) {
  const ops = await getAllQueueItems();
  const toDelete = ops.filter(op =>
    op.status === 'pending' &&
    op.type === 'create' &&
    String(op.payload?.case_id) === String(caseId)
  );
  await Promise.all(toDelete.map(op => db.syncQueue.delete(op.id)));
}

export async function clearCompleted() {
  await db.syncQueue.where('status').equals('done').delete();
  await db.syncQueue.where('status').equals('error').delete();
}

export async function processSyncQueue(onProgress, onConflict) {
  if (syncing) return { synced: 0, failed: 0, conflicts: [] };
  syncing = true;

  const pending = await db.syncQueue.where('status').equals('pending').sortBy('id');
  let synced = 0;
  let failed = 0;
  const conflicts = [];

  for (const item of pending) {
    try {
      await db.syncQueue.update(item.id, { status: 'syncing' });
      if (onProgress) onProgress({ current: synced + failed + 1, total: pending.length, item });

      const headers = { 'Content-Type': 'application/json' };
      const fetchOpts = {
        method: item.method,
        headers,
        body: JSON.stringify({
          ...item.payload,
          _offlineTimestamp: item.timestamp,
          _offlineUserId: item.userId,
          _offlineUserName: item.userName,
        }),
      };

      const response = await fetch(`${API_URL}${item.endpoint}`, fetchOpts);

      if (response.ok) {
        const result = await response.json();
        await db.syncQueue.update(item.id, { status: 'done', result });
        synced++;

        if (result._conflict) {
          conflicts.push({ itemId: item.id, ...result._conflict });
          if (onConflict) onConflict(result._conflict);
        }

        if (result.newCaseId && item.type === 'create') {
          await db.cases.update(item.payload.case_id, { case_id: result.newCaseId });
        }
      } else {
        const err = await response.json().catch(() => ({ error: 'Sync failed' }));
        if (response.status === 409) {
          conflicts.push({ itemId: item.id, error: err.error || 'Conflict' });
          if (onConflict) onConflict(err);
          await db.syncQueue.update(item.id, { status: 'error', error: err.error });
          failed++;
        } else {
          await db.syncQueue.update(item.id, { status: 'error', error: err.error || 'Server error' });
          failed++;
        }
      }
    } catch (err) {
      await db.syncQueue.update(item.id, { status: 'error', error: err.message });
      failed++;
    }
  }

  syncing = false;
  return { synced, failed, conflicts };
}
