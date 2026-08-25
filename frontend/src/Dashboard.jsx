import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from './config';
import { cacheCases, getCachedCases, isOnline } from './offlineSync';

// Counts up (or down) to `value` whenever it changes
const AnimatedNumber = ({ value, style }) => {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const from = prevRef.current;
    const to = Number(value) || 0;
    prevRef.current = to;
    if (from === to) { setDisplay(to); return; }
    let raf;
    const start = performance.now();
    const dur = 700;
    const tick = (now) => {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <div style={style}>{display}</div>;
};

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

const getWorkWeek = () => {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return {
    start: monday.toISOString().slice(0, 10),
    end: friday.toISOString().slice(0, 10),
  };
};

const toISO = (d) => d.toISOString().slice(0, 10);

const getPeriodRange = (period, quarter, year) => {
  const now = new Date();
  if (period === 'monthly') {
    return {
      start: toISO(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  if (period === 'quarterly') {
    const qStart = { 1: 0, 2: 3, 3: 6, 4: 9 }[quarter] || 0;
    return {
      start: toISO(new Date(year, qStart, 1)),
      end: toISO(new Date(year, qStart + 3, 0)),
    };
  }
  if (period === 'yearly') {
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }
  return getWorkWeek();
};

const Dashboard = ({ setActiveTab, loggedUser, dateFormat, fontScale, compactMode, loginRole, loginBarangay, sessionContext, selectedDisease, setSelectedDisease, dateRange, setDateRange, dashPeriod, setDashPeriod, dashQuarter, setDashQuarter, dashYear, setDashYear }) => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [ellipsisOpen, setEllipsisOpen] = useState(false);
  const [ellipsisPageInput, setEllipsisPageInput] = useState('');
  const ellipsisRef = useRef(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef(null);
  const [chartMounted, setChartMounted] = useState(false);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [showAllDiseases, setShowAllDiseases] = useState(false);
  const [allPeriod, setAllPeriod] = useState('monthly');
  const [allDateRange, setAllDateRange] = useState({ start: dateRange.start, end: dateRange.end });
  const [allQuarter, setAllQuarter] = useState(1);
  const [allYear, setAllYear] = useState(new Date().getFullYear());
  const [allYearOpen, setAllYearOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const yearRef = useRef(null);

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

  const [offlineMode, setOfflineMode] = useState(!isOnline());
  const fetchCasesData = () => {
    axios.get(API_URL + '/api/disease_cases')
      .then((res) => { setCases(res.data); setLoading(false); setLastUpdated(Date.now()); setOfflineMode(false); cacheCases(res.data).catch(() => {}); })
      .catch(async () => {
        const cached = await getCachedCases();
        if (cached.length > 0) { setCases(cached); setOfflineMode(true); }
        setLoading(false);
      });
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
      if (yearRef.current && !yearRef.current.contains(e.target)) {
        setYearOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!ellipsisOpen) return;
    const handler = (e) => { if (ellipsisRef.current && !ellipsisRef.current.contains(e.target)) setEllipsisOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ellipsisOpen]);

  useEffect(() => { setCurrentPage(1); }, [dateRange.start, dateRange.end]);

  useEffect(() => {
    setChartMounted(false);
    const t = setTimeout(() => setChartMounted(true), 60);
    return () => clearTimeout(t);
  }, [dashPeriod, dashQuarter, dashYear]);

  const choUnitBarangays = sessionContext ? CHO_UNIT_BARANGAYS[sessionContext] || [] : [];

  const scopedCases = (loginRole === 'BHW' && loginBarangay)
    ? cases.filter(c => c.barangay_name === loginBarangay)
    : (loginRole === 'CHO' && choUnitBarangays.length > 0)
      ? cases.filter(c => choUnitBarangays.includes(c.barangay_name))
      : cases;

  const displayCases = (() => {
    let filtered = scopedCases;
    if (dateRange.start) {
      filtered = filtered.filter(c => c.date_reported && c.date_reported.slice(0, 10) >= dateRange.start);
    }
    if (dateRange.end) {
      filtered = filtered.filter(c => c.date_reported && c.date_reported.slice(0, 10) <= dateRange.end);
    }
    return filtered;
  })();

  const allDiseaseDisplayCases = (() => {
    let filtered = scopedCases;
    if (allDateRange.start) {
      filtered = filtered.filter(c => c.date_reported && c.date_reported.slice(0, 10) >= allDateRange.start);
    }
    if (allDateRange.end) {
      filtered = filtered.filter(c => c.date_reported && c.date_reported.slice(0, 10) <= allDateRange.end);
    }
    return filtered;
  })();

  if (loading) {
    return (
      <div style={{ color: 'var(--text-main)', padding: '28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', marginBottom: '16px' }}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px' }}>
              <div className="cdms-skeleton" style={{ width: '70%', height: '12px', marginBottom: '12px' }} />
              <div className="cdms-skeleton" style={{ width: '45%', height: '26px' }} />
            </div>
          ))}
        </div>
        <div className="cdms-skeleton" style={{ width: '100%', height: '260px', borderRadius: '10px' }} />
      </div>
    );
  }

  // Count-based color: Red = highest, Yellow = 2nd highest (all ties), Blue = rest
  const getCountColor = (count, bars) => {
    if (!bars || bars.length === 0) return '#3b82f6';
    const uniqueCounts = [...new Set(bars.map(b => b.count))].filter(c => c > 0).sort((a, b) => b - a);
    if (uniqueCounts.length === 0) return '#3b82f6';
    if (count === uniqueCounts[0]) return '#DC2626';
    if (uniqueCounts.length > 1 && count === uniqueCounts[1]) return '#D97706';
    return '#3b82f6';
  };

  // ── FULL-PAGE: All Disease Count ──
  if (showAllDiseases) {
    const allDiseaseCounts = {};
    ALL_DISEASES.forEach(d => { allDiseaseCounts[d] = 0; });
    allDiseaseDisplayCases.forEach(c => {
      if (c.disease_name) {
        const matched = findBestDisease(c.disease_name);
        if (matched) allDiseaseCounts[matched]++;
      }
    });
    const allDiseaseList = Object.entries(allDiseaseCounts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
    const allDiseaseMax = allDiseaseList.length > 0 ? allDiseaseList[0].count : 1;
    const hasCases = allDiseaseList.some(d => d.count > 0);
    const allTotalCases = allDiseaseDisplayCases.length;
    const allYearList = (() => {
      const yrs = new Set();
      scopedCases.forEach(c => {
        if (c.date_reported) {
          const y = c.date_reported.slice(0, 4);
          if (/^\d{4}$/.test(y)) yrs.add(Number(y));
        }
      });
      return [...yrs].sort((a, b) => b - a);
    })();

    const allGridLines = (() => {
      const step = Math.max(1, Math.ceil(allDiseaseMax / 4));
      const top = step * 4;
      const lines = [];
      for (let k = 0; k <= 4; k++) lines.push({ value: k * step, frac: k / 4 });
      return { lines, top };
    })();

    return (
      <div className="cdms-view-in" style={{ padding: compactMode ? '12px' : '4px 28px 28px 28px' }}>
        <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '4px' }}>
          <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--accent, #60a5fa)' }} onClick={() => setShowAllDiseases(false)}>Dashboard</span>
          {' / All Disease Count'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '22px', color: 'var(--text-main)' }}>All Disease Count</h2>
          <button
            onClick={() => setShowAllDiseases(false)}
            style={{ padding: '8px 18px', background: '#121358', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Period selector bar — local state only */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {['weekly', 'monthly', 'quarterly', 'yearly'].map(p => (
              <button
                key={p}
                onClick={() => { setAllPeriod(p); setAllDateRange(getPeriodRange(p, allQuarter, allYear)); }}
                style={{
                  padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', fontWeight: '500', textTransform: 'capitalize',
                  background: allPeriod === p ? '#121358' : 'var(--input-bg)',
                  color: allPeriod === p ? 'white' : 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                {p}
              </button>
            ))}
          </div>

          {allPeriod === 'quarterly' && (
            <div style={{ display: 'flex', gap: '4px' }}>
              {[1, 2, 3, 4].map(q => (
                <button
                  key={q}
                  onClick={() => { setAllQuarter(q); setAllDateRange(getPeriodRange('quarterly', q, allYear)); }}
                  style={{
                    padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', fontWeight: '600',
                    background: allQuarter === q ? '#129968' : 'var(--input-bg)',
                    color: allQuarter === q ? 'white' : 'var(--text-muted)',
                    border: '1px solid var(--border-color)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  Q{q}
                </button>
              ))}
            </div>
          )}

          {(allPeriod === 'quarterly' || allPeriod === 'yearly') && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setAllYearOpen(!allYearOpen)}
                style={{
                  padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', fontWeight: '500',
                  background: 'var(--input-bg)', color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                {allYear} ▾
              </button>
              {allYearOpen && (
                <div style={{ position: 'absolute', top: '110%', left: 0, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '4px', zIndex: 100, maxHeight: '200px', overflowY: 'auto', minWidth: '80px' }}>
                  {allYearList.map(y => (
                    <div
                      key={y}
                      onClick={() => {
                        setAllYear(y);
                        setAllDateRange(allPeriod === 'yearly' ? getPeriodRange('yearly', 0, y) : getPeriodRange('quarterly', allQuarter, y));
                        setAllYearOpen(false);
                      }}
                      style={{
                        padding: '6px 10px', cursor: 'pointer', fontSize: '15px', borderRadius: '4px',
                        background: allYear === y ? 'rgba(96,165,250,0.25)' : 'transparent',
                        color: 'var(--text-main)',
                      }}
                      onMouseEnter={e => { if (allYear !== y) { e.currentTarget.style.background = 'rgba(96,165,250,0.25)'; e.currentTarget.style.color = 'var(--text-main)'; } }}
                      onMouseLeave={e => { if (allYear !== y) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-main)'; } }}
                    >
                      {y}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {(allPeriod === 'weekly' || allPeriod === 'monthly' || allPeriod === 'custom') && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="date"
                key={`all-start-${allDateRange.start}`}
                defaultValue={allDateRange.start}
                onBlur={(e) => { const v = e.target.value; if (/^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v))) { setAllDateRange({ ...allDateRange, start: v }); setAllPeriod('custom'); } }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                style={{ padding: '6px 8px', background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '15px' }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '15px' }}>to</span>
              <input
                type="date"
                key={`all-end-${allDateRange.end}`}
                defaultValue={allDateRange.end}
                onBlur={(e) => { const v = e.target.value; if (/^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v))) { setAllDateRange({ ...allDateRange, end: v }); setAllPeriod('custom'); } }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                style={{ padding: '6px 8px', background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '15px' }}
              />
            </div>
          )}

          <span style={{ marginLeft: 'auto', fontSize: '15px', color: 'var(--text-muted)' }}>
            {allDateRange.start} to {allDateRange.end}
          </span>
        </div>

        {/* ── Vertical Disease Bar Chart (28 diseases) ── */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: compactMode ? '12px' : '20px' }}>
          <h4 style={{ color: 'var(--text-main)', margin: '0 0 16px 0', fontSize: '15px', fontWeight: '600' }}>
            Disease Cases by Count
            <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '400', marginLeft: '8px' }}>({allTotalCases} total cases · {allDateRange.start} to {allDateRange.end})</span>
          </h4>
          {!hasCases ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '15px' }}>
              No cases found for this date range.
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', height: '280px', position: 'relative' }}>
                {/* Y-axis labels + grid */}
                <div style={{ width: '30px', height: '280px', position: 'relative', flexShrink: 0 }}>
                  {allGridLines.lines.map(l => {
                    const bottomPx = l.frac * 270;
                    return (
                      <span key={l.value} style={{ position: 'absolute', right: 4, bottom: `${bottomPx}px`, transform: 'translateY(50%)', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {l.value}
                      </span>
                    );
                  })}
                </div>
                {/* Bars area */}
                <div style={{ flex: 1, height: '280px', position: 'relative', display: 'flex', alignItems: 'flex-end', gap: '3px' }}>
                  {/* Grid lines */}
                  {allGridLines.lines.map(l => {
                    const bottomPx = l.frac * 270;
                    return <div key={l.value} style={{ position: 'absolute', left: 0, right: 0, bottom: `${bottomPx}px`, borderTop: '1px dashed var(--border-color)', pointerEvents: 'none' }} />;
                  })}
                  {/* Bars */}
                  {allDiseaseList.map((bar, i) => {
                    const h = chartMounted ? Math.max((bar.count / allGridLines.top) * 270, bar.count > 0 ? 4 : 2) : 0;
                    const color = getCountColor(bar.count, allDiseaseList);
                    const isHovered = hoveredBar && hoveredBar.idx === i;
                    return (
                      <div key={bar.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', position: 'relative' }}>
                        {/* Tooltip — only on hovered bar */}
                        {isHovered && (
                          <div style={{
                            position: 'absolute', bottom: `${h + 32}px`, left: '50%', transform: 'translateX(-50%)',
                            background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                            borderRadius: '8px', padding: '8px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                            fontSize: '13px', color: 'var(--text-main)', whiteSpace: 'nowrap', textAlign: 'center', zIndex: 10, pointerEvents: 'none',
                          }}>
                            <div style={{ fontWeight: '700', marginBottom: '2px' }}>{bar.label}</div>
                            <div>{bar.count} cases ({hoveredBar.pct}%)</div>
                          </div>
                        )}
                        <div style={{
                          fontSize: '11px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '2px',
                          opacity: chartMounted ? 1 : 0, transition: 'opacity 0.5s ease 0.2s',
                          position: 'absolute', bottom: `${Math.max(h + 4, 6)}px`
                        }}>
                          {bar.count > 0 ? bar.count : ''}
                        </div>
                        <div
                          onMouseEnter={() => setHoveredBar({ label: bar.label, count: bar.count, pct: allTotalCases > 0 ? Math.round((bar.count / allTotalCases) * 100) : 0, idx: i })}
                          onMouseLeave={() => setHoveredBar(null)}
                          style={{
                            width: '100%', maxWidth: '32px', cursor: 'default',
                            background: color,
                            filter: isHovered ? 'brightness(1.15)' : 'none',
                            height: `${h}px`, borderRadius: '4px 4px 0 0',
                            transition: 'height 0.7s cubic-bezier(0.22, 1, 0.36, 1), filter 0.15s ease',
                            boxShadow: isHovered ? `0 4px 12px ${color}66` : '0 2px 4px rgba(0,0,0,0.1)',
                          }} />
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* X-axis labels — abbreviated, full name on hover */}
              <div style={{ display: 'flex', gap: '3px', marginTop: '4px', paddingLeft: '30px' }}>
                {allDiseaseList.map((bar) => {
                  const short = bar.label.length > 8 ? bar.label.slice(0, 7) + '.' : bar.label;
                  return (
                    <div key={bar.label} title={bar.label} style={{
                      flex: 1, textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      cursor: 'default',
                    }}>
                      {short}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- STAT CARDS ---
  const totalCases = displayCases.length;
  const activeCases = displayCases.filter(c => ['Active', 'Pending', 'Under Treatment'].includes(c.status)).length;
  const recoveredCases = displayCases.filter(c => c.status === 'Recovered').length;
  const deathCases = displayCases.filter(c => c.status === 'Deceased').length;

  // --- TREND COMPARISON: previous period ---
  const prevDateRange = (() => {
    if (!dateRange.start || !dateRange.end) return null;
    const s = new Date(dateRange.start);
    const e = new Date(dateRange.end);
    const diff = e - s;
    const prevEnd = new Date(s.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - diff);
    return { start: prevStart.toISOString().slice(0, 10), end: prevEnd.toISOString().slice(0, 10) };
  })();
  const prevCases = prevDateRange
    ? scopedCases.filter(c => {
        if (!c.date_reported) return false;
        const d = c.date_reported.slice(0, 10);
        return d >= prevDateRange.start && d <= prevDateRange.end;
      })
    : [];
  const prevTotal = prevCases.length;
  const prevActive = prevCases.filter(c => ['Active', 'Pending', 'Under Treatment'].includes(c.status)).length;
  const prevRecovered = prevCases.filter(c => c.status === 'Recovered').length;
  const prevDeaths = prevCases.filter(c => c.status === 'Deceased').length;

  const trendDelta = (curr, prev) => {
    if (prev === 0) return curr > 0 ? { pct: '+100', up: true } : { pct: '0', up: false };
    const d = ((curr - prev) / prev) * 100;
    return { pct: `${d >= 0 ? '+' : ''}${Math.round(d)}`, up: d > 0 };
  };

  // --- CASES TODAY ---
  const todayStr = new Date().toISOString().slice(0, 10);
  const casesToday = displayCases.filter(c => c.date_reported && c.date_reported.slice(0, 10) === todayStr).length;

  // --- TOP AFFECTED BARANGAY ---
  const topBarangayName = (() => {
    const counts = {};
    displayCases.forEach(c => { if (c.barangay_name) counts[c.barangay_name] = (counts[c.barangay_name] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? { name: sorted[0][0], count: sorted[0][1] } : null;
  })();

  const topDiseaseName = (() => {
    const counts = {};
    displayCases.forEach(c => {
      if (c.disease_name) {
        const matched = findBestDisease(c.disease_name);
        if (matched) counts[matched] = (counts[matched] || 0) + 1;
      }
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? { name: sorted[0][0], count: sorted[0][1] } : null;
  })();

  const statSignature = `${dashPeriod}|${dashQuarter}|${dashYear}|${dateRange.start || ''}|${dateRange.end || ''}|${selectedDisease}`;

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

  // --- PERIOD CHART MODE: shows column chart for all period types ---
  const periodChart = dashPeriod === 'quarterly' || dashPeriod === 'yearly' || dashPeriod === 'weekly' || dashPeriod === 'monthly' || dashPeriod === 'custom';

  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_FULL  = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const COLUMN_COLORS = ['#DC2626', '#D97706', '#129968', '#3b82f6', '#7c3aed', '#db2777', '#0ea5e9', '#84cc16', '#f59e0b', '#14b8a6', '#ef4444', '#6366f1', '#059669', '#d946ef', '#0891b2'];

  const buildMonthBars = (months) => months.map(m => {
    const key = String(dashYear).padStart(4, '0') + '-' + String(m + 1).padStart(2, '0');
    const count = displayCases.filter(c => c.date_reported && c.date_reported.slice(0, 7) === key).length;
    return { label: MONTH_SHORT[m], full: MONTH_FULL[m], count };
  });

  // Weekly: 5 bars (Mon–Fri) within the date range
  const buildWeekBars = () => {
    const bars = [];
    const start = new Date(dateRange.start);
    for (let i = 0; i < 5; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const dayLabel = DAY_SHORT[d.getDay()];
      const dateLabel = `${d.getDate()}/${d.getMonth() + 1}`;
      const count = displayCases.filter(c => c.date_reported && c.date_reported.slice(0, 10) === key).length;
      bars.push({ label: `${dayLabel} ${dateLabel}`, full: `${dayLabel}, ${MONTH_FULL[d.getMonth()]} ${d.getDate()}`, count });
    }
    return bars;
  };

  // Monthly: ~4-5 bars (Week 1, Week 2, ...) splitting the calendar month
  const buildMonthlyWeekBars = () => {
    const bars = [];
    const [startStr, endStr] = [dateRange.start, dateRange.end];
    if (!startStr || !endStr) return bars;
    const sDate = new Date(startStr);
    const eDate = new Date(endStr);
    let weekNum = 1;
    let cursor = new Date(sDate);
    while (cursor <= eDate) {
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const effectiveEnd = weekEnd > eDate ? eDate : weekEnd;
      const sKey = cursor.toISOString().slice(0, 10);
      const eKey = effectiveEnd.toISOString().slice(0, 10);
      const count = displayCases.filter(c => {
        if (!c.date_reported) return false;
        const d = c.date_reported.slice(0, 10);
        return d >= sKey && d <= eKey;
      }).length;
      const label = `Wk ${weekNum}`;
      const full = `Week ${weekNum} (${cursor.getDate()} ${MONTH_SHORT[cursor.getMonth()]} – ${effectiveEnd.getDate()} ${MONTH_SHORT[effectiveEnd.getMonth()]})`;
      bars.push({ label, full, count });
      cursor = new Date(effectiveEnd);
      cursor.setDate(cursor.getDate() + 1);
      weekNum++;
    }
    return bars;
  };

  // Custom range: daily bars if ≤14 days, weekly bars if >14 days
  const buildCustomBars = () => {
    const bars = [];
    if (!dateRange.start || !dateRange.end) return bars;
    const sDate = new Date(dateRange.start);
    const eDate = new Date(dateRange.end);
    if (isNaN(sDate) || isNaN(eDate)) return bars;
    if (sDate > eDate) return bars;
    const dayDiff = Math.round((eDate - sDate) / 86400000) + 1;
    if (dayDiff <= 14) {
      let cursor = new Date(sDate);
      let safety = 0;
      while (cursor <= eDate && safety < 366) {
        const key = cursor.toISOString().slice(0, 10);
        const dayLabel = DAY_SHORT[cursor.getDay()];
        const dateLabel = `${cursor.getDate()}/${cursor.getMonth() + 1}`;
        const count = displayCases.filter(c => c.date_reported && c.date_reported.slice(0, 10) === key).length;
        bars.push({ label: `${dayLabel} ${dateLabel}`, full: `${dayLabel}, ${MONTH_FULL[cursor.getMonth()]} ${cursor.getDate()}`, count });
        cursor.setDate(cursor.getDate() + 1);
        safety++;
      }
    } else {
      let cursor = new Date(sDate);
      let weekNum = 1;
      let safety = 0;
      while (cursor <= eDate && safety < 53) {
        const weekEnd = new Date(cursor);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const effectiveEnd = weekEnd > eDate ? eDate : weekEnd;
        const sKey = cursor.toISOString().slice(0, 10);
        const eKey = effectiveEnd.toISOString().slice(0, 10);
        const count = displayCases.filter(c => {
          if (!c.date_reported) return false;
          const d = c.date_reported.slice(0, 10);
          return d >= sKey && d <= eKey;
        }).length;
        const label = `Wk ${weekNum}`;
        const full = `Week ${weekNum} (${cursor.getDate()} ${MONTH_SHORT[cursor.getMonth()]} – ${effectiveEnd.getDate()} ${MONTH_SHORT[effectiveEnd.getMonth()]})`;
        bars.push({ label, full, count });
        cursor = new Date(effectiveEnd);
        cursor.setDate(cursor.getDate() + 1);
        weekNum++;
        safety++;
      }
    }
    return bars;
  };

  const qStartMonth = (dashQuarter - 1) * 3;
  const monthBars = periodChart
    ? (dashPeriod === 'weekly'
        ? buildWeekBars()
        : dashPeriod === 'monthly'
          ? buildMonthlyWeekBars()
          : dashPeriod === 'quarterly'
            ? buildMonthBars([qStartMonth, qStartMonth + 1, qStartMonth + 2])
            : dashPeriod === 'custom'
              ? buildCustomBars()
              : buildMonthBars([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]))
    : [];
  const monthMax = monthBars.length > 0 ? Math.max(...monthBars.map(b => b.count)) : 1;

  const gridLines = (() => {
    const step = Math.max(1, Math.ceil(monthMax / 4));
    const top = step * 4;
    const lines = [];
    for (let k = 0; k <= 4; k++) lines.push({ value: k * step, frac: k / 4 });
    return { lines, top };
  })();

  const yearOptions = (() => {
    const years = new Set();
    cases.forEach(c => {
      if (c.date_reported) {
        const y = c.date_reported.slice(0, 4);
        if (/^\d{4}$/.test(y)) years.add(Number(y));
      }
    });
    const currentYear = new Date().getFullYear();
    years.add(currentYear);
    const floor = Math.min(Math.min(...years), 1900);
    const all = [];
    for (let y = currentYear; y >= floor; y--) all.push(y);
    return all;
  })();

  const exportBars = periodChart ? monthBars : (isBhw ? diseaseBars : sortedBars);
  const exportTitle = periodChart
    ? (dashPeriod === 'weekly'
        ? `Weekly Cases (${dateRange.start || ''} to ${dateRange.end || ''})`
        : dashPeriod === 'monthly'
          ? `Monthly Cases (${MONTH_FULL[new Date(dateRange.start || Date.now()).getMonth()]} ${dashYear})`
          : dashPeriod === 'quarterly'
            ? `Quarterly Cases (Q${dashQuarter} ${dashYear})`
            : dashPeriod === 'custom'
              ? `Custom Range (${dateRange.start || ''} to ${dateRange.end || ''})`
              : `Yearly Cases (${dashYear})`)
    : (isBhw ? 'All Diseases - Case Counts' : `${selectedDisease} Cases by Barangay`);
  const exportHighest = periodChart ? monthMax : (isBhw ? (diseaseBars.length > 0 ? diseaseBars[0].count : 1) : highestCount);

  const yearOptionStyle = (active) => ({
    padding: '8px 14px', cursor: 'pointer', fontSize: '15px',
    display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '6px',
    justifyContent: 'flex-start',
    background: active ? 'rgba(96,165,250,0.18)' : 'transparent',
    color: active ? 'var(--accent, #93bbfc)' : 'var(--text-main)',
    fontWeight: active ? '600' : '400',
    borderLeft: active ? '3px solid var(--accent, #60a5fa)' : '3px solid transparent',
  });

  // --- PAGINATION ---
  const totalPages = Math.ceil(displayCases.length / CASES_PER_PAGE);
  const paginatedCases = displayCases.slice(
    (currentPage - 1) * CASES_PER_PAGE,
    currentPage * CASES_PER_PAGE
  );

  const getVisiblePages = (cur, total) => {
    if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1);
    let start = 1 + 9 * Math.floor((cur - 1) / 9);
    start = Math.max(1, Math.min(start, total - 8));
    const end = Math.min(total, start + 8);
    const pages = [];
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < total) pages.push('...');
    return pages;
  };

  // ─── SHARED: build bar chart HTML block for exports ───
  const buildBarChartHTML = (bars = sortedBars, title = `${selectedDisease} Cases by Barangay`, highest = highestCount) => {
    if (bars.length === 0) {
      return `<p style="color:#64748b;font-size:14px;">No cases found.</p>`;
    }
    const barRows = bars.map((bar, i) => {
      const pct = highest > 0 ? Math.round((bar.count / highest) * 100) : 0;
      const color = i === 0 ? '#DC2626' : i === 1 ? '#D97706' : '#3b82f6';
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
    const eBars = exportBars;
    const eTitle = exportTitle;
    const eHighest = exportHighest;
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
      <h2>Cabuyao Disease Monitoring System - Dashboard Export</h2>
      <p>Generated: ${new Date().toLocaleDateString()} &nbsp;|&nbsp; Date Range: ${dateRange.start} to ${dateRange.end}</p>

      <h3>${eTitle}</h3>
      <div class="bar-section">${buildBarChartHTML(eBars, eTitle, eHighest)}</div>

      <h3>Case Records</h3>
      <table class="main">
        <thead><tr><th>ID</th><th>Patient</th><th>Age</th><th>Barangay</th><th>Disease</th><th>Severity</th><th>Status</th></tr></thead>
        <tbody>${buildTableRowsHTML(displayCases)}</tbody>
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
    const rows = displayCases.map(c =>
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
    const rows = displayCases.map(c =>
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
    const eBars = exportBars;
    const eTitle = exportTitle;
    const eHighest = exportHighest;
    const html = `
      <html><head><meta charset="utf-8"><title>CDMS Slide Export</title>
      <style>
        body { font-family: Arial, sans-serif; background: #0B1120; color: white; padding: 40px; }
        h1 { color: #129968; margin-bottom: 4px; } 
        h2 { color: #3b82f6; margin-top: 36px; margin-bottom: 12px; font-size: 18px; }
        p { color: #9ca3af; margin: 0 0 24px 0; font-size: 13px; }
        .stats { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }
        .stat { background: #1e293b; padding: 18px 28px; border-radius: 8px; text-align: center; min-width: 100px; }
        .stat .num { font-size: 32px; font-weight: bold; color: #129968; }
        .stat .lbl { font-size: 12px; color: #9ca3af; margin-top: 4px; }
        table.bars { width: 100%; border-collapse: collapse; }
        table.bars td { padding: 5px 8px; font-size: 13px; color: #e2e8f0; }
        .track { background: #334155; border-radius: 4px; height: 24px; width: 100%; overflow: hidden; position: relative; }
        .fill-red { background: #ef4444; height: 100%; border-radius: 4px; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; color: #fff; font-weight: 700; font-size: 14px; box-sizing: border-box; }
        .fill-amber { background: #D97706; height: 100%; border-radius: 4px; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; color: #fff; font-weight: 700; font-size: 14px; box-sizing: border-box; }
        .fill-blue { background: #3b82f6; height: 100%; border-radius: 4px; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; color: #fff; font-weight: 700; font-size: 14px; box-sizing: border-box; }
        footer { color: #4b5563; font-size: 12px; margin-top: 40px; border-top: 1px solid #1e293b; padding-top: 12px; }
      </style></head><body>
      <h1>Cabuyao Disease Monitoring System</h1>
      <p>Dashboard Export &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString()} &nbsp;|&nbsp; ${dateRange.start} to ${dateRange.end}</p>

      <div class="stats">
        <div class="stat"><div class="num">${totalCases}</div><div class="lbl">Total Cases</div></div>
        <div class="stat"><div class="num" style="color:#D97706;">${activeCases}</div><div class="lbl">Active</div></div>
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
    const eBars = exportBars;
    const eTitle = exportTitle;
    const eHighest = exportHighest;
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
    if (status === 'Active') return { background: '#121358', color: '#93c5fd' };
    if (status === 'Pending') return { background: '#1e3a8a', color: '#93c5fd' };
    if (status === 'Under Treatment') return { background: '#3b0764', color: '#c4b5fd' };
    if (status === 'Recovered') return { background: '#083d2c', color: '#3cb882' };
    if (status === 'Deceased') return { background: '#7f1d1d', color: '#fca5a5' };
    if (status === 'Draft') return { background: '#374151', color: '#d1d5db' };
    return { background: '#374151', color: '#d1d5db' };
};

  return (
        <div style={{ padding: compactMode ? '14px' : '24px', display: 'flex', flexDirection: 'column', gap: compactMode ? '12px' : '20px', fontSize: `calc(14px * ${fontScale || '1'})` }}>

      {offlineMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', fontSize: '15px', color: '#D97706' }}>
          <span style={{ fontSize: '16px' }}>⚠</span>
          Offline - showing cached data. Will refresh when reconnected.
        </div>
      )}

      {/* ── WELCOME BANNER ── */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: compactMode ? '12px 16px' : '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '15px', fontWeight: '500' }}>
          {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}
        </div>
        <div style={{ color: 'var(--text-main)', fontSize: '22px', fontWeight: '700', marginTop: '2px' }}>
          Welcome back, {loggedUser || 'User'}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '4px' }}>
          {loginRole === 'CHO' ? `City Health Officer - ${sessionContext || ''}` : `Barangay Health Worker - ${loginBarangay || ''}`}
          <span style={{ margin: '0 8px' }}>•</span>
          {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>  
      </div>

      {/* ── STAT CARDS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: compactMode ? '10px' : '16px' }}>
        {[
          { label: 'Total Cases', value: totalCases, color: '#3B82F6', trend: trendDelta(totalCases, prevTotal), invertTrend: false },
          { label: 'Active', value: activeCases, color: '#D97706', trend: trendDelta(activeCases, prevActive), invertTrend: true },
          { label: 'Recovered', value: recoveredCases, color: '#0D7A4E', trend: trendDelta(recoveredCases, prevRecovered), invertTrend: false },
          { label: 'Deaths', value: deathCases, color: '#DC2626', trend: trendDelta(deathCases, prevDeaths), invertTrend: true },
          { label: 'Cases Today', value: casesToday, color: '#6366F1', trend: null },
          isBhw
            ? { label: 'Top Disease', value: topDiseaseName ? topDiseaseName.count : 0, color: '#0EA5E9', trend: null, subtitle: topDiseaseName ? topDiseaseName.name : 'N/A' }
            : { label: 'Top Barangay', value: topBarangayName ? topBarangayName.count : 0, color: '#0EA5E9', trend: null, subtitle: topBarangayName ? topBarangayName.name : 'N/A' },
        ].map((card, i) => (
            <div key={`${card.label}-${statSignature}`} className="cdms-view-in" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: compactMode ? '12px' : '20px', animationDelay: `${i * 80}ms` }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
            <AnimatedNumber value={card.value} style={{ color: card.color, fontSize: '32px', fontWeight: '700', marginTop: '6px' }} />
            {card.subtitle && <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={card.subtitle}>{card.subtitle}</div>}
            {card.trend && (
              <div style={{ fontSize: '13px', marginTop: '4px', fontWeight: '600', color: card.invertTrend ? (card.trend.up ? '#DC2626' : '#0D7A4E') : (card.trend.up ? '#0D7A4E' : '#DC2626') }}>
                {card.trend.up ? '▲' : '▼'} {card.trend.pct}% vs prev. period
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── CHART + FILTER ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px' }}>

        {/* BAR CHART */}
          <div key={`chart-${statSignature}`} className="cdms-view-in" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: compactMode ? '12px' : '20px', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ color: 'var(--text-main)', margin: '0 0 16px 0', fontSize: '15px', fontWeight: '600' }}>
            {exportTitle}
          </h4>
          {periodChart ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '210px' }}>
                  <div style={{ width: '26px', height: '210px', position: 'relative', fontSize: '13px', color: 'var(--text-muted)' }}>
                    {gridLines.lines.map(l => {
                      const topPx = 26 + (1 - l.frac) * 184;
                      return <span key={l.value} style={{ position: 'absolute', right: 6, top: `${(topPx / 210) * 100}%`, transform: 'translateY(-50%)' }}>{l.value}</span>;
                    })}
                  </div>
                  <div style={{ flex: 1, position: 'relative', height: '210px' }}>
                    {gridLines.lines.map(l => {
                      const topPx = 26 + (1 - l.frac) * 184;
                      return <div key={l.value} style={{ position: 'absolute', left: 0, right: 0, top: `${(topPx / 210) * 100}%`, borderTop: '1px dashed var(--border-color)' }} />;
                    })}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
                      {monthBars.map((b, i) => {
                        const h = chartMounted ? Math.max((b.count / gridLines.top) * 184, b.count > 0 ? 4 : 2) : 0;
                        const barPct = totalCases > 0 ? Math.round((b.count / totalCases) * 100) : 0;
                        return (
                          <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px', opacity: chartMounted ? 1 : 0, transition: 'opacity 0.5s ease 0.2s' }}>{b.count}</div>
                            <div
                              onMouseEnter={() => setHoveredBar({ label: b.full, count: b.count, pct: barPct, idx: i })}
                              onMouseLeave={() => setHoveredBar(null)}
                              style={{
                              width: '100%', maxWidth: '48px', cursor: 'default',
                              background: hoveredBar && hoveredBar.idx === i ? COLUMN_COLORS[i % COLUMN_COLORS.length] : COLUMN_COLORS[i % COLUMN_COLORS.length],
                              filter: hoveredBar && hoveredBar.idx === i ? 'brightness(1.15)' : 'none',
                              height: `${h}px`, borderRadius: '6px 6px 0 0',
                              transition: 'height 0.7s cubic-bezier(0.22, 1, 0.36, 1), filter 0.15s ease',
                              boxShadow: hoveredBar && hoveredBar.idx === i ? `0 4px 12px ${COLUMN_COLORS[i % COLUMN_COLORS.length]}66` : '0 2px 6px rgba(0,0,0,0.15)',
                            }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <div style={{ width: '26px' }} />
                  {monthBars.map(b => (
                    <div key={b.label} style={{ flex: 1, textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{b.label}</div>
                  ))}
                </div>
                {hoveredBar && (
                  <div style={{ position: 'absolute', bottom: '44px', left: `calc(26px + ${(hoveredBar.idx + 0.5) * (100 / monthBars.length)}% - 24px)`, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontSize: '13px', color: 'var(--text-main)', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 10 }}>
                    <div style={{ fontWeight: '700', marginBottom: '2px' }}>{hoveredBar.label}</div>
                    <div>{hoveredBar.count} cases ({hoveredBar.pct}%)</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                {monthBars.map((b, i) => (
                  <span key={b.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '15px', color: 'var(--text-muted)' }}>
                    <span style={{ width: '11px', height: '11px', borderRadius: '3px', background: COLUMN_COLORS[i % COLUMN_COLORS.length] }} />
                    {b.full}
                  </span>
                ))}
              </div>
            </div>
          ) : periodChart || isBhw ? (
            <div style={{ maxHeight: '480px', overflowY: 'auto', paddingRight: '4px' }}>
              {diseaseBars.map((bar, i) => {
                const dHighest = diseaseBars.length > 0 ? diseaseBars[0].count : 1;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <span style={{ minWidth: '180px', fontSize: '15px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {bar.label}
                    </span>
                    <div style={{ flex: 1, background: 'var(--input-bg)', height: '24px', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        width: dHighest > 0 ? `${(bar.count / dHighest) * 100}%` : '0%',
                        background: getCountColor(bar.count, diseaseBars),
                        height: '100%', borderRadius: '6px', transition: 'width 0.4s ease',
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                        paddingRight: '8px', color: '#fff', fontWeight: '700', fontSize: '15px',
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
            <div style={{ color: 'var(--text-muted)', fontSize: '15px', padding: '20px 0' }}>
              No cases found for {selectedDisease}.
            </div>
          ) : (
            <div style={{ maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
              {sortedBars.map((bar, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <span style={{ minWidth: '180px', fontSize: '15px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {bar.label}
                  </span>
                  <div style={{ flex: 1, background: 'var(--input-bg)', height: '24px', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      width: `${(bar.count / highestCount) * 100}%`,
                      background: getCountColor(bar.count, sortedBars),
                      height: '100%', borderRadius: '6px', transition: 'width 0.4s ease',
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                      paddingRight: '8px', color: '#fff', fontWeight: '700', fontSize: '15px',
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

        {/* FILTER & CONTROLS - FIX: date inputs no longer overflow */}
          <div key={`filters-${statSignature}`} className="cdms-view-in" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: compactMode ? '12px' : '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ color: 'var(--text-main)', margin: '0', fontSize: '15px', fontWeight: '600' }}>Filter & Controls</h4>

          {!isBhw && <div>
            <label style={{ color: 'var(--text-muted)', fontSize: '15px', display: 'block', marginBottom: '4px' }}>Disease</label>
            <div style={{ position: 'relative' }} ref={diseaseRef}>
              <button
                onClick={() => setDiseaseOpen(!diseaseOpen)}
                style={{ width: '100%', padding: '7px 10px', background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '15px', boxSizing: 'border-box', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span>{selectedDisease}</span>
                <span style={{ marginLeft: '6px', opacity: 0.6, transition: 'transform 0.2s', display: 'inline-block', transform: diseaseOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
              </button>
              {diseaseOpen && (
                <div className="cdms-dropdown-panel" style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  maxHeight: '250px', overflowY: 'auto', marginTop: '4px',
                  background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                  borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                }}>
                  {[...ALL_DISEASES].sort().map(d => (
                    <div
                      key={d}
                      onClick={() => { setSelectedDisease(d); setDiseaseOpen(false); }}
                      style={{
                        padding: '7px 10px', cursor: 'pointer', fontSize: '15px',
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

          {/* ── Period + Date range ── */}
          <div>
            <label style={{ color: 'var(--text-muted)', fontSize: '15px', display: 'block', marginBottom: '4px' }}>Date Range</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['weekly', 'monthly', 'quarterly', 'yearly'].map(p => (
                <button
                  key={p}
                  onClick={() => {
                    setDashPeriod(p);
                    setDateRange(getPeriodRange(p, dashQuarter, dashYear));
                    setShowAllDiseases(false);
                  }}
                  style={{
                    flex: 1, padding: '6px 4px', borderRadius: '6px', cursor: 'pointer',
                    fontSize: '15px', fontWeight: '500', textTransform: 'capitalize', minWidth: '56px',
                    background: dashPeriod === p ? '#121358' : 'var(--input-bg)',
                    color: dashPeriod === p ? 'white' : 'var(--text-muted)',
                    border: '1px solid var(--border-color)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  {p}
                </button>
              ))}
            </div>

            {dashPeriod === 'quarterly' && (
              <>
                <label style={{ color: 'var(--text-muted)', fontSize: '15px', display: 'block', marginBottom: '4px', marginTop: '10px' }}>Quarter</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[1, 2, 3, 4].map(q => (
                    <button
                      key={q}
                      onClick={() => { setDashQuarter(q); setDateRange(getPeriodRange('quarterly', q, dashYear)); }}
                      style={{
                        flex: 1, padding: '6px 4px', borderRadius: '6px', cursor: 'pointer',
                        fontSize: '15px', fontWeight: '600',
                        background: dashQuarter === q ? '#129968' : 'var(--input-bg)',
                        color: dashQuarter === q ? 'white' : 'var(--text-muted)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      Q{q}
                    </button>
                  ))}
                </div>
                <div style={{ position: 'relative', marginTop: '6px' }} ref={yearRef}>
                  <button
                    onClick={() => setYearOpen(!yearOpen)}
                    style={{
                      width: '100%', padding: '9px 12px',
                      background: 'var(--input-bg)', border: `1px solid ${yearOpen ? '#60a5fa' : 'var(--border-color)'}`,
                      borderRadius: '7px', color: 'var(--text-main)',
                      fontSize: '15px', cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box',
                    }}
                  >
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dashPeriod === 'custom' ? 'Custom dates…' : dashYear}</span>
                    <span style={{ fontSize: '13px', opacity: 0.6, flexShrink: 0, marginLeft: '8px', transition: 'transform 0.2s', display: 'inline-block', transform: yearOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                  </button>
                  {yearOpen && (
                    <div className="cdms-dropdown-panel" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, maxHeight: '250px', overflowY: 'auto', marginTop: '4px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 12px 32px rgba(0,0,0,0.3)', padding: '4px', textAlign: 'left' }}>
                      <div
                        onClick={() => { setDashPeriod('custom'); setYearOpen(false); }}
                        style={yearOptionStyle(dashPeriod === 'custom')}
                        onMouseEnter={e => { if (dashPeriod !== 'custom') { e.currentTarget.style.background = 'rgba(96,165,250,0.25)'; e.currentTarget.style.color = 'var(--text-main)'; } }}
                        onMouseLeave={e => { if (dashPeriod !== 'custom') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-main)'; } }}
                      >
                        <span style={{ flex: 1 }}>Custom dates…</span>
                        {dashPeriod === 'custom' && <span style={{ color: '#60a5fa', fontSize: '15px' }}>✓</span>}
                      </div>
                      {yearOptions.map(y => (
                        <div
                          key={y}
                          onClick={() => { setDashYear(y); setDateRange(getPeriodRange('quarterly', dashQuarter, y)); setYearOpen(false); }}
                          style={yearOptionStyle(dashYear === y)}
                          onMouseEnter={e => { if (dashYear !== y) { e.currentTarget.style.background = 'rgba(96,165,250,0.25)'; e.currentTarget.style.color = 'var(--text-main)'; } }}
                          onMouseLeave={e => { if (dashYear !== y) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-main)'; } }}
                        >
                          <span style={{ flex: 1 }}>{y}</span>
                          {dashYear === y && <span style={{ color: '#60a5fa', fontSize: '15px' }}>✓</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {dashPeriod === 'yearly' && (
              <div style={{ position: 'relative', marginTop: '10px' }} ref={yearRef}>
                <button
                  onClick={() => setYearOpen(!yearOpen)}
                  style={{
                    width: '100%', padding: '9px 12px',
                    background: 'var(--input-bg)', border: `1px solid ${yearOpen ? '#60a5fa' : 'var(--border-color)'}`,
                    borderRadius: '7px', color: 'var(--text-main)',
                    fontSize: '15px', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box',
                  }}
                >
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dashPeriod === 'custom' ? 'Custom dates…' : dashYear}</span>
                  <span style={{ fontSize: '13px', opacity: 0.6, flexShrink: 0, marginLeft: '8px', transition: 'transform 0.2s', display: 'inline-block', transform: yearOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </button>
                {yearOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, maxHeight: '250px', overflowY: 'auto', marginTop: '4px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 12px 32px rgba(0,0,0,0.3)', padding: '4px', textAlign: 'left' }}>
                    <div
                      onClick={() => { setDashPeriod('custom'); setYearOpen(false); }}
                      style={yearOptionStyle(dashPeriod === 'custom')}
                      onMouseEnter={e => { if (dashPeriod !== 'custom') { e.currentTarget.style.background = 'rgba(96,165,250,0.25)'; e.currentTarget.style.color = 'var(--text-main)'; } }}
                      onMouseLeave={e => { if (dashPeriod !== 'custom') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-main)'; } }}
                    >
                      <span style={{ flex: 1 }}>Custom dates…</span>
                      {dashPeriod === 'custom' && <span style={{ color: '#60a5fa', fontSize: '15px' }}>✓</span>}
                    </div>
                    {yearOptions.map(y => (
                      <div
                        key={y}
                        onClick={() => { setDashYear(y); setDateRange(getPeriodRange('yearly', 0, y)); setYearOpen(false); }}
                        style={yearOptionStyle(dashYear === y)}
                        onMouseEnter={e => { if (dashYear !== y) { e.currentTarget.style.background = 'rgba(96,165,250,0.25)'; e.currentTarget.style.color = 'var(--text-main)'; } }}
                        onMouseLeave={e => { if (dashYear !== y) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-main)'; } }}
                      >
                        <span style={{ flex: 1 }}>{y}</span>
                        {dashYear === y && <span style={{ color: '#60a5fa', fontSize: '15px' }}>✓</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(dashPeriod === 'weekly' || dashPeriod === 'monthly' || dashPeriod === 'custom') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                <input
                  type="date"
                  key={`start-${dateRange.start}`}
                  defaultValue={dateRange.start}
                  onBlur={(e) => { const v = e.target.value; if (/^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v))) { setDateRange({ ...dateRange, start: v }); setDashPeriod('custom'); } }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur(); } }}
                  style={{ width: '100%', padding: '6px 8px', background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '15px', boxSizing: 'border-box' }}
                />
                <input
                  type="date"
                  key={`end-${dateRange.end}`}
                  defaultValue={dateRange.end}
                  onBlur={(e) => { const v = e.target.value; if (/^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v))) { setDateRange({ ...dateRange, end: v }); setDashPeriod('custom'); } }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur(); } }}
                  style={{ width: '100%', padding: '6px 8px', background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '15px', boxSizing: 'border-box' }}
                />
              </div>
            )}
          </div>

          {/* EXPORT dropdown */}
          <div style={{ position: 'relative' }} ref={exportRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{ width: '100%', padding: '8px', background: '#121358', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              📤 Export Data <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: showExportMenu ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
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
                    style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', textAlign: 'left', fontSize: '15px', borderBottom: '1px solid var(--border-color)' }}
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
            style={{ width: '100%', padding: '8px', background: '#0a5e42', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            🖨️ Print Report
          </button>

          <div style={{ fontSize: '15px', color: 'var(--text-muted)', textAlign: 'center', paddingTop: '4px' }}>
            {lastUpdated ? `Updated ${Math.round((now - lastUpdated) / 1000)}s ago` : 'Refreshing...'}
          </div>
        </div>
      </div>

      {/* ── TOP CASES ── */}
      {(() => {
        const topBarangayList = (() => {
          const counts = {};
          displayCases.forEach(c => { if (c.barangay_name) counts[c.barangay_name] = (counts[c.barangay_name] || 0) + 1; });
          return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
        })();
        const topDiseaseList = (() => {
          const counts = {};
          displayCases.forEach(c => {
            if (c.disease_name) {
              const matched = findBestDisease(c.disease_name);
              if (matched) counts[matched] = (counts[matched] || 0) + 1;
            }
          });
          return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
        })();
        const topBrgyMax = topBarangayList.length > 0 ? topBarangayList[0].count : 1;
        const topDisMax = topDiseaseList.length > 0 ? topDiseaseList[0].count : 1;
        const getRankColor = (count, list) => {
          if (!list || list.length === 0) return 'var(--input-bg)';
          const uniqueCounts = [...new Set(list.map(b => b.count))].filter(c => c > 0).sort((a, b) => b - a);
          if (count === uniqueCounts[0]) return '#DC2626';
          if (uniqueCounts.length > 1 && count === uniqueCounts[1]) return '#D97706';
          return '#3b82f6';
        };
        const rankBadge = (count, list) => {
          const bg = getRankColor(count, list);
          return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: bg, color: '#fff', fontSize: '13px', fontWeight: '700', flexShrink: 0 }}>{list.indexOf(list.find(b => b.count === count)) + 1}</span>;
        };
        return (
          <div style={{ display: 'grid', gridTemplateColumns: isBhw ? '1fr' : '1fr 1fr', gap: '16px' }}>
            {/* Top Barangays — CHO only */}
            {!isBhw && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: compactMode ? '12px' : '20px' }}>
                <h4 style={{ color: 'var(--text-main)', margin: '0 0 16px 0', fontSize: '15px', fontWeight: '600' }}>
                  Top Barangays
                  <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '400', marginLeft: '8px' }}>({dateRange.start} to {dateRange.end})</span>
                </h4>
                {topBarangayList.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '15px', padding: '20px 0', textAlign: 'center' }}>No cases in this period</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {topBarangayList.map((item, i) => (
                      <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {rankBadge(item.count, topBarangayList)}
                        <span style={{ minWidth: '130px', fontSize: '15px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.name}>{item.name}</span>
                        <div style={{ flex: 1, background: 'var(--input-bg)', height: '20px', borderRadius: '6px', overflow: 'hidden' }}>
                          <div style={{ width: `${topBrgyMax > 0 ? (item.count / topBrgyMax) * 100 : 0}%`, background: getCountColor(item.count, topBarangayList), height: '100%', borderRadius: '6px', transition: 'width 0.4s ease', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px', color: '#fff', fontSize: '13px', fontWeight: '700', boxSizing: 'border-box' }}>
                            {item.count > 0 ? item.count : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Top Diseases — all roles */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: compactMode ? '12px' : '20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ color: 'var(--text-main)', margin: 0, fontSize: '15px', fontWeight: '600' }}>
                  Top Diseases
                  <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '400', marginLeft: '8px' }}>({dateRange.start} to {dateRange.end})</span>
                </h4>
                <button
                  onClick={() => setShowAllDiseases(true)}
                  style={{ padding: '4px 12px', background: '#121358', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  View All Diseases →
                </button>
              </div>
              {topDiseaseList.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '15px', padding: '20px 0', textAlign: 'center' }}>No cases in this period</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {topDiseaseList.map((item, i) => (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {rankBadge(item.count, topDiseaseList)}
                      <span style={{ minWidth: '130px', fontSize: '15px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                      <div style={{ flex: 1, background: 'var(--input-bg)', height: '20px', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{ width: `${topDisMax > 0 ? (item.count / topDisMax) * 100 : 0}%`, background: getCountColor(item.count, topDiseaseList), height: '100%', borderRadius: '6px', transition: 'width 0.4s ease', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px', color: '#fff', fontSize: '13px', fontWeight: '700', boxSizing: 'border-box' }}>
                          {item.count > 0 ? item.count : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── RECENT CASE REPORTS ── */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: compactMode ? '12px' : '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h4 style={{ color: 'var(--text-main)', margin: 0, fontSize: '15px', fontWeight: '600' }}>
            Recent Case Reports
            <span style={{ color: 'var(--text-muted)', fontSize: '15px', fontWeight: '400', marginLeft: '8px' }}>
              ({displayCases.length} total)
            </span>
          </h4>
          <button
            onClick={() => setActiveTab('Manage Cases')}
            style={{ padding: '6px 14px', background: '#129968', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
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
                  textAlign: 'center', color: 'var(--text-muted)', fontSize: '15px',
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
                <td style={{ padding: compactMode ? '7px 8px' : '12px', color: 'var(--text-muted)', fontSize: '15px', textAlign: 'center' }}>#{String(c.case_id).padStart(3, '0')}</td>
                <td style={{ padding: compactMode ? '7px 8px' : '12px', color: 'var(--text-main)', fontSize: '15px', fontWeight: '500', textAlign: 'center' }}>{c.patient_name || 'Unknown'}</td>
                <td style={{ padding: compactMode ? '7px 8px' : '12px', color: 'var(--text-main)', fontSize: '15px', textAlign: 'center' }}>{c.age || '--'}</td>
                <td style={{ padding: compactMode ? '7px 8px' : '12px', color: 'var(--text-main)', fontSize: '15px', textAlign: 'center' }}>{c.barangay_name || `ID: ${c.barangay_id}`}</td>
                <td style={{ padding: compactMode ? '7px 8px' : '12px', color: 'var(--text-main)', fontSize: '15px', textAlign: 'center' }}>{c.disease_name || '--'}</td>
                <td style={{ padding: compactMode ? '7px 8px' : '12px', color: 'var(--text-main)', fontSize: '15px', textAlign: 'center', whiteSpace: 'nowrap' }}>{formatDateStr(c.date_reported, dateFormat)}</td>
                <td style={{ padding: compactMode ? '7px 8px' : '12px', color: 'var(--text-main)', fontSize: '15px', textAlign: 'center' }}>{c.severity || 'N/A'}</td>
                <td style={{ padding: compactMode ? '7px 8px' : '12px', textAlign: 'center' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '15px', fontWeight: '500', ...getStatusStyle(c.status) }}>
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
            Showing {(currentPage - 1) * CASES_PER_PAGE + 1}–{Math.min(currentPage * CASES_PER_PAGE, displayCases.length)} of {displayCases.length} cases
          </span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              style={{ padding: '5px 8px', background: currentPage === 1 ? 'var(--input-bg)' : '#121358', color: currentPage === 1 ? 'var(--text-muted)' : 'white', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: '700' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              {'<<'}
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ padding: '5px 12px', background: currentPage === 1 ? 'var(--input-bg)' : '#121358', color: currentPage === 1 ? 'var(--text-muted)' : 'white', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '15px' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              ← Prev
            </button>
            {getVisiblePages(currentPage, totalPages).map((p, i) =>
              p === '...' ? (
                <div key={`e${i}`} ref={ellipsisRef} style={{ position: 'relative', display: 'inline-flex' }}>
                  <button onClick={() => setEllipsisOpen(o => !o)}
                    style={{ padding: '5px 8px', background: ellipsisOpen ? 'rgba(18,19,88,0.15)' : 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', fontWeight: '700', letterSpacing: '2px' }}>...</button>
                  {ellipsisOpen && (
                    <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', width: '160px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 100 }}>
                      <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '6px' }}>Go to page (1–{totalPages})</div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input type="number" min="1" max={totalPages} value={ellipsisPageInput} placeholder="#"
                          onChange={e => setEllipsisPageInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { const v = parseInt(ellipsisPageInput); if (v >= 1 && v <= totalPages) { setCurrentPage(v); setEllipsisOpen(false); setEllipsisPageInput(''); } } }}
                          style={{ flex: 1, padding: '5px 6px', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '15px', outline: 'none', width: '100%' }} />
                        <button onClick={() => { const v = parseInt(ellipsisPageInput); if (v >= 1 && v <= totalPages) { setCurrentPage(v); setEllipsisOpen(false); setEllipsisPageInput(''); } }}
                          style={{ padding: '5px 8px', border: '1px solid #121358', borderRadius: '4px', background: '#121358', color: 'white', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>Go</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  style={{ padding: '5px 10px', background: p === currentPage ? '#121358' : 'transparent', color: p === currentPage ? 'white' : 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', minWidth: '32px' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ padding: '5px 12px', background: currentPage === totalPages ? 'var(--input-bg)' : '#121358', color: currentPage === totalPages ? 'var(--text-muted)' : 'white', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '15px' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Next →
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              style={{ padding: '5px 8px', background: currentPage === totalPages ? 'var(--input-bg)' : '#121358', color: currentPage === totalPages ? 'var(--text-muted)' : 'white', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: '700' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              {'>>'}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;