import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { API_URL } from '../config';
import cabuyaoBoundaries from '../data/cabuyao_barangays.geojson.json';
import { getPointInBarangay, pointInFeature } from '../data/coordinates';

const CABUYAO_CENTER = [14.2253, 121.1254];
const CABUYAO_BOUNDS = [
  [14.16, 120.98],
  [14.29, 121.18],
];

const ALL_BARANGAYS = [
  'Baclaran', 'Banay-Banay', 'Banlic',
  'Barangay Dos (Poblacion)', 'Barangay Tres (Poblacion)', 'Barangay Uno (Poblacion)',
  'Bigaa', 'Butong', 'Casile', 'Diezmo', 'Gulod',
  'Mamatid', 'Marinig', 'Niugan', 'Pittland', 'Pulo', 'Sala', 'San Isidro',
];

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

// Inject permanent label styles once
if (!document.getElementById('cdms-barangay-labels')) {
  const ls = document.createElement('style');
  ls.id = 'cdms-barangay-labels';
  ls.textContent = `
    .brgy-tooltip-label {
      background: rgba(15,23,42,0.85) !important;
      border: none !important;
      border-radius: 6px !important;
      padding: 4px 7px !important;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3) !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      pointer-events: none !important;
    }
    .brgy-tooltip-label .brgy-name {
      font-weight: 700;
      font-size: 11px;
      color: #fff;
      text-align: center;
      line-height: 1.2;
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
    }
    .brgy-tooltip-label .brgy-disease {
      font-size: 10px;
      color: #93c5fd;
      text-align: center;
      line-height: 1.2;
      margin-top: 1px;
    }
    .brgy-tooltip-label .brgy-empty {
      color: #94a3b8;
      font-style: italic;
    }
    .brgy-tooltip-label .brgy-risk {
      font-size: 9px;
      text-align: center;
      line-height: 1.1;
      margin-top: 1px;
    }
    .leaflet-tooltip-top.brgy-tooltip-label::before,
    .leaflet-tooltip-bottom.brgy-tooltip-label::before,
    .leaflet-tooltip-left.brgy-tooltip-label::before,
    .leaflet-tooltip-right.brgy-tooltip-label::before {
      border: none !important;
    }
  `;
  document.head.appendChild(ls);
}

const DISEASE_CAUSES = {
  'dengue': 'Likely caused by stagnant water collecting near homes after rain, allowing mosquitoes to breed.',
  'leptospirosis': 'Likely caused by floodwater or stagnant water contaminated with animal urine in the area.',
  'cholera': 'Likely caused by contaminated water sources or poor sanitation in the address.',
  'typhoid fever': 'Likely caused by contaminated food or water supply in the area.',
  'diarrhea': 'Likely caused by unsafe drinking water or poor sanitation nearby.',
  'malaria': 'Likely caused by stagnant water bodies supporting mosquito breeding in the area.',
  'chickenpox': 'Likely spread through close contact in densely populated housing.',
  'measles': 'Likely spread through close contact in densely populated housing.',
  'tuberculosis': 'Likely spread through prolonged close contact in crowded living conditions.',
  'covid-19': 'Likely spread through close contact in densely populated housing.',
  'hand foot and mouth disease': 'Likely spread through close contact among children in the area.',
  'hepatitis a': 'Likely caused by contaminated food or water supply in the area.',
  'hepatitis b': 'Likely spread through contact with infected blood or bodily fluids in the area.',
  'hepatitis c': 'Likely spread through contact with infected blood in the area.',
  'hiv/aids': 'Likely spread through contact with infected bodily fluids.',
  'rabies': 'Likely caused by exposure to infected animals, particularly stray dogs in the vicinity.',
  'influenza a': 'Likely spread through respiratory droplets in crowded indoor spaces.',
  'influenza a (h1n1)': 'Likely spread through respiratory droplets in crowded indoor spaces.',
  'acute respiratory infection': 'Likely caused by viral or bacterial infection spread through coughing or sneezing in close quarters.',
  'avian influenza': 'Likely caused by contact with infected poultry or contaminated surfaces in the area.',
  'diphtheria': 'Likely spread through respiratory droplets or close contact in crowded conditions.',
  'ebola': 'Likely spread through direct contact with blood or bodily fluids of an infected person.',
  'leprosy': 'Likely spread through prolonged close contact in crowded living conditions.',
  'meningococcemia': 'Likely spread through respiratory droplets in crowded indoor spaces.',
  'pertussis': 'Likely spread through coughing or sneezing in close contact with others.',
  'poliomyelitis': 'Likely caused by contaminated water or poor sanitation in the area.',
  'sars': 'Likely spread through respiratory droplets in crowded indoor spaces.',
  'sore eyes': 'Likely spread through direct contact with infected eye secretions or contaminated surfaces.',
};

