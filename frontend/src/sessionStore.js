const SESSION_KEY = 'cdms_session';

// Session persistence rules (Phase 1 - opt-in "Stay signed in"):
//  - "Stay signed in" checked  → saved to localStorage (survives browser restart / new tabs)
//  - unchecked (default)       → saved to sessionStorage (dies with the tab; private/incognito windows never resume)
const storeByTarget = (persist) => (persist ? localStorage : sessionStorage);

export function persistSession(session) {
  clearSession();
  const store = storeByTarget(!!(session && session.persist));
  const copy = { ...(session || {}) };
  delete copy.persist;
  try { store.setItem(SESSION_KEY, JSON.stringify(copy)); } catch (e) { /* storage full/blocked - session just won't persist */ }
}

export function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return null;
}

export function updateSession(next) {
  const current = readSession() || {};
  let store = null;
  try { if (sessionStorage.getItem(SESSION_KEY)) store = sessionStorage; } catch (e) { /* ignore */ }
  if (!store) { try { if (localStorage.getItem(SESSION_KEY)) store = localStorage; } catch (e) { /* ignore */ } }
  if (!store) store = storeByTarget(current.persist);
  try { store.setItem(SESSION_KEY, JSON.stringify({ ...current, ...next })); } catch (e) { /* ignore */ }
}

export function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
}