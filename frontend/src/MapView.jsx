import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const CABUYAO_CENTER = [14.2253, 121.1254];

// ALL 18 barangays — hardcoded so dropdown is always complete
const ALL_BARANGAYS = [
  'Baclaran', 'Banay-Banay', 'Banlic',
  'Barangay Dos (Poblacion)', 'Barangay Tres (Poblacion)', 'Barangay Uno (Poblacion)',
  'Bigaa', 'Butong', 'Casile', 'Diezmo', 'Gulod',
  'Mamatid', 'Marinig', 'Niugan', 'Pittland', 'Pulo', 'Sala', 'San Isidro',
];

// Coordinates for each barangay — fuzzy matched so minor spelling diffs are OK
const BARANGAY_COORDS = {
  'Baclaran':                  [14.2050, 121.1050],
  'Banay-Banay':               [14.2400, 121.1350],
  'Banlic':                    [14.2150, 121.1120],
  'Barangay Dos (Poblacion)':  [14.2260, 121.1230],
  'Barangay Tres (Poblacion)': [14.2240, 121.1210],
  'Barangay Uno (Poblacion)':  [14.2280, 121.1250],
  'Bigaa':                     [14.2180, 121.1300],
  'Butong':                    [14.2100, 121.1180],
  'Casile':                    [14.2050, 121.0900],
  'Diezmo':                    [14.2320, 121.1000],
  'Gulod':                     [14.2200, 121.1400],
  'Mamatid':                   [14.2350, 121.1450],
  'Marinig':                   [14.2150, 121.1500],
  'Niugan':                    [14.2450, 121.1200],
  'Pittland':                  [14.1980, 121.0950],
  'Pulo':                      [14.2500, 121.1100],
  'Sala':                      [14.2300, 121.1300],
  'San Isidro':                [14.2420, 121.0980],
};

const norm = (s) => (s || '').toLowerCase().replace(/[\s\-().]/g, '');

const findCoords = (name) => {
  if (!name) return null;
  if (BARANGAY_COORDS[name]) return BARANGAY_COORDS[name];
  const n = norm(name);
  for (const [key, val] of Object.entries(BARANGAY_COORDS)) {
    if (norm(key) === n) return val;
  }
  return null;
};

// Risk thresholds: <10 = Low (green), 10-20 = Medium (amber), >20 = High (red)
const getRisk = (count) => {
  if (count > 20) return { color: '#ef4444', ring: 'rgba(239,68,68,0.3)', label: 'High Risk' };
  if (count >= 10) return { color: '#f59e0b', ring: 'rgba(245,158,11,0.3)', label: 'Medium Risk' };
  return { color: '#10b981', ring: 'rgba(16,185,129,0.3)', label: 'Low Risk' };
};

// Inject pulse keyframes once
if (!document.getElementById('cdms-pulse')) {
  const s = document.createElement('style');
  s.id = 'cdms-pulse';
  s.textContent = `@keyframes cdmsPulse {
    0%   { transform: scale(0.85); opacity: 0.9; }
    70%  { transform: scale(2.4);  opacity: 0;   }
    100% { transform: scale(0.85); opacity: 0;   }
  }`;
  document.head.appendChild(s);
}

