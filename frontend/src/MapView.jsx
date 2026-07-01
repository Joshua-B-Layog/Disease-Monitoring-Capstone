import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { API_URL } from './config';
import { GeoJSON } from 'react-leaflet';
import cabuyaoBoundaries from './data/cabuyao_barangays.geojson.json';
import cabuyaoGeoJSON from './data/cabuyao_barangays.geojson';
import PUROK_OFFSETS, { findPurokCoords } from './data/coordinates';

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
const CABUYAO_BOUNDS = [
  [14.16, 121.07],
  [14.29, 121.18],
];

// ALL 18 barangays — hardcoded so dropdown is always complete
const ALL_BARANGAYS = [
  'Baclaran', 'Banay-Banay', 'Banlic',
  'Barangay Dos (Poblacion)', 'Barangay Tres (Poblacion)', 'Barangay Uno (Poblacion)',
  'Bigaa', 'Butong', 'Casile', 'Diezmo', 'Gulod',
  'Mamatid', 'Marinig', 'Niugan', 'Pittland', 'Pulo', 'Sala', 'San Isidro',
];

// Coordinates for each barangay — fuzzy matched so minor spelling diffs are OK
const BARANGAY_COORDS = {
  'Baclaran': [14.2450, 121.1630],
  'Banay-Banay': [14.2550, 121.1300],
  'Banlic': [14.2330, 121.1380],
  'Barangay Dos (Poblacion)': [14.2770, 121.1260],
  'Barangay Tres (Poblacion)': [14.2760, 121.1230],
  'Barangay Uno (Poblacion)': [14.2800, 121.1240],
  'Bigaa': [14.2860, 121.1300],
  'Butong': [14.2850, 121.1370],
  'Casile': [14.1830, 121.0350],
  'Diezmo': [14.2340, 121.1000],
  'Gulod': [14.2530, 121.1590],
  'Mamatid': [14.2360, 121.1600],
  'Marinig': [14.2660, 121.1480],
  'Niugan': [14.2690, 121.1340],
  'Pittland': [14.2160, 121.0600],
  'Pulo': [14.2480, 121.1390],
  'Sala': [14.2690, 121.1350],
  'San Isidro': [14.2490, 121.1430],
};

const extractPurok = (address) => {
  if (!address) return 'Unknown';
  const a = address.toLowerCase();
  for (const p of PUROK_OPTIONS) {
    if (p === 'All Puroks') continue;
    if (a.includes(p.toLowerCase())) return p;
  }
  return 'Unknown';
};