function getDiseaseCause(diseaseName) {
  if (!diseaseName) return 'Cause unclear - insufficient data for this address component.';
  const key = diseaseName.trim().toLowerCase();
  return DISEASE_CAUSES[key] ||
    'Cause unclear - likely linked to environmental or sanitation conditions in this address component (Lot/Blk/Phase/Purok).';
}

const norm = (s) => {
  if (typeof s !== 'string') return '';
  return s.toLowerCase().replace(/[\s\-().]/g, '');
};

function getPolygonCentroid(geometry) {
  if (!geometry) return null;
  let coords = [];
  if (geometry.type === 'Polygon') {
    coords = geometry.coordinates[0];
  } else if (geometry.type === 'MultiPolygon') {
    let largest = geometry.coordinates[0][0];
    geometry.coordinates.forEach(poly => {
      if (poly[0].length > largest.length) largest = poly[0];
    });
    coords = largest;
  }
  if (!coords.length) return null;
  let latSum = 0, lngSum = 0;
  coords.forEach(([lng, lat]) => { latSum += lat; lngSum += lng; });
  return [latSum / coords.length, lngSum / coords.length];
}

const getBarangayBounds = (barangayName) => {
  if (!barangayName) return null;
  const n = norm(barangayName);
  const feature = cabuyaoBoundaries.features.find(f => {
    const props = f.properties || {};
    const rawName = props.ADM4_EN || '';
    const mappedName = GEOJSON_TO_DB_NAME[rawName] || rawName;
    return norm(mappedName) === n;
  });
  if (!feature || !feature.geometry) return null;

  let allCoords = [];
  const geom = feature.geometry;
  if (geom.type === 'Polygon') {
    allCoords = geom.coordinates[0];
  } else if (geom.type === 'MultiPolygon') {
    geom.coordinates.forEach(poly => {
      allCoords = allCoords.concat(poly[0]);
    });
  }
  if (!allCoords.length) return null;

  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  allCoords.forEach(([lng, lat]) => {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  });
  return [[minLat, minLng], [maxLat, maxLng]];
};

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

function findBarangayAtCoords(lat, lng, geoJson) {
  if (!geoJson || !geoJson.features) return null;
  for (const feature of geoJson.features) {
    if (feature.geometry && pointInFeature(lng, lat, feature.geometry)) {
      return getDbNameFromGeoJson(feature.properties.ADM4_EN);
    }
  }
  return null;
}

