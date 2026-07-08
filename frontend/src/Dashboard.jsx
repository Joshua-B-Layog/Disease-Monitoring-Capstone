import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from './config';

const ALL_DISEASES = [
  'Acute Respiratory Infection','Avian Influenza','Chickenpox','Cholera','Dengue',
  'Diarrhea','Covid-19','Diphtheria','Ebola','Hand Foot and Mouth Disease','Hepatitis A',
  'Hepatitis B','Hepatitis C','HIV/AIDS','Influenza','Influenza A',
  'Leprosy','Leptospirosis','Malaria','Measles','Meningococcemia','Pertussis','Poliomyelitis',
  'Rabies','SARS','Sore Eyes','Tuberculosis','Typhoid Fever',
];

// Sorted by length descending for prefix matching (longest-first)
const SORTED_ALL_DISEASES = [...ALL_DISEASES].sort((a, b) => b.length - a.length);

const findBestDisease = (diseaseName) => {
  if (!diseaseName) return null;
  const dn = diseaseName.toLowerCase();
  for (const d of SORTED_ALL_DISEASES) {
    const dl = d.toLowerCase();
    if (dn === dl || dn.startsWith(dl + ' ')) return d;
  }
  return null;
};

const CASES_PER_PAGE = 10;

const formatDateStr = (dateStr, fmt) => {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const shortY = String(y).slice(-2);
  if (fmt === 'DD/MM/YY') return `${day}/${m}/${shortY}`;
  if (fmt === 'YYYY-MM-DD') return `${y}-${m}-${day}`;
  return `${m}/${day}/${shortY}`;
};