// Distinct color palette for disease-based choropleth
const DISEASE_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#0ea5e9', '#a855f7', '#d946ef',
  '#22c55e', '#eab308', '#64748b', '#475569', '#1e293b',
  '#7c3aed', '#db2777', '#0284c7', '#65a30d', '#d97706',
  '#9333ea',
];
const getDiseaseColor = (diseaseName) => {
  if (!diseaseName) return '#374151';
  let hash = 0;
  for (let i = 0; i < diseaseName.length; i++) {
    hash = diseaseName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return DISEASE_COLORS[Math.abs(hash) % DISEASE_COLORS.length];
};
const getTopDisease = (diseases) => {
  const entries = Object.entries(diseases);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
};

// Safe normalize — never crashes on non-string input
const norm = (s) => {
  if (typeof s !== 'string') return '';
  return s.toLowerCase().replace(/[\s\-().]/g, '');
};

// Maps GeoJSON ADM4_EN values to DB's barangays.name values
const GEOJSON_TO_DB_NAME = {
  'Baclaran': 'Baclaran',
  'Banaybanay': 'Banay-Banay',
  'Banlic': 'Banlic',
  'Butong': 'Butong',
  'Bigaa': 'Bigaa',
  'Casile': 'Casile',
  'Gulod': 'Gulod',
  'Mamatid': 'Mamatid',
  'Marinig': 'Marinig',
  'Niugan': 'Niugan',
  'Pittland': 'Pittland',
  'Pulo': 'Pulo',
  'Sala': 'Sala',
  'San Isidro': 'San Isidro',
  'Diezmo': 'Diezmo',
  'Barangay Uno (Pob.)': 'Barangay Uno (Poblacion)',
  'Barangay Dos (Pob.)': 'Barangay Dos (Poblacion)',
  'Barangay Tres (Pob.)': 'Barangay Tres (Poblacion)',
};
const getDbNameFromGeoJson = (admName) => {
  if (!GEOJSON_TO_DB_NAME[admName]) {
    console.warn('Unmatched GeoJSON ADM4_EN:', admName);
  }
  return GEOJSON_TO_DB_NAME[admName] || admName;
};

const PUROK_OPTIONS = [
  'All Puroks', 'Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Purok 5', 'Purok 6',
  'Blk 1', 'Blk 2', 'Blk 3', 'Blk 4', 'Blk 5',
  'Phase 1', 'Phase 2', 'Phase 3',
  'Lot 1', 'Lot 2', 'Lot 3', 'Lot 4', 'Lot 5'
];

const findCoords = (name) => {
  if (!name) return null;
  if (BARANGAY_COORDS[name]) return BARANGAY_COORDS[name];
  const n = norm(name);
  for (const [key, val] of Object.entries(BARANGAY_COORDS)) {
    if (norm(key) === n) return val;
  }
  return null;
};

const findCanonicalName = (rawName) => {
  if (!rawName) return null;
  const n = norm(rawName);
  const match = ALL_BARANGAYS.find(b => norm(b) === n);
  return match || rawName;
};

// Risk thresholds: <10 = Low (green), 10-20 = Medium (amber), >20 = High (red)
const getRisk = (count) => {
  if (count > 20) return { color: '#ef4444', ring: 'rgba(239,68,68,0.3)', label: 'High Risk' };
  if (count >= 10) return { color: '#f59e0b', ring: 'rgba(245,158,11,0.3)', label: 'Medium Risk' };
  return { color: '#10b981', ring: 'rgba(16,185,129,0.3)', label: 'Low Risk' };
};

const getGeoJsonStyle = (feature, barangayData) => {
  const dbName = getDbNameFromGeoJson(feature.properties.ADM4_EN);
  const match = barangayData.find(b => b.barangayName === dbName);
  const topDisease = match ? getTopDisease(match.diseases) : null;
  const fillColor = topDisease ? getDiseaseColor(topDisease) : '#374151';
  const count = match ? match.totalCases : 0;
  return {
    fillColor,
    fillOpacity: count > 0 ? 0.5 : 0.12,
    color: '#ffffff',
    weight: 1.5,
  };
};

const getPurokGroups = (barangayName, cases) => {
  const groups = {};
  const centroid = BARANGAY_COORDS[barangayName];
  if (!centroid) return [];

  cases.forEach(c => {
    const [, purokPart] = (c.address || '').split('|');
    let purok = (purokPart || '').trim();
    if (!purok) {
      const addrLower = (c.address || '').toLowerCase().replace(/[\s\-]/g, '');
      const matched = PUROK_OPTIONS.find(p => {
        if (p === 'All Puroks') return false;
        const pNorm = p.toLowerCase().replace(/[\s]/g, '');
        return addrLower.includes(pNorm);
      });
      purok = matched || 'Unspecified';
    }
    const hasCoords = c.latitude && c.longitude && !isNaN(parseFloat(c.latitude)) && !isNaN(parseFloat(c.longitude));

    if (!groups[purok]) groups[purok] = { purok, cases: [], latSum: 0, lngSum: 0, validCoordCount: 0 };
    groups[purok].cases.push(c);

    if (hasCoords) {
      groups[purok].latSum += parseFloat(c.latitude);
      groups[purok].lngSum += parseFloat(c.longitude);
      groups[purok].validCoordCount++;
    }
  });

  return Object.values(groups).map(g => ({
    purok: g.purok,
    barangayName: g.purok === 'Unspecified' ? barangayName : barangayName + ' - ' + g.purok,
    barangay: barangayName,
    coords: g.validCoordCount > 0
      ? [g.latSum / g.validCoordCount, g.lngSum / g.validCoordCount]
      : findPurokCoords(barangayName, g.purok, BARANGAY_COORDS) || centroid,
    totalCases: g.cases.length,
    diseases: g.cases.reduce((acc, c) => {
      const d = c.disease_name || 'Unknown';
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {}),
  }));
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

function ZoomToBarangay({ barangay, loginRole, loginBarangay }) {
  const map = useMap();
  const prevRef = useRef(null);
  useEffect(() => {
    const target = (loginRole === 'BHW' && loginBarangay) ? loginBarangay : barangay;
    if (!target || target === 'All Barangays' || target === prevRef.current) return;
    prevRef.current = target;
    const coords = findCoords(target);
    if (!coords) return;
    map.setView(coords, 15, { animate: true, duration: 0.8 });
  }, [barangay, loginRole, loginBarangay, map]);
  return null;
}

function ChoroplethLayer({ barangayData, onHover, onLeave, onClick }) {
  const findMatch = (feature) => {
    const rawName = feature?.properties?.name ?? feature?.properties?.NAME ?? '';
    const key = norm(rawName);
    const overridden = GEOJSON_TO_DB_NAME[key];
    const targetName = overridden || rawName;
    const targetKey = norm(targetName);

    return barangayData.find(b => norm(b.barangayName) === targetKey) || null;
  };

  const style = (feature) => {
    const match = findMatch(feature);
    const count = match ? match.totalCases : 0;
    const fillColor = match ? getRisk(count).color : '#444';
    return {
      fillColor,
      weight: 1,
      color: '#666',
      fillOpacity: match ? 0.65 : 0.15,
    };
  };

  const onEachFeature = (feature, layer) => {
    layer.on({
      mouseover: () => {
        const match = findMatch(feature);
        if (match) {
          onHover(match);
        } else {
          onHover({
            barangayName: feature.properties.ADM4_EN,
            totalCases: 0,
            diseases: {},
          });
        }
      },
      mouseout: () => onLeave(),
      click: () => {
        const match = findMatch(feature);
        if (match) onClick(match);
      },
    });
  };

  return (
    <GeoJSON
      data={cabuyaoBoundaries}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}

export default function MapView({ setActiveTab, setCaseFilter, loginRole, loginBarangay, sessionContext }) {
  const [allCases, setAllCases]         = useState([]);
  const [barangayData, setBarangayData] = useState([]);
  const [purokData, setPurokData]       = useState([]);
  const [filterBarangay, setFilterBarangay] = useState('All Barangays');
  const [filterStatus,   setFilterStatus]   = useState('All Status');
  const [filterDate,     setFilterDate]     = useState('');
  const [filterSeverity, setFilterSeverity] = useState('All Severities');
  const [filterPurok, setFilterPurok] = useState('All Puroks');
  const [tooltip, setTooltip] = useState(null);
  const [popup,   setPopup]   = useState(null);
  const [lastUpdated, setLastUpdated]   = useState(null);
  const [now, setNow]                   = useState(Date.now());

  const [barangayOpen, setBarangayOpen] = useState(false);
  const barangayRef = useRef(null);
  const [purokOpen, setPurokOpen] = useState(false);
  const purokRef = useRef(null);
  const geoJsonLayerRef = useRef(null);
  const barangayDataRef = useRef(barangayData);
  useEffect(() => { barangayDataRef.current = barangayData; }, [barangayData]);

  const CHO_UNIT_BARANGAYS = {
    'CHO Unit I (Sala)': [
      'Barangay Uno (Poblacion)', 'Barangay Dos (Poblacion)', 'Barangay Tres (Poblacion)',
      'Sala', 'Bigaa', 'Butong', 'Marinig', 'Gulod', 'Niugan', 'Baclaran',
    ],
    'CHO Unit II (Pulo)': [
      'Pulo', 'Banay-Banay', 'Banlic', 'Mamatid', 'San Isidro', 'Diezmo', 'Pittland', 'Casile',
    ],
  };

  useEffect(() => {
    const handler = (e) => {
      if (barangayRef.current && !barangayRef.current.contains(e.target)) {
        setBarangayOpen(false);
      }
      if (purokRef.current && !purokRef.current.contains(e.target)) setPurokOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchMapData = () => {
    axios.get(API_URL + '/api/disease_cases')
      .then(res => { setAllCases(res.data); setLastUpdated(Date.now()); })
      .catch(err => console.error('MapView fetch error:', err));
  };

  useEffect(() => {
    fetchMapData();
    const interval = setInterval(fetchMapData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!geoJsonLayerRef.current) return;
    geoJsonLayerRef.current.eachLayer((layer) => {
      layer.setStyle(getGeoJsonStyle(layer.feature, barangayData));
    });
  }, [barangayData]);

  useEffect(() => {
    if (!allCases.length) return;

    const filtered = allCases.filter(c => {
      if (filterBarangay !== 'All Barangays'  && c.barangay_name !== filterBarangay)   return false;
      if (filterStatus   !== 'All Status'     && c.status        !== filterStatus)      return false;
      if (filterSeverity !== 'All Severities' && c.severity      !== filterSeverity)    return false;
      if (filterDate && c.date_reported && !c.date_reported.startsWith(filterDate))     return false;
      if (filterPurok !== 'All Puroks' && !(c.address || '').toLowerCase().includes(filterPurok.toLowerCase())) return false;
      return true;
    });

    const choUnitBarangays = sessionContext ? CHO_UNIT_BARANGAYS[sessionContext] || [] : [];

    const scopedFiltered = (loginRole === 'BHW' && loginBarangay)
      ? filtered.filter(c => c.barangay_name === loginBarangay)
      : (loginRole === 'CHO' && choUnitBarangays.length > 0)
        ? filtered.filter(c => choUnitBarangays.includes(c.barangay_name))
        : filtered;

    const groups = {};
    scopedFiltered.forEach(c => {
      const bn = findCanonicalName(c.barangay_name);
      if (!bn) { console.warn('Unmatched barangay in case data:', c.barangay_name); return; }
      const coords = findCoords(bn);
      if (!coords) { console.warn('No coords for:', bn); return; }
      if (!groups[bn]) groups[bn] = { barangayName: bn, coords, totalCases: 0, diseases: {}, cases: [] };
      const g = groups[bn];
      g.totalCases++;
      g.cases.push(c);
      const dn = (c.disease_name || 'Unknown').trim();
      g.diseases[dn] = (g.diseases[dn] || 0) + 1;
    });

    console.table(groups);
    setBarangayData(Object.values(groups));

    // Purok-level grouping — used when scoped to a single barangay
    const purokTarget = (loginRole === 'BHW' && loginBarangay) ? loginBarangay
      : (filterBarangay !== 'All Barangays') ? filterBarangay
      : null;
    if (purokTarget) {
      const canon = findCanonicalName(purokTarget);
      const purokCases = scopedFiltered.filter(c => findCanonicalName(c.barangay_name) === canon);
      setPurokData(getPurokGroups(canon, purokCases));
    } else {
      setPurokData([]);
    }
  }, [allCases, filterBarangay, filterStatus, filterDate, filterSeverity, filterPurok]);

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
    background: 'var(--input-bg)', border: '1px solid var(--border-color)',
    borderRadius: '7px', color: 'var(--text-main)',
    fontSize: '13px', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── SIDEBAR — fixed 280px, never shrinks ── */}
      <div style={{
        width: '280px', minWidth: '280px', flexShrink: 0,
        background: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)',
        padding: '20px 16px', display: 'flex', flexDirection: 'column',
        gap: '16px', overflowY: 'auto',
      }}>
        <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Filters
        </p>

        {/* Barangay — all 18 hardcoded (hidden for BHW) */}
        {loginRole !== 'BHW' && (
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: '600' }}>Barangay</label>
            <div style={{ position: 'relative' }} ref={barangayRef}>
              <button
                onClick={() => setBarangayOpen(!barangayOpen)}
                style={{
                  width: '100%', padding: '9px 12px',
                  background: 'var(--input-bg)', border: `1px solid ${barangayOpen ? '#60a5fa' : 'var(--border-color)'}`,
                  borderRadius: '7px', color: 'var(--text-main)',
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
                  background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                  borderRadius: '8px', boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
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
                      color: filterBarangay === 'All Barangays' ? 'var(--accent, #93bbfc)' : 'var(--text-main)',
                      fontWeight: filterBarangay === 'All Barangays' ? '600' : '400',
                      borderLeft: filterBarangay === 'All Barangays' ? '3px solid var(--accent, #60a5fa)' : '3px solid transparent',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.25)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = filterBarangay === 'All Barangays' ? 'rgba(96,165,250,0.18)' : 'transparent'; e.currentTarget.style.color = filterBarangay === 'All Barangays' ? 'var(--accent, #93bbfc)' : 'var(--text-main)'; }}
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
                        color: filterBarangay === b ? 'var(--accent, #93bbfc)' : 'var(--text-main)',
                        fontWeight: filterBarangay === b ? '600' : '400',
                        borderLeft: filterBarangay === b ? '3px solid var(--accent, #60a5fa)' : '3px solid transparent',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.25)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = filterBarangay === b ? 'rgba(96,165,250,0.18)' : 'transparent'; e.currentTarget.style.color = filterBarangay === b ? 'var(--accent, #93bbfc)' : 'var(--text-main)'; }}
                    >
                      <span style={{ flex: 1 }}>{b}</span>
                      {filterBarangay === b && <span style={{ color: '#60a5fa', fontSize: '12px' }}>✓</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* BHW — static barangay display */}
        {loginRole === 'BHW' && loginBarangay && (
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: '600' }}>Barangay</label>
            <div style={{ padding: '9px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '7px', color: 'var(--text-main)', fontSize: '13px' }}>
              {loginBarangay}
            </div>
          </div>
        )}

        {/* Status */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: '600' }}>Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={SEL}>
            <option>All Status</option>
            <option>Active</option>
            <option>Pending</option>
            <option>Under Treatment</option>
            <option>Recovered</option>
            <option>Deceased</option>
          </select>
        </div>

        {/* Purok / Blk / Phase */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: '600' }}>Purok / Blk / Phase</label>
          <div style={{ position: 'relative' }} ref={purokRef}>
            <button
              onClick={() => setPurokOpen(!purokOpen)}
              style={{
                width: '100%', padding: '9px 12px',
                background: 'var(--input-bg)', border: `1px solid ${purokOpen ? '#60a5fa' : 'var(--border-color)'}`,
                borderRadius: '7px', color: 'var(--text-main)',
                fontSize: '13px', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxSizing: 'border-box',
              }}
            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filterPurok}</span>
              <span style={{
                fontSize: '10px', opacity: 0.6, flexShrink: 0, marginLeft: '8px',
                transition: 'transform 0.2s', display: 'inline-block',
                transform: purokOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}>▾</span>
            </button>
            {purokOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                maxHeight: '200px', overflowY: 'auto', marginTop: '4px',
                background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                borderRadius: '8px', boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
                padding: '4px', textAlign: 'left',
              }}>
                {PUROK_OPTIONS.map(p => (
                  <div
                    key={p}
                    onClick={() => { setFilterPurok(p); setPurokOpen(false); }}
                    style={{
                      padding: '8px 14px', cursor: 'pointer', fontSize: '13px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      borderRadius: '6px',
                      background: filterPurok === p ? 'rgba(96,165,250,0.18)' : 'transparent',
                      color: filterPurok === p ? 'var(--accent, #93bbfc)' : 'var(--text-main)',
                      fontWeight: filterPurok === p ? '600' : '400',
                      borderLeft: filterPurok === p ? '3px solid var(--accent, #60a5fa)' : '3px solid transparent',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.25)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = filterPurok === p ? 'rgba(96,165,250,0.18)' : 'transparent'; }}
                  >
                    <span style={{ flex: 1 }}>{p}</span>
                    {filterPurok === p && <span style={{ color: '#60a5fa', fontSize: '12px' }}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Date */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: '600' }}>Date</label>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={SEL} />
        </div>

        {/* Severity — includes Asymptomatic */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: '600' }}>Severity</label>
          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} style={SEL}>
            <option>All Severities</option>
            <option>Mild</option>
            <option>Moderate</option>
            <option>Severe</option>
            <option>Asymptomatic</option>
          </select>
        </div>

        {/* Legend */}
        <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legend</p>
          {[
            { color: '#ef4444', label: 'High Risk (>20 cases)' },
            { color: '#f59e0b', label: 'Medium Risk (10–20)' },
            { color: '#10b981', label: 'Low Risk (<10)' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '8px' }}>
              <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: l.color, flexShrink: 0, display: 'inline-block' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-main)' }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* Active Hotspots counter — based on filtered data */}
        <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Hotspots</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { label: 'High',   count: highCount,   color: '#ef4444' },
              { label: 'Medium', count: mediumCount, color: '#f59e0b' },
              { label: 'Low',    count: lowCount,    color: '#10b981' },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ flex: 1, background: 'var(--input-bg)', borderRadius: '8px', padding: '10px 4px', textAlign: 'center', border: `1px solid ${color}33` }}>
                <div style={{ fontSize: '22px', fontWeight: '800', color }}>{count}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Pin color = total cases per barangay. Thresholds: &gt;20 red, 10–20 amber, &lt;10 green.
          </p>
        </div>

        <button
          onClick={() => { setFilterBarangay('All Barangays'); setFilterStatus('All Status'); setFilterDate(''); setFilterSeverity('All Severities'); }}
          style={{ padding: '11px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', marginTop: 'auto' }}>
          Reset Filters
        </button>

        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', paddingTop: '6px' }}>
          {lastUpdated ? `Updated ${Math.round((now - lastUpdated) / 1000)}s ago` : 'Refreshing...'}
        </div>
      </div>

      {/* ── MAP AREA ── */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <MapContainer
          center={(loginRole === 'BHW' && loginBarangay && findCoords(loginBarangay)) 
            ? findCoords(loginBarangay) 
            : CABUYAO_CENTER} zoom={14} minZoom={13} maxZoom={18}
          maxBounds={CABUYAO_BOUNDS}
          maxBoundsViscosity={1.0}
          style={{ width: '100%', height: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <ZoomToBarangay barangay={filterBarangay} loginRole={loginRole} loginBarangay={loginBarangay} />
          {loginRole !== 'BHW' && filterBarangay === 'All Barangays' ? (
            <GeoJSON
              ref={geoJsonLayerRef}
              data={cabuyaoBoundaries}
              style={(feature) => getGeoJsonStyle(feature, barangayData)}
              onEachFeature={(feature, layer) => {
                const barangayName = getDbNameFromGeoJson(feature.properties.ADM4_EN);
                layer.on({
                  mouseover: function (e) {
                    e.target.setStyle({ fillOpacity: 0.75, weight: 2.5 });
                    const liveData = barangayDataRef.current.find(b => b.barangayName === barangayName);
                    if (liveData) {
                      setTooltip(liveData);
                    } else {
                      setTooltip({ barangayName, totalCases: 0, diseases: {} });
                    }
                  },
                  mouseout: function (e) {
                    e.target.setStyle(getGeoJsonStyle(feature, barangayData));
                    setTooltip(null);
                  },
                  click: function () {
                    const liveData = barangayDataRef.current.find(b => b.barangayName === barangayName);
                    if (liveData) setPopup(liveData);
                    else setPopup({ barangayName, totalCases: 0, diseases: {}, coords: null });
                  },
                });
              }}
            />
          ) : (
            <PulseMarkers
              barangayData={purokData.length > 0 ? purokData : barangayData}
              onHover={setTooltip}
              onLeave={() => setTooltip(null)}
              onClick={setPopup}
            />
          )}
        </MapContainer>

        {/* HOVER TOOLTIP */}
        {tooltip && (
          <div style={{
            position: 'absolute', top: '16px', left: '16px', zIndex: 1000,
            background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
            borderRadius: '10px', padding: '14px 16px', minWidth: '210px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)', pointerEvents: 'none',
          }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '3px' }}>
              {tooltip.barangayName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: getRisk(tooltip.totalCases).color, display: 'inline-block' }} />
              {getRisk(tooltip.totalCases).label} · {tooltip.totalCases} case{tooltip.totalCases !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '7px' }}>
              Top Diseases
            </div>
            {getTop5(tooltip.diseases).map(([disease, count], i) => (
              <div key={disease} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: '5px' }}>{i + 1}.</span>{disease}
                </span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#10b981', marginLeft: '12px' }}>{count}</span>
              </div>
            ))}
            <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Click pin for full details</div>
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
              background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px',
              padding: '28px', width: '440px', maxWidth: '95vw', maxHeight: '80vh',
              overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
            }} onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '20px', fontWeight: '700', color: 'var(--text-main)' }}>{popup.barangayName}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: getRisk(popup.totalCases).color, display: 'inline-block' }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {getRisk(popup.totalCases).label} · {popup.totalCases} total case{popup.totalCases !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <button onClick={() => setPopup(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '24px', lineHeight: 1, padding: 0 }}>
                  ×
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', marginBottom: '14px' }} />

              <p style={{ margin: '0 0 10px 0', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
                      border: `1px solid ${isTop ? 'rgba(59,130,246,0.25)' : 'var(--border-color)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flex: 1, minWidth: 0 }}>
                        {isTop && (
                          <span style={{ fontSize: '9px', background: '#3b82f6', color: 'white', padding: '2px 6px', borderRadius: '10px', fontWeight: '700', flexShrink: 0 }}>
                            TOP {i + 1}
                          </span>
                        )}
                        <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: isTop ? '600' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                Click "Go To →" to open Manage Cases filtered to that disease and barangay
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}