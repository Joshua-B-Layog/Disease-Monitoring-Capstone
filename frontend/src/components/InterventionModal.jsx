import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { useI18n } from '../i18n';
import DatePicker from './DatePicker';
import { ACTION_TYPES, ACTION_STATUSES, ACTION_TYPE_ICONS } from '../disasterRisk';
// Custom dropdown styling (.mc-custom-dropdown-btn/panel/item) lives with the
// Manage Cases sheet - same classes, same look, no native <select> anywhere.
import '../ManageCases.css';

// Shared field styles, hoisted so the dropdown below can use them too.
const fieldLabel = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' };

// The same custom dropdown used across Manage Cases, dropped into a label-style
// field: button + absolutely-positioned item panel, closed by an outside click.
const CustomDropdown = ({ label, value, display, options, onSelect, placeholder, disabled }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div style={fieldLabel}>
      <span>{label}</span>
      <div style={{ position: 'relative' }} ref={ref}>
        <button type="button" disabled={disabled} className="mc-custom-dropdown-btn"
          style={{
            width: '100%', fontSize: '14px', minWidth: 0,
            cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.85 : 1,
          }}
          onClick={() => { if (!disabled) setOpen(o => !o); }}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value ? (display || value) : placeholder}
          </span>
          {!disabled && (
            <span style={{ marginLeft: '6px', opacity: 0.6, transition: 'transform 0.2s', display: 'inline-block', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
          )}
        </button>
        {open && (
          <div className="mc-custom-dropdown-panel" style={{ maxWidth: '340px' }}>
            {options.map(o => (
              <div
                key={String(o.value)}
                className={`mc-custom-dropdown-item ${value === o.value ? 'mc-custom-dropdown-item--active' : ''}`}
                onClick={() => { onSelect(o.value); setOpen(false); }}>
                {o.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Log an intervention against a flagged disease count (e.g. "Dengue x 7 in Brgy.
// Niugan"). The remarks field is REQUIRED here and on the server: the panelist
// requirement is that an intervention (fogging / spraying / community cleaning)
// cannot be recorded without saying what was actually done.
//
// `context` carries the warning the intervention answers:
//   { barangay, barangay_id, disease, count, alert_id, alert_kind, kind_label }
// alert_id is only set for real epi_alerts rows; Dashboard-computed warnings
// (recurring hotspot, high active cases, surge) pass alert_kind instead.
const InterventionModal = ({ open, context, barangays = [], diseases = [], dateFormat, onClose, onSaved }) => {
  const { t, translateActionStatus } = useI18n();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ barangay_id: '', disease: '', action_type: 'Fogging', status: 'ongoing', date_started: today, date_ended: '' });
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  // Re-seed on every new warning so a half-typed remark never leaks across cards.
  useEffect(() => {
    if (!open) return;
    setForm({
      barangay_id: context?.barangay_id ? String(context.barangay_id) : '',
      disease: context?.disease || '',
      action_type: 'Fogging',
      status: 'Ongoing',
      date_started: today,
      date_ended: '',
    });
    setRemarks('');
    setSaving(false);
    setError('');
    setTouched(false);
  }, [open, context?.barangay, context?.disease, context?.alert_id, context?.alert_kind]);

  if (!open) return null;

  const lockedBarangay = !!context?.barangay_id;
  const lockedDisease = !!context?.disease;
  const remarksOk = remarks.trim().length > 0;

  const save = async () => {
    setTouched(true);
    if (!remarksOk) { setError(t('Remarks are required - describe the intervention performed.')); return; }
    if (!lockedBarangay && !form.barangay_id) { setError(t('Select the barangay this intervention was done in.')); return; }
    if (!lockedDisease && !form.disease) { setError(t('Select the disease this intervention responds to.')); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        barangay_id: lockedBarangay ? Number(context.barangay_id) : (form.barangay_id ? Number(form.barangay_id) : null),
        action_type: form.action_type,
        description: remarks.trim(),
        target_disease: lockedDisease ? context.disease : form.disease,
        date_started: form.date_started || null,
        date_ended: form.date_ended || null,
        status: form.status,
        epi_alert_id: context?.alert_id || null,
        alert_kind: context?.alert_kind || null,
      };
      const res = await axios.post(API_URL + '/api/barangay-actions', payload);
      if (onSaved) onSaved(res.data || payload);
    } catch (err) {
      const msg = err?.response?.data?.error;
      setError(msg || t('Could not save the intervention. Please try again.'));
      setSaving(false);
    }
  };

  const barangayNameOf = (id) => (barangays.find(b => String(b.id) === String(id)) || {}).name || '';

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 3200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', padding: '20px' }}
      onClick={onClose}>
      <div
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '24px', width: '560px', maxWidth: '95vw', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-main)' }}>🩺 {t('Log Intervention')}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              {t('Record the action taken on this disease warning so it is documented for the report.')}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '24px', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {/* The warning this intervention answers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', marginBottom: '16px', borderRadius: '9px', background: 'var(--warning-bg, rgba(217,119,6,0.15))', border: '1px solid var(--warning-border, #D97706)' }}>
          <span style={{ fontSize: '18px', lineHeight: 1 }}>⚠️</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>
              {context?.disease || t('Disease')}{context?.barangay ? ` · ${context.barangay}` : ''}{context?.count ? ` · ${context.count} ${context.count === 1 ? t('case') : t('cases')}` : ''}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {context?.kind_label ? `${t('Warning:')} ${context.kind_label}` : t('Warning-level disease count')}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <CustomDropdown
            label={t('Barangay')}
            value={lockedBarangay ? String(context.barangay_id) : form.barangay_id}
            display={lockedBarangay ? (context.barangay || t('Barangay')) : barangayNameOf(form.barangay_id)}
            placeholder={t('Select barangay')}
            disabled={lockedBarangay}
            options={(barangays || []).map(b => ({ value: String(b.id), label: b.name }))}
            onSelect={v => setForm({ ...form, barangay_id: v })}
          />
          <CustomDropdown
            label={t('Intervention')}
            value={form.action_type}
            display={`${ACTION_TYPE_ICONS[form.action_type] || ''} ${form.action_type}`.trim()}
            placeholder={t('Intervention')}
            options={ACTION_TYPES.map(x => ({ value: x, label: `${ACTION_TYPE_ICONS[x] || ''} ${x}`.trim() }))}
            onSelect={v => setForm({ ...form, action_type: v })}
          />
        </div>

        {!lockedDisease && (
          <div style={{ marginBottom: '10px' }}>
            <CustomDropdown
              label={t('Disease')}
              value={form.disease}
              placeholder={t('Select disease')}
              options={(diseases || []).map(d => ({ value: d, label: d }))}
              onSelect={v => setForm({ ...form, disease: v })}
            />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <CustomDropdown
            label={t('Status')}
            value={form.status}
            display={translateActionStatus(form.status)}
            options={ACTION_STATUSES.map(s => ({ value: s, label: translateActionStatus(s) }))}
            onSelect={v => setForm({ ...form, status: v })}
          />
          <label style={fieldLabel}>
            {t('Date started')}
            <DatePicker value={form.date_started} onChange={v => setForm({ ...form, date_started: v })} dateFormat={dateFormat} placeholder={t('Date')} />
          </label>
          <label style={fieldLabel}>
            {t('Date ended')}
            <DatePicker value={form.date_ended} onChange={v => setForm({ ...form, date_ended: v })} dateFormat={dateFormat} placeholder={t('Date')} clearable anchorRight={true} />
          </label>
        </div>

        {/* Label text + required marker must stay on ONE line: the old flex-column
            label turned the `*` into a second row of its own. */}
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '6px' }}>
          <span>{t('Remarks / Comments')}</span>
          <span style={{ color: '#DC2626' }}>*</span>
        </div>
        <textarea
          value={remarks}
          onChange={e => { setRemarks(e.target.value); if (error) setError(''); }}
          onBlur={() => setTouched(true)}
          rows={4}
          placeholder={t('Describe the intervention performed, e.g. Fogging of Purok 3 and 4, community clean-up drive at the barangay hall.')}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px',
            background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '14px', fontFamily: 'inherit',
            border: `1px solid ${touched && !remarksOk ? '#DC2626' : 'var(--border-color)'}`, outline: 'none', resize: 'vertical',
          }}
        />
        <div style={{ fontSize: '12px', marginTop: '5px', color: (touched && !remarksOk) ? '#DC2626' : 'var(--text-muted)' }}>
          {t('Remarks are required for an intervention on a disease warning.')}
        </div>

        {error && (
          <div style={{ marginTop: '10px', padding: '9px 12px', borderRadius: '8px', fontSize: '13px', color: '#DC2626', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.4)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: '8px', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
            {t('Cancel')}
          </button>
          <button onClick={save} disabled={saving}
            style={{
              padding: '10px 18px', borderRadius: '8px',
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontSize: '14px', fontWeight: '700',
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.75 : 1,
              transition: 'background 0.15s ease, opacity 0.15s ease',
            }}>
            {saving ? t('Saving…') : t('Save Intervention')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterventionModal;
