// frontend/src/components/Toast.jsx
// Minimal global toast system (no deps).
// Usage:
//   <ToastHost />              // mount once near app root (App.jsx)
//   notify('Saved successfully!', 'success');                  // success | error | info | warning
//   notify('Saved!', 'success', { x, y });                     // anchored near a button position
import { useState, useCallback, useEffect, useRef } from 'react';

const listeners = new Set();
let idCounter = 0;

export function notify(message, type = 'success', pos) {
  const id = ++idCounter;
  listeners.forEach((fn) => fn({ id, message, type, pos }));
  return id;
}

export function dismissToast(id) {
  listeners.forEach((fn) => fn(null, id));
}

const THEME = {
  success: { icon: '✅', bg: '#e9f8f0', border: '#129968', color: '#0b5c3f' },
  error:   { icon: '❌', bg: '#fdecec', border: '#ef4444', color: '#b91c1c' },
  info:    { icon: 'ℹ️', bg: '#ebf3fe', border: '#3b82f6', color: '#1d4ed8' },
  warning: { icon: '⚠️', bg: '#fef5e6', border: '#f59e0b', color: '#b45309' },
};

function ToastCard({ t, style }) {
  const th = THEME[t.type] || THEME.info;
  return (
    <div
      className="cdms-msg-in"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        background: th.bg, border: `1px solid ${th.border}`,
        borderRadius: '10px', padding: '12px 16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        color: th.color, fontSize: '15px', fontWeight: '600',
        lineHeight: '1.45', maxWidth: '340px',
        ...style,
      }}
    >
      <span style={{ fontSize: '17px', lineHeight: 1.2 }}>{th.icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{t.message}</span>
    </div>
  );
}

export function ToastHost({ duration = 2200 }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = (toast, dismissId) => {
      if (toast && toast.message) {
        setToasts((prev) => [...prev, toast]);
      }
      if (dismissId) remove(dismissId);
    };
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, [remove]);

  useAutoDismiss(toasts, remove, duration);

  const positioned = toasts.filter((t) => t.pos);
  const stacked = toasts.filter((t) => !t.pos);

  return (
    <>
      {/* Default stack, just below the top nav, for unpositioned toasts */}
      <div
        style={{
          position: 'fixed', top: 'calc(70px + 20px)', right: '24px', zIndex: 100000,
          display: 'flex', flexDirection: 'column', gap: '10px',
          pointerEvents: 'none', maxWidth: '380px',
        }}
      >
        {stacked.map((t) => (
          <div key={t.id} style={{ pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => remove(t.id)}>
            <ToastCard t={t} />
          </div>
        ))}
      </div>

      {/* Positioned toasts anchored near the triggering button */}
      {positioned.map((t) => {
        const anchorX = t.pos.x;
        const anchorY = t.pos.y;
        return (
          <div
            key={t.id}
            onClick={(e) => { e.stopPropagation(); remove(t.id); }}
            style={{
              position: 'fixed', zIndex: 100000,
              left: Math.max(8, anchorX - 360),
              top: Math.max(8, anchorY - 76),
              pointerEvents: 'auto', cursor: 'pointer',
            }}
          >
            <ToastCard t={t} />
          </div>
        );
      })}
    </>
  );
}

export function useAutoDismiss(toasts, remove, duration) {
  const scheduledRef = useRef({});
  useEffect(() => {
    toasts.forEach((t) => {
      if (scheduledRef.current[t.id]) return;
      scheduledRef.current[t.id] = setTimeout(() => {
        delete scheduledRef.current[t.id];
        remove(t.id);
      }, duration);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toasts, remove, duration]);
}