function PulseMarkers({ barangayData, onHover, onLeave, onClick }) {
  const map = useMap();
  const markersRef = useRef([]);

  useEffect(() => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    barangayData.forEach(b => {
      const { color, ring } = getRisk(b.totalCases);
      const size = Math.max(24, Math.min(54, 20 + b.totalCases * 1.5));
      const inner = Math.round(size * 0.2);

      const icon = L.divIcon({
        className: '',
        html: `
          <div style="position:relative;width:${size}px;height:${size}px;">
            <div style="
              position:absolute;inset:0;border-radius:50%;
              background:${ring};
              animation:cdmsPulse 2s ease-out infinite;
            "></div>
            <div style="
              position:absolute;
              top:${inner}px;left:${inner}px;
              right:${inner}px;bottom:${inner}px;
              border-radius:50%;
              background:${color};
              box-shadow:0 0 0 3px white, 0 2px 10px rgba(0,0,0,0.4);
              cursor:pointer;
            "></div>
            <div style="
              position:absolute;inset:0;
              display:flex;align-items:center;justify-content:center;
              font-size:${size < 32 ? 9 : 11}px;
              font-weight:800;color:#fff;
              pointer-events:none;z-index:2;
            ">${b.totalCases}</div>
          </div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const m = L.marker(b.coords, { icon, zIndexOffset: 1000 }).addTo(map);
      m.on('mouseover', () => onHover(b));
      m.on('mouseout',  () => onLeave());
      m.on('click',     () => onClick(b));
      markersRef.current.push(m);
    });

    return () => { markersRef.current.forEach(m => m.remove()); };
  }, [barangayData, map]);

  return null;
}

export default function MapView({ setActiveTab, setCaseFilter }) {
  const [allCases, setAllCases]       = useState([]);
  const [barangayData, setBarangayData] = useState([]);
  const [filterBarangay, setFilterBarangay] = useState('All Barangays');
  const [filterStatus,   setFilterStatus]   = useState('All Status');
  const [filterDate,     setFilterDate]     = useState('');
  const [filterSeverity, setFilterSeverity] = useState('All Severities');
  const [tooltip, setTooltip] = useState(null);
  const [popup,   setPopup]   = useState(null);

  const [barangayOpen, setBarangayOpen] = useState(false);
  const barangayRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (barangayRef.current && !barangayRef.current.contains(e.target)) {
        setBarangayOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    axios.get('http://localhost:5000/api/disease_cases')
      .then(res => setAllCases(res.data))
      .catch(err => console.error('MapView fetch error:', err));
  }, []);

  useEffect(() => {
    if (!allCases.length) return;

    const filtered = allCases.filter(c => {
      if (filterBarangay !== 'All Barangays'  && c.barangay_name !== filterBarangay)   return false;
      if (filterStatus   !== 'All Status'     && c.status        !== filterStatus)      return false;
      if (filterSeverity !== 'All Severities' && c.severity      !== filterSeverity)    return false;
      if (filterDate && c.date_reported && !c.date_reported.startsWith(filterDate))     return false;
      return true;
    });

    const groups = {};
    filtered.forEach(c => {
      const bn = c.barangay_name;
      if (!bn) return;
      const coords = findCoords(bn);
      if (!coords) { console.warn('No coords for:', bn); return; }
      if (!groups[bn]) groups[bn] = { barangayName: bn, coords, totalCases: 0, diseases: {}, cases: [] };
      groups[bn].totalCases++;
      groups[bn].cases.push(c);
      const dn = (c.disease_name || 'Unknown').trim();
      groups[bn].diseases[dn] = (groups[bn].diseases[dn] || 0) + 1;
    });

    setBarangayData(Object.values(groups));
  }, [allCases, filterBarangay, filterStatus, filterDate, filterSeverity]);

  const getTop5 = (diseases) =>
    Object.entries(diseases).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const goToDisease = (barangayName, diseaseName) => {
    if (setCaseFilter) setCaseFilter({ disease: diseaseName.trim(), barangay: barangayName });
    if (setActiveTab)  setActiveTab('Manage Cases');
    setPopup(null);
  };

  const highCount   = barangayData.filter(b => b.totalCases > 20).length;
  const mediumCount = barangayData.filter(b => b.totalCases >= 10 && b.totalCases <= 20).length;
  const lowCount    = barangayData.filter(b => b.totalCases < 10).length;

  const SEL = {
    width: '100%', padding: '9px 12px',
    background: '#0f172a', border: '1px solid #334155',
    borderRadius: '7px', color: '#e2e8f0',
    fontSize: '13px', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── SIDEBAR — fixed 280px, never shrinks ── */}
      <div style={{
        width: '280px', minWidth: '280px', flexShrink: 0,
        background: '#1e293b', borderRight: '1px solid #334155',
        padding: '20px 16px', display: 'flex', flexDirection: 'column',
        gap: '16px', overflowY: 'auto',
      }}>
        <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Filters
        </p>

        {/* Barangay — all 18 hardcoded */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '5px', fontWeight: '600' }}>Barangay</label>
          <div style={{ position: 'relative' }} ref={barangayRef}>
            <button
              onClick={() => setBarangayOpen(!barangayOpen)}
              style={{
                width: '100%', padding: '9px 12px',
                background: '#0f172a', border: `1px solid ${barangayOpen ? '#60a5fa' : '#334155'}`,
                borderRadius: '7px', color: '#e2e8f0',
                fontSize: '13px', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxSizing: 'border-box',
              }}
            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filterBarangay}</span>
              <span style={{
                fontSize: '10px', opacity: 0.6, flexShrink: 0, marginLeft: '8px',
                transition: 'transform 0.2s', display: 'inline-block',
                transform: barangayOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}>▾</span>
            </button>
            {barangayOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                maxHeight: '250px', overflowY: 'auto', marginTop: '4px',
                background: '#1e293b', border: '1px solid #475569',
                borderRadius: '8px', boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                padding: '4px', textAlign: 'left',
              }}>
                <div
                  onClick={() => { setFilterBarangay('All Barangays'); setBarangayOpen(false); }}
                  style={{
                    padding: '8px 14px', cursor: 'pointer', fontSize: '13px',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    borderRadius: '6px',
                    justifyContent: 'flex-start',
                    background: filterBarangay === 'All Barangays' ? 'rgba(96,165,250,0.18)' : 'transparent',
                    color: filterBarangay === 'All Barangays' ? '#93bbfc' : '#cbd5e1',
                    fontWeight: filterBarangay === 'All Barangays' ? '600' : '400',
                    borderLeft: filterBarangay === 'All Barangays' ? '3px solid #60a5fa' : '3px solid transparent',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.25)'; e.currentTarget.style.color = '#f1f5f9'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = filterBarangay === 'All Barangays' ? 'rgba(96,165,250,0.18)' : 'transparent'; e.currentTarget.style.color = filterBarangay === 'All Barangays' ? '#93bbfc' : '#cbd5e1'; }}
                >
                  <span style={{ flex: 1 }}>All Barangays</span>
                  {filterBarangay === 'All Barangays' && <span style={{ color: '#60a5fa', fontSize: '12px' }}>✓</span>}
                </div>
                {ALL_BARANGAYS.map(b => (
                  <div
                    key={b}
                    onClick={() => { setFilterBarangay(b); setBarangayOpen(false); }}
                    style={{
                      padding: '8px 14px', cursor: 'pointer', fontSize: '13px',
                      display: 'flex', alignItems: 'center', gap: '8px',
                      borderRadius: '6px',
                      justifyContent: 'flex-start',
                      background: filterBarangay === b ? 'rgba(96,165,250,0.18)' : 'transparent',
                      color: filterBarangay === b ? '#93bbfc' : '#cbd5e1',
                      fontWeight: filterBarangay === b ? '600' : '400',
                      borderLeft: filterBarangay === b ? '3px solid #60a5fa' : '3px solid transparent',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.25)'; e.currentTarget.style.color = '#f1f5f9'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = filterBarangay === b ? 'rgba(96,165,250,0.18)' : 'transparent'; e.currentTarget.style.color = filterBarangay === b ? '#93bbfc' : '#cbd5e1'; }}
                  >
                    <span style={{ flex: 1 }}>{b}</span>
                    {filterBarangay === b && <span style={{ color: '#60a5fa', fontSize: '12px' }}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '5px', fontWeight: '600' }}>Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={SEL}>
            <option>All Status</option>
            <option>Active</option>
            <option>Pending</option>
            <option>Under Treatment</option>
            <option>Recovered</option>
            <option>Deceased</option>
          </select>
        </div>

        {/* Date */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '5px', fontWeight: '600' }}>Date</label>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={SEL} />
        </div>

        {/* Severity — includes Asymptomatic */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '5px', fontWeight: '600' }}>Severity</label>
          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} style={SEL}>
            <option>All Severities</option>
            <option>Mild</option>
            <option>Moderate</option>
            <option>Severe</option>
            <option>Asymptomatic</option>
          </select>
        </div>

        {/* Legend */}
        <div style={{ paddingTop: '14px', borderTop: '1px solid #334155' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legend</p>
          {[
            { color: '#ef4444', label: 'High Risk (>20 cases)' },
            { color: '#f59e0b', label: 'Medium Risk (10–20)' },
            { color: '#10b981', label: 'Low Risk (<10)' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '8px' }}>
              <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: l.color, flexShrink: 0, display: 'inline-block' }} />
              <span style={{ fontSize: '12px', color: '#cbd5e1' }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* Active Hotspots counter — based on filtered data */}
        <div style={{ paddingTop: '14px', borderTop: '1px solid #334155' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Active Hotspots</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { label: 'High',   count: highCount,   color: '#ef4444' },
              { label: 'Medium', count: mediumCount, color: '#f59e0b' },
              { label: 'Low',    count: lowCount,    color: '#10b981' },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ flex: 1, background: '#0f172a', borderRadius: '8px', padding: '10px 4px', textAlign: 'center', border: `1px solid ${color}33` }}>
                <div style={{ fontSize: '22px', fontWeight: '800', color }}>{count}</div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '10px', color: '#475569', lineHeight: '1.4' }}>
            Pin color = total cases per barangay. Thresholds: &gt;20 red, 10–20 amber, &lt;10 green.
          </p>
        </div>

        <button
          onClick={() => { setFilterBarangay('All Barangays'); setFilterStatus('All Status'); setFilterDate(''); setFilterSeverity('All Severities'); }}
          style={{ padding: '11px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', marginTop: 'auto' }}>
          Reset Filters
        </button>
      </div>

      {/* ── MAP AREA ── */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <MapContainer
          center={CABUYAO_CENTER} zoom={14} minZoom={12} maxZoom={18}
          style={{ width: '100%', height: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <PulseMarkers
            barangayData={barangayData}
            onHover={setTooltip}
            onLeave={() => setTooltip(null)}
            onClick={setPopup}
          />
        </MapContainer>

        {/* HOVER TOOLTIP */}
        {tooltip && (
          <div style={{
            position: 'absolute', top: '16px', left: '16px', zIndex: 1000,
            background: 'rgba(15,23,42,0.97)', border: '1px solid #334155',
            borderRadius: '10px', padding: '14px 16px', minWidth: '210px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)', pointerEvents: 'none',
          }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#f1f5f9', marginBottom: '3px' }}>
              {tooltip.barangayName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: getRisk(tooltip.totalCases).color, display: 'inline-block' }} />
              {getRisk(tooltip.totalCases).label} · {tooltip.totalCases} case{tooltip.totalCases !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '7px' }}>
              Top Diseases
            </div>
            {getTop5(tooltip.diseases).map(([disease, count], i) => (
              <div key={disease} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <span style={{ fontSize: '13px', color: '#cbd5e1' }}>
                  <span style={{ color: '#475569', marginRight: '5px' }}>{i + 1}.</span>{disease}
                </span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#10b981', marginLeft: '12px' }}>{count}</span>
              </div>
            ))}
            <div style={{ marginTop: '8px', fontSize: '10px', color: '#475569', fontStyle: 'italic' }}>Click pin for full details</div>
          </div>
        )}

        {/* CLICK POPUP */}
        {popup && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
          }} onClick={() => setPopup(null)}>
            <div style={{
              background: '#1e293b', border: '1px solid #334155', borderRadius: '14px',
              padding: '28px', width: '440px', maxWidth: '95vw', maxHeight: '80vh',
              overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
            }} onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>{popup.barangayName}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: getRisk(popup.totalCases).color, display: 'inline-block' }} />
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                      {getRisk(popup.totalCases).label} · {popup.totalCases} total case{popup.totalCases !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <button onClick={() => setPopup(null)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px', lineHeight: 1, padding: 0 }}>
                  ×
                </button>
              </div>

              <div style={{ borderTop: '1px solid #334155', marginBottom: '14px' }} />

              <p style={{ margin: '0 0 10px 0', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                All Diseases in this Barangay
              </p>

              {Object.entries(popup.diseases)
                .sort((a, b) => b[1] - a[1])
                .map(([disease, count], i) => {
                  const isTop = i < 5;
                  return (
                    <div key={disease} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', marginBottom: '7px', borderRadius: '8px',
                      background: isTop ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isTop ? 'rgba(59,130,246,0.25)' : '#334155'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flex: 1, minWidth: 0 }}>
                        {isTop && (
                          <span style={{ fontSize: '9px', background: '#3b82f6', color: 'white', padding: '2px 6px', borderRadius: '10px', fontWeight: '700', flexShrink: 0 }}>
                            TOP {i + 1}
                          </span>
                        )}
                        <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: isTop ? '600' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {disease}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginLeft: '10px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#10b981' }}>{count}</span>
                        <button onClick={() => goToDisease(popup.barangayName, disease)}
                          style={{ padding: '5px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                          Go To →
                        </button>
                      </div>
                    </div>
                  );
                })}

              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #334155', fontSize: '11px', color: '#475569', textAlign: 'center' }}>
                Click "Go To →" to open Manage Cases filtered to that disease and barangay
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}