import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const ALL_DISEASES = [
  'Acute Respiratory Infection',
  'Avian Influenza',
  'Chickenpox',
  'Cholera',
  'Dengue',
  'Diarrhea',
  'Diphtheria',
  'Ebola',
  'Hand Foot and Mouth Disease',
  'Hepatitis A',
  'Hepatitis B',
  'Hepatitis C',
  'HIV/AIDS',
  'Influenza',
  'Influenza A (H1N1)',
  'Leprosy',
  'Malaria',
  'Measles',
  'Meningococcemia',
  'Pertussis',
  'Poliomyelitis',
  'Rabies',
  'SARS',
  'Sore Eyes',
  'Tuberculosis',
  'Typhoid Fever',
];

const CASES_PER_PAGE = 10;

const Dashboard = ({ setActiveTab, loggedUser }) => {
  const [cases, setCases] = useState([]);
  const [selectedDisease, setSelectedDisease] = useState('Dengue');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: '2026-01-01', end: '2026-12-31' });
  const [currentPage, setCurrentPage] = useState(1);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef(null);

  useEffect(() => {
    axios.get('http://localhost:5000/api/disease_cases')
      .then((res) => { setCases(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (loading) {
    return <div style={{ color: 'var(--text-main)', padding: '40px', textAlign: 'center' }}>Loading dashboard data...</div>;
  }

  // --- STAT CARDS ---
  const totalCases = cases.length;
  const activeCases = cases.filter(c => c.status === 'Approved' || c.status === 'Pending').length;
  const recoveredCases = cases.filter(c => c.status === 'Recovered').length;
  const deathCases = cases.filter(c => c.status === 'Deceased').length;

  // --- BAR CHART: filter by disease, count by barangay, sort desc, show top 6 visible ---
  const diseaseFilteredCases = cases.filter(
    c => c.disease_name && c.disease_name.toLowerCase() === selectedDisease.toLowerCase()
  );

  const barangayCounts = {};
  diseaseFilteredCases.forEach(item => {
    const name = item.barangay_name || `Barangay ${item.barangay_id}`;
    barangayCounts[name] = (barangayCounts[name] || 0) + 1;
  });

  const sortedBars = Object.entries(barangayCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));

  const highestCount = sortedBars.length > 0 ? sortedBars[0].count : 1;

  // --- PAGINATION for recent cases ---
  const totalPages = Math.ceil(cases.length / CASES_PER_PAGE);
  const paginatedCases = cases.slice(
    (currentPage - 1) * CASES_PER_PAGE,
    currentPage * CASES_PER_PAGE
  );

  // --- EXPORT FUNCTIONS ---
  const handleExportCSV = () => {
    const headers = 'Case ID,Patient Name,Age,Barangay,Disease,Severity,Status,Date Reported\n';
    const rows = cases.map(c =>
      `"${c.case_id}","${c.patient_name || ''}","${c.age || ''}","${c.barangay_name || ''}","${c.disease_name || ''}","${c.severity || ''}","${c.status || ''}","${c.date_reported || ''}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'CDMS_Dashboard_Export.csv'; a.click();
    setShowExportMenu(false);
  };

  const handleExportExcel = () => {
    // Tab-separated values saved as .xls — opens in Excel
    const headers = 'Case ID\tPatient Name\tAge\tBarangay\tDisease\tSeverity\tStatus\tDate Reported\n';
    const rows = cases.map(c =>
      `${c.case_id}\t${c.patient_name || ''}\t${c.age || ''}\t${c.barangay_name || ''}\t${c.disease_name || ''}\t${c.severity || ''}\t${c.status || ''}\t${c.date_reported || ''}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'CDMS_Dashboard_Export.xls'; a.click();
    setShowExportMenu(false);
  };

  const handleExportWord = () => {
    const rows = cases.map(c =>
      `<tr>
        <td>${c.case_id}</td><td>${c.patient_name || ''}</td><td>${c.age || ''}</td>
        <td>${c.barangay_name || ''}</td><td>${c.disease_name || ''}</td>
        <td>${c.severity || ''}</td><td>${c.status || ''}</td><td>${c.date_reported || ''}</td>
      </tr>`
    ).join('');
    const html = `
      <html><head><meta charset="utf-8"><title>CDMS Report</title></head><body>
      <h2>Cabuyao Disease Monitoring System — Dashboard Export</h2>
      <p>Generated: ${new Date().toLocaleDateString()}</p>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:12px;">
        <thead style="background:#1E3A8A;color:white;">
          <tr><th>ID</th><th>Patient</th><th>Age</th><th>Barangay</th><th>Disease</th><th>Severity</th><th>Status</th><th>Date</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table></body></html>`;
    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'CDMS_Dashboard_Export.doc'; a.click();
    setShowExportMenu(false);
  };

  const handleExportPPT = () => {
    // Creates a basic HTML file styled like a slide — user can copy to PPT
    const topBarangays = sortedBars.slice(0, 5).map(b => `<li>${b.label}: <strong>${b.count} cases</strong></li>`).join('');
    const html = `
      <html><head><meta charset="utf-8"><title>CDMS Slide Export</title>
      <style>
        body { font-family: Arial, sans-serif; background: #0B1120; color: white; padding: 40px; }
        h1 { color: #10b981; } h2 { color: #60a5fa; margin-top: 40px; }
        .stat { display: inline-block; background: #1e293b; padding: 20px 30px; margin: 10px; border-radius: 8px; text-align: center; }
        .stat .num { font-size: 36px; font-weight: bold; color: #10b981; }
        .stat .lbl { font-size: 14px; color: #9ca3af; }
        ul { font-size: 18px; line-height: 2; }
      </style></head><body>
      <h1>Cabuyao Disease Monitoring System</h1>
      <p style="color:#9ca3af;">Generated: ${new Date().toLocaleDateString()}</p>
      <div>
        <div class="stat"><div class="num">${totalCases}</div><div class="lbl">Total Cases</div></div>
        <div class="stat"><div class="num">${activeCases}</div><div class="lbl">Active</div></div>
        <div class="stat"><div class="num">${recoveredCases}</div><div class="lbl">Recovered</div></div>
        <div class="stat"><div class="num">${deathCases}</div><div class="lbl">Deaths</div></div>
      </div>
      <h2>Top Affected Barangays — ${selectedDisease}</h2>
      <ul>${topBarangays || '<li>No data for selected disease</li>'}</ul>
      <p style="color:#6b7280;font-size:12px;margin-top:40px;">Copy this content into PowerPoint for presentation use.</p>
      </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'CDMS_Slide_Export.html'; a.click();
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    const rows = paginatedCases.map(c =>
      `<tr>
        <td>#${String(c.case_id).padStart(3,'0')}</td>
        <td>${c.patient_name || ''}</td>
        <td>${c.age || '--'}</td>
        <td>${c.barangay_name || ''}</td>
        <td>${c.disease_name || ''}</td>
        <td>${c.severity || 'N/A'}</td>
        <td>${c.status || ''}</td>
      </tr>`
    ).join('');
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head><title>CDMS Print Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 13px; }
        h2 { color: #1e3a8a; } p { color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #1e3a8a; color: white; padding: 10px; text-align: left; }
        td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
        tr:nth-child(even) { background: #f9fafb; }
        @media print { button { display: none; } }
      </style></head><body>
      <h2>Cabuyao Disease Monitoring System</h2>
      <p>Report generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; Showing page ${currentPage} of ${totalPages}</p>
      <table>
        <thead><tr><th>ID</th><th>Patient Name</th><th>Age</th><th>Barangay</th><th>Disease</th><th>Severity</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <br/><button onclick="window.print();" style="padding:10px 24px;background:#1e3a8a;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">
        🖨️ Print / Save as PDF
      </button>
      </body></html>`);
    printWindow.document.close();
  };

  // --- STATUS BADGE STYLE ---
  const getStatusStyle = (status) => {
    if (status === 'Approved' || status === 'Pending') return { background: '#1E3A8A', color: '#60A5FA' };
    if (status === 'Recovered') return { background: '#064E3B', color: '#34D399' };
    if (status === 'Deceased') return { background: '#7f1d1d', color: '#fca5a5' };
    return { background: '#374151', color: '#9ca3af' };
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── STAT CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[
          { label: 'Total Cases', value: totalCases, color: '#3b82f6' },
          { label: 'Active', value: activeCases, color: '#f59e0b' },
          { label: 'Recovered', value: recoveredCases, color: '#10b981' },
          { label: 'Deaths', value: deathCases, color: '#ef4444' },
        ].map(card => (
          <div key={card.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
            <div style={{ color: card.color, fontSize: '32px', fontWeight: '700', marginTop: '6px' }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* ── CHART + FILTER ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px' }}>

        {/* BAR CHART */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px' }}>
          <h4 style={{ color: 'var(--text-main)', margin: '0 0 16px 0', fontSize: '15px', fontWeight: '600' }}>
            {selectedDisease} Cases by Barangay
          </h4>

          {sortedBars.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '20px 0' }}>
              No cases found for {selectedDisease}.
            </div>
          ) : (
            /* Scrollable container — shows 6, scroll for rest */
            <div style={{ maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
              {sortedBars.map((bar, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <span style={{ minWidth: '180px', fontSize: '13px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {bar.label} ({bar.count})
                  </span>
                  <div style={{ flex: 1, background: 'var(--input-bg)', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${(bar.count / highestCount) * 100}%`,
                      background: i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#3b82f6',
                      height: '100%',
                      borderRadius: '6px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FILTER & CONTROLS */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ color: 'var(--text-main)', margin: '0', fontSize: '15px', fontWeight: '600' }}>Filter & Controls</h4>

          {/* Disease dropdown — all 26 */}
          <div>
            <label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Disease</label>
            <select
              value={selectedDisease}
              onChange={(e) => setSelectedDisease(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px' }}
            >
              {ALL_DISEASES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Date range — compact */}
          <div>
            <label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Date Range</label>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                style={{ flex: 1, padding: '6px 8px', background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px' }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                style={{ flex: 1, padding: '6px 8px', background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px' }}
              />
            </div>
          </div>

          {/* EXPORT dropdown button */}
          <div style={{ position: 'relative' }} ref={exportRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{ width: '100%', padding: '8px', background: '#1E3A8A', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              📤 Export Data ▾
            </button>
            {showExportMenu && (
              <div style={{ position: 'absolute', bottom: '110%', left: 0, width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                {[
                  { label: '📄 Word (.doc)', action: handleExportWord },
                  { label: '📊 Excel (.xls)', action: handleExportExcel },
                  { label: '📋 CSV (.csv)', action: handleExportCSV },
                  { label: '🎞️ PPT Slide (.html)', action: handleExportPPT },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', textAlign: 'left', fontSize: '13px', borderBottom: '1px solid var(--border-color)' }}
                    onMouseEnter={e => e.target.style.background = 'var(--input-bg)'}
                    onMouseLeave={e => e.target.style.background = 'transparent'}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PRINT button */}
          <button
            onClick={handlePrint}
            style={{ width: '100%', padding: '8px', background: '#065f46', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
          >
            🖨️ Print Report
          </button>
        </div>
      </div>

      {/* ── RECENT CASE REPORTS ── */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px' }}>

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h4 style={{ color: 'var(--text-main)', margin: 0, fontSize: '15px', fontWeight: '600' }}>
            Recent Case Reports
            <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '400', marginLeft: '8px' }}>
              ({cases.length} total)
            </span>
          </h4>
          <button
            onClick={() => setActiveTab('Manage Cases')}
            style={{ padding: '6px 14px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
          >
            View All →
          </button>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['ID', 'Patient Name', 'Age', 'Barangay', 'Disease', 'Severity', 'Status'].map(h => (
                <th key={h} style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600', padding: '10px 12px', borderBottom: '1px solid var(--border-color)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedCases.map((c) => (
              <tr key={c.case_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>#{String(c.case_id).padStart(3, '0')}</td>
                <td style={{ padding: '12px', color: 'var(--text-main)', fontSize: '14px', fontWeight: '500' }}>{c.patient_name || 'Unknown'}</td>
                <td style={{ padding: '12px', color: 'var(--text-main)', fontSize: '13px' }}>{c.age || '--'}</td>
                <td style={{ padding: '12px', color: 'var(--text-main)', fontSize: '13px' }}>{c.barangay_name || `ID: ${c.barangay_id}`}</td>
                <td style={{ padding: '12px', color: 'var(--text-main)', fontSize: '13px' }}>{c.disease_name || '--'}</td>
                <td style={{ padding: '12px', color: 'var(--text-main)', fontSize: '13px' }}>{c.severity || 'N/A'}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '500', ...getStatusStyle(c.status) }}>
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Showing {(currentPage - 1) * CASES_PER_PAGE + 1}–{Math.min(currentPage * CASES_PER_PAGE, cases.length)} of {cases.length} cases
          </span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ padding: '5px 12px', background: currentPage === 1 ? 'var(--input-bg)' : '#1E3A8A', color: currentPage === 1 ? 'var(--text-muted)' : 'white', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '13px' }}
            >
              ← Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                style={{ padding: '5px 10px', background: page === currentPage ? '#1E3A8A' : 'transparent', color: page === currentPage ? 'white' : 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', minWidth: '32px' }}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ padding: '5px 12px', background: currentPage === totalPages ? 'var(--input-bg)' : '#1E3A8A', color: currentPage === totalPages ? 'var(--text-muted)' : 'white', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '13px' }}
            >
              Next →
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;