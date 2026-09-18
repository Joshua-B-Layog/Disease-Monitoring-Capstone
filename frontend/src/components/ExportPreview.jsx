import React from 'react';

const actionBtnStyle = (primary) => ({
  padding: '9px 18px',
  background: primary ? '#1e3a8a' : '#e5e7eb',
  color: primary ? '#ffffff' : '#111827',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '600',
});

export default function ExportPreviewModal({ preview, onClose }) {
  if (!preview) return null;
  const isHtml = !!preview.html;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 20000, padding: '24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(1000px, 100%)', maxHeight: '92vh', background: '#fff',
          borderRadius: '12px', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc',
        }}>
          <strong style={{ fontSize: '16px', color: '#111827' }}>{preview.title}</strong>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#dc2626', fontSize: '15px', fontWeight: '600', padding: '4px 8px',
          }}>✕</button>
        </div>

        <div style={{
          padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: '10px',
          borderBottom: '1px solid #e5e7eb', background: '#f1f5f9',
        }}>
          {(preview.actions || []).map((a, i) => (
            <button key={i} onClick={a.onClick} style={actionBtnStyle(a.primary !== false)}>
              {a.label}
            </button>
          ))}
        </div>

        {isHtml ? (
          <iframe
            title="export-preview"
            srcDoc={preview.html}
            style={{ flex: 1, border: 'none', background: '#fff', minHeight: '420px' }}
          />
        ) : (
          <div style={{ flex: 1, overflow: 'auto', background: '#fff', padding: '16px 20px' }}>
            <div className="ep-preview-count" style={{ fontSize: '13px', color: '#6b7280', marginBottom: '10px' }}>
              {preview.rows.length} {preview.rows.length === 1 ? 'row' : 'rows'}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
              <thead>
                <tr>
                  {(preview.columns || []).map((col, i) => (
                    <th key={i} style={{
                      background: '#1e3a8a', color: '#fff', padding: '8px 10px',
                      textAlign: 'center', fontSize: '12px', border: '1px solid #1e3a8a', position: 'sticky', top: 0,
                    }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 50).map((row, r) => (
                  <tr key={r}>
                    {(preview.columns || []).map((_, c) => (
                      <td key={c} style={{
                        padding: '6px 10px', border: '1px solid #e5e7eb',
                        textAlign: 'center', fontSize: '12px', color: '#111827',
                      }}>{row[c]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 50 && (
              <div style={{ fontSize: '13px', color: '#6b7280', padding: '10px 0', textAlign: 'center' }}>
                + {preview.rows.length - 50} more (full dataset downloads)
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}