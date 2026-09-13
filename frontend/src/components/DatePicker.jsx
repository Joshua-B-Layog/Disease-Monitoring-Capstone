import React, { useEffect, useRef, useState } from 'react';
import { formatDate } from '../formatDate';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const toISO = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export default function DatePicker({ value, onChange, dateFormat = 'MM/DD/YY', placeholder = 'Select date', style, clearable = true, disabled = false, error = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const today = new Date();
  const [viewYear, setViewYear] = useState(value ? new Date(value).getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(value ? new Date(value).getMonth() : today.getMonth());

  useEffect(() => {
    if (!open) return;
    const base = value ? new Date(value) : new Date();
    if (!isNaN(base.getTime())) {
      setViewYear(base.getFullYear());
      setViewMonth(base.getMonth());
    }
  }, [open]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const pick = (d) => { onChange(toISO(viewYear, viewMonth, d)); setOpen(false); };
  const isSelected = (d) => value === toISO(viewYear, viewMonth, d);
  const isToday = (d) => {
    const t = new Date();
    return t.getFullYear() === viewYear && t.getMonth() === viewMonth && t.getDate() === d;
  };
  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };
  const todayStr = toISO(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', ...style }}>
      <button type="button" disabled={disabled} onClick={() => { if (disabled) return; setOpen(o => !o); }}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between',
          padding: '7px 11px', borderRadius: '8px',
          border: error ? '2px solid #ef4444' : '1px solid var(--border-color)',
          background: error ? 'rgba(239,68,68,0.1)' : 'var(--input-bg)',
          color: value ? 'var(--text-main)' : 'var(--text-muted)',
          cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '15px', whiteSpace: 'nowrap',
          opacity: disabled ? 0.65 : 1,
        }}>
        <span style={{ flex: 1, textAlign: 'left' }}>{value ? formatDate(value, dateFormat) : placeholder}</span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: '264px', zIndex: 3000,
          background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.3)', padding: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <button type="button" onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', padding: '2px 8px', fontWeight: '600', lineHeight: 1 }}>{'<'}</button>
            <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', padding: '2px 8px', fontWeight: '600', lineHeight: 1 }}>{'>'}</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', padding: '2px' }}>{d}</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {cells.map((d, i) => {
              const sel = d && isSelected(d);
              const tday = d && isToday(d);
              return (
                <button key={i} type="button" disabled={!d} onClick={() => d && pick(d)}
                  style={{
                    height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', borderRadius: '6px', cursor: d ? 'pointer' : 'default', padding: 0,
                    background: sel ? '#0d9488' : 'transparent',
                    color: sel ? '#fff' : d ? 'var(--text-main)' : 'transparent',
                    border: tday && !sel ? '1px solid #0d9488' : 'none',
                    fontWeight: sel || tday ? '700' : '400',
                  }}>
                  {d || ''}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            {clearable && (
              <button type="button" onClick={() => { onChange(''); setOpen(false); }}
                style={{ flex: 1, padding: '6px 0', borderRadius: '6px', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', color: '#ef4444', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                Clear
              </button>
            )}
            <button type="button" onClick={() => { onChange(todayStr); setOpen(false); }}
              style={{ flex: 1, padding: '6px 0', borderRadius: '6px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}