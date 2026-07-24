import { useState, useEffect } from 'react';
import { API_URL } from './config';

export default function WeeklySummary({ userId, loginRole, compactMode, fontScale, onBack }) {
  const defaultStart = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const defaultEnd = new Date().toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/weekly-summary?user_id=${userId}&start_date=${startDate}&end_date=${endDate}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { if (userId) fetchData(); }, [userId]);

  const fmtDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const fmtDateTime = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const fmtShortDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getRiskColor = (count) => {
    if (count >= 20) return '#DC2626';
    if (count >= 10) return '#f59e0b';
    return '#10b981';
  };

  const getRiskLabel = (count) => {
    if (count >= 20) return 'High';
    if (count >= 10) return 'Medium';
    return 'Low';
  };

  const getStatusBadge = (status) => {
    const map = {
      Active: { bg: '#1E3A8A', color: '#93c5fd' },
      Pending: { bg: '#1e3a8a', color: '#93c5fd' },
      'Under Treatment': { bg: '#3b0764', color: '#c4b5fd' },
      Recovered: { bg: '#064E3B', color: '#34D399' },
      Deceased: { bg: '#7f1d1d', color: '#fca5a5' },
      Draft: { bg: '#374151', color: '#d1d5db' },
    };
    return map[status] || { bg: '#374151', color: '#d1d5db' };
  };

  const getSeverityColor = (sev) => {
    const map = { Critical: '#DC2626', Severe: '#f59e0b', Moderate: '#3b82f6', Mild: '#10b981', Asymptomatic: '#6b7280' };
    return map[sev] || '#6b7280';
  };

  const getActionBadge = (action) => {
    const map = {
      Created: { bg: '#064E3B', color: '#34D399' },
      Updated: { bg: '#1E3A8A', color: '#93c5fd' },
      Deleted: { bg: '#7f1d1d', color: '#fca5a5' },
      'Logged In': { bg: '#374151', color: '#d1d5db' },
      Routed: { bg: '#4c1d95', color: '#c4b5fd' },
    };
    return map[action] || { bg: '#374151', color: '#d1d5db' };
  };

  // ── Export: Print / Save as PDF ──
  const handlePrint = () => {
    if (!data) return;
    const { summary, byBarangay, byDisease, bySeverity, newCases, scopeLabel, dateRange } = data;
    const maxBCount = Math.max(...byBarangay.map(b => b.count), 1);
    const maxDCount = Math.max(...byDisease.map(d => d.count), 1);

    const barangayRows = byBarangay.map(b => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px">${b.barangay_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;font-size:13px">${b.count}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;width:40%">
          <div style="background:#e5e7eb;border-radius:4px;height:18px;overflow:hidden">
            <div style="width:${(b.count / maxBCount) * 100}%;background:${getRiskColor(b.count)};height:100%;border-radius:4px"></div>
          </div>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px">
          <span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${getRiskColor(b.count)}22;color:${getRiskColor(b.count)}">${getRiskLabel(b.count)} Risk</span>
        </td>
      </tr>`).join('');

    const diseaseRows = byDisease.filter(d => d.count > 0).map(d => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px">${d.disease_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;font-size:13px">${d.count}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;width:40%">
          <div style="background:#e5e7eb;border-radius:4px;height:18px;overflow:hidden">
            <div style="width:${(d.count / maxDCount) * 100}%;background:#1E3A8A;height:100%;border-radius:4px"></div>
          </div>
        </td>
      </tr>`).join('');

    const sevRows = bySeverity.map(s => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${getSeverityColor(s.severity)};margin-right:8px"></span>${s.severity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${s.count}</td>
      </tr>`).join('');

    const newCaseRows = newCases.map(c => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:12px">#${String(c.case_id).padStart(3,'0')}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:12px">${c.patient_name || ''}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:12px">${c.age || '--'}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:12px">${c.disease_name || ''}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:12px">${c.barangay_name || ''}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:12px">${c.severity || 'N/A'}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:12px">${c.status || ''}</td>
      </tr>`).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Weekly Summary Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 28px; font-size: 13px; color: #111; margin: 0; }
        h1 { color: #1e3a8a; font-size: 22px; margin: 0 0 4px 0; }
        h2 { color: #1e3a8a; font-size: 16px; margin: 24px 0 8px 0; border-bottom: 2px solid #1e3a8a; padding-bottom: 4px; }
        p { color: #555; margin: 0 0 16px 0; font-size: 13px; }
        .metrics { display: flex; gap: 12px; margin: 16px 0 24px 0; }
        .metric-card { flex: 1; text-align: center; padding: 14px 8px; border-radius: 8px; }
        .metric-val { font-size: 28px; font-weight: 700; }
        .metric-label { font-size: 11px; color: #64748b; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { background: #1e3a8a; color: white; padding: 9px 12px; text-align: left; font-size: 12px; }
        td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
        tr:nth-child(even) td { background: #f9fafb; }
        .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; text-align: center; }
        @media print { .no-print { display: none !important; } body { padding: 16px; } }
      </style></head><body>
      <h1>Weekly Disease Summary Report</h1>
      <p><strong>Scope:</strong> ${scopeLabel} &nbsp;|&nbsp; <strong>Period:</strong> ${fmtDate(dateRange.start)} - ${fmtDate(dateRange.end)} &nbsp;|&nbsp; <strong>Prepared by:</strong> ${data.generatedBy} &nbsp;|&nbsp; <strong>Generated:</strong> ${fmtDateTime(data.generatedAt)}</p>

      <div class="metrics">
        <div class="metric-card" style="background:#eff6ff"><div class="metric-val" style="color:#1e3a8a">${summary.total_cases}</div><div class="metric-label">Total Cases</div></div>
        <div class="metric-card" style="background:#fef2f2"><div class="metric-val" style="color:#DC2626">${summary.new_this_week}</div><div class="metric-label">New This Week</div></div>
        <div class="metric-card" style="background:#fffbeb"><div class="metric-val" style="color:#f59e0b">${summary.active_cases}</div><div class="metric-label">Active</div></div>
        <div class="metric-card" style="background:#f0fdf4"><div class="metric-val" style="color:#10b981">${summary.recovered}</div><div class="metric-label">Recovered</div></div>
        <div class="metric-card" style="background:#fef2f2"><div class="metric-val" style="color:#991b1b">${summary.deceased}</div><div class="metric-label">Deceased</div></div>
      </div>

      <h2>Cases by Barangay</h2>
      <table><thead><tr><th>Barangay</th><th style="text-align:right">Count</th><th>Distribution</th><th style="text-align:center">Risk Level</th></tr></thead><tbody>${barangayRows || '<tr><td colspan="4" style="text-align:center;color:#64748b">No data</td></tr>'}</tbody></table>

      <h2>Cases by Disease</h2>
      <table><thead><tr><th>Disease</th><th style="text-align:right">Count</th><th>Distribution</th></tr></thead><tbody>${diseaseRows || '<tr><td colspan="3" style="text-align:center;color:#64748b">No data</td></tr>'}</tbody></table>

      <h2>Cases by Severity</h2>
      <table><thead><tr><th>Severity</th><th style="text-align:right">Count</th></tr></thead><tbody>${sevRows || '<tr><td colspan="2" style="text-align:center;color:#64748b">No data</td></tr>'}</tbody></table>

      <h2>New Cases This Period (${newCases.length})</h2>
      <table><thead><tr><th>ID</th><th>Patient</th><th>Age</th><th>Disease</th><th>Barangay</th><th>Severity</th><th>Status</th></tr></thead><tbody>${newCaseRows || '<tr><td colspan="7" style="text-align:center;color:#64748b">No new cases</td></tr>'}</tbody></table>

      <div class="footer">Cabuyao City Disease Monitoring System - Prepared by ${data.generatedBy} (${scopeLabel})</div>
      <br/><button class="no-print" onclick="window.print();" style="padding:10px 24px;background:#1e3a8a;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">Print / Save as PDF</button>
      </body></html>`);
    printWindow.document.close();
  };

  // ── Export: Word ──
  const handleExportWord = () => {
    if (!data) return;
    const { summary, byBarangay, byDisease, bySeverity, newCases, scopeLabel, dateRange } = data;
    const maxBCount = Math.max(...byBarangay.map(b => b.count), 1);
    const maxDCount = Math.max(...byDisease.map(d => d.count), 1);

    const barangayRows = byBarangay.map(b => `<tr><td>${b.barangay_name}</td><td style="text-align:right;font-weight:600">${b.count}</td><td style="width:40%"><div style="background:#e5e7eb;height:16px;border-radius:3px"><div style="width:${(b.count/maxBCount)*100}%;background:${getRiskColor(b.count)};height:16px;border-radius:3px"></div></div></td><td style="text-align:center"><span style="padding:2px 8px;border-radius:10px;font-size:11px;background:${getRiskColor(b.count)}22;color:${getRiskColor(b.count)}">${getRiskLabel(b.count)}</span></td></tr>`).join('');
    const diseaseRows = byDisease.filter(d => d.count > 0).map(d => `<tr><td>${d.disease_name}</td><td style="text-align:right;font-weight:600">${d.count}</td><td style="width:40%"><div style="background:#e5e7eb;height:16px;border-radius:3px"><div style="width:${(d.count/maxDCount)*100}%;background:#1E3A8A;height:16px;border-radius:3px"></div></div></td></tr>`).join('');
    const sevRows = bySeverity.map(s => `<tr><td>${s.severity}</td><td style="text-align:right;font-weight:600">${s.count}</td></tr>`).join('');
    const newCaseRows = newCases.map(c => `<tr><td>#${String(c.case_id).padStart(3,'0')}</td><td>${c.patient_name||''}</td><td>${c.age||'--'}</td><td>${c.disease_name||''}</td><td>${c.barangay_name||''}</td><td>${c.severity||'N/A'}</td><td>${c.status||''}</td></tr>`).join('');

    const html = `<html><head><meta charset="utf-8"><title>Weekly Summary Report</title>
      <style>body{font-family:Arial,sans-serif;padding:32px;font-size:13px;color:#111}h1{color:#1e3a8a;font-size:22px;margin:0 0 4px 0}p{color:#555;margin:0 0 16px 0}h2{color:#1e3a8a;font-size:16px;margin:24px 0 8px 0;border-bottom:2px solid #1e3a8a;padding-bottom:4px}table{width:100%;border-collapse:collapse;margin-bottom:16px}th{background:#1e3a8a;color:white;padding:9px 12px;text-align:left;font-size:12px}td{padding:8px 12px;border-bottom:1px solid #e5e7eb}tr:nth-child(even) td{background:#f9fafb}.footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;text-align:center}</style></head><body>
      <h1>Weekly Disease Summary Report</h1>
      <p><b>Scope:</b> ${scopeLabel} | <b>Period:</b> ${fmtDate(dateRange.start)} - ${fmtDate(dateRange.end)} | <b>Prepared by:</b> ${data.generatedBy}</p>
      <table style="width:100%;margin-bottom:20px"><tr>
        <td style="background:#eff6ff;padding:12px;border-radius:8px 0 0 8px;text-align:center"><div style="font-size:24px;font-weight:700;color:#1e3a8a">${summary.total_cases}</div><div style="font-size:11px;color:#64748b">Total Cases</div></td>
        <td style="background:#fef2f2;padding:12px;text-align:center"><div style="font-size:24px;font-weight:700;color:#DC2626">${summary.new_this_week}</div><div style="font-size:11px;color:#64748b">New This Week</div></td>
        <td style="background:#fffbeb;padding:12px;text-align:center"><div style="font-size:24px;font-weight:700;color:#f59e0b">${summary.active_cases}</div><div style="font-size:11px;color:#64748b">Active</div></td>
        <td style="background:#f0fdf4;padding:12px;border-radius:0 8px 8px 0;text-align:center"><div style="font-size:24px;font-weight:700;color:#10b981">${summary.recovered}</div><div style="font-size:11px;color:#64748b">Recovered</div></td>
      </tr></table>
      <h2>Cases by Barangay</h2><table><thead><tr><th>Barangay</th><th style="text-align:right">Count</th><th>Distribution</th><th style="text-align:center">Risk</th></tr></thead><tbody>${barangayRows||'<tr><td colspan="4">No data</td></tr>'}</tbody></table>
      <h2>Cases by Disease</h2><table><thead><tr><th>Disease</th><th style="text-align:right">Count</th><th>Distribution</th></tr></thead><tbody>${diseaseRows||'<tr><td colspan="3">No data</td></tr>'}</tbody></table>
      <h2>Cases by Severity</h2><table><thead><tr><th>Severity</th><th style="text-align:right">Count</th></tr></thead><tbody>${sevRows||'<tr><td colspan="2">No data</td></tr>'}</tbody></table>
      <h2>New Cases (${newCases.length})</h2><table><thead><tr><th>ID</th><th>Patient</th><th>Age</th><th>Disease</th><th>Barangay</th><th>Severity</th><th>Status</th></tr></thead><tbody>${newCaseRows||'<tr><td colspan="7">No new cases</td></tr>'}</tbody></table>
      <div class="footer">Cabuyao City Disease Monitoring System - ${data.generatedBy} (${scopeLabel})</div>
      </body></html>`;
    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `Weekly_Summary_${scopeLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${startDate}.doc`; a.click();
  };

  // ── Export: CSV ──
  const handleExportCSV = () => {
    if (!data) return;
    const headers = 'ID,Patient Name,Age,Gender,Disease,Barangay,Severity,Status,Date Reported\n';
    const rows = data.newCases.map(c =>
      `#${String(c.case_id).padStart(3,'0')},"${c.patient_name||''}",${c.age||''},"${c.gender||''}","${c.disease_name||''}","${c.barangay_name||''}","${c.severity||''}","${c.status||''}","${c.date_reported||''}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `Weekly_Summary_${startDate}.csv`; a.click();
  };

  const cardStyle = { flex: '1 1 0', minWidth: '120px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', textAlign: 'center' };
  const tableContainerStyle = { background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' };

  if (loading) return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <div style={{ fontSize: '15px', color: 'var(--text-muted)' }}>Loading weekly summary...</div>
    </div>
  );

  if (error) return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <div style={{ fontSize: '15px', color: '#DC2626' }}>Error: {error}</div>
      <button onClick={fetchData} style={{ marginTop: '12px', padding: '8px 20px', background: '#1E3A8A', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Retry</button>
    </div>
  );

  if (!data) return null;

  const { summary, byBarangay, byDisease, bySeverity, newCases, auditLogs, scopeLabel, dateRange } = data;
  const maxBarangayCount = Math.max(...byBarangay.map(b => b.count), 1);
  const maxDiseaseCount = Math.max(...byDisease.map(d => d.count), 1);
  const highRiskCount = byBarangay.filter(b => b.count >= 20).length;

  return (
    <div style={{ padding: compactMode ? '12px 16px' : '20px 28px', overflowY: 'auto', height: '100%', fontSize: `${(fontScale || 1) * 14}px` }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          {onBack && (
            <button onClick={onBack} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)', cursor: 'pointer', fontSize: '13px', fontWeight: '600', flexShrink: 0, marginTop: '2px' }}>
              ← Back
            </button>
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', color: 'var(--text-h)' }}>Weekly Disease Summary Report</h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              {scopeLabel} | Period: {fmtDate(dateRange.start)} - {fmtDate(dateRange.end)}
            </p>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Prepared by: {data.generatedBy} | Generated: {fmtDateTime(data.generatedAt)}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* Date Range */}
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '12px' }} />
          <span style={{ color: 'var(--text-muted)', alignSelf: 'center', fontSize: '12px' }}>to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '12px' }} />
          <button onClick={fetchData} style={{ padding: '6px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
            Generate
          </button>
          {/* Export */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <ExportMenu onPrint={handlePrint} onWord={handleExportWord} onCSV={handleExportCSV} />
          </div>
        </div>
      </div>

      {/* ── Key Metrics ── */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ ...cardStyle, borderLeft: '3px solid #1E3A8A' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1E3A8A' }}>{summary.total_cases}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Total Cases</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '3px solid #DC2626' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#DC2626' }}>{summary.new_this_week}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>New This Period</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '3px solid #f59e0b' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#f59e0b' }}>{summary.active_cases}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Active</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '3px solid #10b981' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981' }}>{summary.recovered}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Recovered</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '3px solid #991b1b' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#991b1b' }}>{summary.deceased}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Deceased</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '3px solid #DC2626' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: highRiskCount > 0 ? '#DC2626' : '#10b981' }}>{highRiskCount}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>High-Risk Areas</div>
        </div>
      </div>

      {/* ── Cases by Barangay ── */}
      <div style={tableContainerStyle}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '15px', color: 'var(--text-h)' }}>Cases by Barangay</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{byBarangay.length} barangay{byBarangay.length !== 1 ? 's' : ''}</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-main)' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Barangay</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Count</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', width: '40%' }}>Distribution</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Risk Level</th>
            </tr>
          </thead>
          <tbody>
            {byBarangay.map(b => (
              <tr key={b.barangay_name} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '10px 16px', fontSize: '13px' }}>{b.barangay_name}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '700', fontSize: '14px' }}>{b.count}</td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ background: 'var(--border-color)', borderRadius: '4px', height: '18px', overflow: 'hidden' }}>
                    <div style={{ width: `${(b.count / maxBarangayCount) * 100}%`, background: getRiskColor(b.count), height: '100%', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                  </div>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', background: `${getRiskColor(b.count)}22`, color: getRiskColor(b.count) }}>
                    {getRiskLabel(b.count)} Risk
                  </span>
                </td>
              </tr>
            ))}
            {byBarangay.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No barangay data</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Cases by Disease ── */}
      <div style={tableContainerStyle}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '15px', color: 'var(--text-h)' }}>Cases by Disease</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{byDisease.filter(d => d.count > 0).length} diseases with cases</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-main)' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Disease</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Count</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', width: '40%' }}>Distribution</th>
            </tr>
          </thead>
          <tbody>
            {byDisease.filter(d => d.count > 0).map(d => (
              <tr key={d.disease_name} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '10px 16px', fontSize: '13px' }}>{d.disease_name}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '700', fontSize: '14px' }}>{d.count}</td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ background: 'var(--border-color)', borderRadius: '4px', height: '18px', overflow: 'hidden' }}>
                    <div style={{ width: `${(d.count / maxDiseaseCount) * 100}%`, background: d.count / maxDiseaseCount >= 0.7 ? '#DC2626' : d.count / maxDiseaseCount >= 0.35 ? '#f59e0b' : '#10b981', height: '100%', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                  </div>
                </td>
              </tr>
            ))}
            {byDisease.filter(d => d.count > 0).length === 0 && (
              <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No disease data</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Two-column row: Severity + Risk Assessment ── */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {/* Cases by Severity */}
        <div style={{ ...tableContainerStyle, flex: '1 1 300px', marginBottom: 0, alignSelf: 'flex-start' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)' }}>
            <h2 style={{ margin: 0, fontSize: '15px', color: 'var(--text-h)' }}>Cases by Severity</h2>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-main)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Severity</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {bySeverity.map(s => (
                <tr key={s.severity} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: getSeverityColor(s.severity), flexShrink: 0 }} />
                      <span style={{ fontSize: '13px' }}>{s.severity}</span>
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '700', fontSize: '14px' }}>{s.count}</td>
                </tr>
              ))}
              {bySeverity.length === 0 && (
                <tr><td colSpan={2} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No severity data</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Risk Assessment */}
        <div style={{ ...tableContainerStyle, flex: '1 1 300px', marginBottom: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)' }}>
            <h2 style={{ margin: 0, fontSize: '15px', color: 'var(--text-h)' }}>Risk Assessment</h2>
          </div>
          <div style={{ padding: '12px 16px' }}>
            {byBarangay.filter(b => b.count >= 20).length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#DC2626', marginBottom: '6px' }}>HIGH RISK (20+ cases)</div>
                {byBarangay.filter(b => b.count >= 20).map(b => (
                  <div key={b.barangay_name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#DC262615', borderRadius: '6px', marginBottom: '4px', borderLeft: '3px solid #DC2626' }}>
                    <span style={{ fontSize: '13px' }}>{b.barangay_name}</span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#DC2626' }}>{b.count} cases</span>
                  </div>
                ))}
              </div>
            )}
            {byBarangay.filter(b => b.count >= 10 && b.count < 20).length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#f59e0b', marginBottom: '6px' }}>MEDIUM RISK (10-19 cases)</div>
                {byBarangay.filter(b => b.count >= 10 && b.count < 20).map(b => (
                  <div key={b.barangay_name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f59e0b15', borderRadius: '6px', marginBottom: '4px', borderLeft: '3px solid #f59e0b' }}>
                    <span style={{ fontSize: '13px' }}>{b.barangay_name}</span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#f59e0b' }}>{b.count} cases</span>
                  </div>
                ))}
              </div>
            )}
            {byBarangay.filter(b => b.count < 10).length > 0 && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#10b981', marginBottom: '6px' }}>LOW RISK (&lt;10 cases)</div>
                {byBarangay.filter(b => b.count < 10).map(b => (
                  <div key={b.barangay_name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#10b98115', borderRadius: '6px', marginBottom: '4px', borderLeft: '3px solid #10b981' }}>
                    <span style={{ fontSize: '13px' }}>{b.barangay_name}</span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#10b981' }}>{b.count} cases</span>
                  </div>
                ))}
              </div>
            )}
            {byBarangay.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No data</div>
            )}
          </div>
        </div>
      </div>

      {/* ── New Cases This Period ── */}
      <div style={tableContainerStyle}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '15px', color: 'var(--text-h)' }}>New Cases This Period</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{newCases.length} case{newCases.length !== 1 ? 's' : ''}</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-main)' }}>
              {['ID', 'Patient Name', 'Age', 'Disease', 'Barangay', 'Severity', 'Status', 'Date'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Patient Name' || h === 'Disease' || h === 'Barangay' ? 'left' : h === 'Date' ? 'right' : 'center', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {newCases.map(c => {
              const st = getStatusBadge(c.status);
              return (
                <tr key={c.case_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 16px', fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' }}>#{String(c.case_id).padStart(3, '0')}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px' }}>{c.patient_name || ''}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: '13px' }}>{c.age || '--'}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px' }}>{c.disease_name || ''}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px' }}>{c.barangay_name || ''}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: '12px' }}>
                    {c.severity ? (
                      <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', background: `${getSeverityColor(c.severity)}22`, color: getSeverityColor(c.severity) }}>{c.severity}</span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>N/A</span>}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', background: st.bg, color: st.color }}>{c.status}</span>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>{fmtShortDate(c.date_reported)}</td>
                </tr>
              );
            })}
            {newCases.length === 0 && (
              <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No new cases this period</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Weekly Activity Log ── */}
      <div style={tableContainerStyle}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '15px', color: 'var(--text-h)' }}>Weekly Activity Log</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{auditLogs.length} activit{auditLogs.length !== 1 ? 'ies' : 'y'}</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-main)' }}>
              {['Timestamp', 'User', 'Role', 'Action', 'Entity', 'Details'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Details' ? 'left' : h === 'Timestamp' ? 'left' : 'center', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {auditLogs.map(log => {
              const ab = getActionBadge(log.action);
              return (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtDateTime(log.created_at)}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px' }}>{log.user_full_name || log.user_name || 'System'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', background: log.user_role === 'CHO' ? '#1E3A8A22' : log.user_role === 'BHW' ? '#7c3aed22' : '#37415122', color: log.user_role === 'CHO' ? '#1E3A8A' : log.user_role === 'BHW' ? '#7c3aed' : '#6b7280' }}>
                      {log.user_role || 'System'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', background: ab.bg, color: ab.color }}>{log.action}</span>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: '12px' }}>{log.entity || ''}</td>
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.details || ''}</td>
                </tr>
              );
            })}
            {auditLogs.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No activity this period</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      <div style={{ marginTop: '20px', padding: '16px', textAlign: 'center', borderTop: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '12px' }}>
        Cabuyao City Disease Monitoring System - Prepared by {data.generatedBy} ({scopeLabel})
      </div>
    </div>
  );
}

// ── Export dropdown menu (same pattern as Dashboard) ──
function ExportMenu({ onPrint, onWord, onCSV }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(!open)} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
        Export ▾
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', zIndex: 20, minWidth: '150px', overflow: 'hidden' }}>
            <button onClick={() => { onPrint(); setOpen(false); }} style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border-color)' }}>Print / Save as PDF</button>
            <button onClick={() => { onWord(); setOpen(false); }} style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border-color)' }}>Word (.doc)</button>
            <button onClick={() => { onCSV(); setOpen(false); }} style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', fontSize: '13px' }}>CSV (.csv)</button>
          </div>
        </>
      )}
    </div>
  );
}
