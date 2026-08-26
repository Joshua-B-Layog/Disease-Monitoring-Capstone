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
  // syncQueue is ephemeral
});

db.version(3).stores({
  cases: 'case_id, disease_name, barangay_name, status, date_reported',
  diseases: 'id, name',
  barangays: 'id, name',
  referenceData: 'key',
  syncQueue: '++id, type, endpoint, timestamp, userId, status',
  users: 'user_id, username, role, barangay_name',
  auditLogs: '++id, action, entity_type, created_at',
  generatedReports: 'id, cho_unit, created_at',
  userProfiles: 'userId',
  weeklySummaries: 'key'
}).upgrade(async (tx) => {
  // new stores start empty
});

db.version(4).stores({
  cases: 'case_id, disease_name, barangay_name, status, date_reported',
  diseases: 'id, name',
  barangays: 'id, name',
  referenceData: 'key',
  syncQueue: '++id, type, endpoint, timestamp, userId, status',
  users: 'user_id, username, role, barangay_name',
  auditLogs: '++id, action, entity_type, created_at',
  generatedReports: 'id, cho_unit, created_at',
  userProfiles: 'userId',
  weeklySummaries: 'key',
  inboxItems: 'id, status, barangay_name',
  contactMessages: 'id, status, barangay',
  editRequests: 'id, status, requested_by',
  outboxItems: 'id, status, barangay_name',
  pendingRegistrations: 'id, status',
  notifications: 'id, is_read'
}).upgrade(async (tx) => {
  // new stores start empty
});

db.version(5).stores({
  cases: 'case_id, disease_name, barangay_name, status, date_reported',
  diseases: 'id, name',
  barangays: 'id, name',
  referenceData: 'key',
  syncQueue: '++id, type, endpoint, timestamp, userId, status',
  users: 'user_id, username, role, barangay_name',
  auditLogs: '++id, action, entity_type, created_at',
  generatedReports: 'id, cho_unit, created_at',
  userProfiles: 'userId',
  weeklySummaries: 'key',
  inboxItems: 'id, status, barangay_name',
  contactMessages: 'id, status, barangay',
  editRequests: 'id, status, requested_by',
  outboxItems: 'id, status, barangay_name',
  pendingRegistrations: 'id, status',
  notifications: 'id, is_read',
  syncHistory: '++id, type, timestamp, status'
}).upgrade(async (tx) => {
  // syncHistory store starts empty
});

export default db;
