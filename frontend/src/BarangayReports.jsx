import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// ── CHO Unit → Barangay mapping ──
const CHO_BARANGAYS = {
  'CHO Unit I (Sala)': ['Baclaran', 'Banlic', 'Bigaa', 'Butong', 'Gulod', 'Mamatid', 'Marinig', 'Sala', 'Barangay Uno (Poblacion)', 'Barangay Dos (Poblacion)', 'Barangay Tres (Poblacion)'],
  'CHO Unit II (Pulo)': ['Banay-Banay', 'Casile', 'Diezmo', 'Niugan', 'Pitland', 'Pulo', 'San Isidro'],
};

const ALL_USERS_MOCK = [
  { id: 'JD01', name: 'Juan Danika' },
  { id: 'MK02', name: 'Maria Koars' },
  { id: 'CHO-Admin', name: 'Pedro Santos' },
];

const ENTITY_OPTIONS = [
  'Case Records',
  'New CHO Admin Account',
  'New BHW Account',
  'Barangay Risk Update',
  'System Maintenance',
  'Epidemiological Summary',
  'Other',
];

const PERIOD_OPTIONS = ['Today', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'];

const ITEMS_PER_PAGE = 10;

export default function BarangayReports({ activeUser }) {
  // activeUser = { role: 'CHO', context: 'CHO Unit I (Sala)' }
  const choUnit = activeUser?.context || 'CHO Unit I (Sala)';
  const myBarangays = CHO_BARANGAYS[choUnit] || Object.values(CHO_BARANGAYS).flat();

  // ── Live stats from API ──
  const [allCases, setAllCases] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    axios.get('http://localhost:5000/api/disease_cases')
      .then(res => { setAllCases(res.data); setStatsLoading(false); })
      .catch(() => setStatsLoading(false));
  }, []);

  // ── Quick stats: filtered to this CHO's barangays ──
  const myCases = allCases.filter(c => myBarangays.includes(c.barangay_name));
  const casesAdded = myCases.length;
  const casesUpdated = myCases.filter(c => c.status === 'Recovered' || c.status === 'Under Treatment').length;
  const casesDeleted = 0; // would come from audit_logs table in future
  const accountsCreated = 2; // placeholder — would come from users table

  // ── Generated reports log (local state, starts with mocks) ──
  const [reportLogs, setReportLogs] = useState([
    { id: 1, title: 'Daily Summary Report - Jun 07.pdf', timestamp: 'Generated Today, 02:15 PM', period: 'Today' },
    { id: 2, title: 'Weekly Barangay Health Review - Wk 23.pdf', timestamp: 'Generated Yesterday, 05:00 PM', period: 'Weekly' },
    { id: 3, title: 'Consolidated System Audit Logs - May.xlsx', timestamp: 'Generated Jun 01, 2026', period: 'Monthly' },
  ]);

  // ── Generate Report Modal ──
  const [showGenModal, setShowGenModal] = useState(false);
  const [genForm, setGenForm] = useState({
    name: '', period: 'Today', entity: 'Case Records', details: ''
  });
  const [genError, setGenError] = useState('');

  const handleGenerateReport = () => {
    if (!genForm.name.trim()) { setGenError('Please enter a report name.'); return; }
    const now = new Date();
    const formatted = now.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    const ext = genForm.entity.toLowerCase().includes('account') ? 'xlsx' : 'pdf';
    const newReport = {
      id: Date.now(),
      title: `${genForm.name} - ${formatted}.${ext}`,
      timestamp: `Generated Today, ${timeStr}`,
      period: genForm.period,
      entity: genForm.entity,
      details: genForm.details,
    };
    setReportLogs(prev => [newReport, ...prev]);
    setShowGenModal(false);
    setGenForm({ name: '', period: 'Today', entity: 'Case Records', details: '' });
    setGenError('');
  };

  // ── Audit log mock data (would come from /api/audit_logs in production) ──
  const [auditLogs] = useState([
    { id: 1, timestamp: 'Jun 07, 2026 02:15 PM', userId: 'CHO-Admin', userName: 'Pedro Santos', action: 'Created', entity: 'Case Record', details: 'Added Dengue entry for Patient DG-901 (Niugan)' },
    { id: 2, timestamp: 'Jun 07, 2026 01:40 PM', userId: 'MK02', userName: 'Maria Koars', action: 'Updated', entity: 'Case Record', details: 'Changed COVID-19 status to Recovered for CV-1102' },
    { id: 3, timestamp: 'Jun 07, 2026 11:15 AM', userId: 'CHO-Admin', userName: 'Pedro Santos', action: 'Deleted', entity: 'Case Record', details: 'Removed duplicate Influenza A log item #FL-043' },
    { id: 4, timestamp: 'Jun 06, 2026 04:10 PM', userId: 'JD01', userName: 'Juan Danika', action: 'Created', entity: 'User Account', details: 'Provisioned BHW account credentials for Sector Pulo' },
    { id: 5, timestamp: 'Jun 06, 2026 09:30 AM', userId: 'JD01', userName: 'Juan Danika', action: 'Logged In', entity: 'System', details: 'Login from Chrome on Windows' },
    { id: 6, timestamp: 'Jun 05, 2026 03:20 PM', userId: 'MK02', userName: 'Maria Koars', action: 'Updated', entity: 'Case Record', details: 'Updated severity for Dengue case DG-899 to Severe' },
    { id: 7, timestamp: 'Jun 05, 2026 10:00 AM', userId: 'CHO-Admin', userName: 'Pedro Santos', action: 'Created', entity: 'Case Record', details: 'Added Tuberculosis case TB-024 (Sala)' },
    { id: 8, timestamp: 'Jun 04, 2026 02:45 PM', userId: 'JD01', userName: 'Juan Danika', action: 'Deleted', entity: 'User Account', details: 'Deactivated BHW account ID PC03' },
    { id: 9, timestamp: 'Jun 04, 2026 11:30 AM', userId: 'MK02', userName: 'Maria Koars', action: 'Logged In', entity: 'System', details: 'Login from Firefox on Android' },
    { id: 10, timestamp: 'Jun 03, 2026 04:00 PM', userId: 'CHO-Admin', userName: 'Pedro Santos', action: 'Updated', entity: 'Case Record', details: 'Changed status of CV-1089 to Recovered' },
    { id: 11, timestamp: 'Jun 03, 2026 01:15 PM', userId: 'JD01', userName: 'Juan Danika', action: 'Created', entity: 'Case Record', details: 'New Cholera case CH-011 (Pulo)' },
    { id: 12, timestamp: 'Jun 02, 2026 10:00 AM', userId: 'MK02', userName: 'Maria Koars', action: 'Deleted', entity: 'Case Record', details: 'Removed test entry DG-000' },
  ]);

  // ── Audit log filters ──
  const [searchLog, setSearchLog] = useState('');
  const [filterAction, setFilterAction] = useState('All Actions');
  const [filterUser, setFilterUser] = useState('All Users');
  const [showActionDrop, setShowActionDrop] = useState(false);
  const [showUserDrop, setShowUserDrop] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [logPage, setLogPage] = useState(1);

  // Calendar state
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectingStart, setSelectingStart] = useState(true);

  const actionDropRef = useRef(null);
  const userDropRef = useRef(null);
  const datePickerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (actionDropRef.current && !actionDropRef.current.contains(e.target)) setShowActionDrop(false);
      if (userDropRef.current && !userDropRef.current.contains(e.target)) setShowUserDrop(false);
      if (datePickerRef.current && !datePickerRef.current.contains(e.target)) setShowDatePicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Filter audit logs ──
  const filteredLogs = auditLogs.filter(log => {
    const q = searchLog.toLowerCase();
    const matchSearch = !q || log.userName.toLowerCase().includes(q) || log.details.toLowerCase().includes(q) || log.entity.toLowerCase().includes(q);
    const matchAction = filterAction === 'All Actions' || log.action === filterAction;
    const matchUser = filterUser === 'All Users' || log.userId === filterUser.split(' ')[0];
    let matchDate = true;
    if (dateRange.start && dateRange.end) {
      // simple string compare works for our format if we parse
      const logDate = new Date(log.timestamp);
      const s = new Date(dateRange.start);
      const e = new Date(dateRange.end);
      matchDate = logDate >= s && logDate <= e;
    }
    return matchSearch && matchAction && matchUser && matchDate;
  });

  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const paginatedLogs = filteredLogs.slice((logPage - 1) * ITEMS_PER_PAGE, logPage * ITEMS_PER_PAGE);

  // ── Calendar helpers ──
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDay = (y, m) => new Date(y, m, 1).getDay();

  const formatDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return `${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}/${dt.getFullYear()}`;
  };

  const handleCalendarDay = (day) => {
    const clicked = new Date(calYear, calMonth, day);
    const str = clicked.toISOString().split('T')[0];
    if (selectingStart) {
      setDateRange({ start: str, end: '' });
      setSelectingStart(false);
    } else {
      if (new Date(str) < new Date(dateRange.start)) {
        setDateRange({ start: str, end: dateRange.start });
      } else {
        setDateRange({ start: dateRange.start, end: str });
      }
      setSelectingStart(true);
    }
  };

  const isDayInRange = (day) => {
    if (!dateRange.start || !dateRange.end) return false;
    const d = new Date(calYear, calMonth, day);
    return d >= new Date(dateRange.start) && d <= new Date(dateRange.end);
  };

  const isDayStart = (day) => {
    if (!dateRange.start) return false;
    const d = new Date(calYear, calMonth, day);
    return d.toISOString().split('T')[0] === dateRange.start;
  };

  const isDayEnd = (day) => {
    if (!dateRange.end) return false;
    const d = new Date(calYear, calMonth, day);
    return d.toISOString().split('T')[0] === dateRange.end;
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(calYear, calMonth);
    const firstDay = getFirstDay(calYear, calMonth);
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  };

  const actionBadgeStyle = (action) => {
    if (action === 'Created') return { background: '#dcfce7', color: '#16a34a' };
    if (action === 'Updated') return { background: '#dbeafe', color: '#2563eb' };
    if (action === 'Deleted') return { background: '#fee2e2', color: '#dc2626' };
    if (action === 'Logged In') return { background: '#f3e8ff', color: '#7c3aed' };
    return { background: '#f1f5f9', color: '#64748b' };
  };

  // ── Export audit logs ──
  const handleExportLogs = () => {
    const headers = 'Timestamp,User ID,Name,Action,Entity,Details\n';
    const rows = filteredLogs.map(l =>
      `"${l.timestamp}","${l.userId}","${l.userName}","${l.action}","${l.entity}","${l.details}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `CDMS_AuditLogs_${choUnit.replace(/\s/g,'_')}.csv`; a.click();
  };

  // ── Report period filter ──
  const [reportPeriod, setReportPeriod] = useState('');
  const [reportDateStart, setReportDateStart] = useState('');
  const [reportDateEnd, setReportDateEnd] = useState('');
  const [reportType, setReportType] = useState('');

  const s = { // shared style tokens
    card: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' },
    label: { fontSize: '12px', fontWeight: '600', color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' },
    input: { padding: '9px 14px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '14px', color: '#1e293b', background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box' },
    dropBtn: (active) => ({
      padding: '9px 14px', border: `1px solid ${active ? '#0d9488' : '#e2e8f0'}`, borderRadius: '7px', fontSize: '14px',
      color: active ? '#0d9488' : '#475569', background: '#fff', cursor: 'pointer', display: 'flex',
      alignItems: 'center', gap: '8px', whiteSpace: 'nowrap', fontWeight: active ? '600' : '400'
    }),
    dropMenu: { position: 'absolute', top: '110%', left: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200, minWidth: '180px', overflow: 'hidden' },
    dropItem: (active) => ({ padding: '10px 16px', fontSize: '14px', cursor: 'pointer', color: active ? '#0d9488' : '#334155', background: active ? '#f0fdfa' : 'transparent', display: 'block', width: '100%', border: 'none', textAlign: 'left', fontWeight: active ? '600' : '400' }),
  };

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── GENERATE REPORT MODAL ── */}
      {showGenModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '36px', width: '520px', maxWidth: '95vw', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>Generate New Report</h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#64748b' }}>This will be saved to the Generated Reports Logs.</p>

            {genError && (
              <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
                {genError}
              </div>
            )}

            {/* Report Name */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ ...s.label, display: 'block', marginBottom: '6px' }}>Report Name *</label>
              <input
                type="text"
                placeholder="e.g. Daily Dengue Summary Report"
                style={s.input}
                value={genForm.name}
                onChange={e => { setGenForm({ ...genForm, name: e.target.value }); setGenError(''); }}
              />
            </div>

            {/* Period */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ ...s.label, display: 'block', marginBottom: '6px' }}>Report Period</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {PERIOD_OPTIONS.map(p => (
                  <button key={p} type="button" onClick={() => setGenForm({ ...genForm, period: p })}
                    style={{ padding: '7px 16px', borderRadius: '20px', border: '1px solid', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                      background: genForm.period === p ? '#0d9488' : '#f8fafc',
                      color: genForm.period === p ? '#fff' : '#475569',
                      borderColor: genForm.period === p ? '#0d9488' : '#e2e8f0' }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Entity */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ ...s.label, display: 'block', marginBottom: '6px' }}>Report Entity / Category</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {ENTITY_OPTIONS.map(e => (
                  <button key={e} type="button" onClick={() => setGenForm({ ...genForm, entity: e })}
                    style={{ padding: '7px 14px', borderRadius: '20px', border: '1px solid', fontSize: '12px', fontWeight: '500', cursor: 'pointer',
                      background: genForm.entity === e ? '#1e3a8a' : '#f8fafc',
                      color: genForm.entity === e ? '#fff' : '#475569',
                      borderColor: genForm.entity === e ? '#1e3a8a' : '#e2e8f0' }}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Details */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ ...s.label, display: 'block', marginBottom: '6px' }}>Report Details / Notes</label>
              <textarea
                placeholder={`Describe what this ${genForm.period.toLowerCase()} report covers, any notable findings, or special circumstances...`}
                rows={4}
                style={{ ...s.input, resize: 'vertical', lineHeight: '1.5' }}
                value={genForm.details}
                onChange={e => setGenForm({ ...genForm, details: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowGenModal(false); setGenError(''); }}
                style={{ padding: '10px 24px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', fontWeight: '500', color: '#475569', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleGenerateReport}
                style={{ padding: '10px 28px', background: '#10b981', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', color: '#fff', cursor: 'pointer' }}>
                Generate Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAGE HEADER ── */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 2px 0', fontSize: '22px', fontWeight: '700', color: '#0f172a' }}>Audit Reports</h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{choUnit} — Monitoring {myBarangays.length} barangays</p>
      </div>

      {/* ── TOP FILTER BAR ── */}
      <div style={{ ...s.card, display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select value={reportPeriod} onChange={e => setReportPeriod(e.target.value)}
          style={{ ...s.input, width: '160px', flex: '0 0 auto' }}>
          <option value="">Report Period</option>
          {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="date" value={reportDateStart} onChange={e => setReportDateStart(e.target.value)}
          style={{ ...s.input, width: '150px', flex: '0 0 auto' }} />
        <input type="date" value={reportDateEnd} onChange={e => setReportDateEnd(e.target.value)}
          style={{ ...s.input, width: '150px', flex: '0 0 auto' }} />
        <select value={reportType} onChange={e => setReportType(e.target.value)}
          style={{ ...s.input, flex: 1, minWidth: '160px' }}>
          <option value="">Report Type</option>
          {ENTITY_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <button onClick={() => setShowGenModal(true)}
          style={{ padding: '9px 22px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '7px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Generate Report
        </button>
      </div>

      {/* ── MIDDLE ROW: Logs + Quick Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', marginBottom: '20px' }}>

        {/* Generated Reports Logs */}
        <div style={s.card}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>Generated Reports Logs</h3>
          {reportLogs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: '14px' }}>
              No reports generated yet. Click "Generate Report" to create one.
            </div>
          )}
          {reportLogs.map(file => (
            <div key={file.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', marginBottom: '10px' }}>
              <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', background: '#e0f2fe', color: '#0369a1', flexShrink: 0 }}>
                    {file.period || 'Manual'}
                  </span>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.title}
                  </p>
                </div>
                <small style={{ color: '#64748b', fontSize: '12px' }}>{file.timestamp}</small>
                {file.details && <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.details}</p>}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button style={{ padding: '6px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', color: '#475569', fontWeight: '500' }}>Download</button>
                <button style={{ padding: '6px 14px', background: '#e6f4ea', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', color: '#16a34a', fontWeight: '500' }}>View</button>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div style={s.card}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>Quick Stats</h3>
          <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#94a3b8' }}>{choUnit}</p>
          {statsLoading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px' }}>Loading...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { label: 'Cases Added', value: casesAdded, color: '#1e3a8a', bg: '#eff6ff' },
                { label: 'Cases Updated', value: casesUpdated, color: '#0369a1', bg: '#e0f2fe' },
                { label: 'Cases Deleted', value: casesDeleted, color: '#dc2626', bg: '#fee2e2' },
                { label: 'Accounts Created', value: accountsCreated, color: '#059669', bg: '#d1fae5' },
              ].map(stat => (
                <div key={stat.label} style={{ background: stat.bg, borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: '500' }}>{stat.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Barangay list */}
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
            <p style={{ ...s.label, display: 'block', marginBottom: '8px' }}>Covered Barangays</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {myBarangays.map(b => (
                <span key={b} style={{ fontSize: '11px', padding: '3px 9px', background: '#f1f5f9', borderRadius: '10px', color: '#475569', fontWeight: '500' }}>
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── AUDIT LOG TABLE ── */}
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>Generated System Logs</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleExportLogs}
              style={{ padding: '7px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
            <button style={{ padding: '7px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', color: '#475569' }}>
              Filter
            </button>
          </div>
        </div>

        {/* Toolbar row */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Search Logs..."
              value={searchLog} onChange={e => { setSearchLog(e.target.value); setLogPage(1); }}
              style={{ ...s.input, width: '200px', paddingLeft: '32px' }} />
          </div>

          {/* All Actions dropdown */}
          <div style={{ position: 'relative' }} ref={actionDropRef}>
            <button onClick={() => { setShowActionDrop(!showActionDrop); setShowUserDrop(false); setShowDatePicker(false); }}
              style={s.dropBtn(filterAction !== 'All Actions')}>
              {filterAction}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showActionDrop && (
              <div style={s.dropMenu}>
                {['All Actions', 'Created', 'Updated', 'Deleted', 'Logged In'].map(a => (
                  <button key={a} style={s.dropItem(filterAction === a)}
                    onClick={() => { setFilterAction(a); setShowActionDrop(false); setLogPage(1); }}
                    onMouseEnter={e => { if (filterAction !== a) e.target.style.background = '#f8fafc'; }}
                    onMouseLeave={e => { if (filterAction !== a) e.target.style.background = 'transparent'; }}>
                    {a !== 'All Actions' && (
                      <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', marginRight: '8px', background: a === 'Created' ? '#16a34a' : a === 'Updated' ? '#2563eb' : a === 'Deleted' ? '#dc2626' : '#7c3aed' }} />
                    )}
                    {a}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* All Users dropdown */}
          <div style={{ position: 'relative' }} ref={userDropRef}>
            <button onClick={() => { setShowUserDrop(!showUserDrop); setShowActionDrop(false); setShowDatePicker(false); }}
              style={s.dropBtn(filterUser !== 'All Users')}>
              {filterUser}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showUserDrop && (
              <div style={s.dropMenu}>
                <button style={s.dropItem(filterUser === 'All Users')}
                  onClick={() => { setFilterUser('All Users'); setShowUserDrop(false); setLogPage(1); }}>
                  All Users
                </button>
                {ALL_USERS_MOCK.map(u => (
                  <button key={u.id} style={s.dropItem(filterUser === `${u.id} - ${u.name}`)}
                    onClick={() => { setFilterUser(`${u.id} - ${u.name}`); setShowUserDrop(false); setLogPage(1); }}
                    onMouseEnter={e => { if (filterUser !== `${u.id} - ${u.name}`) e.target.style.background = '#f8fafc'; }}
                    onMouseLeave={e => { if (filterUser !== `${u.id} - ${u.name}`) e.target.style.background = 'transparent'; }}>
                    <span style={{ fontWeight: '600', color: '#0f172a' }}>{u.id}</span>
                    <span style={{ color: '#64748b', marginLeft: '6px' }}>— {u.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date Range picker */}
          <div style={{ position: 'relative' }} ref={datePickerRef}>
            <button onClick={() => { setShowDatePicker(!showDatePicker); setShowActionDrop(false); setShowUserDrop(false); }}
              style={s.dropBtn(!!dateRange.start)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {dateRange.start ? `${formatDate(dateRange.start)}${dateRange.end ? ' — ' + formatDate(dateRange.end) : ''}` : 'Date Range'}
            </button>

            {showDatePicker && (
              <div style={{ position: 'absolute', top: '110%', left: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.14)', zIndex: 300, padding: '16px', width: '280px' }}>
                {/* Header with Start / End display */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '3px', fontWeight: '600' }}>Start Date</div>
                    <div style={{ padding: '6px', background: selectingStart ? '#f0fdfa' : '#f8fafc', border: `1px solid ${selectingStart ? '#0d9488' : '#e2e8f0'}`, borderRadius: '6px', fontSize: '13px', color: '#1e293b', cursor: 'pointer' }}
                      onClick={() => setSelectingStart(true)}>
                      {dateRange.start ? formatDate(dateRange.start) : '—'}
                    </div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '3px', fontWeight: '600' }}>End Date</div>
                    <div style={{ padding: '6px', background: !selectingStart ? '#f0fdfa' : '#f8fafc', border: `1px solid ${!selectingStart ? '#0d9488' : '#e2e8f0'}`, borderRadius: '6px', fontSize: '13px', color: '#1e293b', cursor: 'pointer' }}
                      onClick={() => setSelectingStart(false)}>
                      {dateRange.end ? formatDate(dateRange.end) : '—'}
                    </div>
                  </div>
                </div>

                {/* Month nav */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); } else setCalMonth(m => m-1); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#475569', padding: '2px 8px' }}>‹</button>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{MONTH_NAMES[calMonth]} {calYear}</span>
                  <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); } else setCalMonth(m => m+1); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#475569', padding: '2px 8px' }}>›</button>
                </div>

                {/* Day headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
                  {DAY_NAMES.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', fontWeight: '600', padding: '2px' }}>{d}</div>)}
                </div>

                {/* Calendar grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                  {renderCalendar().map((day, i) => {
                    const isStart = day && isDayStart(day);
                    const isEnd = day && isDayEnd(day);
                    const inRange = day && isDayInRange(day);
                    const isToday = day && new Date(calYear, calMonth, day).toDateString() === new Date().toDateString();
                    return (
                      <div key={i} onClick={() => day && handleCalendarDay(day)}
                        style={{
                          height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '12px', borderRadius: '6px', cursor: day ? 'pointer' : 'default',
                          background: isStart || isEnd ? '#0d9488' : inRange ? '#ccfbf1' : 'transparent',
                          color: isStart || isEnd ? '#fff' : inRange ? '#0d9488' : day ? '#334155' : 'transparent',
                          fontWeight: isToday ? '700' : '400',
                          outline: isToday && !isStart && !isEnd ? '1px solid #0d9488' : 'none',
                        }}>
                        {day || ''}
                      </div>
                    );
                  })}
                </div>

                {/* Clear */}
                {(dateRange.start || dateRange.end) && (
                  <button onClick={() => { setDateRange({ start: '', end: '' }); setSelectingStart(true); setLogPage(1); }}
                    style={{ marginTop: '10px', width: '100%', padding: '7px', background: '#fee2e2', border: 'none', borderRadius: '6px', fontSize: '12px', color: '#dc2626', cursor: 'pointer', fontWeight: '500' }}>
                    Clear Date Range
                  </button>
                )}
              </div>
            )}
          </div>

          <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#94a3b8' }}>
            Showing {Math.min((logPage - 1) * ITEMS_PER_PAGE + 1, filteredLogs.length)}–{Math.min(logPage * ITEMS_PER_PAGE, filteredLogs.length)} of {filteredLogs.length} entries
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                {['Timestamp', 'User', 'Action', 'Entity', 'Details'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '14px' }}>No logs found matching your filters.</td></tr>
              ) : (
                paginatedLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f8fafc' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '13px 14px', fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>{log.timestamp}</td>
                    <td style={{ padding: '13px 14px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{log.userId}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{log.userName}</div>
                    </td>
                    <td style={{ padding: '13px 14px' }}>
                      <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', ...actionBadgeStyle(log.action) }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '13px 14px', fontSize: '13px', color: '#475569' }}>{log.entity}</td>
                    <td style={{ padding: '13px 14px', fontSize: '13px', color: '#64748b', maxWidth: '320px' }}>{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalLogPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', alignItems: 'center' }}>
            <button onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logPage === 1}
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: logPage === 1 ? 'not-allowed' : 'pointer', color: logPage === 1 ? '#cbd5e1' : '#475569' }}>
              ‹
            </button>
            {Array.from({ length: totalLogPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setLogPage(p)}
                style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: p === logPage ? '#1e3a8a' : '#fff', color: p === logPage ? '#fff' : '#475569', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: p === logPage ? '600' : '400' }}>
                {p}
              </button>
            ))}
            <button onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))} disabled={logPage === totalLogPages}
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: logPage === totalLogPages ? 'not-allowed' : 'pointer', color: logPage === totalLogPages ? '#cbd5e1' : '#475569' }}>
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}