const CHANNEL_NAME = 'cdms_diseases';
const STORAGE_KEY = 'cdms_diseases_rev';
let channel = null;

export function emitDiseasesChanged() {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage({ type: 'diseases' });
    }
  } catch (e) { /* ignore */ }
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch (e) { /* ignore */ }
}

export function onDiseasesChanged(cb) {
  let ch = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      ch = new BroadcastChannel(CHANNEL_NAME);
      ch.onmessage = (e) => { if (e && e.data && e.data.type === 'diseases') cb(); };
    } catch (e) { ch = null; }
  }
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    if (ch) { try { ch.close(); } catch (e) { /* ignore */ } }
    window.removeEventListener('storage', onStorage);
  };
}
