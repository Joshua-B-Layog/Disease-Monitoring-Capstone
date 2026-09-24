import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { API_URL } from './config';
import { notify } from './components/Toast';
import { cacheCases, getCachedCases } from './offlineSync';
import { GeoJSON } from 'react-leaflet';
import cabuyaoBoundaries from './data/cabuyao_barangays.geojson.json';
import cabuyaoGeoJSON from './data/cabuyao_barangays.geojson';
import { getPointInBarangay, pointInFeature } from './data/coordinates';
import DatePicker from './components/DatePicker';
import { useI18n } from './i18n';

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
  [14.16, 120.98],
  [14.29, 121.18],
];

// ALL 18 barangays - hardcoded so dropdown is always complete
const ALL_BARANGAYS = [
  'Baclaran', 'Banay-Banay', 'Banlic',
  'Barangay Dos (Poblacion)', 'Barangay Tres (Poblacion)', 'Barangay Uno (Poblacion)',
  'Bigaa', 'Butong', 'Casile', 'Diezmo', 'Gulod',
  'Mamatid', 'Marinig', 'Niugan', 'Pittland', 'Pulo', 'Sala', 'San Isidro',
];

// Coordinates for each barangay - fuzzy matched so minor spelling diffs are OK
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

// Safe normalize - never crashes on non-string input
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