const Dashboard = ({ setActiveTab, loggedUser, dateFormat, fontScale, compactMode, loginRole, loginBarangay, sessionContext }) => {
  const [cases, setCases] = useState([]);
  const [selectedDisease, setSelectedDisease] = useState('Dengue');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: '2026-01-01', end: '2026-12-31' });
  const [currentPage, setCurrentPage] = useState(1);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef(null);

  const CHO_UNIT_BARANGAYS = {
    'CHO Unit I (Sala)': [
      'Barangay Uno (Poblacion)', 'Barangay Dos (Poblacion)', 'Barangay Tres (Poblacion)',
      'Sala', 'Bigaa', 'Butong', 'Marinig', 'Gulod', 'Niugan', 'Baclaran',
    ],
    'CHO Unit II (Pulo)': [
      'Pulo', 'Banay-Banay', 'Banlic', 'Mamatid', 'San Isidro', 'Diezmo', 'Pittland', 'Casile',
    ],
  };

  const [diseaseOpen, setDiseaseOpen] = useState(false);
  const diseaseRef = useRef(null);

  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(Date.now());

  const fetchCasesData = () => {
    axios.get(API_URL + '/api/disease_cases')
      .then((res) => { setCases(res.data); setLoading(false); setLastUpdated(Date.now()); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchCasesData();
    const interval = setInterval(fetchCasesData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
      if (diseaseRef.current && !diseaseRef.current.contains(e.target)) {
        setDiseaseOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const choUnitBarangays = sessionContext ? CHO_UNIT_BARANGAYS[sessionContext] || [] : [];

  const displayCases = (loginRole === 'BHW' && loginBarangay)
    ? cases.filter(c => c.barangay_name === loginBarangay)
    : (loginRole === 'CHO' && choUnitBarangays.length > 0)
      ? cases.filter(c => choUnitBarangays.includes(c.barangay_name))
      : cases;

  if (loading) {
    return <div style={{ color: 'var(--text-main)', padding: '40px', textAlign: 'center' }}>Loading dashboard data...</div>;
  }

  // --- STAT CARDS ---
  const totalCases = displayCases.length;
  const activeCases = displayCases.filter(c => ['Active', 'Pending', 'Under Treatment'].includes(c.status)).length;
  const recoveredCases = displayCases.filter(c => c.status === 'Recovered').length;
  const deathCases = displayCases.filter(c => c.status === 'Deceased').length;

  // --- BAR CHART DATA (prefix matching for variants) ---
  const diseaseFilteredCases = displayCases.filter(c => {
    if (!c.disease_name) return false;
    const best = findBestDisease(c.disease_name);
    return best && best.toLowerCase() === selectedDisease.toLowerCase();
  });
  const barangayCounts = {};
  diseaseFilteredCases.forEach(item => {
    const name = item.barangay_name || `Barangay ${item.barangay_id}`;
    barangayCounts[name] = (barangayCounts[name] || 0) + 1;
  });
  const sortedBars = Object.entries(barangayCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
  const highestCount = sortedBars.length > 0 ? sortedBars[0].count : 1;

  const isBhw = loginRole === 'BHW';

  // Disease-level counts (prefix matching for variants)
  const diseaseCounts = {};
  ALL_DISEASES.forEach(d => { diseaseCounts[d] = 0; });
  displayCases.forEach(c => {
    if (c.disease_name) {
      const matched = findBestDisease(c.disease_name);
      if (matched) diseaseCounts[matched]++;
    }
  });
  const diseaseBars = Object.entries(diseaseCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // --- PAGINATION ---
  const totalPages = Math.ceil(displayCases.length / CASES_PER_PAGE);
  const paginatedCases = displayCases.slice(
    (currentPage - 1) * CASES_PER_PAGE,
    currentPage * CASES_PER_PAGE
  );

  // ─── SHARED: build bar chart HTML block for exports ───
  const buildBarChartHTML = (bars = sortedBars, title = `${selectedDisease} Cases by Barangay`, highest = highestCount) => {
    if (bars.length === 0) {
      return `<p style="color:#64748b;font-size:14px;">No cases found.</p>`;
    }
    const barRows = bars.map((bar, i) => {
      const pct = highest > 0 ? Math.round((bar.count / highest) * 100) : 0;
      const color = i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#3b82f6';
      return `
        <tr>
          <td style="padding:6px 10px 6px 0;font-size:13px;white-space:nowrap;min-width:160px;">${bar.label}</td>
          <td style="padding:6px 0;width:100%;">
            <div style="background:#e2e8f0;border-radius:4px;height:24px;width:100%;overflow:hidden;position:relative;">
              <div style="background:${color};height:100%;width:${pct}%;border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:8px;color:#fff;font-weight:700;font-size:14px;box-sizing:border-box;min-width:${bar.count > 0 ? '24px' : '0'};">
                ${bar.count > 0 ? bar.count : ''}
              </div>
            </div>
          </td>
        </tr>`;
    }).join('');
    return `
      <table style="width:100%;border-collapse:collapse;">
        <tbody>${barRows}</tbody>
      </table>`;
  };

  // ─── SHARED: build case table rows HTML ───
  const buildTableRowsHTML = (caseList) => caseList.map(c =>
    `<tr>
      <td>${c.case_id}</td>
      <td>${c.patient_name || ''}</td>
      <td>${c.age || '--'}</td>
      <td>${c.barangay_name || ''}</td>
      <td>${c.disease_name || ''}</td>
      <td>${c.severity || 'N/A'}</td>
      <td>${c.status || ''}</td>
    </tr>`
  ).join('');

  // --- EXPORT: WORD ---
  const handleExportWord = () => {
    const eBars = isBhw ? diseaseBars : sortedBars;
    const eTitle = isBhw ? 'All Diseases - Case Counts' : `${selectedDisease} Cases by Barangay`;
    const eHighest = isBhw ? (diseaseBars.length > 0 ? diseaseBars[0].count : 1) : highestCount;
    const html = `
      <html><head><meta charset="utf-8"><title>CDMS Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; font-size: 13px; color: #111; }
        h2 { color: #1e3a8a; margin-bottom: 4px; }
        p { color: #555; margin: 0 0 20px 0; }
        h3 { color: #1e3a8a; margin: 24px 0 10px 0; font-size: 15px; }
        table.main { width: 100%; border-collapse: collapse; margin-top: 8px; }
        table.main th { background: #1e3a8a; color: white; padding: 9px 10px; text-align: center; font-size: 12px; }
        table.main td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 12px; }
        table.main tr:nth-child(even) td { background: #f9fafb; }
        .bar-section { margin: 8px 0 24px 0; }
      </style></head><body>
      <h2>Cabuyao Disease Monitoring System — Dashboard Export</h2>
      <p>Generated: ${new Date().toLocaleDateString()} &nbsp;|&nbsp; Date Range: ${dateRange.start} to ${dateRange.end}</p>

      <h3>${eTitle}</h3>
      <div class="bar-section">${buildBarChartHTML(eBars, eTitle, eHighest)}</div>

      <h3>Case Records</h3>
      <table class="main">
        <thead><tr><th>ID</th><th>Patient</th><th>Age</th><th>Barangay</th><th>Disease</th><th>Severity</th><th>Status</th></tr></thead>
        <tbody>${buildTableRowsHTML(cases)}</tbody>
      </table>
      </body></html>`;
    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'CDMS_Dashboard_Export.doc'; a.click();
    setShowExportMenu(false);
  };

  // --- EXPORT: EXCEL ---
  const handleExportExcel = () => {
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

  // --- EXPORT: CSV ---
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

  // --- EXPORT: PPT ---
  const handleExportPPT = () => {
    const eBars = isBhw ? diseaseBars : sortedBars;
    const eTitle = isBhw ? 'All Diseases — Case Counts' : `${selectedDisease} Cases by Barangay`;
    const eHighest = isBhw ? (diseaseBars.length > 0 ? diseaseBars[0].count : 1) : highestCount;
    const html = `
      <html><head><meta charset="utf-8"><title>CDMS Slide Export</title>
      <style>
        body { font-family: Arial, sans-serif; background: #0B1120; color: white; padding: 40px; }
        h1 { color: #10b981; margin-bottom: 4px; } 
        h2 { color: #60a5fa; margin-top: 36px; margin-bottom: 12px; font-size: 18px; }
        p { color: #9ca3af; margin: 0 0 24px 0; font-size: 13px; }
        .stats { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }
        .stat { background: #1e293b; padding: 18px 28px; border-radius: 8px; text-align: center; min-width: 100px; }
        .stat .num { font-size: 32px; font-weight: bold; color: #10b981; }
        .stat .lbl { font-size: 12px; color: #9ca3af; margin-top: 4px; }
        table.bars { width: 100%; border-collapse: collapse; }
        table.bars td { padding: 5px 8px; font-size: 13px; color: #e2e8f0; }
        .track { background: #334155; border-radius: 4px; height: 24px; width: 100%; overflow: hidden; position: relative; }
        .fill-red { background: #ef4444; height: 100%; border-radius: 4px; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; color: #fff; font-weight: 700; font-size: 14px; box-sizing: border-box; }
        .fill-amber { background: #f59e0b; height: 100%; border-radius: 4px; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; color: #fff; font-weight: 700; font-size: 14px; box-sizing: border-box; }
        .fill-blue { background: #3b82f6; height: 100%; border-radius: 4px; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; color: #fff; font-weight: 700; font-size: 14px; box-sizing: border-box; }
        footer { color: #4b5563; font-size: 11px; margin-top: 40px; border-top: 1px solid #1e293b; padding-top: 12px; }
      </style></head><body>
      <h1>Cabuyao Disease Monitoring System</h1>
      <p>Dashboard Export &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString()} &nbsp;|&nbsp; ${dateRange.start} to ${dateRange.end}</p>

      <div class="stats">
        <div class="stat"><div class="num">${totalCases}</div><div class="lbl">Total Cases</div></div>
        <div class="stat"><div class="num" style="color:#f59e0b;">${activeCases}</div><div class="lbl">Active</div></div>
        <div class="stat"><div class="num">${recoveredCases}</div><div class="lbl">Recovered</div></div>
        <div class="stat"><div class="num" style="color:#ef4444;">${deathCases}</div><div class="lbl">Deaths</div></div>
      </div>

      <h2>${eTitle}</h2>
      ${eBars.length === 0
        ? `<p>No cases found.</p>`
        : `<table class="bars"><tbody>
            ${eBars.map((bar, i) => {
              const pct = eHighest > 0 ? Math.round((bar.count / eHighest) * 100) : 0;
              const fillClass = i === 0 ? 'fill-red' : i === 1 ? 'fill-amber' : 'fill-blue';
              return `<tr>
                <td style="min-width:170px;white-space:nowrap;">${bar.label}</td>
                <td style="width:100%;"><div class="track"><div class="${fillClass}" style="width:${pct}%;">${bar.count > 0 ? bar.count : ''}</div></div></td>
              </tr>`;
            }).join('')}
          </tbody></table>`
      }

      <footer>Copy content into PowerPoint for presentation. &copy; 2026 City Health Office (CHO) Cabuyao</footer>
      </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'CDMS_Slide_Export.html'; a.click();
    setShowExportMenu(false);
  };

  // --- PRINT ---
  const handlePrint = () => {
    const eBars = isBhw ? diseaseBars : sortedBars;
    const eTitle = isBhw ? 'All Diseases — Case Counts' : `${selectedDisease} Cases by Barangay`;
    const eHighest = isBhw ? (diseaseBars.length > 0 ? diseaseBars[0].count : 1) : highestCount;
    const rows = displayCases.map(c =>
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
        body { font-family: Arial, sans-serif; padding: 28px; font-size: 13px; color: #111; }
        h2 { color: #1e3a8a; margin-bottom: 2px; }
        p { color: #555; margin: 0 0 20px 0; }
        h3 { color: #1e3a8a; margin: 20px 0 8px 0; font-size: 14px; }
        table.main { width: 100%; border-collapse: collapse; }
        table.main th { background: #1e3a8a; color: white; padding: 9px 10px; text-align: center; font-size: 12px; }
        table.main td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 12px; }
        table.main tr:nth-child(even) td { background: #f9fafb; }
        .bar-section { margin-bottom: 24px; }
        @media print { button { display: none; } }
      </style></head><body>
      <h2>Cabuyao Disease Monitoring System</h2>
      <p>Report generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; Date Range: ${dateRange.start} to ${dateRange.end}</p>

      <h3>${eTitle}</h3>
      <div class="bar-section">${buildBarChartHTML(eBars, eTitle, eHighest)}</div>

      <h3>Recent Case Records</h3>
      <table class="main">
        <thead><tr><th>ID</th><th>Patient Name</th><th>Age</th><th>Barangay</th><th>Disease</th><th>Severity</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <br/>
      <button onclick="window.print();" style="padding:10px 24px;background:#1e3a8a;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">
        🖨️ Print / Save as PDF
      </button>
      </body></html>`);
    printWindow.document.close();
  };

  // --- STATUS BADGE STYLE ---
  const getStatusStyle = (status) => {
    if (status === 'Active') return { background: '#1E3A8A', color: '#60A5FA' };
    if (status === 'Pending') return { background: '#1e3a8a', color: '#93c5fd' };
    if (status === 'Under Treatment') return { background: '#3b0764', color: '#c4b5fd' };
    if (status === 'Recovered') return { background: '#064E3B', color: '#34D399' };
    if (status === 'Deceased') return { background: '#7f1d1d', color: '#fca5a5' };
    if (status === 'Draft') return { background: '#374151', color: '#9ca3af' };
    return { background: '#374151', color: '#9ca3af' };
};

  return (
        <div style={{ padding: compactMode ? '14px' : '24px', display: 'flex', flexDirection: 'column', gap: compactMode ? '12px' : '20px', fontSize: `calc(14px * ${fontScale || '1'})` }}>

      {/* ── STAT CARDS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: compactMode ? '10px' : '16px' }}>
        {[
          { label: 'Total Cases', value: totalCases, color: '#3b82f6' },
          { label: 'Active', value: activeCases, color: '#f59e0b' },
          { label: 'Recovered', value: recoveredCases, color: '#10b981' },
          { label: 'Deaths', value: deathCases, color: '#ef4444' },
        ].map(card => (
            <div key={card.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: compactMode ? '12px' : '20px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
            <div style={{ color: card.color, fontSize: '32px', fontWeight: '700', marginTop: '6px' }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* ── CHART + FILTER ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px' }}>

        {/* BAR CHART */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: compactMode ? '12px' : '20px' }}>
          <h4 style={{ color: 'var(--text-main)', margin: '0 0 16px 0', fontSize: '15px', fontWeight: '600' }}>
            {isBhw ? 'All Diseases - Case Counts' : `${selectedDisease} Cases by Barangay`}
          </h4>
          {isBhw ? (
            <div style={{ maxHeight: '480px', overflowY: 'auto', paddingRight: '4px' }}>
              {diseaseBars.map((bar, i) => {
                const dHighest = diseaseBars.length > 0 ? diseaseBars[0].count : 1;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <span style={{ minWidth: '180px', fontSize: '13px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {bar.label}
                    </span>
                    <div style={{ flex: 1, background: 'var(--input-bg)', height: '24px', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        width: dHighest > 0 ? `${(bar.count / dHighest) * 100}%` : '0%',
                        background: '#3b82f6',
                        height: '100%', borderRadius: '6px', transition: 'width 0.4s ease',
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                        paddingRight: '8px', color: '#fff', fontWeight: '700', fontSize: '14px',
                        boxSizing: 'border-box'
                      }}>
                        {bar.count > 0 ? bar.count : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : sortedBars.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '20px 0' }}>
              No cases found for {selectedDisease}.
            </div>
          ) : (
            <div style={{ maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
              {sortedBars.map((bar, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <span style={{ minWidth: '180px', fontSize: '13px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {bar.label}
                  </span>
                  <div style={{ flex: 1, background: 'var(--input-bg)', height: '24px', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      width: `${(bar.count / highestCount) * 100}%`,
                      background: i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#3b82f6',
                      height: '100%', borderRadius: '6px', transition: 'width 0.4s ease',
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                      paddingRight: '8px', color: '#fff', fontWeight: '700', fontSize: '14px',
                      boxSizing: 'border-box'
                    }}>
                      {bar.count > 0 ? bar.count : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FILTER & CONTROLS — FIX: date inputs no longer overflow */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: compactMode ? '12px' : '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ color: 'var(--text-main)', margin: '0', fontSize: '15px', fontWeight: '600' }}>Filter & Controls</h4>

          {!isBhw && <div>
            <label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Disease</label>
            <div style={{ position: 'relative' }} ref={diseaseRef}>
              <button
                onClick={() => setDiseaseOpen(!diseaseOpen)}
                style={{ width: '100%', padding: '7px 10px', background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span>{selectedDisease}</span>
                <span style={{ marginLeft: '6px', opacity: 0.6 }}>▼</span>
              </button>
              {diseaseOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  maxHeight: '250px', overflowY: 'auto', marginTop: '4px',
                  background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                  borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                }}>
                  {ALL_DISEASES.map(d => (
                    <div
                      key={d}
                      onClick={() => { setSelectedDisease(d); setDiseaseOpen(false); }}
                      style={{
                        padding: '7px 10px', cursor: 'pointer', fontSize: '13px',
                        background: selectedDisease === d ? 'var(--input-bg)' : 'transparent',
                        color: 'var(--text-main)',
                        fontWeight: selectedDisease === d ? '600' : '400',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--input-bg)'}
                      onMouseLeave={e => { e.currentTarget.style.background = selectedDisease === d ? 'var(--input-bg)' : 'transparent'; }}
                    >
                      {d}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>}

          {/* ── FIX: Date range — stacked so neither overflows ── */}
          <div>
            <label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Date Range</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                style={{ width: '100%', padding: '6px 8px', background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' }}
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                style={{ width: '100%', padding: '6px 8px', background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* EXPORT dropdown */}
          <div style={{ position: 'relative' }} ref={exportRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{ width: '100%', padding: '8px', background: '#1E3A8A', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              📤 Export Data ▼
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

          {/* PRINT */}
          <button
            onClick={handlePrint}
            style={{ width: '100%', padding: '8px', background: '#065f46', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
          >
            🖨️ Print Report
          </button>

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', paddingTop: '4px' }}>
            {lastUpdated ? `Updated ${Math.round((now - lastUpdated) / 1000)}s ago` : 'Refreshing...'}
          </div>
        </div>
      </div>

      {/* ── RECENT CASE REPORTS ── */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: compactMode ? '12px' : '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h4 style={{ color: 'var(--text-main)', margin: 0, fontSize: '15px', fontWeight: '600' }}>
            Recent Case Reports
            <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '400', marginLeft: '8px' }}>
              ({displayCases.length} total)
            </span>
          </h4>
          <button
            onClick={() => setActiveTab('Manage Cases')}
            style={{ padding: '6px 14px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
          >
            View All →
          </button>
        </div>

        {/* ── FIX: All headers centered, all cells centered ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['ID', 'Patient Name', 'Age', 'Barangay', 'Disease', 'Date Reported', 'Severity', 'Status'].map(h => (
                <th key={h} style={{
                  textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px',
                  fontWeight: '600', padding: compactMode ? '6px 8px' : '10px 12px', borderBottom: '1px solid var(--border-color)',
                  textTransform: 'uppercase', letterSpacing: '0.05em'
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedCases.map((c) => (
              <tr key={c.case_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: compactMode ? '7px 8px' : '12px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>#{String(c.case_id).padStart(3, '0')}</td>
                <td style={{ padding: compactMode ? '7px 8px' : '12px', color: 'var(--text-main)', fontSize: '14px', fontWeight: '500', textAlign: 'center' }}>{c.patient_name || 'Unknown'}</td>
                <td style={{ padding: compactMode ? '7px 8px' : '12px', color: 'var(--text-main)', fontSize: '13px', textAlign: 'center' }}>{c.age || '--'}</td>
                <td style={{ padding: compactMode ? '7px 8px' : '12px', color: 'var(--text-main)', fontSize: '13px', textAlign: 'center' }}>{c.barangay_name || `ID: ${c.barangay_id}`}</td>
                <td style={{ padding: compactMode ? '7px 8px' : '12px', color: 'var(--text-main)', fontSize: '13px', textAlign: 'center' }}>{c.disease_name || '--'}</td>
                <td style={{ padding: compactMode ? '7px 8px' : '12px', color: 'var(--text-main)', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap' }}>{formatDateStr(c.date_reported, dateFormat)}</td>
                <td style={{ padding: compactMode ? '7px 8px' : '12px', color: 'var(--text-main)', fontSize: '13px', textAlign: 'center' }}>{c.severity || 'N/A'}</td>
                <td style={{ padding: compactMode ? '7px 8px' : '12px', textAlign: 'center' }}>
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
            Showing {(currentPage - 1) * CASES_PER_PAGE + 1}–{Math.min(currentPage * CASES_PER_PAGE, displayCases.length)} of {displayCases.length} cases
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