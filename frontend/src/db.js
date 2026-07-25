import Dexie from 'dexie';

const db = new Dexie('CabuyaoCDMS');

db.version(1).stores({
  cases: 'case_id, disease_name, barangay_name, status, date_reported',
  diseases: 'id, name',
  barangays: 'id, name',
  referenceData: 'key',
  syncQueue: '++id, type, timestamp, userId, status'
});

db.version(2).stores({
  cases: 'case_id, disease_name, barangay_name, status, date_reported',
  diseases: 'id, name',
  barangays: 'id, name',
  referenceData: 'key',
  syncQueue: '++id, type, endpoint, timestamp, userId, status'
}).upgrade(async (tx) => {
  // no data migration needed — syncQueue is ephemeral
});

export default db;