// Barangay label anchor point - same ring walker as getPolygonCentroid,
// returns [lat, lng] so permanent labels pin to a stable spot per barangay.
function getLabelPoint(geometry) {
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

// Manual screen-space (x, y) offsets so the three interlocked Poblacion
// polygons (nearly identical centroids) don't stack their labels on top of
// each other. A general collision pass could be added later.
const LABEL_OFFSETS = {
  'Barangay Uno (Poblacion)': [0, -46],
  'Barangay Dos (Poblacion)': [0, 0],
  'Barangay Tres (Poblacion)': [0, 46],
};

// Single shared label HTML builder - used by both the initial bindTooltip
// and the setTooltipContent refresh so the two can never drift apart.
// Displays the DB name (e.g. "Barangay Uno (Poblacion)") via dbName.
const getTop5 = (diseases) =>
  Object.entries(diseases || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);

function buildLabelHtml({ dbName, match, risk, t }) {
  const topDisease = match ? getTop5(match.diseases)[0] : null;
  return `
    <div class="brgy-label">
      <div class="brgy-name">${dbName}</div>
      <div class="brgy-disease">
        ${match ? `${match.totalCases} case${match.totalCases !== 1 ? 's' : ''}` : (t ? t('0 cases') : '0 cases')}
        ${topDisease ? ` | ${topDisease[0]} (${topDisease[1]})` : ''}
      </div>
      ${risk ? `<div class="brgy-risk" style="color:${risk.color}">● ${t ? t(risk.label) : risk.label}</div>` : ''}
    </div>
  `;
}

// Compute bounding box from GeoJSON polygon for a barangay
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

// Compute combined bounding box for multiple barangays (e.g. CHO unit)
const getCombinedBounds = (barangayNames) => {
  if (!barangayNames || !barangayNames.length) return null;
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  let found = false;
  barangayNames.forEach(name => {
    const bounds = getBarangayBounds(name);
    if (bounds) {
      found = true;
      if (bounds[0][0] < minLat) minLat = bounds[0][0];
      if (bounds[0][1] < minLng) minLng = bounds[0][1];
      if (bounds[1][0] > maxLat) maxLat = bounds[1][0];
      if (bounds[1][1] > maxLng) maxLng = bounds[1][1];
    }
  });
  if (!found) return null;
  return [[minLat, minLng], [maxLat, maxLng]];
};

// CHO unit coverage mapping
const CHO_UNIT_BARANGAYS = {
  'CHO Unit I (Sala)': [
    'Barangay Uno (Poblacion)', 'Barangay Dos (Poblacion)', 'Barangay Tres (Poblacion)',
    'Sala', 'Bigaa', 'Butong', 'Marinig', 'Gulod', 'Niugan', 'Baclaran',
  ],
  'CHO Unit II (Pulo)': [
    'Pulo', 'Banay-Banay', 'Banlic', 'Mamatid', 'San Isidro', 'Diezmo', 'Pittland', 'Casile',
  ],
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

function findBarangayAtCoords(lat, lng, geoJson) {
  if (!geoJson || !geoJson.features) return null;
  for (const feature of geoJson.features) {
    if (feature.geometry && pointInFeature(lng, lat, feature.geometry)) {
      return getDbNameFromGeoJson(feature.properties.ADM4_EN);
    }
  }
  return null;
}

const findFeatureForBarangay = (barangayName) => {
  if (!barangayName) return null;
  const n = norm(barangayName);
  return cabuyaoBoundaries.features.find(f => {
    const mapped = GEOJSON_TO_DB_NAME[f.properties.ADM4_EN] || f.properties.ADM4_EN;
    return norm(mapped) === n;
  }) || null;
};

// Display snap: keep a case's stored coordinates when they sit inside the
// case's own barangay polygon (the same shapes the choropleth renders);
// otherwise return a deterministic in-polygon point so markers never float
// outside their barangay geography.
const snapToOwnBarangay = (c) => {
  const lat = parseFloat(c.latitude);
  const lng = parseFloat(c.longitude);
  const canon = findCanonicalName(c.barangay_name) || c.barangay_name;
  const own = findFeatureForBarangay(canon);
  if (!own) return { lat: isNaN(lat) ? 0 : lat, lng: isNaN(lng) ? 0 : lng };
  if (!isNaN(lat) && !isNaN(lng) && pointInFeature(lng, lat, own.geometry)) return { lat, lng };
  const unit = extractLocationUnit(c.address);
  const seedKey = `${canon}|${unit || 'C'}`;
  const pin = getPointInBarangay(own, seedKey);
  const fallback = getPolygonCentroid(own.geometry);
  return {
    lat: pin ? pin[0] : (fallback ? fallback[0] : (isNaN(lat) ? 0 : lat)),
    lng: pin ? pin[1] : (fallback ? fallback[1] : (isNaN(lng) ? 0 : lng)),
  };
};

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

  // Primary source: derive centroid from the actual GeoJSON polygon (same shape data as the choropleth)
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

  // Fallback: hardcoded table, only used if no GeoJSON match is found
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

// Risk thresholds: <10 = Low (green), 10-19 = Medium (amber), >=20 = High (red)
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

const getGeoJsonStyle = (feature, barangayData, activeBarangay = null, focused = false, mapLayer = 'HD', bordersOnly = false) => {
  const dbName = getDbNameFromGeoJson(feature.properties.ADM4_EN);
  const match = barangayData.find(b => b.barangayName === dbName);
  const count = match ? match.totalCases : 0;
  const isActive = activeBarangay && norm(activeBarangay) === norm(dbName);
  const mutedLine = mapLayer === 'SD' ? '#334155' : 'rgba(255,255,255,0.75)';
  const fill = (visibleCount) => (visibleCount > 0 ? getGradientColor(visibleCount) : '#374151');
  const fillOpacity = (visibleCount) => (visibleCount > 0 ? 0.5 : 0.12);
  if (bordersOnly) {
    return {
      fillColor: '#000000',
      fillOpacity: 0,
      color: isActive ? '#fbbf24' : (mapLayer === 'SD' ? '#334155' : '#ffffff'),
      weight: isActive ? 3.5 : 1.5,
      dashArray: isActive ? '6 4' : undefined,
    };
  }
  if (isActive) {
    return {
      fillColor: focused ? '#000000' : fill(count),
      fillOpacity: focused ? 0 : fillOpacity(count),
      color: '#fbbf24',
      weight: 3.5,
      dashArray: '6 4',
    };
  }
  if (focused) {
    return {
      fillColor: '#000000',
      fillOpacity: 0,
      color: mutedLine,
      weight: 1,
    };
  }
  return {
    fillColor: fill(count),
    fillOpacity: fillOpacity(count),
    color: mapLayer === 'SD' ? '#334155' : '#ffffff',
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
    coords: (() => {
      const feature = cabuyaoBoundaries.features.find(f => {
        const mapped = GEOJSON_TO_DB_NAME[f.properties.ADM4_EN] || f.properties.ADM4_EN;
        return norm(mapped) === norm(barangayName);
      });
      const fallback = () => getPointInBarangay(feature, `${barangayName}|${g.purok}`) || centroid;
      if (g.validCoordCount > 0) {
        const mLat = g.latSum / g.validCoordCount;
        const mLng = g.lngSum / g.validCoordCount;
        return (feature && pointInFeature(mLng, mLat, feature.geometry)) ? [mLat, mLng] : fallback();
      }
      return fallback();
    })(),
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
    0%   { transform: scale(1);   opacity: 0.95; }
    60%  { transform: scale(3.2); opacity: 0;    }
    100% { transform: scale(1);   opacity: 0;    }
  }`;
  document.head.appendChild(s);
}

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
      font-family: 'Tw Cen MT Condensed', 'Segoe UI', system-ui, sans-serif !important;
      pointer-events: none !important;
    }
    .brgy-tooltip-label .brgy-name {
      font-weight: 700;
      font-size: 12px;
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
    .brgy-label {
      white-space: nowrap;
    }
    .brgy-labels-hidden .brgy-tooltip-label {
      display: none !important;
    }
  `;
  document.head.appendChild(ls);
}

function CreateTopPane() {
  const map = useMap();
  useEffect(() => {
    const pane = map.createPane('topPane');
    pane.style.zIndex = 800;
  }, [map]);
  return null;
}

function CaseDotMarkers({ cases, zoom, t = (s) => s, translateStatus = (s) => s }) {
  const map = useMap();
  const markersRef = useRef([]);

  useEffect(() => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (zoom < 18) return;

    const isFullView = zoom === 19;
    const casesWithCoords = cases.filter(c => c.latitude && c.longitude && !isNaN(parseFloat(c.latitude)) && !isNaN(parseFloat(c.longitude)));

    casesWithCoords.forEach(c => {
      const snapped = snapToOwnBarangay(c);
      const lat = snapped.lat;
      const lng = snapped.lng;
      const color = getDiseaseColor(c.disease_name);
      const severityColor = c.severity === 'Critical' ? '#7f1d1d' : c.severity === 'Severe' ? '#DC2626' : c.severity === 'Moderate' ? '#D97706' : '#3b82f6';

      const marker = L.circleMarker([lat, lng], {
        radius: isFullView ? 12 : 7,
        fillColor: color,
        color: isFullView ? '#fff' : 'rgba(255,255,255,0.75)',
        weight: isFullView ? 3 : 2.5,
        opacity: isFullView ? 1 : 0.85,
        fillOpacity: isFullView ? 0.85 : 0.65,
        interactive: isFullView,
        pane: 'topPane',
      }).addTo(map);

      if (isFullView) {
        marker.bindTooltip(`
          <div style="font-size:12px;line-height:1.4;min-width:140px;">
            <div style="font-weight:700;margin-bottom:2px;">${c.patient_name || t('Unknown')}</div>
            <div style="color:#666;">${c.disease_name || t('Unknown Disease')}</div>
            <div style="color:#666;">${t('Age: ')}${c.age || '--'} · ${c.gender || ''}</div>
            <div style="display:flex;align-items:center;gap:4px;margin-top:2px;">
              <span style="width:7px;height:7px;border-radius:50%;background:${severityColor};display:inline-block;"></span>
              ${c.severity || t('N/A')} · ${translateStatus(c.status) || ''}
            </div>
          </div>
        `, { direction: 'top', offset: [0, -8] });

        marker.on('click', () => {
          marker.openTooltip();
        });
      }

      markersRef.current.push(marker);
    });

    return () => { markersRef.current.forEach(m => m.remove()); };
  }, [cases, zoom, map]);

  return null;
}

const escapeHtmlBasic = (s) =>
  String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Shared SVG pin maker: white counter on a colored teardrop, optional small
// label tag underneath (used by per-unit pins, area pins and barangay pins).
const getPinSize = (count) => Math.max(40, Math.min(76, 28 + count * 1.8));

const createPinIcon = ({ count, color, label = null }) => {
  const size = getPinSize(count);
  const w = size;
  const h = Math.round(size * 44 / 34);
  const hasLabel = !!(label && String(label) !== 'Unspecified');
  const labelRaw = hasLabel ? String(label) : '';
  const labelText = labelRaw.length > 22 ? labelRaw.slice(0, 21) + '…' : labelRaw;
  const labelH = hasLabel ? 20 : 0;
  const totalH = h + labelH;

  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:${w}px;height:${totalH}px;cursor:pointer;">
        <svg width="${w}" height="${h}" viewBox="0 0 34 44" style="position:absolute;top:0;left:0;display:block;filter:drop-shadow(0 3px 4px rgba(0,0,0,0.5));">
          <path d="M17 0C7.6 0 0 7.6 0 17c0 12 17 27 17 27s17-15 17-27C34 7.6 26.4 0 17 0z" fill="${color}"/>
          <circle cx="17" cy="17" r="11" fill="#ffffff"/>
          <text x="17" y="22" text-anchor="middle" font-size="14" font-weight="800" fill="${color}" font-family="Tw Cen MT Condensed,system-ui,sans-serif">${count}</text>
        </svg>
        ${hasLabel ? `<div style="position:absolute;left:50%;top:${h + 1}px;transform:translateX(-50%);background:rgba(15,23,42,0.85);border:1px solid rgba(255,255,255,0.18);color:#fff;font-size:9.5px;font-weight:600;padding:2px 7px;border-radius:8px;white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis;line-height:1.2;text-shadow:0 1px 2px rgba(0,0,0,0.3);">${labelText}</div>` : ''}
      </div>`,
    iconSize: [w, totalH],
    iconAnchor: [w / 2, h],
  });
};

function PulseMarkers({ barangayData, onHover, onLeave, onClick }) {
  const map = useMap();
  const markersRef = useRef([]);

  useEffect(() => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    barangayData.forEach(b => {
      if (!b.purok || b.purok === 'Unspecified') return;
      const dcount = b.diseases || {};
      const top = Object.entries(dcount).sort((a, b2) => b2[1] - a[1])[0];
      const color = top ? getDiseaseColor(top[0]) : '#374151';
      const icon = createPinIcon({ count: b.totalCases, color, label: b.purok });

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

// Named "area" units: Phase N / Mabitac Phase N / Southville X. At the area tier
// these are the pins that stay visible, and every loose unit (Purok/Blk/Lot/
// Unspecified) folds into its nearest named area.
const NAMED_AREA_RE = /^(Mabitac\s+)?Phase\s+\d+$|^Southville\s+\S+$/;

// T2 (zoom 17): one pin per named area (Phase/Mabitac/Southville),
// each collecting the blk/lot/purok units nearest to it. Barangays without any
// named area fall back to a single pin at the barangay's centre with the total.
function AreaPins({ groups, barangay, onHover, onLeave, onClick }) {
  const map = useMap();
  const markersRef = useRef([]);

  useEffect(() => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (!groups || groups.length === 0) return;

    const named = groups.filter(g => NAMED_AREA_RE.test(g.purok || ''));
    const loose = groups.filter(g => !NAMED_AREA_RE.test(g.purok || ''));

    const areas = named.map(g => ({
      purok: g.purok,
      barangayName: barangay,
      coords: g.coords,
      totalCases: g.totalCases,
      diseases: { ...(g.diseases || {}) },
    }));

    loose.forEach(g => {
      let best = null;
      let bestD = Infinity;
      areas.forEach(a => {
        const d = (a.coords[0] - g.coords[0]) ** 2 + (a.coords[1] - g.coords[1]) ** 2;
        if (d < bestD) { bestD = d; best = a; }
      });
      if (best) {
        best.totalCases += g.totalCases;
        Object.entries(g.diseases || {}).forEach(([d, n]) => { best.diseases[d] = (best.diseases[d] || 0) + n; });
      }
    });

    let items = areas;
    if (items.length === 0) {
      const total = groups.reduce((s, g) => s + g.totalCases, 0);
      const diseases = {};
      groups.forEach(g => Object.entries(g.diseases || {}).forEach(([d, n]) => { diseases[d] = (diseases[d] || 0) + n; }));
      const c = findCoords(barangay);
      items = [{ purok: barangay, barangayName: barangay, coords: c || [0, 0], totalCases: total, diseases }];
    }

    items.forEach(b => {
      const dcount = b.diseases || {};
      const top = Object.entries(dcount).sort((a, b2) => b2[1] - a[1])[0];
      const color = top ? getDiseaseColor(top[0]) : '#374151';
      const icon = createPinIcon({ count: b.totalCases, color, label: b.purok });
      const m = L.marker(b.coords, { icon, zIndexOffset: 1000 }).addTo(map);
      m.on('mouseover', () => onHover(b));
      m.on('mouseout',  () => onLeave());
      m.on('click',     () => onClick(b));
      markersRef.current.push(m);
    });

    return () => { markersRef.current.forEach(m => m.remove()); };
  }, [groups, barangay, map]);

  return null;
}

// T1 (zoom <= 16): exactly one pin per barangay, parked at the barangay's
// centre, showing that barangay's full case total.
function BarangayPins({ barangayData, onHover, onLeave, onClick }) {
  const map = useMap();
  const markersRef = useRef([]);

  useEffect(() => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    barangayData.forEach(b => {
      const dcount = b.diseases || {};
      const top = Object.entries(dcount).sort((a, b2) => b2[1] - a[1])[0];
      const color = top ? getDiseaseColor(top[0]) : '#374151';
      const icon = createPinIcon({ count: b.totalCases, color, label: b.barangayName });
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

function ZoomListener({ onZoom, filterBarangay, autoDetectedBrgy, setAutoDetectedBrgy, loginRole }) {
  useMapEvents({
    zoomend: (e) => {
      const zoom = e.target.getZoom();
      onZoom(zoom);
      if (loginRole === 'BHW') return;
      if (zoom >= PUROK_ZOOM_THRESHOLD && filterBarangay === 'All Barangays') {
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

function ZoomToBarangay({ barangay, loginRole, loginBarangay, sessionContext, cases }) {
  const map = useMap();
  const prevRef = useRef(null);
  const casesRef = useRef([]);
  casesRef.current = cases;
  useEffect(() => {
    const target = (loginRole === 'BHW' && loginBarangay) ? loginBarangay : barangay;

    // CHO unit scope - zoom to the combined area of covered barangays
    if (loginRole === 'CHO' && sessionContext && (!target || target === 'All Barangays')) {
      const key = 'cho:' + sessionContext;
      if (key === prevRef.current) return;
      prevRef.current = key;
      const unitBarangays = CHO_UNIT_BARANGAYS[sessionContext];
      if (unitBarangays && unitBarangays.length > 0) {
        const combined = getCombinedBounds(unitBarangays);
        if (combined) {
          map.fitBounds(combined, { padding: [40, 40], animate: true, duration: 0.8 });
        }
      }
      return;
    }

    if (!target || target === 'All Barangays' || target === prevRef.current) return;
    prevRef.current = target;

    // Try marker bounds first (tightest zoom to case dots)
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

    // Fallback: polygon bounds
    const bounds = getBarangayBounds(target);
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40], animate: true, duration: 0.8 });
    } else {
      const coords = findCoords(target);
      if (!coords) return;
      map.setView(coords, 15, { animate: true, duration: 0.8 });
    }
  }, [barangay, loginRole, loginBarangay, sessionContext, map]);
  return null;
}

// Lock the view to the logged-in user's area of responsibility (CHO unit / BHW barangay)
function ScopeEnforcer({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    map.setMaxBounds(bounds);
    const applyMinZoom = () => {
      if (!bounds) return;
      const fitZoom = map.getBoundsZoom(bounds, false, [40, 40]);
      if (!Number.isFinite(fitZoom)) return;
      const mobile = window.matchMedia('(max-width: 820px)').matches;
      const cap = mobile ? 13 : 16;
      map.setMinZoom(Math.min(cap, Math.max(12, Math.round(fitZoom))));
    };
    applyMinZoom();
    map.on('resize', applyMinZoom);
    return () => {
      map.off('resize', applyMinZoom);
    };
  }, [map, bounds]);
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
    const fillColor = match ? getGradientColor(count) : '#444';
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

export default function MapView({ setActiveTab, setCaseFilter, loginRole, loginBarangay, sessionContext, compactMode, dateFormat = 'MM/DD/YY' }) {
  const { t, translateStatus } = useI18n();
  const [allCases, setAllCases] = useState([]);
  const [barangayData, setBarangayData] = useState([]);
  const [purokData, setPurokData] = useState([]);
  const [mapZoom, setMapZoom] = useState(14);
  const [autoDetectedBrgy, setAutoDetectedBrgy] = useState(null);
  const [hoveredBarangay, setHoveredBarangay] = useState(null);
  const [hotspotData, setHotspotData]  = useState([]);
  const [filterBarangay, setFilterBarangay] = useState('All Barangays');
  const [filterStatus, setFilterStatus]  = useState('All Status');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('All Severities');
  const [filterPurok, setFilterPurok] = useState('All Puroks');
  const [filterDisease, setFilterDisease] = useState('All Diseases');
  const [diseaseOpen, setDiseaseOpen] = useState(false);
  const diseaseRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [popup, setPopup] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [offlineMode, setOfflineMode] = useState(false);

  const [barangayOpen, setBarangayOpen] = useState(false);
  const barangayRef = useRef(null);
  const [purokOpen, setPurokOpen] = useState(false);
  const purokRef = useRef(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef(null);
  const [severityOpen, setSeverityOpen] = useState(false);
  const severityRef = useRef(null);
  const [mapLayer, setMapLayer] = useState('HD'); // 'SD' = street map (OSM), 'HD' = satellite (Esri)
  const [filtersOpen, setFiltersOpen] = useState(false); // mobile: filter sidebar as hamburger drawer
  const geoJsonLayerRef = useRef(null);
  const bordersOnly = loginRole === 'BHW';
  const barangayDataRef = useRef(barangayData);
  useEffect(() => { barangayDataRef.current = barangayData; }, [barangayData]);

  // Area of responsibility for the logged-in user - drives maxBounds + minZoom
  const roleBounds = useMemo(() => {
    if (loginRole === 'CHO' && sessionContext && CHO_UNIT_BARANGAYS[sessionContext]) {
      return getCombinedBounds(CHO_UNIT_BARANGAYS[sessionContext]) || CABUYAO_BOUNDS;
    }
    if (loginRole === 'BHW' && loginBarangay) {
      const b = getBarangayBounds(loginBarangay);
      if (b) {
        const pad = 0.004;
        return [[b[0][0] - pad, b[0][1] - pad], [b[1][0] + pad, b[1][1] + pad]];
      }
      const c = findCoords(loginBarangay);
      if (c) return [[c[0] - 0.015, c[1] - 0.015], [c[0] + 0.015, c[1] + 0.015]];
    }
    return CABUYAO_BOUNDS;
  }, [loginRole, sessionContext, loginBarangay]);


  const scopedGeoJson = useMemo(() => {
    let allowedBarangays = null;
    if (loginRole === 'BHW' && loginBarangay) {
      allowedBarangays = [loginBarangay];
    } else if (loginRole === 'CHO' && sessionContext && CHO_UNIT_BARANGAYS[sessionContext]) {
      allowedBarangays = CHO_UNIT_BARANGAYS[sessionContext];
    }
    if (!allowedBarangays) return cabuyaoBoundaries;
    const canonSet = new Set(allowedBarangays.map(b => norm(b)));
    return {
      ...cabuyaoBoundaries,
      features: cabuyaoBoundaries.features.filter(f => {
        const mapped = getDbNameFromGeoJson(f.properties.ADM4_EN);
        return canonSet.has(norm(mapped));
      }),
    };
  }, [loginRole, loginBarangay, sessionContext]);

  const scopedCasesForPurok = (() => {
    if (loginRole === 'BHW' && loginBarangay) {
      return allCases.filter(c => c.barangay_name === loginBarangay);
    }
    if (loginRole === 'CHO' && sessionContext && CHO_UNIT_BARANGAYS[sessionContext]) {
      const unitBarangays = CHO_UNIT_BARANGAYS[sessionContext];
      let scoped = allCases.filter(c => unitBarangays.includes(c.barangay_name));
      if (filterBarangay !== 'All Barangays') {
        scoped = scoped.filter(c => c.barangay_name === filterBarangay);
      }
      return scoped;
    }
    return allCases;
  })();
  const dynamicPurokOptions = ['All Puroks', ...Array.from(
    new Set(
      scopedCasesForPurok
        .map(c => extractLocationUnit(c.address))
        .filter(Boolean)
    )
  ).sort()];

  const scopedBarangayOptions = (loginRole === 'CHO' && sessionContext && CHO_UNIT_BARANGAYS[sessionContext])
    ? CHO_UNIT_BARANGAYS[sessionContext]
    : ALL_BARANGAYS;

  useEffect(() => {
    const handler = (e) => {
      if (barangayRef.current && !barangayRef.current.contains(e.target)) {
        setBarangayOpen(false);
      }
      if (purokRef.current && !purokRef.current.contains(e.target)) setPurokOpen(false);
      if (statusRef.current && !statusRef.current.contains(e.target)) setStatusOpen(false);
      if (severityRef.current && !severityRef.current.contains(e.target)) setSeverityOpen(false);
      if (diseaseRef.current && !diseaseRef.current.contains(e.target)) setDiseaseOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchMapData = () => {
    axios.get(API_URL + '/api/disease_cases')
      .then(res => { setAllCases(res.data); setLastUpdated(Date.now()); setOfflineMode(false); cacheCases(res.data).catch(() => {}); })
      .catch(async () => {
        const cached = await getCachedCases();
        if (cached.length > 0) { setAllCases(cached); setOfflineMode(true); }
      });
  };

  useEffect(() => {
    fetchMapData();
    const interval = setInterval(() => {
      if (navigator.onLine) fetchMapData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!geoJsonLayerRef.current) return;
    geoJsonLayerRef.current.eachLayer((layer) => {
      layer.setStyle(getGeoJsonStyle(layer.feature, barangayData, null, false, mapLayer, bordersOnly));
    });
  }, [barangayData, mapLayer]);

  // Update permanent labels when data refreshes
  useEffect(() => {
    if (!geoJsonLayerRef.current) return;
    geoJsonLayerRef.current.eachLayer((layer) => {
      const dbName = getDbNameFromGeoJson(layer.feature.properties.ADM4_EN);
      const match = barangayData.find(b => b.barangayName === dbName);
      const risk = match ? getRisk(match.totalCases) : getRisk(0);
      const html = buildLabelHtml({ dbName, match, risk, t });
      layer.setTooltipContent(html);
      if (layer.getTooltip()) {
        const anchor = getLabelPoint(layer.feature.geometry);
        if (anchor) layer.getTooltip().setLatLng(anchor);
      }
    });
  }, [barangayData]);

  // Hide permanent labels when zoomed out too far (labels would clutter).
  // Restored immediately on window blur so returning via Tab re-shows them.
  useEffect(() => {
    const container = document.querySelector('.cdms-map-area .leaflet-container');
    if (!container) return;
    if (mapZoom < 13) container.classList.add('brgy-labels-hidden');
    else container.classList.remove('brgy-labels-hidden');
  }, [mapZoom]);

  useEffect(() => {
    const restoreLabels = () => {
      const container = document.querySelector('.cdms-map-area .leaflet-container');
      if (container) container.classList.remove('brgy-labels-hidden');
    };
    window.addEventListener('blur', restoreLabels);
    return () => window.removeEventListener('blur', restoreLabels);
  }, []);

  useEffect(() => {
    if (!allCases.length) return;

    const filtered = allCases.filter(c => {
      if (filterBarangay !== 'All Barangays'  && c.barangay_name !== filterBarangay)   return false;
      if (filterStatus   !== 'All Status'     && c.status        !== filterStatus)      return false;
      if (filterSeverity !== 'All Severities' && c.severity      !== filterSeverity)    return false;
      if (filterDateFrom || filterDateTo) {
        const d = (c.date_reported || '').slice(0, 10);
        if (d && ((filterDateFrom && d < filterDateFrom) || (filterDateTo && d > filterDateTo))) return false;
      }
      if (filterPurok !== 'All Puroks' && !(c.address || '').toLowerCase().includes(filterPurok.toLowerCase())) return false;
      if (filterDisease !== 'All Diseases' && (c.disease_name || '') !== filterDisease) return false;
      return true;
    });

    const choUnitBarangays = sessionContext ? CHO_UNIT_BARANGAYS[sessionContext] || [] : [];

    const scopedFiltered = (loginRole === 'BHW' && loginBarangay)
      ? filtered.filter(c => c.barangay_name === loginBarangay)
      : (loginRole === 'CHO' && choUnitBarangays.length > 0)
        ? filtered.filter(c => choUnitBarangays.includes(c.barangay_name))
        : filtered;

    // Active Hotspots - scope-only, ignores barangay/purok filter
    const scopeBase = allCases.filter(c => {
      if (filterStatus   !== 'All Status'     && c.status    !== filterStatus)   return false;
      if (filterSeverity !== 'All Severities' && c.severity  !== filterSeverity) return false;
      if (filterDateFrom || filterDateTo) {
        const d = (c.date_reported || '').slice(0, 10);
        if (d && ((filterDateFrom && d < filterDateFrom) || (filterDateTo && d > filterDateTo))) return false;
      }
      if (filterDisease !== 'All Diseases' && (c.disease_name || '') !== filterDisease) return false;
      return true;
    });
    const scopedHotspots = (loginRole === 'BHW' && loginBarangay)
      ? scopeBase.filter(c => c.barangay_name === loginBarangay)
      : (loginRole === 'CHO' && choUnitBarangays.length > 0)
        ? scopeBase.filter(c => choUnitBarangays.includes(c.barangay_name))
        : scopeBase;
    const hGroups = {};
    scopedHotspots.forEach(c => {
      const bn = findCanonicalName(c.barangay_name);
      if (!bn) return;
      if (!hGroups[bn]) hGroups[bn] = { barangayName: bn, totalCases: 0 };
      hGroups[bn].totalCases++;
    });
    setHotspotData(Object.values(hGroups));

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

    setBarangayData(Object.values(groups));

    // Purok-level grouping - used when scoped to a single barangay
    const purokTarget = (loginRole === 'BHW' && loginBarangay) ? loginBarangay
      : (filterBarangay !== 'All Barangays') ? filterBarangay
      : autoDetectedBrgy || null;
    if (purokTarget) {
      const canon = findCanonicalName(purokTarget);
      const purokCases = scopedFiltered.filter(c => findCanonicalName(c.barangay_name) === canon);
      setPurokData(getPurokGroups(canon, purokCases));
    } else {
      setPurokData([]);
    }
  }, [allCases, filterBarangay, filterStatus, filterDateFrom, filterDateTo, filterSeverity, filterPurok, filterDisease, autoDetectedBrgy]);

  const goToDisease = (barangayName, diseaseName, purok) => {
    if (setCaseFilter) setCaseFilter({ disease: diseaseName.trim(), barangay: barangayName, purok: purok || '' });
    if (setActiveTab)  setActiveTab('Manage Cases');
    setPopup(null);
  };

  const activeData  = (filterBarangay !== 'All Barangays' || loginRole === 'BHW') && purokData.length > 0 ? purokData : barangayData;
  const highCount   = activeData.filter(b => b.totalCases >= 20).length;
  const mediumCount = activeData.filter(b => b.totalCases >= 10 && b.totalCases < 20).length;
  const lowCount    = activeData.filter(b => b.totalCases < 10).length;

  // Ranked disease hotspots across the current filter scope
  const hotspotRanked = useMemo(() => {
    const pool = {};
    activeData.forEach(g => Object.entries(g.diseases || {}).forEach(([d, n]) => { pool[d] = (pool[d] || 0) + n; }));
    return Object.entries(pool).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [activeData]);
  const hotspotMax = hotspotRanked.length ? hotspotRanked[0][1] : 0;

  // Cases that survive all sidebar filters + the user's area of responsibility -
  // used by the cluster pins, case dots, and the disease legend.
  const mapCases = useMemo(() => {
    const choUnitBarangays = sessionContext ? CHO_UNIT_BARANGAYS[sessionContext] || [] : [];
    return allCases.filter(c => {
      if (filterBarangay !== 'All Barangays'  && c.barangay_name !== filterBarangay)  return false;
      if (filterStatus   !== 'All Status'     && c.status        !== filterStatus)     return false;
      if (filterSeverity !== 'All Severities' && c.severity      !== filterSeverity)   return false;
      if (filterDateFrom || filterDateTo) {
        const d = (c.date_reported || '').slice(0, 10);
        if (d && ((filterDateFrom && d < filterDateFrom) || (filterDateTo && d > filterDateTo))) return false;
      }
      if (filterPurok !== 'All Puroks' && !(c.address || '').toLowerCase().includes(filterPurok.toLowerCase())) return false;
      if (filterDisease !== 'All Diseases' && (c.disease_name || '') !== filterDisease) return false;
      if (loginRole === 'BHW' && loginBarangay)      return c.barangay_name === loginBarangay;
      if (loginRole === 'CHO' && choUnitBarangays.length > 0) return choUnitBarangays.includes(c.barangay_name);
      return true;
    });
  }, [allCases, filterBarangay, filterStatus, filterSeverity, filterDateFrom, filterDateTo, filterPurok, filterDisease, loginRole, loginBarangay, sessionContext]);

  const diseaseOptions = useMemo(() => {
    const s = new Set();
    allCases.forEach(c => { if (c.disease_name) s.add(c.disease_name); });
    return ['All Diseases', ...Array.from(s).sort()];
  }, [allCases]);

  const topDiseaseColors = useMemo(() => {
    const pool = {};
    mapCases.forEach(c => { const d = c.disease_name || 'Unknown'; pool[d] = (pool[d] || 0) + 1; });
    return Object.entries(pool).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([d, n]) => [d, n, getDiseaseColor(d)]);
  }, [mapCases]);

  const SEL = {
    width: '100%', padding: '9px 12px',
    background: 'var(--input-bg)', border: '1px solid var(--border-color)',
    borderRadius: '7px', color: 'var(--text-main)',
    fontSize: '15px', boxSizing: 'border-box',
  };

  const showAutoPurok = loginRole !== 'BHW' && filterBarangay === 'All Barangays' && mapZoom >= PUROK_ZOOM_THRESHOLD && autoDetectedBrgy;

  // The single barangay currently in focus for the unit/area pin tiers: the
  // selected filter, a BHW's own barangay, or the auto-detected one.
  const pinnedBarangay = (filterBarangay !== 'All Barangays')
    ? filterBarangay
    : (loginRole === 'BHW' && loginBarangay) ? loginBarangay
      : autoDetectedBrgy || null;

  // The barangay whose geographic borders get highlighted. While the mouse is
  // over a polygon that one wins (borders switch Niugan→Sala as you sweep the
  // map); otherwise the selected filter wins, then the auto-detected barangay.
  const activeBarangayHighlight = hoveredBarangay
    || ((filterBarangay !== 'All Barangays')
        ? filterBarangay
        : (showAutoPurok && autoDetectedBrgy) ? autoDetectedBrgy : null);

  // True when a single barangay is pinned (selected in the filter or auto-detected
  // in purok view): all fills are dropped so pins sit cleanly on the map.
  const barangayFocused = (filterBarangay !== 'All Barangays') || (showAutoPurok && autoDetectedBrgy);

  // Re-style every border when the active highlight changes so only the lit
  // barangay shows the thick dashed line and the rest are plain outlines.
  useEffect(() => {
    if (!geoJsonLayerRef.current) return;
    geoJsonLayerRef.current.eachLayer((layer) => {
      layer.setStyle(getGeoJsonStyle(layer.feature, barangayData, activeBarangayHighlight, barangayFocused, mapLayer, bordersOnly));
    });
  }, [barangayData, hoveredBarangay, filterBarangay, autoDetectedBrgy, showAutoPurok, mapLayer, activeBarangayHighlight, barangayFocused]);

  // Label focus: when a barangay is selected (or auto-detected in purok view),
  // hide every permanent label except that barangay's. All-Barangays keeps all.
  useEffect(() => {
    if (!geoJsonLayerRef.current) return;
    const fixed = (filterBarangay !== 'All Barangays')
      ? filterBarangay
      : (showAutoPurok && autoDetectedBrgy) ? autoDetectedBrgy : null;
    geoJsonLayerRef.current.eachLayer((layer) => {
      const tooltip = layer.getTooltip && layer.getTooltip();
      if (!tooltip) return;
      const dbName = getDbNameFromGeoJson(layer.feature.properties.ADM4_EN);
      const visible = !fixed || norm(fixed) === norm(dbName);
      tooltip.setOpacity(visible ? 1 : 0);
    });
  }, [filterBarangay, autoDetectedBrgy, showAutoPurok]);

  const sectionHeaderStyle = {
    margin: '0 0 8px 0', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.08em', paddingBottom: '4px',
    borderBottom: '1px solid var(--border-color)',
  };

  return (
    <div className="cdms-map-wrap" style={{ display: 'flex', height: compactMode ? 'calc(100vh - 56px)' : 'calc(100vh - 70px)' }}>

      {/* ── SIDEBAR - fixed 280px on desktop; slide-in hamburger drawer on mobile ── */}
      <div className={filtersOpen ? 'cdms-map-sidebar cdms-map-sidebar-open' : 'cdms-map-sidebar'} style={{
        width: '280px', minWidth: '280px', flexShrink: 0,
        background: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)',
        padding: '20px 16px', display: 'flex', flexDirection: 'column',
        gap: '16px', overflowY: 'auto',
      }}>
        <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {t('Filters')}
        </p>

        {/* ─── FILTER LAYER: AREA ─── */}
        <p style={sectionHeaderStyle}>{t('Filter by Area')}</p>

        {/* Barangay - all 18 hardcoded (hidden for BHW) */}
        {loginRole !== 'BHW' && (
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: '600' }}>{t('Barangay')}</label>
            <div style={{ position: 'relative' }} ref={barangayRef}>
              <button
                onClick={() => setBarangayOpen(!barangayOpen)}
                style={{
                  width: '100%', padding: '9px 12px',
                  background: 'var(--input-bg)', border: `1px solid ${barangayOpen ? '#60a5fa' : 'var(--border-color)'}`,
                  borderRadius: '7px', color: 'var(--text-main)',
                  fontSize: '15px', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(filterBarangay)}</span>
                <span style={{
                  fontSize: '13px', opacity: 0.6, flexShrink: 0, marginLeft: '8px',
                  transition: 'transform 0.2s', display: 'inline-block',
                  transform: barangayOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}>▼</span>
              </button>
              {barangayOpen && (
                <div className="cdms-dropdown-panel" style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  maxHeight: '250px', overflowY: 'auto', marginTop: '4px',
                  background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                  borderRadius: '8px', boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
                  padding: '4px', textAlign: 'left',
                }}>
                  <div
                    onClick={() => { setFilterBarangay('All Barangays'); setAutoDetectedBrgy(null); setBarangayOpen(false); }}
                    style={{
                      padding: '8px 14px', cursor: 'pointer', fontSize: '15px',
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
                    <span style={{ flex: 1 }}>{t('All Barangays')}</span>
                    {filterBarangay === 'All Barangays' && <span style={{ color: '#60a5fa', fontSize: '13px' }}>✓</span>}
                  </div>
                  {scopedBarangayOptions.map(b => (
                    <div
                      key={b}
                      onClick={() => { setFilterBarangay(b); setAutoDetectedBrgy(null); setBarangayOpen(false); }}
                      style={{
                        padding: '8px 14px', cursor: 'pointer', fontSize: '15px',
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
                      {filterBarangay === b && <span style={{ color: '#60a5fa', fontSize: '13px' }}>✓</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* BHW - static barangay display */}
        {loginRole === 'BHW' && loginBarangay && (
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: '600' }}>{t('Barangay')}</label>
            <div style={{ padding: '9px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '7px', color: 'var(--text-main)', fontSize: '15px' }}>
              {loginBarangay}
            </div>
          </div>
        )}

        {/* Purok / Blk / Phase */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: '600' }}>{t('Purok / Blk / Phase')}</label>
          <div style={{ position: 'relative' }} ref={purokRef}>
            <button
              onClick={() => setPurokOpen(!purokOpen)}
              style={{
                width: '100%', padding: '9px 12px',
                background: 'var(--input-bg)', border: `1px solid ${purokOpen ? '#60a5fa' : 'var(--border-color)'}`,
                borderRadius: '7px', color: 'var(--text-main)',
                fontSize: '15px', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxSizing: 'border-box',
              }}
            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(filterPurok)}</span>
              <span style={{
                fontSize: '13px', opacity: 0.6, flexShrink: 0, marginLeft: '8px',
                transition: 'transform 0.2s', display: 'inline-block',
                transform: purokOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}>▼</span>
            </button>
            {purokOpen && (
              <div className="cdms-dropdown-panel" style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                maxHeight: '200px', overflowY: 'auto', marginTop: '4px',
                background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                borderRadius: '8px', boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
                padding: '4px', textAlign: 'left',
              }}>
                {dynamicPurokOptions.map(p => (
                  <div
                    key={p}
                    onClick={() => { setFilterPurok(p); setPurokOpen(false); }}
                    style={{
                      padding: '8px 14px', cursor: 'pointer', fontSize: '15px',
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
                    <span style={{ flex: 1 }}>{t(p)}</span>
                    {filterPurok === p && <span style={{ color: '#60a5fa', fontSize: '13px' }}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── FILTER LAYER: DISEASE ─── */}
        <p style={sectionHeaderStyle}>{t('Filter by Disease')}</p>

        {/* Disease */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: '600' }}>{t('Disease')}</label>
          <div style={{ position: 'relative' }} ref={diseaseRef}>
            <button type="button" onClick={() => setDiseaseOpen(!diseaseOpen)}
              style={{ ...SEL, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(filterDisease)}</span>
              <span style={{ fontSize: '13px', opacity: 0.6, transition: 'transform 0.2s', transform: diseaseOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            </button>
            {diseaseOpen && (
              <div className="cdms-dropdown-panel" style={{ position: 'absolute', top: '105%', left: 0, width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 100, overflow: 'hidden', maxHeight: '260px', overflowY: 'auto' }}>
                {diseaseOptions.map(d => (
                  <button key={d} type="button"
                    onClick={() => { setFilterDisease(d); setDiseaseOpen(false); }}
                    style={{ display: 'block', width: '100%', padding: '10px 14px', background: filterDisease === d ? 'var(--input-bg)' : 'transparent', border: 'none', textAlign: 'left', fontSize: '15px', color: 'var(--text-main)', cursor: 'pointer', fontWeight: filterDisease === d ? '600' : '400' }}
                    onMouseEnter={e => { if (filterDisease !== d) e.currentTarget.style.background = 'var(--input-bg)'; }}
                    onMouseLeave={e => { if (filterDisease !== d) e.currentTarget.style.background = 'transparent'; }}>
                    {t(d)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── FILTER LAYER: STATUS ─── */}
        <p style={sectionHeaderStyle}>{t('Filter by Status')}</p>

        {/* Status */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: '600' }}>{t('Status')}</label>
          <div style={{ position: 'relative' }} ref={statusRef}>
            <button type="button" onClick={() => setStatusOpen(!statusOpen)}
              style={{ ...SEL, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
              <span>{t(filterStatus)}</span>
              <span style={{ fontSize: '13px', opacity: 0.6, transition: 'transform 0.2s', transform: statusOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            </button>
            {statusOpen && (
              <div className="cdms-dropdown-panel" style={{ position: 'absolute', top: '105%', left: 0, width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 100, overflow: 'hidden' }}>
                {['All Status', 'Active', 'Pending', 'Under Treatment', 'Recovered', 'Deceased'].map(s => (
                  <button key={s} type="button"
                    onClick={() => { setFilterStatus(s); setStatusOpen(false); }}
                    style={{ display: 'block', width: '100%', padding: '10px 14px', background: filterStatus === s ? 'var(--input-bg)' : 'transparent', border: 'none', textAlign: 'left', fontSize: '15px', color: 'var(--text-main)', cursor: 'pointer', fontWeight: filterStatus === s ? '600' : '400' }}
                    onMouseEnter={e => { if (filterStatus !== s) e.target.style.background = 'var(--input-bg)'; }}
                    onMouseLeave={e => { if (filterStatus !== s) e.target.style.background = 'transparent'; }}>
                    {t(s)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── FILTER LAYER: DATE ─── */}
        <p style={sectionHeaderStyle}>{t('Filter by Date')}</p>

        {/* Date range - From / To */}
        <div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: '600' }}>{t('From')}</label>
              <DatePicker value={filterDateFrom} dateFormat={dateFormat} placeholder={t('Start date')} clearable={true}
                onChange={v => setFilterDateFrom(v)}
                style={{ width: '100%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: '600' }}>{t('To')}</label>
              <DatePicker value={filterDateTo} dateFormat={dateFormat} placeholder={t('End date')} clearable={true}
                onChange={v => setFilterDateTo(v)}
                style={{ width: '100%' }} />
            </div>
          </div>
        </div>

        {/* Severity - includes Asymptomatic */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: '600' }}>{t('Severity')}</label>
          <div style={{ position: 'relative' }} ref={severityRef}>
            <button type="button" onClick={() => setSeverityOpen(!severityOpen)}
              style={{ ...SEL, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
              <span>{t(filterSeverity)}</span>
              <span style={{ fontSize: '13px', opacity: 0.6, transition: 'transform 0.2s', transform: severityOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            </button>
            {severityOpen && (
              <div className="cdms-dropdown-panel" style={{ position: 'absolute', top: '105%', left: 0, width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 100, overflow: 'hidden' }}>
                {['All Severities', 'Critical', 'Severe', 'Moderate', 'Mild', 'Asymptomatic'].map(s => (
                  <button key={s} type="button"
                    onClick={() => { setFilterSeverity(s); setSeverityOpen(false); }}
                    style={{ display: 'block', width: '100%', padding: '10px 14px', background: filterSeverity === s ? 'var(--input-bg)' : 'transparent', border: 'none', textAlign: 'left', fontSize: '15px', color: 'var(--text-main)', cursor: 'pointer', fontWeight: filterSeverity === s ? '600' : '400' }}
                    onMouseEnter={e => { if (filterSeverity !== s) e.target.style.background = 'var(--input-bg)'; }}
                    onMouseLeave={e => { if (filterSeverity !== s) e.target.style.background = 'transparent'; }}>
                    {t(s)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div data-tour="map-legend" style={{ paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Legend')}</p>
          {[
            { color: '#DC2626', label: 'High Risk (20+ cases)' },
            { color: '#f59e0b', label: 'Medium Risk (10-19 cases)' },
            { color: '#10b981', label: 'Low Risk (Below 10 cases)' },
            { color: '#374151', label: 'No cases' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '8px' }}>
              <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: l.color, flexShrink: 0, display: 'inline-block' }} />
              <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{t(l.label)}</span>
            </div>
          ))}
          <div style={{ paddingTop: '10px', borderTop: '1px dashed var(--border-color)', marginTop: '2px' }}>
            <p style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>{t('Pins & markers')}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '8px' }}>
              <svg width="14" height="18" viewBox="0 0 24 30" style={{ flexShrink: 0 }}>
                <path d="M12 0C5.4 0 0 5.4 0 12c0 8.5 12 18 12 18S24 20.5 24 12C24 5.4 18.6 0 12 0z" fill="var(--accent, #60a5fa)" />
                <circle cx="12" cy="12" r="7.5" fill="var(--bg-surface)" />
                <text x="12" y="15.8" textAnchor="middle" fontSize="9" fontWeight="800" fill="var(--accent, #60a5fa)" fontFamily="system-ui, sans-serif">12</text>
              </svg>
              <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{t('Barangay / unit pin - number shows total cases')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '8px' }}>
              <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: 'var(--accent, #60a5fa)', border: '2px solid var(--bg-surface)', flexShrink: 0, display: 'inline-block' }} />
              <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{t('Case dot (max zoom) - one dot per case, colored by disease')}</span>
            </div>
          </div>
          <div style={{ paddingTop: '10px', borderTop: '1px dashed var(--border-color)', marginTop: '2px' }}>
            <p style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>{t('Disease pin colors')}</p>
            {topDiseaseColors.length === 0 && (
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{t('No cases match the current filters.')}</p>
            )}
            {topDiseaseColors.map(([disease, count, color]) => (
              <div key={disease} style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '6px' }}>
                <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: '12.5px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '165px' }}>{disease}</span>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Active Hotspots counter - based on filtered data */}
        <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('Active Hotspots')}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { label: 'High',   count: highCount,   color: '#DC2626' },
              { label: 'Medium', count: mediumCount, color: '#f59e0b' },
              { label: 'Low',    count: lowCount,    color: '#10b981' },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ flex: 1, background: 'var(--input-bg)', borderRadius: '8px', padding: '10px 4px', textAlign: 'center', border: `1px solid ${color}33` }}>
                <div style={{ fontSize: '22px', fontWeight: '800', color }}>{count}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{t(label)}</div>
              </div>
            ))}
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            {t('Risk from the current filter scope. Thresholds: >20 red, 10-20 amber, <10 green.')}
          </p>
        </div>

        {/* Disease Hotspots - ranked top 5 by case count in current scope */}
        <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('Disease Hotspots')}</p>
          {hotspotRanked.length === 0 && (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>{t('No cases match the current filters.')}</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {hotspotRanked.map(([disease, count], i) => (
              <div key={disease}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>{i + 1}. {disease}</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: i === 0 ? '#DC2626' : 'var(--text-muted)' }}>{count}</span>
                </div>
                <div style={{ height: '7px', background: 'var(--input-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${hotspotMax > 0 ? Math.max(4, Math.round((count / hotspotMax) * 100)) : 0}%`, height: '100%', background: i === 0 ? '#DC2626' : i === 1 ? '#f59e0b' : 'var(--accent, #60a5fa)', borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            {t('Top ')}{hotspotRanked.length}{t(' diseases by case count across the current filter scope.')}
          </p>
        </div>

        <button
          onClick={() => { setAutoDetectedBrgy(null); setFilterBarangay('All Barangays'); setFilterStatus('All Status'); setFilterDateFrom(''); setFilterDateTo(''); setFilterSeverity('All Severities'); setFilterDisease('All Diseases'); setFilterPurok('All Puroks'); }}
          style={{ padding: '11px', background: '#DC2626', color: 'white', border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: '600', fontSize: '15px', marginTop: 'auto' }}>
          {t('Reset Filters')}
        </button>

        <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', paddingTop: '6px' }}>
          {lastUpdated ? <>{t('Updated ')}{Math.round((now - lastUpdated) / 1000)}{t('s ago')}</> : t('Refreshing...')}
        </div>
        {offlineMode && (
          <div style={{ fontSize: '13px', color: '#F59E0B', textAlign: 'center', padding: '6px 8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px' }}>
            {t('Offline - showing cached data')}
          </div>
        )}
      </div>

      {/* ── MAP AREA ── */}
      <div className="cdms-map-area" style={{ flex: 1, position: 'relative', minWidth: 0 }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
      >
        {filtersOpen && (
          <div className="cdms-map-backdrop" onClick={() => setFiltersOpen(false)} />
        )}
        <button
          className="cdms-map-filter-btn"
          onClick={() => setFiltersOpen(!filtersOpen)}
          style={{
            position: 'absolute', top: '12px', left: '12px', zIndex: 1000,
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '9px 14px', borderRadius: '8px', cursor: 'pointer',
            background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            fontSize: '14px', fontWeight: '600', color: 'var(--text-main)',
          }}
        >
          ⚙ {t('Filters')}
        </button>
        <MapContainer
          center={(loginRole === 'BHW' && loginBarangay && findCoords(loginBarangay)) 
            ? findCoords(loginBarangay) 
            : CABUYAO_CENTER} zoom={14} minZoom={12} maxZoom={19} scrollWheelZoom={true}
          maxBounds={roleBounds}
          maxBoundsViscosity={1.0}
          style={{ width: '100%', height: '100%' }}>
          <ScopeEnforcer key="scope-enforcer" bounds={roleBounds} />
          {mapLayer === 'SD' ? (
            <TileLayer
              key="tile-sd"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          ) : (
            <TileLayer
              key="tile-hd"
              attribution='Tiles &copy; Esri - Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          )}
          <CreateTopPane key="create-top-pane" />
          <ZoomToBarangay key="zoom-barangay" barangay={filterBarangay} loginRole={loginRole} loginBarangay={loginBarangay} sessionContext={sessionContext} cases={allCases} />
          <ZoomListener key="zoom-listener" onZoom={setMapZoom} filterBarangay={filterBarangay} autoDetectedBrgy={autoDetectedBrgy} setAutoDetectedBrgy={setAutoDetectedBrgy} loginRole={loginRole} />
          {mapZoom === 19 && <CaseDotMarkers key="case-dot-markers" cases={mapCases} zoom={mapZoom} t={t} translateStatus={translateStatus} />}
          {mapZoom === 18 && purokData.length > 0 && (
            <PulseMarkers key="unit-pins" barangayData={purokData} onHover={setTooltip} onLeave={() => setTooltip(null)} onClick={setPopup} />
          )}
          {mapZoom === 17 && purokData.length > 0 && pinnedBarangay && (
            <AreaPins key="area-pins" groups={purokData} barangay={pinnedBarangay} onHover={setTooltip} onLeave={() => setTooltip(null)} onClick={setPopup} />
          )}
          {mapZoom < 17 && <BarangayPins key="barangay-pins" barangayData={barangayData} onHover={setTooltip} onLeave={() => setTooltip(null)} onClick={setPopup} />}
          <GeoJSON
              key="brgy-geojson"
              ref={geoJsonLayerRef}
              data={scopedGeoJson}
              style={(feature) => getGeoJsonStyle(feature, barangayData, activeBarangayHighlight, barangayFocused, mapLayer, bordersOnly)}
              onEachFeature={(feature, layer) => {
                const barangayName = getDbNameFromGeoJson(feature.properties.ADM4_EN);
                const match = barangayDataRef.current.find(b => b.barangayName === barangayName);
                const risk = match ? getRisk(match.totalCases) : getRisk(0);
                const html = buildLabelHtml({ dbName: barangayName, match, risk, t });
                layer.bindTooltip(html, {
                  permanent: true,
                  direction: 'center',
                  className: 'brgy-tooltip-label',
                  offset: LABEL_OFFSETS[barangayName] || [0, 0],
                  interactive: false,
                });
                const anchor = getLabelPoint(feature.geometry);
                if (anchor) layer.getTooltip().setLatLng(anchor);
                layer.on({
                  mouseover: function (e) {
                    setHoveredBarangay(barangayName);
                    e.target.bringToFront();
                    const liveData = barangayDataRef.current.find(b => b.barangayName === barangayName);
                    if (liveData) {
                      setTooltip(liveData);
                    } else {
                      setTooltip({ barangayName, totalCases: 0, diseases: {} });
                    }
                  },
                  mouseout: function () {
                    setHoveredBarangay(null);
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
        </MapContainer>

        {/* SD / HD BASE LAYER TOGGLE */}
        <div style={{
          position: 'absolute', bottom: '16px', left: '16px', zIndex: 1000,
          display: 'flex', gap: '4px', padding: '4px',
          background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
          borderRadius: '10px', boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
        }}>
          <button onClick={() => setMapLayer('SD')}
            style={{
              padding: '6px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer',
              fontSize: '13px', fontWeight: '700',
              background: mapLayer === 'SD' ? '#1e3a8a' : 'transparent',
              color: mapLayer === 'SD' ? '#fff' : 'var(--text-muted)',
            }}>
            {t('SD Map')}
          </button>
          <button onClick={() => setMapLayer('HD')}
            style={{
              padding: '6px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer',
              fontSize: '13px', fontWeight: '700',
              background: mapLayer === 'HD' ? '#1e3a8a' : 'transparent',
              color: mapLayer === 'HD' ? '#fff' : 'var(--text-muted)',
            }}>
            {t('HD Map')}
          </button>
        </div>

        {/* EXPORT MAP AS IMAGE */}
        <div style={{
          position: 'absolute', bottom: '16px', right: '16px', zIndex: 1000,
        }}>
          <button
            onClick={() => {
              const mapContainer = document.querySelector('.leaflet-container');
              if (!mapContainer) return;
              import('html2canvas').then(({ default: html2canvas }) => {
                const rect = mapContainer.getBoundingClientRect();
                html2canvas(mapContainer, {
                  useCORS: true,
                  allowTaint: true,
                  scale: 2,
                  backgroundColor: null,
                  scrollX: -window.scrollX,
                  scrollY: -window.scrollY,
                  windowWidth: Math.ceil(rect.right - rect.left),
                  windowHeight: Math.ceil(rect.bottom - rect.top),
                  logging: false,
                }).then(canvas => {
                  const link = document.createElement('a');
                  link.download = 'CDMS_Map_Export.png';
                  link.href = canvas.toDataURL('image/png');
                  link.click();
                });
              }).catch(() => {
                notify(t('Export requires html2canvas. Please use the Print option instead.'), 'info');
              });
            }}
            style={{
              padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
              background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
              fontSize: '13px', fontWeight: '700', color: 'var(--text-main)',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {t('Export Image')}
          </button>
        </div>

        {/* ZOOM LEVEL INDICATOR */}
        {mapZoom === 18 && (
          <div style={{
            position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
            zIndex: 1000, padding: '6px 12px', borderRadius: '8px',
            background: 'rgba(18,153,104,0.15)', border: '1px solid rgba(18,153,104,0.3)',
            fontSize: '12px', fontWeight: '600', color: '#129968',
          }}>
            {t('● Dots showing case placements - zoom to max for full details')}
          </div>
        )}
        {mapZoom === 19 && (
          <div style={{
            position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
            zIndex: 1000, padding: '6px 12px', borderRadius: '8px',
            background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
            fontSize: '12px', fontWeight: '600', color: '#3b82f6',
          }}>
            {t('● Click dots for individual case details')}
          </div>
        )}

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: getRisk(tooltip.totalCases).color, display: 'inline-block' }} />
              {t(getRisk(tooltip.totalCases).label)} · {tooltip.totalCases} case{tooltip.totalCases !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: '15px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '7px' }}>
              {t('Top Diseases')}
            </div>
            {getTop5(tooltip.diseases).map(([disease, count], i) => (
              <div key={disease} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <span style={{ fontSize: '15px', color: 'var(--text-main)' }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: '5px' }}>{i + 1}.</span>{disease}
                </span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#10b981', marginLeft: '12px' }}>{count}</span>
              </div>
            ))}
            <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('Click pin for full details')}</div>
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
              <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
                {diseaseName} <span style={{ color: '#10b981', fontWeight: '700' }}>({count})</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                {t(getDiseaseCause(diseaseName))}
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
                    <span style={{ fontSize: '15px', color: 'var(--text-muted)' }}>
                      {t(getRisk(popup.totalCases).label)} · {popup.totalCases} total case{popup.totalCases !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <button onClick={() => setPopup(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '24px', lineHeight: 1, padding: 0 }}>
                  ×
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', marginBottom: '14px' }} />

              <p style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('All Diseases in this Barangay')}
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
                      border: `1px solid ${isTop ? 'rgba(18,19,88,0.25)' : 'var(--border-color)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flex: 1, minWidth: 0 }}>
                        {isTop && (
                          <span style={{ fontSize: '13px', background: '#121358', color: 'white', padding: '2px 6px', borderRadius: '10px', fontWeight: '700', flexShrink: 0 }}>
                            {t('TOP ')}{i + 1}
                          </span>
                        )}
                        <span style={{ fontSize: '15px', color: 'var(--text-main)', fontWeight: isTop ? '600' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {disease}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginLeft: '10px' }}>
                        <span style={{ fontSize: '15px', fontWeight: '700', color: '#10b981' }}>{count}</span>
                        <button onClick={() => goToDisease(popup.barangay || popup.barangayName, disease, popup.purok)}
                          style={{ padding: '5px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                          {t('Go To →')}
                        </button>
                      </div>
                    </div>
                  );
                })}

              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                {t('Click "Go To →" to open Manage Cases filtered to that disease and barangay')}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}