function getPurokGroups(barangayName, cases) {
  const groups = {};
  const centroid = BARANGAY_COORDS[barangayName];
  if (!centroid) return [];

  cases.forEach(c => {
    const [, purokPart] = (c.address || '').split('|');
    let purok = (purokPart || '').trim();
    if (!purok) {
      purok = extractLocationUnit(c.address) || 'Unspecified';
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
      : (() => {
          const feature = cabuyaoBoundaries.features.find(f => {
            const mapped = GEOJSON_TO_DB_NAME[f.properties.ADM4_EN] || f.properties.ADM4_EN;
            return norm(mapped) === norm(barangayName);
          });
          return getPointInBarangay(feature, `${barangayName}|${g.purok}`) || centroid;
        })(),
    totalCases: g.cases.length,
    diseases: g.cases.reduce((acc, c) => {
      const d = c.disease_name || 'Unknown';
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {}),
  }));
}

const PUROK_ZOOM_THRESHOLD = 17;

const PUROK_OPTIONS = [
  'All Puroks', 'Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Purok 5', 'Purok 6',
  'Blk 1', 'Blk 2', 'Blk 3', 'Blk 4', 'Blk 5',
  'Phase 1', 'Phase 2', 'Phase 3',
  'Lot 1', 'Lot 2', 'Lot 3', 'Lot 4', 'Lot 5'
];

function extractLocationUnit(address) {
  if (!address) return null;
  const a = address.toUpperCase();
  const found = { blk: null, lot: null, phase: null, purok: null };

  const blkMatch = a.match(/\bBLOCK\s*(\d+[A-Z]?)\b/)
    || a.match(/\bBLK\.?\s*(\d+[A-Z]?)\b/)
    || a.match(/\bB\.?\s*(\d+[A-Z]?)(?=\s|,|$|[A-Z])/);
  if (blkMatch) found.blk = blkMatch[1];

  const lotMatch = a.match(/\bLOT\.?\s*(\d+[A-Z]?)\b/)
    || a.match(/\bL\.?\s*(\d+[A-Z]?)(?=\s|,|$|[A-Z])/);
  if (lotMatch) found.lot = lotMatch[1];

  const mabitacMatch = a.match(/\bMABITAC\s+PHASE\s*(\d+)\b/);
  if (mabitacMatch) return `Mabitac Phase ${mabitacMatch[1]}`;

  const phaseMatch = a.match(/\bPHASE\s*(\d+)\b/)
    || a.match(/\bPH\.?\s*(\d+)\b/);
  if (phaseMatch) found.phase = phaseMatch[1];

  const purokMatch = a.match(/\bPUROK\s*(\d+)\b/)
    || a.match(/\bPRK\.?\s*(\d+)\b/);
  if (purokMatch) found.purok = purokMatch[1];

  const hasExplicitWord = /\b(BLK|BLOCK|LOT|PHASE|PH\.|PUROK|PRK)\b/.test(a);
  if (!hasExplicitWord && !found.phase && !found.purok) {
    const bareCount = (found.blk ? 1 : 0) + (found.lot ? 1 : 0);
    if (bareCount < 2) return null;
  }

  const parts = [];
  if (found.phase) parts.push(`Phase ${found.phase}`);
  if (found.blk) parts.push(`Blk ${found.blk}`);
  if (found.lot) parts.push(`Lot ${found.lot}`);
  if (found.purok) parts.push(`Purok ${found.purok}`);

  if (parts.length > 0) return parts.join(' ');

  const knownSubds = ['SOUTHVILLE 1A', 'SOUTHVILLE 1B', 'SOUTHVILLE 2', 'SOUTHVILLE 3'];
  for (const subd of knownSubds) {
    if (a.includes(subd)) return subd;
  }

  return null;
}

const findCoords = (name) => {
  if (!name) return null;
  const n = norm(name);

  const feature = cabuyaoBoundaries.features.find(f => {
    const props = f.properties || {};
    const rawName = props.ADM4_EN || '';
    const mappedName = GEOJSON_TO_DB_NAME[rawName] || rawName;
    return norm(mappedName) === n;
  });
  if (feature) {
    const centroid = getPolygonCentroid(feature.geometry);
    if (centroid) return centroid;
  }

  if (BARANGAY_COORDS[name]) return BARANGAY_COORDS[name];
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

const getRisk = (count) => {
  if (count >= 20) return { color: '#DC2626', ring: 'rgba(220,38,38,0.3)', label: 'High Risk' };
  if (count >= 10) return { color: '#f59e0b', ring: 'rgba(245,158,11,0.3)', label: 'Medium Risk' };
  return { color: '#10b981', ring: 'rgba(16,185,129,0.3)', label: 'Low Risk' };
};

function getGradientColor(count) {
  const clamped = Math.min(count, 40);
  if (clamped <= 10) {
    const t = clamped / 10;
    const r = Math.round(16 + t * (245 - 16));
    const g = Math.round(185 + t * (158 - 185));
    const b = Math.round(129 + t * (11 - 129));
    return `rgb(${r},${g},${b})`;
  } else {
    const t = Math.min((clamped - 10) / 30, 1);
    const r = Math.round(245 + t * (220 - 245));
    const g = Math.round(158 + t * (0 - 158));
    const b = Math.round(11 + t * (38 - 11));
    return `rgb(${r},${g},${b})`;
  }
}

const getGeoJsonStyle = (feature, barangayData) => {
  const dbName = getDbNameFromGeoJson(feature.properties.ADM4_EN);
  const match = barangayData.find(b => b.barangayName === dbName);
  const count = match ? match.totalCases : 0;
  const fillColor = count > 0 ? getGradientColor(count) : '#374151';
  return {
    fillColor,
    fillOpacity: count > 0 ? 0.5 : 0.12,
    color: '#ffffff',
    weight: 1.5,
  };
};

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

function ZoomListener({ onZoom, autoDetectedBrgy, setAutoDetectedBrgy }) {
  useMapEvents({
    zoomend: (e) => {
      const zoom = e.target.getZoom();
      onZoom(zoom);
      if (zoom >= PUROK_ZOOM_THRESHOLD) {
        const center = e.target.getCenter();
        const detected = findBarangayAtCoords(center.lat, center.lng, cabuyaoBoundaries);
        if (detected && detected !== autoDetectedBrgy) {
          setAutoDetectedBrgy(detected);
        }
      } else if (zoom < PUROK_ZOOM_THRESHOLD && autoDetectedBrgy) {
        setAutoDetectedBrgy(null);
      }
    },
  });
  return null;
}

function ZoomToBarangay({ barangay, cases }) {
  const map = useMap();
  const prevRef = useRef(null);
  const casesRef = useRef([]);
  casesRef.current = cases;
  useEffect(() => {
    const target = barangay;
    if (!target || target === prevRef.current) return;
    prevRef.current = target;

    const targetCases = (casesRef.current || []).filter(
      c => c.barangay_name === target && c.latitude && c.longitude
    );
    if (targetCases.length > 0) {
      let minLat = Infinity, maxLat = -Infinity;
      let minLng = Infinity, maxLng = -Infinity;
      targetCases.forEach(c => {
        const lat = parseFloat(c.latitude);
        const lng = parseFloat(c.longitude);
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      });
      if (minLat !== Infinity) {
        const latSpan = maxLat - minLat;
        const lngSpan = maxLng - minLng;
        if (latSpan < 0.005 && lngSpan < 0.005) {
          map.setView([(minLat + maxLat) / 2, (minLng + maxLng) / 2], 14, { animate: true, duration: 0.8 });
        } else {
          map.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [50, 50], animate: true, duration: 0.8 });
        }
        return;
      }
    }

    const bounds = getBarangayBounds(target);
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40], animate: true, duration: 0.8 });
    } else {
      const coords = findCoords(target);
      if (!coords) return;
      map.setView(coords, 15, { animate: true, duration: 0.8 });
    }
  }, [barangay, map]);
  return null;
}

