const CHANNEL_NAME = 'cdms_2fa';
const STORAGE_KEY = 'cdms_2fa_rev';
let channel = null;

export function emitTwoFaChanged(userId, enabled) {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage({ type: 'twofa', userId, enabled: !!enabled });
    }
  } catch (e) { /* ignore */ }
  try {
    localStorage.setItem(STORAGE_KEY, `${Date.now()}:${enabled ? 1 : 0}`);
  } catch (e) { /* ignore */ }
}

export function onTwoFaChanged(userId, cb) {
  let ch = null;
  const handle = (enabled) => { try { cb(!!enabled); } catch (e) { /* ignore */ } };
  const readLocalValue = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && raw.indexOf(':') !== -1) {
        const parts = raw.split(':');
        if (parts.length === 2) handle(parts[1] === '1');
        return;
      }
    } catch (e) { /* ignore */ }
    handle(true);
  };
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      ch = new BroadcastChannel(CHANNEL_NAME);
      ch.onmessage = (e) => {
        if (e && e.data && e.data.type === 'twofa' && String(e.data.userId) === String(userId)) {
          handle(e.data.enabled);
        }
      };
    } catch (e) { ch = null; }
  }
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY && String((e.newValue || '')) !== String((e.oldValue || ''))) {
      readLocalValue();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    if (ch) { try { ch.close(); } catch (e) { /* ignore */ } }
    window.removeEventListener('storage', onStorage);
  };
}