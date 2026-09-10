const PERMISSION_ROWS = [
  { feature: 'View Dashboard & Stats', cho: true, bhw: true },
  { feature: 'View Disease Map', cho: true, bhw: true },
  { feature: 'View Audit Reports', cho: true, bhw: true },
  { feature: 'Add Disease Cases', cho: true, bhw: true },
  { feature: 'Add Case → Submit to CHO (approval required)', cho: false, bhw: true },
  { feature: 'Approve / Reject Add Requests', cho: true, bhw: false },
  { feature: 'Edit All Cases Directly', cho: true, bhw: false },
  { feature: 'Review Own Cases & Request CHO Edit', cho: true, bhw: true },
  { feature: 'Cross-Unit Referrals & Handle Inbox', cho: true, bhw: false },
  { feature: 'Manage User Accounts (approve/reject BHW)', cho: true, bhw: false },
  { feature: 'Generate Program Reports (PDF/Excel/CSV)', cho: true, bhw: true },
  { feature: 'Weekly Summary Report Cron (auto)', cho: true, bhw: true },
  { feature: 'Settings & Profile Management', cho: true, bhw: true },
  { feature: 'Offline Mode & Sync Queue', cho: true, bhw: true },
];

const YesIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" style={{ verticalAlign: 'middle' }}>
    <circle cx="12" cy="12" r="10" fill="#129968" opacity="0.18" />
    <path fill="#129968" d="M9.29 16.29a1 1 0 0 1-1.42 0l-4-4a1 1 0 0 1 1.42-1.42L9 14.17l8.29-8.3a1 1 0 0 1 1.42 1.42Z" />
  </svg>
);

const NoIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" style={{ verticalAlign: 'middle' }}>
    <circle cx="12" cy="12" r="10" fill="#dc2626" opacity="0.15" />
    <path fill="#dc2626" d="M15.54 8.46a1 1 0 0 1 0 1.42L13.41 12l2.13 2.12a1 1 0 1 1-1.42 1.42L12 13.41l-2.12 2.13a1 1 0 0 1-1.42-1.42L10.59 12 8.46 9.88a1 1 0 0 1 1.42-1.42L12 10.59l2.12-2.13a1 1 0 0 1 1.42 0Z" />
  </svg>
);

export default function RolesPermissions({ compactMode, loginRole = 'CHO', onBack }) {
  const isCho = loginRole === 'CHO';
  const roleLabel = isCho ? 'CHO Admin' : 'BHW Health Worker';
  const s = {
    card: { background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: compactMode ? '14px' : '26px' },
    label: { fontSize: '15px', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' },
  };

  return (
    <div style={{ padding: compactMode ? '14px' : '24px', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <div style={{ maxWidth: '980px', margin: '0 auto', width: '100%' }}>
        {isCho && (
          <button
            onClick={() => onBack && onBack()}
            style={{
              padding: '8px 18px', marginBottom: '16px', background: '#129968', color: '#fff',
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '600',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            ← Back to User Accounts
          </button>
        )}

        <div style={s.card}>
          <p style={{ ...s.label, margin: '0 0 4px 0' }}>Roles & Permissions</p>
          <h2 style={{ margin: '0 0 6px 0', fontSize: '24px', fontWeight: '700', color: 'var(--text-h)' }}>
            {isCho ? 'CHO Officer Permissions' : 'BHW Health Worker Permissions'}
          </h2>
          <p style={{ margin: '0 0 20px 0', fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {isCho
              ? 'Your account is a CHO account. Listed below are the permissions granted to the CHO role. Patient-identifying data and case approval actions are restricted to CHO personnel; BHW permissions are not visible to CHO accounts.'
              : 'Your account is a BHW account. Listed below are the permissions granted to the BHW role. BHWs add cases and submit them through the CHO inbox workflow for approval; CHO permissions are not visible to BHW accounts.'}
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <span style={{
              padding: '4px 14px', borderRadius: '12px', fontSize: '15px', fontWeight: '700',
              background: isCho ? 'rgba(37,99,235,0.15)' : 'rgba(18,153,104,0.15)',
              color: isCho ? '#2563eb' : '#129968',
              border: `1px solid ${isCho ? 'rgba(37,99,235,0.4)' : 'rgba(18,153,104,0.4)'}`,
            }}>{roleLabel}</span>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px' }}>
              <thead>
                <tr style={{ background: 'var(--input-bg)' }}>
                  <th style={{ padding: '11px 14px', textAlign: 'center', fontWeight: '700', color: 'var(--text-main)', borderBottom: '2px solid var(--border-color)', fontSize: '15px' }}>Feature / Permission</th>
                  <th style={{ padding: '11px 14px', textAlign: 'center', fontWeight: '700', color: isCho ? '#2563eb' : '#129968', borderBottom: '2px solid var(--border-color)', whiteSpace: 'nowrap' }}>{isCho ? 'CHO' : 'BHW'}</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSION_ROWS.map((row, i) => {
                  const allowed = isCho ? row.cho : row.bhw;
                  return (
                    <tr key={row.feature} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--input-bg)' }}>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: '500', textAlign: 'center' }}>{row.feature}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>{allowed ? <YesIcon /> : <NoIcon />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p style={{ margin: '16px 0 0 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Enforced server-side on every API route and reflected in the UI ({'Add Case'}, inbox tabs, approval actions, and user management are hidden or replaced for BHW accounts). Case data access is scoped per CHO unit or BHW barangay.
          </p>
        </div>
      </div>
    </div>
  );
}