function BoundsSetter() {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(CABUYAO_BOUNDS);
  }, [map]);
  return null;
}

const getTop5 = (diseases) =>
  Object.entries(diseases).sort((a, b) => b[1] - a[1]).slice(0, 5);

function LegendItem({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
      <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: color, opacity: 0.6 }} />
      {label}
    </div>
  );
}

export default function ResidentMap() {
  const [allCases, setAllCases]         = useState([]);
  const [barangayData, setBarangayData] = useState([]);
  const [purokData, setPurokData]       = useState([]);
  const [mapZoom, setMapZoom]           = useState(14);
  const [autoDetectedBrgy, setAutoDetectedBrgy] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [popup,   setPopup]   = useState(null);
  const [lastUpdated, setLastUpdated]   = useState(null);
  const [now, setNow]                   = useState(Date.now());
  const [selectedBrgy, setSelectedBrgy] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState([]);
  const geoJsonLayerRef = useRef(null);
  const barangayDataRef = useRef(barangayData);
  useEffect(() => { barangayDataRef.current = barangayData; }, [barangayData]);

  const fetchMapData = () => {
    axios.get(API_URL + '/api/disease_cases')
      .then(res => { setAllCases(res.data); setLastUpdated(Date.now()); })
      .catch(err => console.error('ResidentMap fetch error:', err));
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
    if (!allCases.length) return;

    const groups = {};
    allCases.forEach(c => {
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

    setBarangayData(Object.values(groups));
  }, [allCases]);

  // Purok grouping — only when scoped to a detected barangay
  useEffect(() => {
    if (autoDetectedBrgy) {
      const canon = findCanonicalName(autoDetectedBrgy);
      const purokCases = allCases.filter(c => findCanonicalName(c.barangay_name) === canon);
      setPurokData(getPurokGroups(canon, purokCases));
    } else {
      setPurokData([]);
    }
  }, [autoDetectedBrgy, allCases]);

  // Update GeoJSON styles when barangayData changes
  useEffect(() => {
    if (!geoJsonLayerRef.current) return;
    geoJsonLayerRef.current.eachLayer((layer) => {
      layer.setStyle(getGeoJsonStyle(layer.feature, barangayData));
    });
  }, [barangayData]);

  // Update permanent labels when data refreshes
  useEffect(() => {
    if (!geoJsonLayerRef.current) return;
    geoJsonLayerRef.current.eachLayer((layer) => {
      const rawName = layer.feature.properties.ADM4_EN;
      const barangayName = getDbNameFromGeoJson(rawName);
      const match = barangayData.find(b => b.barangayName === barangayName);
      const topDisease = match ? getTop5(match.diseases)[0] : null;
      const risk = match ? getRisk(match.totalCases) : getRisk(0);

      const html = `
        <div class="brgy-label">
          <div class="brgy-name">${rawName}</div>
          <div class="brgy-disease">
            ${match ? `${match.totalCases} case${match.totalCases !== 1 ? 's' : ''}` : '0 cases'}
            ${topDisease ? ` | ${topDisease[0]} (${topDisease[1]})` : ''}
          </div>
          <div class="brgy-risk" style="color:${risk.color}">● ${risk.label}</div>
        </div>
      `;
      if (layer.getTooltip()) {
        layer.setTooltipContent(html);
      } else {
        layer.bindTooltip(html, { permanent: true, direction: 'center', className: 'brgy-tooltip-label' });
      }
    });
  }, [barangayData]);

  const showAutoPurok = mapZoom >= PUROK_ZOOM_THRESHOLD && autoDetectedBrgy;

  const handleSearch = (val) => {
    const q = norm(val ?? searchQuery);
    if (!q) { setSearchMatches([]); return; }
    const matches = ALL_BARANGAYS.filter(b => norm(b).includes(q));
    setSearchMatches(matches);
    if (matches.length === 1) {
      setSelectedBrgy(matches[0]);
      setSearchQuery('');
      setSearchMatches([]);
    }
  };

  const zoomToBrgy = (name) => {
    setSelectedBrgy(name);
    setSearchQuery('');
    setSearchMatches([]);
  };

  const handlePulseClick = (data) => {
    setPopup(data);
    if (data.barangay) {
      setSelectedBrgy(data.barangay);
    } else {
      setSelectedBrgy(data.barangayName.replace(/\s*-\s*.*$/, ''));
    }
  };

  const selectedData = selectedBrgy
    ? barangayData.find(b => b.barangayName === selectedBrgy)
    : null;
  const brgyCases = selectedData ? selectedData.totalCases : 0;

  // Collect used disease colors for the legend
  const usedDiseaseColors = [];
  if (barangayData.length > 0) {
    const diseaseMap = {};
    barangayData.forEach(b => {
      Object.keys(b.diseases).forEach(d => {
        diseaseMap[d] = (diseaseMap[d] || 0) + b.diseases[d];
      });
    });
    const sorted = Object.entries(diseaseMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
    sorted.forEach(([disease]) => {
      usedDiseaseColors.push({ disease, color: getDiseaseColor(disease) });
    });
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', fontSize: '24px', fontWeight: '700' }}>
        Disease Map
      </h2>
      <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: '14px' }}>
        Hover over a barangay for a quick summary. Click for full disease breakdown. Zoom in (≥17) to see purok-level pulse markers.
      </p>

      {/* Selected barangay banner */}
      {selectedBrgy && (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px',
          padding: '14px 18px', marginBottom: '16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <strong style={{ fontSize: '16px' }}>{selectedBrgy}</strong>
            <span style={{ marginLeft: '12px', fontSize: '14px', color: 'var(--text-muted)' }}>
              {brgyCases} case{brgyCases !== 1 ? 's' : ''}
            </span>
          </div>
          <button onClick={() => setSelectedBrgy(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>
            ✕
          </button>
        </div>
      )}

      {/* Search bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <input
          type="text"
          placeholder="Search your barangay..."
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); handleSearch(e.target.value); }}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
          style={{ flex: 1, padding: '12px 16px', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: 'var(--bg-surface)', color: 'var(--text-main)' }}
        />
        <button onClick={handleSearch} style={{ padding: '12px 24px', background: '#10B981', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap' }}>
          Search
        </button>
      </div>

      {/* Search match chips */}
      {searchMatches.length > 1 && (
        <div style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {searchMatches.map(b => (
            <button key={b} onClick={() => zoomToBrgy(b)} style={{ padding: '6px 14px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '20px', fontSize: '13px', color: 'var(--text-main)', cursor: 'pointer' }}>
              {b}
            </button>
          ))}
        </div>
      )}
      {searchMatches.length === 0 && searchQuery.trim() && (
        <div style={{ marginBottom: '12px', fontSize: '13px', color: '#ef4444' }}>No barangay found matching "{searchQuery}".</div>
      )}

      {/* Map area */}
      <div style={{
        height: '550px', borderRadius: '12px', overflow: 'hidden',
        border: '1px solid var(--border-color)', position: 'relative',
      }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
      >
        <MapContainer
          center={CABUYAO_CENTER} zoom={14} minZoom={12} maxZoom={19} scrollWheelZoom={true}
          maxBounds={CABUYAO_BOUNDS}
          maxBoundsViscosity={0.6}
          style={{ width: '100%', height: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <BoundsSetter />
          <ZoomToBarangay barangay={selectedBrgy} cases={allCases} />
          <ZoomListener onZoom={setMapZoom} autoDetectedBrgy={autoDetectedBrgy} setAutoDetectedBrgy={setAutoDetectedBrgy} />
          {!showAutoPurok ? (
            <GeoJSON
              ref={geoJsonLayerRef}
              data={cabuyaoBoundaries}
              style={(feature) => getGeoJsonStyle(feature, barangayData)}
              onEachFeature={(feature, layer) => {
                const barangayName = getDbNameFromGeoJson(feature.properties.ADM4_EN);
                const rawName = feature.properties.ADM4_EN;
                const match = barangayDataRef.current.find(b => b.barangayName === barangayName);
                const topDisease = match ? getTop5(match.diseases)[0] : null;
                const risk = match ? getRisk(match.totalCases) : getRisk(0);
                layer.bindTooltip(`
                  <div class="brgy-label">
                    <div class="brgy-name">${rawName}</div>
                    <div class="brgy-disease">
                      ${match ? `${match.totalCases} case${match.totalCases !== 1 ? 's' : ''}` : '0 cases'}
                      ${topDisease ? ` | ${topDisease[0]} (${topDisease[1]})` : ''}
                    </div>
                    <div class="brgy-risk" style="color:${risk.color}">● ${risk.label}</div>
                  </div>
                `, { permanent: true, direction: 'center', className: 'brgy-tooltip-label' });
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
                    if (liveData) {
                      setSelectedBrgy(liveData.barangayName);
                      setPopup(liveData);
                    } else {
                      setSelectedBrgy(barangayName);
                      setPopup({ barangayName, totalCases: 0, diseases: {}, coords: null });
                    }
                  },
                });
              }}
            />
          ) : (
            <PulseMarkers
              barangayData={purokData.length > 0 ? purokData : barangayData}
              onHover={setTooltip}
              onLeave={() => setTooltip(null)}
              onClick={handlePulseClick}
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

        {/* MOUSE-FOLLOWING DISEASE CAUSE TOOLTIP */}
        {tooltip && (() => {
          const top = getTop5(tooltip.diseases)[0];
          if (!top) return null;
          const [diseaseName, count] = top;
          return (
            <div style={{
              position: 'absolute',
              left: mousePos.x + 18,
              top: mousePos.y + 18,
              zIndex: 1001,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '10px 14px',
              maxWidth: '260px',
              boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
              pointerEvents: 'none',
            }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
                {diseaseName} <span style={{ color: '#10b981', fontWeight: '700' }}>({count})</span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                {getDiseaseCause(diseaseName)}
              </div>
            </div>
          );
        })()}

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
                      background: isTop ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${isTop ? 'rgba(96,165,250,0.3)' : 'var(--border-color)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flex: 1, minWidth: 0 }}>
                        {isTop && (
                          <span style={{ fontSize: '9px', background: '#1E3A8A', color: 'white', padding: '2px 6px', borderRadius: '10px', fontWeight: '700', flexShrink: 0 }}>
                            TOP {i + 1}
                          </span>
                        )}
                        <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: isTop ? '600' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {disease}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginLeft: '10px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#10b981' }}>{count}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Risk Levels</div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <LegendItem color="#DC2626" label="High Risk (20+)" />
            <LegendItem color="#f59e0b" label="Medium (10-20)" />
            <LegendItem color="#10b981" label="Low (<10)" />
            <LegendItem color="#374151" label="No cases" />
          </div>
        </div>
        {usedDiseaseColors.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Top Diseases</div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {usedDiseaseColors.map(({ disease, color }) => (
                <div key={disease} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                  {disease}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
