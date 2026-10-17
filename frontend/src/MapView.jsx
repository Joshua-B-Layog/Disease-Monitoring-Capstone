import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, CircleMarker } from 'react-leaflet';
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
import InterventionModal from './components/InterventionModal';
// Same custom-dropdown classes the manage-modal fields use (.mc-custom-dropdown-*).
import './ManageCases.css';
import { formatDate as formatDateStr } from './formatDate';
import { useI18n } from './i18n';
import { precacheTiles } from './mapTileCache';
import EpiPanel from './epiStats';
// Phase 1 zone (purok-level) hotspots: the 3x2 grid cell a case already snaps to
// is treated as a "zone" so flooding can be related to case clustering.
import { buildZoneHotspots, zonesToFeatureCollection, ZONE_KINDS, FLOOD_EVENT_TYPES, RAINY_SEASON_DISEASES, zonesForBarangay, zoneIndexForUnit, resolveZoneIdx, ZONE_PRESETS, DEFAULT_ZONE_SENSITIVITY, purokRowsToAreas, purokIdxForUnit } from './zoneHotspots';
import { ACTION_TYPES, ACTION_TYPE_ICONS, ACTION_STATUSES, DISASTER_EVENT_TYPES, DISASTER_SEVERITIES, SEVERITY_COLORS, hazardIcon, hazardDiseases, hazardColor, hazardSvgMarkup, hazardSvgIcon, isDisasterActive, getDisasterWatch, WEATHER_ATTRIBUTION } from './disasterRisk';
import { RISK_FACTOR_GROUPS, parseRiskFactors, riskFactorLabel } from './riskFactors';
import { seasonForMonth, seasonalDiseases } from './seasonalDiseases';

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

// Cabuyao has no "summer / winter" in the temperate sense - PAGASA splits the
// Philippine year into the rainy season (Tag-ulan), the cool dry season
// (Tag-lamig) and the hot dry / summer season (Tag-init). `months` are 0-based JS
// month indexes, so the map highlights whichever season today falls in.
const PH_SEASONS = [
  { key: 'rainy', icon: '🌧️', label: 'Rainy Season', monthsLabel: 'June to November', months: [5, 6, 7, 8, 9, 10], color: '#0891b2' },
  { key: 'summer', icon: '☀️', label: 'Summer (Hot Dry Season)', monthsLabel: 'March to May', months: [2, 3, 4], color: '#f59e0b' },
  { key: 'cooldry', icon: '🌬️', label: 'Cool Dry Season', monthsLabel: 'December to February', months: [11, 0, 1], color: '#64748b' },
];

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

// Outer ring of a barangay polygon (largest ring for a MultiPolygon, same walk as
// getPolygonCentroid), cached. Needed because `findCoords` returns the centroid -
// which IS inside the barangay - but any point offset from it is not guaranteed to
// stay inside: Niugan's centroid sits off-centre, so a 0.0045 deg fan-out landed
// outside its border. Offsets are pulled back in with pointInRing below.
const BARANGAY_RING_CACHE = new Map();
function barangayRing(name) {
  const n = norm(name);
  if (BARANGAY_RING_CACHE.has(n)) return BARANGAY_RING_CACHE.get(n);
  const feature = cabuyaoBoundaries.features.find(f => {
    const props = f.properties || {};
    const mappedName = GEOJSON_TO_DB_NAME[props.ADM4_EN] || props.ADM4_EN || '';
    return norm(mappedName) === n;
  });
  let ring = null;
  const g = feature && feature.geometry;
  if (g) {
    if (g.type === 'Polygon') ring = g.coordinates[0];
    else if (g.type === 'MultiPolygon') {
      let largest = g.coordinates[0][0];
      g.coordinates.forEach(poly => { if (poly[0].length > largest.length) largest = poly[0]; });
      ring = largest;
    }
  }
  BARANGAY_RING_CACHE.set(n, ring);
  return ring;
}

// Ray-casting point-in-polygon. Ring points are GeoJSON [lng, lat]. Returns true
// when there is no polygon to test against, so a missing geometry never blocks a pin.
function pointInRing(ring, lat, lng) {
  if (!ring) return true;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

const findCanonicalName = (rawName) => {
  if (!rawName) return null;
  const n = norm(rawName);
  const match = ALL_BARANGAYS.find(b => norm(b) === n);
  return match || rawName;
};

// Risk thresholds: 60+ = Critical (crimson), 40-59 = Very High (dark red), 20-39 = High (red), 10-19 = Medium (amber), <10 = Low (green)
const getRisk = (count) => {
  if (count >= 60) return { color: '#7F1D1D', ring: 'rgba(127,29,29,0.3)', label: 'Critical Risk' };
  if (count >= 40) return { color: '#B91C1C', ring: 'rgba(185,28,28,0.3)', label: 'Very High Risk' };
  if (count >= 20) return { color: '#DC2626', ring: 'rgba(220,38,38,0.3)', label: 'High Risk' };
  if (count >= 10) return { color: '#f59e0b', ring: 'rgba(245,158,11,0.3)', label: 'Medium Risk' };
  return { color: '#10b981', ring: 'rgba(16,185,129,0.3)', label: 'Low Risk' };
};

// Smooth mid-band-peak fill gradient for polygon fills only (pins stay discrete):
// 0 green -> 10 half green/amber -> 15 amber -> 19 half amber/red -> 22 red ->
// 34 half red/dark-red -> 45 dark red -> 55 half dark-red/crimson -> 65+ crimson
const getRiskFill = (count) => {
  const stops = [
    [0, 16, 185, 129],
    [10, 130, 172, 70],
    [15, 245, 158, 11],
    [19, 233, 98, 25],
    [22, 220, 38, 38],
    [34, 203, 33, 33],
    [45, 185, 28, 28],
    [55, 156, 29, 29],
    [65, 127, 29, 29],
  ];
  const c = Math.max(0, Math.min(count || 0, stops[stops.length - 1][0]));
  for (let i = 1; i < stops.length; i++) {
    const [c1, r1, g1, b1] = stops[i - 1];
    const [c2, r2, g2, b2] = stops[i];
    if (c <= c2) {
      const t = (c - c1) / (c2 - c1);
      const r = Math.round(r1 + t * (r2 - r1));
      const g = Math.round(g1 + t * (g2 - g1));
      const b = Math.round(b1 + t * (b2 - b1));
      return `rgb(${r},${g},${b})`;
    }
  }
  return 'rgb(127,29,29)';
};

const getGeoJsonStyle = (feature, barangayData, activeBarangay = null, focused = false, mapLayer = 'HD', bordersOnly = false) => {
  const dbName = getDbNameFromGeoJson(feature.properties.ADM4_EN);
  const match = barangayData.find(b => b.barangayName === dbName);
  const count = match ? match.totalCases : 0;
  const isActive = activeBarangay && norm(activeBarangay) === norm(dbName);
  const mutedLine = mapLayer === 'SD' ? '#334155' : 'rgba(255,255,255,0.75)';
  const fill = (visibleCount) => (visibleCount > 0 ? getRiskFill(visibleCount) : '#374151');
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

// Zone detail is two-step by zoom, matching the existing tiers (17 = pins,
// 18 = puroks, 19 = case dots): below this the zone shading is shown so you can
// "zoom in to see the zone"; at/above it the fill steps back and each zone is
// broken down into the location units (purok/blk) inside it.
const ZONE_BREAKDOWN_ZOOM = 18;

// Shading for a Phase 1 zone polygon. Colour encodes the CLASS (exposure watch
// vs case hotspot vs weather-linked hotspot); the fill stays light and the border
// does the heavy lifting so the zone reads on top of the barangay choropleth
// instead of replacing it. At the breakdown zoom the fill is dropped so the
// per-unit chips underneath stay readable; the border keeps the zone extent.
const getZoneStyle = (feature, zoom = 0) => {
  const props = (feature && feature.properties) || {};
  const meta = ZONE_KINDS[props.kind] || ZONE_KINDS.case;
  const score = Number(props.score) || 0;
  const breakdown = zoom >= ZONE_BREAKDOWN_ZOOM;
  return {
    color: meta.color,
    weight: props.kind === 'weather' ? 3 : 2.5,
    dashArray: props.kind === 'exposure' ? '6 4' : props.kind === 'watch' ? '3 4' : undefined,
    fillColor: meta.color,
    fillOpacity: breakdown ? 0 : Math.min(0.35, 0.1 + score / 80),
  };
};

// Background grid drawn when "Show all cells" is on: every one of the 6 bbox
// cells of a scoped barangay, whether or not it crossed a threshold, so the
// zone proxy is visible instead of implied. Neutral + non-interactive; the
// flagged zones draw on top with their own colours.
const getGridStyle = () => ({ color: '#94a3b8', weight: 1, dashArray: '2 5', fillOpacity: 0 });

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
    /* CHO barangay-tier pins: the permanent name box already says the name, so the
       pin's own name tag is hidden live and only restored in exports. */
    .cdms-barangay-pin .pin-label-tag {
      display: none;
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

// Hands the Leaflet map instance up to MapView so the Export Image handler can
// use the real projection (latLngToContainerPoint) for the canvas redraw.
function MapBridge({ mapRef }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [mapRef, map]);
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

// Lift (px) that keeps a hazard badge fully clear of the pin beneath it.
// Pins anchor at their tip and grow upward as the case count rises, so a fixed
// offset clears a near-empty purok and still buries the number on a busy one.
// The whole badge has to clear - not just the disc - because the optional count
// pill is rendered below it and would clip the pin on its own. HAZARD_BADGE_GAP
// is the visible breathing room; keep it small or the dot reads as detached from
// its pin. Tuned down from 6 after the badges proved to sit too high.
const HAZARD_BADGE_GAP = 2;
const hazardBadgeLift = (count, size = 32, hasPill = false) => {
  const pinH = Math.round(getPinSize(Number(count) || 0) * 44 / 34);
  const discCentre = hasPill ? (size / 2) + 8 : size / 2;
  const badgeH = hasPill ? size + 12 : size;
  return pinH + badgeH + HAZARD_BADGE_GAP - discCentre;
};

// Human labels for the server epi_alerts.alert_type values shown on the popup
// warning banner and on any intervention that answers one.
const ALERT_KIND_LABELS = {
  count_threshold: 'Case count warning',
  surge: 'Rapid surge warning',
  rapid_outbreak: 'Rapid outbreak warning',
  mortality: 'Mortality warning',
  hazard_disease: 'Hazard-linked disease warning',
};

const createPinIcon = ({ count, color, label = null, className = '' }) => {
  const size = getPinSize(count);
  const w = size;
  const h = Math.round(size * 44 / 34);
  const hasLabel = !!(label && String(label) !== 'Unspecified');
  const labelRaw = hasLabel ? String(label) : '';
  const labelText = labelRaw.length > 22 ? labelRaw.slice(0, 21) + '…' : labelRaw;
  const labelH = hasLabel ? 20 : 0;
  const totalH = h + labelH;

  return L.divIcon({
    className,
    html: `
      <div style="position:relative;width:${w}px;height:${totalH}px;cursor:pointer;">
        <svg width="${w}" height="${h}" viewBox="0 0 34 44" style="position:absolute;top:0;left:0;display:block;filter:drop-shadow(0 3px 4px rgba(0,0,0,0.5));">
          <path d="M17 0C7.6 0 0 7.6 0 17c0 12 17 27 17 27s17-15 17-27C34 7.6 26.4 0 17 0z" fill="${color}"/>
          <circle cx="17" cy="17" r="11" fill="#ffffff"/>
          <text x="17" y="22" text-anchor="middle" font-size="14" font-weight="800" fill="${color}" font-family="Tw Cen MT Condensed,system-ui,sans-serif">${count}</text>
        </svg>
        ${hasLabel ? `<div class="pin-label-tag" style="position:absolute;left:50%;top:${h + 1}px;transform:translateX(-50%);background:rgba(15,23,42,0.85);border:1px solid rgba(255,255,255,0.18);color:#fff;font-size:9.5px;font-weight:600;padding:2px 7px;border-radius:8px;white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis;line-height:1.2;text-shadow:0 1px 2px rgba(0,0,0,0.3);">${labelText}</div>` : ''}
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

// Same folding as AreaPins: named areas (Phase/Mabitac/Southville) absorb every
// loose unit (Purok/Blk/Lot/Unspecified). Used so the hazard layer at the phase
// tier lines up exactly with the phase pins that are drawn.
function buildAreaTierItems(groups, barangay) {
  if (!groups || groups.length === 0 || !barangay) return [];
  const named = groups.filter(g => NAMED_AREA_RE.test(g.purok || ''));
  const loose = groups.filter(g => !NAMED_AREA_RE.test(g.purok || ''));
  const areas = named.map(g => ({
    purok: g.purok,
    barangay,
    barangayName: barangay,
    coords: g.coords,
    totalCases: g.totalCases,
    diseases: { ...(g.diseases || {}) },
  }));
  loose.forEach(g => {
    let best = null, bestD = Infinity;
    areas.forEach(a => {
      const d = (a.coords[0] - g.coords[0]) ** 2 + (a.coords[1] - g.coords[1]) ** 2;
      if (d < bestD) { bestD = d; best = a; }
    });
    if (best) {
      best.totalCases += g.totalCases;
      Object.entries(g.diseases || {}).forEach(([d, n]) => { best.diseases[d] = (best.diseases[d] || 0) + n; });
    }
  });
  if (areas.length > 0) return areas;
  const total = groups.reduce((s, g) => s + g.totalCases, 0);
  const c = findCoords(barangay);
  return [{ purok: barangay, barangay, barangayName: barangay, coords: c || [0, 0], totalCases: total, diseases: {} }];
}

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

// Screen-space radius (px) below which two pins are considered "colliding"
// and get spread apart. Scales implicitly with how tightly zoomed you are,
// since it's measured in *pixels*, not geographic distance.
const PIN_COLLISION_RADIUS = 64;

// Given barangayData (each with .coords = [lat,lng]), group any pins whose
// projected screen positions land within PIN_COLLISION_RADIUS of each other.
function clusterByScreenProximity(map, barangayData) {
  const points = barangayData.map(b => ({
    b,
    pt: map.latLngToContainerPoint(b.coords),
  }));
  const clusters = [];
  const used = new Array(points.length).fill(false);

  for (let i = 0; i < points.length; i++) {
    if (used[i]) continue;
    const group = [points[i]];
    used[i] = true;
    for (let j = i + 1; j < points.length; j++) {
      if (used[j]) continue;
      const dx = points[i].pt.x - points[j].pt.x;
      const dy = points[i].pt.y - points[j].pt.y;
      if (Math.sqrt(dx * dx + dy * dy) < PIN_COLLISION_RADIUS) {
        group.push(points[j]);
        used[j] = true;
      }
    }
    clusters.push(group);
  }
  return clusters;
}

// T1 (zoom <= 16): exactly one pin per barangay, parked at the barangay's
// centre, showing that barangay's full case total. Pins whose centroids
// collide on screen (e.g. the three tightly-packed Poblacion barangays) are
// radially spread apart so every label stays readable at any zoom level.
function BarangayPins({ barangayData, onHover, onLeave, onClick, loginRole }) {
  const map = useMap();
  const markersRef = useRef([]);

  const placeSinglePin = (b, coords) => {
    const dcount = b.diseases || {};
    const top = Object.entries(dcount).sort((a, b2) => b2[1] - a[1])[0];
    const color = top ? getDiseaseColor(top[0]) : '#374151';
    // For CHO the permanent barangay-name box shows the name at this tier, so the
    // pin's own name tag is hidden live (CSS: .cdms-barangay-pin .pin-label-tag).
    // BHW has no box (own barangay only) so keeps its name tag. Exports unhide the
    // tag on all pins so the image shows names under every pin.
    const pinClass = loginRole === 'BHW' ? '' : 'cdms-barangay-pin';
    const icon = createPinIcon({ count: b.totalCases, color, label: b.barangayName, className: pinClass });
    const m = L.marker(coords, { icon, zIndexOffset: 1000 }).addTo(map);
    m.on('mouseover', () => onHover(b));
    m.on('mouseout',  () => onLeave());
    m.on('click',     () => onClick(b));
    markersRef.current.push(m);
  };

  const placeMarkers = () => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (!barangayData || barangayData.length === 0) return;

    const clusters = clusterByScreenProximity(map, barangayData);

    clusters.forEach(group => {
      if (group.length === 1) {
        placeSinglePin(group[0].b, group[0].b.coords);
        return;
      }
      // Radially spread colliding pins around their shared screen centroid.
      const cx = group.reduce((s, g) => s + g.pt.x, 0) / group.length;
      const cy = group.reduce((s, g) => s + g.pt.y, 0) / group.length;
      // Spread radius grows a bit with group size so 3+ pins don't re-collide.
      const spreadRadius = PIN_COLLISION_RADIUS * 0.55 * Math.max(1, group.length / 2);
      group.forEach((g, idx) => {
        const angle = (2 * Math.PI * idx) / group.length - Math.PI / 2; // start pointing up
        const nx = cx + spreadRadius * Math.cos(angle);
        const ny = cy + spreadRadius * Math.sin(angle);
        const newLatLng = map.containerPointToLatLng([nx, ny]);
        placeSinglePin(g.b, [newLatLng.lat, newLatLng.lng]);
      });
    });
  };

  useEffect(() => {
    placeMarkers();
    // Recompute spread positions on zoom/move so collisions stay resolved
    // (pins that overlap when zoomed out may not once zoomed in, and vice versa).
    map.on('zoomend moveend', placeMarkers);
    return () => {
      map.off('zoomend moveend', placeMarkers);
      markersRef.current.forEach(m => m.remove());
    };
  }, [barangayData, map]);

  return null;
}

// Overlay badges for the Barangay Actions + Weather/Hazard layers.
// `items` = [{ id, coords, svg | emoji, count, color, onClick, title, size?, z?, dy? }]
// svg items render a PAGASA-style warning disc (guaranteed visible on any machine).
// `size` = disc pixel width (default 28); `z` = zIndexOffset (default 800, case pins use 1000 so pass >1000 to float on top); `dy` = latitude offset applied to coords.
function LayerBadgeMarkers({ items }) {
  const map = useMap();
  const markersRef = useRef([]);
  useEffect(() => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    (items || []).forEach(it => {
      let inner, w, rowGap;
      const size = it.size || 28;
      if (it.svg) {
        // SVG warning disc + optional folded count pill below
        inner = `<div style="width:${size}px;height:${size}px;text-align:center;line-height:1">${it.svg}</div>` +
          (it.count && it.count > 0
            ? `<div style="font-size:${size >= 34 ? '11px' : '9px'};font-weight:800;line-height:1;text-align:center;color:${it.color};margin-top:2px;background:var(--bg-surface);border:1px solid ${it.color};border-radius:7px;padding:1px 4px">${it.count}</div>`
            : '');
        w = size + 6; rowGap = '4px';
      } else if (it.emoji) {
        inner = `<div style="font-size:14px;line-height:1;text-align:center">${it.emoji}</div>` +
          (it.count ? `<div style="font-size:9px;font-weight:800;line-height:1;text-align:center;color:${it.color};margin-top:1px">${it.count}</div>` : '');
        w = 28; rowGap = '2px';
      } else {
        inner = `<div style="font-size:13px;font-weight:800;line-height:26px;text-align:center;color:${it.color}">${it.count}</div>`;
        w = 28; rowGap = '0px';
      }
      const h = it.svg ? (it.count && it.count > 0 ? size + 12 : size) : 28;
      const html = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:${rowGap};width:${w}px;height:${h}px;cursor:pointer;background:transparent;padding:2px 0 0 0">${inner}</div>`;
      // `above` (px) lifts a badge clear of the pin it shares coordinates with.
      // Pins anchor at their tip, so the round head already occupies the space
      // directly above the point - without this the disc hides the pin entirely.
      const discCentre = it.count && it.count > 0 ? (size / 2) + 8 : size / 2;
      const anchorY = it.svg ? discCentre + (it.above || 0) : (h / 2);
      const icon = L.divIcon({ className: '', html, iconSize: [w, h], iconAnchor: [w / 2, anchorY] });
      const coords = it.dy ? [it.coords[0] + it.dy, it.coords[1]] : it.coords;
      const m = L.marker(coords, { icon, zIndexOffset: it.z != null ? it.z : 800 }).addTo(map);
      // Keep the tooltip just above whatever was actually rendered (disc size and
      // any `above` lift included) so a big badge never has its label on top of it.
      m.bindTooltip(it.title || '', { direction: 'top', offset: [0, -(anchorY + 6)] });
      m.on('click', () => it.onClick && it.onClick());
      markersRef.current.push(m);
    });
    return () => markersRef.current.forEach(m => m.remove());
  }, [items, map]);
  return null;
}

// Step 2 of the zone view: at ZONE_BREAKDOWN_ZOOM each flagged zone is broken
// down into the location units (purok/blk) inside it, so the user can see WHICH
// purok in the zone carried the cases. Chip colour = the zone's class; the mean
// case coordinate of the unit is the anchor (falls back to the zone centroid).
function ZoneBreakdownMarkers({ items }) {
  const map = useMap();
  const markersRef = useRef([]);
  useEffect(() => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    (items || []).forEach(it => {
      const html = `<div style="transform:translate(-50%,-50%);display:inline-flex;align-items:center;gap:5px;`
        + `background:var(--bg-surface);border:1.5px solid ${it.color};border-left:5px solid ${it.color};`
        + `border-radius:8px;padding:2px 8px;font-size:11px;font-weight:700;color:var(--text-main);`
        + `white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:pointer">${it.label}</div>`;
      const icon = L.divIcon({ className: '', html, iconSize: [0, 0], iconAnchor: [0, 0] });
      const m = L.marker(it.coords, { icon, zIndexOffset: it.z != null ? it.z : 760 }).addTo(map);
      m.bindTooltip(it.title || '', { direction: 'top', offset: [0, -10] });
      m.on('click', () => it.onClick && it.onClick());
      markersRef.current.push(m);
    });
    return () => markersRef.current.forEach(m => m.remove());
  }, [items, map]);
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

// Read-only hazard-pin preview map: re-centre the tiny map whenever the typed
// coordinates (or the fallback barangay centre) change. Uses setView directly
// instead of declaring a `center` prop so react-leaflet never remounts the pane.
function HazardPreviewRecenter({ center }) {
  const map = useMap();
  const lat = center ? center[0] : null;
  const lng = center ? center[1] : null;
  useEffect(() => {
    if (lat == null || lng == null) return;
    map.setView([lat, lng], map.getZoom(), { animate: false });
  }, [lat, lng, map]);
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
    const fillColor = match ? getRiskFill(count) : '#444';
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

export default function MapView({ setActiveTab, setCaseFilter, loginRole, loginBarangay, sessionContext, compactMode, dateFormat = 'MM/DD/YY', initialFocus, onFocusConsumed }) {
  const { t, translateStatus, translateActionStatus } = useI18n();
  const currentYear = new Date().getFullYear();
  const [allCases, setAllCases] = useState([]);
  const [barangayData, setBarangayData] = useState([]);
  const [purokData, setPurokData] = useState([]);
  const [mapZoom, setMapZoom] = useState(14);
  const [autoDetectedBrgy, setAutoDetectedBrgy] = useState(null);
  const [hoveredBarangay, setHoveredBarangay] = useState(null);
  const [hotspotData, setHotspotData]  = useState([]);
  const [filterBarangay, setFilterBarangay] = useState('All Barangays');
  const [filterStatus, setFilterStatus]  = useState('All Status');
  const [filterCaseType, setFilterCaseType] = useState('All Case Types');
  // Date filter default: a rolling 2-month window ending today (e.g. 08/17 - 10/17),
  // so the map opens on recent activity instead of the whole calendar year.
  const [filterDateFrom, setFilterDateFrom] = useState(() => {
    const t = new Date();
    const s = new Date(t.getFullYear(), t.getMonth() - 2, t.getDate());
    const p = (n) => String(n).padStart(2, '0');
    return `${s.getFullYear()}-${p(s.getMonth() + 1)}-${p(s.getDate())}`;
  });
  const [filterDateTo, setFilterDateTo] = useState(() => {
    const t = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
  });
  const [filterYear, setFilterYear] = useState(() => String(new Date().getFullYear()));
  const [filterSeverity, setFilterSeverity] = useState('All Severities');
  const [filterPurok, setFilterPurok] = useState('All Puroks');
  const [filterDisease, setFilterDisease] = useState('All Diseases');
  const [filterRiskFactor, setFilterRiskFactor] = useState('All Factors');
  const [diseaseOpen, setDiseaseOpen] = useState(false);
  const diseaseRef = useRef(null);
  const [riskFactorOpen, setRiskFactorOpen] = useState(false);
  const riskFactorRef = useRef(null);
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
  const [caseTypeOpen, setCaseTypeOpen] = useState(false);
  const caseTypeRef = useRef(null);
  const [severityOpen, setSeverityOpen] = useState(false);
  const severityRef = useRef(null);
  const [yearOpen, setYearOpen] = useState(false);
  const yearRef = useRef(null);
  const [mapLayer, setMapLayer] = useState('HD'); // 'SD' = street map (OSM), 'HD' = satellite (Esri)
  const [filtersOpen, setFiltersOpen] = useState(false); // mobile: filter sidebar as hamburger drawer

  // ── F: Barangay Actions layer + H: Weather/Hazard layer (weather + manual pins) ──
  const [actions, setActions] = useState([]);
  const [disasterEvents, setDisasterEvents] = useState([]);
  const [weatherHazards, setWeatherHazards] = useState([]);
  const [pagasa, setPagasa] = useState(null);
  const [showActionsLayer, setShowActionsLayer] = useState(true);
  const [showDisasterLayer, setShowDisasterLayer] = useState(true);
  // Map mode: 'disaster' = hazards + actions + probable disease watch (replaces the old
  // Actions/Hazards layers); 'hotspot' = case density only.
  const [mapMode, setMapMode] = useState('disaster');
  const isDisasterMap = mapMode === 'disaster';
  const [weatherOffline, setWeatherOffline] = useState(false);
  const [manageActionsOpen, setManageActionsOpen] = useState(false);
  const [actionForm, setActionForm] = useState({ id: null, barangay_id: '', barangay_name: '', hazard_id: '', action_type: ACTION_TYPES[0], description: '', target_disease: '', date_started: '', date_ended: '', status: 'planned' });
  const [actionsSaving, setActionsSaving] = useState(false);
  // Disease-warning layer: server epi alerts (same rows the Dashboard warning
  // cards use) + the option to show only warning-linked interventions on the map
  // + the context handed to the shared InterventionModal.
  const [epiAlerts, setEpiAlerts] = useState([]);
  const [interventionsOnly, setInterventionsOnly] = useState(false);
  const [warnActions, setWarnActions] = useState([]);
  const [interventionCtx, setInterventionCtx] = useState(null);
  const [barangayIdMap, setBarangayIdMap] = useState({});
  const [manageHazardsOpen, setManageHazardsOpen] = useState(false);
  const [hazardForm, setHazardForm] = useState({ id: null, barangay_id: '', barangay_name: '', event_type: DISASTER_EVENT_TYPES[0], severity: DISASTER_SEVERITIES[1], purok: '', latitude: '', longitude: '', date_started: '', date_ended: '', notes: '' });
  const [hazardsSaving, setHazardsSaving] = useState(false);
  // Read-only pin preview: typed coordinates win, else the barangay centre, else
  // the city centre. useMemo keeps the array identity stable so the preview map's
  // recentre effect does not loop.
  const hazardPreviewCenter = useMemo(() => {
    const lat = parseFloat(hazardForm.latitude);
    const lng = parseFloat(hazardForm.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    const c = hazardForm.barangay_name ? findCoords(hazardForm.barangay_name) : null;
    return c || CABUYAO_CENTER;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hazardForm.latitude, hazardForm.longitude, hazardForm.barangay_name]);
  const hazardPreviewZoom = useMemo(() => {
    const lat = parseFloat(hazardForm.latitude);
    const lng = parseFloat(hazardForm.longitude);
    return (Number.isFinite(lat) && Number.isFinite(lng)) ? 17 : (hazardForm.barangay_name ? 14 : 12);
  }, [hazardForm.latitude, hazardForm.longitude, hazardForm.barangay_name]);
  // Inline custom dropdowns inside the two CHO manage modals (same
  // .mc-custom-dropdown-btn/panel/item markup used across Manage Cases).
  // One open key at a time: 'a:brgy' | 'a:type' | 'a:hazard' | 'a:disease' |
  // 'a:status' | 'h:brgy' | 'h:type' | 'h:sev'.
  const [manageDD, setManageDD] = useState(null);
  const manageActionsRef = useRef(null);
  const manageHazardsRef = useRef(null);
  // Phase 1 zone (purok-level) hotspots on the Hotspot Disease Map: an exposure
  // overlay that separates "it rained / flooded here" from "cases are clustering".
  const [showZones, setShowZones] = useState(true);
  const [zonePopup, setZonePopup] = useState(null);
  // Detection sensitivity (see ZONE_PRESETS) and the "show every cell" grid
  // overlay. Sensitivity persists per browser so a CHO's tuning sticks.
  const [zoneSensitivity, setZoneSensitivity] = useState(() => {
    try { return localStorage.getItem('cdms_zone_sensitivity') || DEFAULT_ZONE_SENSITIVITY; }
    catch { return DEFAULT_ZONE_SENSITIVITY; }
  });
  const [showAllZoneCells, setShowAllZoneCells] = useState(false);
  // Real purok boundary polygons, when the City supplied them (Settings -> Data
  // Management). Keyed by barangay name: [{ name, rings }]. Empty => the 6-cell
  // proxy grid is used for every barangay.
  const [purokAreas, setPurokAreas] = useState({});
  // Per-zone rainfall, keyed `${barangay}|${zoneIdx}` -> { rain24, rain72 }. Fetched
  // from the zone centroids the map already knows. Falls back to the barangay
  // reading (weatherRawByName) for any zone the server could not answer for.
  const [zoneRain, setZoneRain] = useState({});
  const changeZoneSensitivity = (v) => {
    setZoneSensitivity(v);
    try { localStorage.setItem('cdms_zone_sensitivity', v); } catch { /* ignore */ }
  };
  // Lazily-fetched "same week in past years" historical summary for the open popup
  const [histSummary, setHistSummary] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      axios.get(API_URL + '/api/barangay-actions').then(res => { if (alive) setActions(Array.isArray(res.data) ? res.data : []); }).catch(() => {});
      axios.get(API_URL + '/api/epi-alerts').then(res => { if (alive) setEpiAlerts(Array.isArray(res.data) ? res.data : []); }).catch(() => {});
      axios.get(API_URL + '/api/disaster-events').then(res => { if (alive) setDisasterEvents(Array.isArray(res.data) ? res.data : []); }).catch(() => {});
      axios.get(API_URL + '/api/weather/hazards').then(res => {
        if (alive) { setWeatherHazards(Array.isArray(res.data) ? res.data : []); setWeatherOffline(false); }
        if (!window.__wxLogged && Array.isArray(res.data)) { window.__wxLogged = true; console.info('[weather/hazards]', res.data); }
      }).catch(() => { if (alive) setWeatherOffline(true); });
      axios.get(API_URL + '/api/weather/pagasa').then(res => {
        if (alive && res.data && res.data.ok) setPagasa(res.data);
      }).catch(() => {});
      axios.get(API_URL + '/api/barangays').then(res => {
        if (alive && Array.isArray(res.data)) {
          const m = {};
          res.data.forEach(b => { m[b.id] = b.name; });
          setBarangayIdMap(m);
        }
      }).catch(() => {});
    };
    load();
    const iv = setInterval(load, 30000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  // Notification -> "View →" focus handoff. A rapid-outbreak alert lands here
  // (link_to 'MapView'), so the map switches to the Hotspot Disease Map and
  // narrows to the affected barangay. Waiting on barangayIdMap means a CHO's
  // view is only narrowed once the id -> name lookup is available; a BHW is
  // already scoped to their own barangay so the name resolves from that scope.
  const focusAppliedRef = useRef(false);
  useEffect(() => {
    if (!initialFocus) { focusAppliedRef.current = false; return; }
    setMapMode('hotspot');
    const name = initialFocus.barangayName
      || (initialFocus.barangayId != null ? barangayIdMap[initialFocus.barangayId] : null)
      || (loginRole === 'BHW' ? loginBarangay : null);
    if (name) setFilterBarangay(name);
    if (!focusAppliedRef.current && (name || initialFocus.barangayId == null)) {
      focusAppliedRef.current = true;
      if (onFocusConsumed) onFocusConsumed();
    }
  }, [initialFocus, barangayIdMap, loginRole, loginBarangay, onFocusConsumed]);

  // Real purok boundaries change only on an import, so they get their own slow
  // poll (10 min) instead of riding the 30 s map poll with a multi-KB payload.
  useEffect(() => {
    let alive = true;
    const load = () => {
      axios.get(API_URL + '/api/purok-areas')
        .then(res => { if (alive) setPurokAreas(purokRowsToAreas(res.data)); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 600000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  // "Show interventions only" - the server already filters warning-linked rows
  // via ?interventions=1, so the map layer just consumes that payload instead of
  // re-implementing the rule on the client.
  useEffect(() => {
    if (!interventionsOnly) return undefined;
    let alive = true;
    const load = () => {
      axios.get(API_URL + '/api/barangay-actions?interventions=1')
        .then(res => { if (alive) setWarnActions(Array.isArray(res.data) ? res.data : []); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 30000);
    return () => { alive = false; clearInterval(iv); };
  }, [interventionsOnly]);

  // Refetch both action views after an intervention is logged from the map.
  const reloadMapActions = () => {
    setInterventionCtx(null);
    axios.get(API_URL + '/api/barangay-actions')
      .then(res => setActions(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
    if (interventionsOnly) {
      axios.get(API_URL + '/api/barangay-actions?interventions=1')
        .then(res => setWarnActions(Array.isArray(res.data) ? res.data : []))
        .catch(() => {});
    }
    axios.get(API_URL + '/api/epi-alerts')
      .then(res => setEpiAlerts(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  };

  // Opens the shared InterventionModal for a server-computed disease warning.
  const openWarningIntervention = (alert) => {
    if (!alert) return;
    const name = alert.barangay_name || '';
    const idFromMap = Number(Object.keys(barangayIdMap).find(id => barangayIdMap[id] === name) || 0);
    setInterventionCtx({
      barangay: name,
      barangay_id: alert.barangay_id || idFromMap || null,
      disease: alert.disease_name || '',
      count: alert.alert_value || null,
      alert_id: alert.id || null,
      alert_kind: alert.alert_type || 'epi_count',
      kind_label: t(ALERT_KIND_LABELS[alert.alert_type] || 'Disease warning'),
    });
  };
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

  // Offline tile pre-cache for the user's area of responsibility
  const [tileCache, setTileCache] = useState({ running: false, done: 0, total: 0, error: '' });
  const handleCacheOffline = async () => {
    if (tileCache.running) return;
    if (!navigator.onLine) {
      notify(t('You need to be online to cache the map.'), 'error');
      return;
    }
    setTileCache({ running: true, done: 0, total: 1, error: '' });
    try {
      const layers = mapLayer === 'HD' ? ['esri'] : ['osm'];
      const result = await precacheTiles(roleBounds, 12, 17, layers, (done, all) =>
        setTileCache({ running: true, done, total: all, error: '' })
      );
      setTileCache({ running: false, done: result.succeeded, total: result.total, error: '' });
      if (result.total > 0 && result.succeeded === 0) {
        notify(t('Could not download map tiles - the tile server blocked the request.'), 'error');
      } else {
        notify(t('Offline map saved for your area!'), 'success');
      }
    } catch (err) {
      setTileCache({ running: false, done: 0, total: 0, error: (err && err.message) || t('Failed to cache map') });
      notify(t('Failed to cache the map offline.'), 'error');
    }
  };


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

  const yearOptions = (() => {
    let minYear = currentYear;
    scopedCasesForPurok.forEach(c => {
      const y = parseInt((c.date_reported || '').slice(0, 4), 10);
      if (!isNaN(y) && y < minYear) minYear = y;
    });
    const list = [];
    for (let y = currentYear; y >= minYear; y--) list.push(String(y));
    return list;
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
    if (caseTypeRef.current && !caseTypeRef.current.contains(e.target)) setCaseTypeOpen(false);
      if (severityRef.current && !severityRef.current.contains(e.target)) setSeverityOpen(false);
      if (yearRef.current && !yearRef.current.contains(e.target)) setYearOpen(false);
      if (diseaseRef.current && !diseaseRef.current.contains(e.target)) setDiseaseOpen(false);
      if (riskFactorRef.current && !riskFactorRef.current.contains(e.target)) setRiskFactorOpen(false);
      // Manage-modal dropdowns: close when the click lands outside both cards.
      setManageDD((cur) => {
        if (!cur) return cur;
        const inActions = manageActionsRef.current && manageActionsRef.current.contains(e.target);
        const inHazards = manageHazardsRef.current && manageHazardsRef.current.contains(e.target);
        return (inActions || inHazards) ? cur : null;
      });
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
    if (mapZoom < 13 || mapZoom >= PUROK_ZOOM_THRESHOLD) container.classList.add('brgy-labels-hidden');
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
      if (filterCaseType !== 'All Case Types' && (c.case_type || '') !== filterCaseType) return false;
      if (filterSeverity !== 'All Severities' && c.severity      !== filterSeverity)    return false;
      if (filterDateFrom || filterDateTo) {
        const d = (c.date_reported || '').slice(0, 10);
        if (d && ((filterDateFrom && d < filterDateFrom) || (filterDateTo && d > filterDateTo))) return false;
      }
      if (filterPurok !== 'All Puroks' && !(c.address || '').toLowerCase().includes(filterPurok.toLowerCase())) return false;
      if (filterDisease !== 'All Diseases' && (c.disease_name || '') !== filterDisease) return false;
      if (filterRiskFactor !== 'All Factors' && !parseRiskFactors(c.risk_factors).includes(filterRiskFactor)) return false;
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
      if (filterCaseType !== 'All Case Types' && (c.case_type || '') !== filterCaseType) return false;
      if (filterSeverity !== 'All Severities' && c.severity  !== filterSeverity) return false;
      if (filterDateFrom || filterDateTo) {
        const d = (c.date_reported || '').slice(0, 10);
        if (d && ((filterDateFrom && d < filterDateFrom) || (filterDateTo && d > filterDateTo))) return false;
      }
      if (filterDisease !== 'All Diseases' && (c.disease_name || '') !== filterDisease) return false;
      if (filterRiskFactor !== 'All Factors' && !parseRiskFactors(c.risk_factors).includes(filterRiskFactor)) return false;
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
  }, [allCases, filterBarangay, filterStatus, filterCaseType, filterDateFrom, filterDateTo, filterSeverity, filterPurok, filterDisease, filterRiskFactor, autoDetectedBrgy]);

  const goToDisease = (barangayName, diseaseName, purok) => {
    if (setCaseFilter) setCaseFilter({ disease: diseaseName.trim(), barangay: barangayName, purok: purok || '' });
    if (setActiveTab)  setActiveTab('Manage Cases');
    setPopup(null);
  };

  const activeData  = (filterBarangay !== 'All Barangays' || loginRole === 'BHW') && purokData.length > 0 ? purokData : barangayData;
  const criticalCount = activeData.filter(b => b.totalCases >= 60).length;
  const veryHighCount = activeData.filter(b => b.totalCases >= 40 && b.totalCases < 60).length;
  const highCount   = activeData.filter(b => b.totalCases >= 20 && b.totalCases < 40).length;
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
      if (filterCaseType !== 'All Case Types' && (c.case_type || '') !== filterCaseType) return false;
      if (filterSeverity !== 'All Severities' && c.severity      !== filterSeverity)   return false;
      if (filterDateFrom || filterDateTo) {
        const d = (c.date_reported || '').slice(0, 10);
        if (d && ((filterDateFrom && d < filterDateFrom) || (filterDateTo && d > filterDateTo))) return false;
      }
      if (filterPurok !== 'All Puroks' && !(c.address || '').toLowerCase().includes(filterPurok.toLowerCase())) return false;
      if (filterDisease !== 'All Diseases' && (c.disease_name || '') !== filterDisease) return false;
      if (filterRiskFactor !== 'All Factors' && !parseRiskFactors(c.risk_factors).includes(filterRiskFactor)) return false;
      if (loginRole === 'BHW' && loginBarangay)      return c.barangay_name === loginBarangay;
      if (loginRole === 'CHO' && choUnitBarangays.length > 0) return choUnitBarangays.includes(c.barangay_name);
      return true;
    });
  }, [allCases, filterBarangay, filterStatus, filterCaseType, filterSeverity, filterDateFrom, filterDateTo, filterPurok, filterDisease, filterRiskFactor, loginRole, loginBarangay, sessionContext]);

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

  // The zone (purok-level) layer draws ON TOP of the barangay choropleth as an
  // outline + tint rather than replacing it: dropping the risk fill would change
  // the map the whole office already reads. A darker patch inside a red barangay
  // is the zone driving it. So the choropleth keeps its existing styling.
  //
  // Re-style every border when the active highlight changes so only the lit
  // barangay shows the thick dashed line and the rest are plain outlines.
  useEffect(() => {
    if (!geoJsonLayerRef.current) return;
    geoJsonLayerRef.current.eachLayer((layer) => {
      layer.setStyle(getGeoJsonStyle(layer.feature, barangayData, activeBarangayHighlight, barangayFocused, mapLayer, bordersOnly));
    });
  }, [barangayData, hoveredBarangay, filterBarangay, autoDetectedBrgy, showAutoPurok, mapLayer, activeBarangayHighlight, barangayFocused, bordersOnly]);

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

  // ── F/H overlay data: action badge markers + disaster watch ──
  const openBarangayPopup = (name) => {
    const liveData = barangayDataRef.current.find(b => b.barangayName === name);
    if (liveData) setPopup(liveData);
    else setPopup({ barangayName: name, totalCases: 0, diseases: {}, coords: findCoords(name) });
  };

  const actionBadgeItems = [];
  // `mapActions` = what the map draws. When "Show interventions only" is on it is
  // the server-filtered warning-linked set; otherwise it is every action. The
  // manage modal always reads the full `actions` list so records stay editable.
  const mapActions = interventionsOnly ? warnActions : actions;
  const isWarningIntervention = (a) => !!(a && (a.epi_alert_id || a.alert_kind));
  const ongoingActions = mapActions.filter(a => a.status !== 'completed');
  const wxKey = (n) => (n || '').trim().toLowerCase().replace(/\s+/g, ' ');
  // Phase/pin tier (zoom >= PUROK_ZOOM_THRESHOLD) is scoped to the single barangay
  // in view so "the phases" light up with their weather circles and nothing else.
  // Both manual hazard pins AND action count discs are narrowed to it so other
  // barangays' discs never leak into the phase view (barangay-address tier keeps all).
  const pinFocusKey = (loginRole === 'BHW' && loginBarangay) ? wxKey(loginBarangay)
    : (filterBarangay !== 'All Barangays') ? wxKey(filterBarangay)
    : (autoDetectedBrgy ? wxKey(autoDetectedBrgy) : null);
  const pinTier = mapZoom >= PUROK_ZOOM_THRESHOLD;
  const actionsByName = {};
  const actionScopeList = (loginRole === 'BHW' && loginBarangay) ? [loginBarangay]
    : (loginRole === 'CHO' && sessionContext && CHO_UNIT_BARANGAYS[sessionContext]) ? CHO_UNIT_BARANGAYS[sessionContext]
    : ALL_BARANGAYS;
  const actionScopeKeys = new Set(actionScopeList.map(wxKey));
  ongoingActions.forEach(a => {
    const name = a.barangay_name || (a.barangay_id ? '' : 'Citywide');
    if (!name) return;
    if (actionScopeKeys.size && !actionScopeKeys.has(wxKey(name))) return;
    if (pinTier && pinFocusKey && wxKey(name) !== pinFocusKey) return;
    if (!actionsByName[name]) actionsByName[name] = [];
    actionsByName[name].push(a);
  });
  Object.entries(actionsByName).forEach(([name, list]) => {
    const coords = findCoords(name);
    if (!coords) return;
    actionBadgeItems.push({
      id: 'act-' + name,
      coords,
      count: list.length,
      color: '#0891b2',
      title: `${list.length} ongoing action(s) - ${name}`,
      onClick: () => openBarangayPopup(name),
    });
  });


  const weatherByName = {};
  const wxOfflineNames = new Set();
  // Every scoped barangay response (not just the ones carrying a hazard) so the
  // zone layer can read the trailing rain accumulations.
  const weatherRawByName = {};
  const hazardScopeList = (loginRole === 'BHW' && loginBarangay) ? [loginBarangay]
    : (loginRole === 'CHO' && sessionContext && CHO_UNIT_BARANGAYS[sessionContext]) ? CHO_UNIT_BARANGAYS[sessionContext]
    : ALL_BARANGAYS;
  const hazardScopeKeys = new Set(hazardScopeList.map(wxKey));
  (weatherHazards || []).forEach(w => {
    if (!w || !w.name) return;
    weatherRawByName[wxKey(w.name)] = w;
    if (w.error === 'offline') wxOfflineNames.add(wxKey(w.name));
    if (w.hazards && w.hazards.length) weatherByName[wxKey(w.name)] = w;
  });
  const activeHazardEvents = (disasterEvents || []).filter(ev => isDisasterActive(ev));
  const allManualPinEvents = activeHazardEvents.filter(ev => ev.latitude && ev.longitude);
  const manualPinEvents = allManualPinEvents.filter(ev => !hazardScopeKeys.size || hazardScopeKeys.has(wxKey(ev.barangay_name)));
  const manualBarangayEvents = {};
  manualPinEvents.forEach(ev => {
    if (!ev.barangay_name) return;
    const k = wxKey(ev.barangay_name);
    if (!manualBarangayEvents[k]) manualBarangayEvents[k] = [];
    manualBarangayEvents[k].push(ev);
  });
  // Also include bar-level manual events (no coords) scoped
  const barLevelManualAll = activeHazardEvents.filter(ev => !(ev.latitude && ev.longitude));
  barLevelManualAll.forEach(ev => {
    if (hazardScopeKeys.size && !hazardScopeKeys.has(wxKey(ev.barangay_name))) return;
    const k = wxKey(ev.barangay_name);
    if (!manualBarangayEvents[k]) manualBarangayEvents[k] = [];
    manualBarangayEvents[k].push(ev);
  });

  // A hazard pin whose location text names a unit ("Purok 3", "Blk 8 Lot 8") is
  // anchored to that unit's zone, resolved with the exact mapping the cases use,
  // so the pin and the cases it affects land in the same zone. Pins that name no
  // location unit keep their real coordinates.
  const manualPinZoneAnchor = useMemo(() => {
    const out = {};
    (disasterEvents || []).forEach(ev => {
      const name = ev.barangay_name;
      if (!name || !ev.purok) return;
      const unit = extractLocationUnit(ev.purok);
      if (!unit) return;
      const feature = findFeatureForBarangay(name);
      if (!feature) return;
      const zones = zonesForBarangay(name, feature, purokAreas[name] || null);
      if (!zones.length) return;
      let idx;
      if (zones[0].real) {
        // Real boundaries: anchor only when the pin's text names a purok, so a
        // pin without a purok name keeps its real clicked position.
        idx = purokIdxForUnit(zones, unit);
        if (idx == null) return;
      } else {
        const available = new Set(zones.map(z => z.idx));
        idx = resolveZoneIdx(zoneIndexForUnit(name, unit), available).idx;
      }
      const z = zones.find(zz => zz.idx === idx);
      if (z && z.centroid) out[ev.id] = z.centroid;   // [lat, lng]
    });
    return out;
  }, [disasterEvents, purokAreas]);
  // ── Phase 1: zone (purok-level) hotspot detection ──────────────────────────
  // Built from the RAW scoped case list, not the sidebar-filtered one: the 7-day
  // window is part of the rule, so a date/disease filter would silently break
  // detection. Only the barangay filter narrows the scope, matching the view.
  const zoneScopeList = useMemo(() => {
    const scopeList = (loginRole === 'BHW' && loginBarangay) ? [loginBarangay]
      : (loginRole === 'CHO' && sessionContext && CHO_UNIT_BARANGAYS[sessionContext]) ? CHO_UNIT_BARANGAYS[sessionContext]
      : ALL_BARANGAYS;
    return (filterBarangay !== 'All Barangays') ? [filterBarangay] : scopeList;
  }, [loginRole, loginBarangay, sessionContext, filterBarangay]);

  // Zone geometry for the scoped barangays (the real purok polygons when supplied,
  // else the 6-cell grid). Reused for detection AND for the per-zone rainfall
  // request, so both agree on what "zone 3 of barangay X" is.
  const scopedZoneGeom = useMemo(() => {
    const out = {};
    zoneScopeList.forEach(name => {
      const feature = findFeatureForBarangay(name);
      if (!feature) return;
      const zones = zonesForBarangay(name, feature, purokAreas[name] || null);
      if (zones.length) out[name] = zones;
    });
    return out;
  }, [zoneScopeList, purokAreas]);

  // How many barangays in scope already have REAL purok boundaries (vs the proxy grid).
  const realBoundaryBarangays = useMemo(
    () => zoneScopeList.filter(n => (purokAreas[n] || []).length > 0).length,
    [zoneScopeList, purokAreas]
  );

  // Ask the server for each zone's own rain reading. One POST per scope change; the
  // server caches per point for 30 min so a re-render is free. Skipped when offline.
  const zoneRainSignature = useMemo(() => Object.keys(scopedZoneGeom).sort()
    .map(name => scopedZoneGeom[name].map(z => `${name}|${z.idx}`).join(',')).join(';'),
    [scopedZoneGeom]);
  useEffect(() => {
    if (isDisasterMap || !showZones || !zoneRainSignature) { setZoneRain({}); return undefined; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return undefined;
    let alive = true;
    const points = [];
    Object.keys(scopedZoneGeom).forEach(name => {
      scopedZoneGeom[name].forEach(z => {
        if (z.centroid) points.push({ key: `${name}|${z.idx}`, lat: z.centroid[0], lng: z.centroid[1] });
      });
    });
    if (points.length === 0) return undefined;
    axios.post(API_URL + '/api/weather/by-points', { points })
      .then(res => { if (alive && res.data && res.data.results) setZoneRain(res.data.results); })
      .catch(() => {});
    return () => { alive = false; };
  }, [isDisasterMap, showZones, zoneRainSignature]);

  const zoneHotspots = useMemo(() => {
    if (isDisasterMap || !showZones) return [];
    const thresholds = ZONE_PRESETS[zoneSensitivity] || ZONE_PRESETS[DEFAULT_ZONE_SENSITIVITY];
    const rows = [];
    zoneScopeList.forEach(name => {
      const feature = findFeatureForBarangay(name);
      if (!feature) return;
      const key = wxKey(name);
      const canon = findCanonicalName(name) || name;
      const brgyCases = allCases.filter(c => (findCanonicalName(c.barangay_name) || c.barangay_name) === canon);
      const wx = weatherRawByName[key];
      const rainfall = wx ? { rain24: wx.rain_24h, rain72: wx.rain_72h } : null;
      const floodPins = (disasterEvents || []).filter(ev => (
        isDisasterActive(ev) && FLOOD_EVENT_TYPES.includes(ev.event_type)
        && (!ev.barangay_name || wxKey(ev.barangay_name) === key)
      ));
      // Per-zone readings for THIS barangay, only for zones the server answered for.
      const zoneRainfall = new Map();
      (scopedZoneGeom[name] || []).forEach(z => {
        const rec = zoneRain[`${name}|${z.idx}`];
        if (rec && (Number.isFinite(rec.rain24) || Number.isFinite(rec.rain72))) zoneRainfall.set(z.idx, rec);
      });
      rows.push(...buildZoneHotspots({
        barangayName: name,
        cases: brgyCases,
        feature,
        extractUnit: extractLocationUnit,
        rainfall,
        floodPins,
        thresholds,
        purokAreas: purokAreas[name] || null,
        zoneRainfall: zoneRainfall.size ? zoneRainfall : null,
      }));
    });
    return rows;
  }, [isDisasterMap, showZones, zoneSensitivity, zoneScopeList, allCases, weatherHazards, disasterEvents, purokAreas, scopedZoneGeom, zoneRain]);

  // "Show all cells": the full 6-cell grid of every scoped barangay, flagged or
  // not, as a neutral background layer so the proxy grid is visible.
  const allZoneCellsFC = useMemo(() => {
    if (isDisasterMap || !showZones || !showAllZoneCells) return { type: 'FeatureCollection', features: [] };
    const rows = [];
    zoneScopeList.forEach(name => {
      const zones = scopedZoneGeom[name];
      if (!zones) return;
      zones.forEach(z => rows.push({ ...z, kind: 'grid', score: 0 }));
    });
    return zonesToFeatureCollection(rows);
  }, [isDisasterMap, showZones, showAllZoneCells, zoneScopeList, scopedZoneGeom]);

  const zoneFeatureCollection = useMemo(
    () => zonesToFeatureCollection(zoneHotspots),
    [zoneHotspots]
  );
  const zoneCounts = useMemo(() => {
    const counts = { exposure: 0, case: 0, weather: 0, watch: 0 };
    zoneHotspots.forEach(r => { counts[r.kind] = (counts[r.kind] || 0) + 1; });
    return counts;
  }, [zoneHotspots]);

  const zoneRowFor = (zoneId) => zoneHotspots.find(r => r.id === zoneId) || null;

  // Step 2 of the zone view (zoom >= ZONE_BREAKDOWN_ZOOM): one chip per location
  // unit inside a flagged zone, so the zone opens up into WHICH purok/blk has
  // what. Skipped for units with no coordinates (they still list in the popup).
  const zoneBreakdownItems = useMemo(() => {
    if (isDisasterMap || !showZones || mapZoom < ZONE_BREAKDOWN_ZOOM) return [];
    const out = [];
    zoneHotspots.forEach(row => {
      (row.breakdown || []).forEach(b => {
        if (!b.coords) return;
        const top = b.diseases[0];
        out.push({
          coords: b.coords,
          color: row.kindMeta.color,
          label: top ? `${b.unit} · ${top.disease} ${b.cases7}` : b.unit,
          title: `${row.barangay} · ${row.label} · ${b.unit}`,
          onClick: () => setZonePopup(row),
        });
      });
    });
    return out;
  }, [isDisasterMap, showZones, mapZoom, zoneHotspots]);

  // Tooltip = plain reading of the zone; click opens the evidence card where the
  // CHO can log the intervention that answers it.
  const onEachZone = (feature, layer) => {
    const props = (feature && feature.properties) || {};
    const row = zoneRowFor(props.zoneId);
    if (!row) return;
    const onlyUnit = row.units.length === 1 && row.units[0] !== 'Unspecified' ? row.units[0] : '';
    layer.bindTooltip(`${row.barangay} · ${row.label}${onlyUnit ? ' · ' + onlyUnit : ''} — ${t(row.kindMeta.label)}`, { sticky: true });
    layer.on('click', () => setZonePopup(row));
  };

  // Hand the zone's evidence to the shared InterventionModal (remarks required,
  // enforced again server-side). alert_kind lets a Dashboard-computed-style warning
  // be answered even though a zone has no epi_alerts row of its own.
  const openZoneIntervention = (row) => {
    const brgyId = Object.keys(barangayIdMap).find(id => wxKey(barangayIdMap[id]) === wxKey(row.barangay)) || '';
    setInterventionCtx({
      barangay: row.barangay,
      barangay_id: brgyId || null,
      disease: row.disease || '',
      count: row.cases7 || 0,
      alert_kind: row.alertKind,
      kind_label: t(row.kindMeta.label),
    });
    setZonePopup(null);
  };

  // Purok-tier badges are derived from the case purok dots inside a hazard barangay
  const weatherPinsByBarangay = {};
  (purokData || []).forEach(p => {
    if (!p.barangay || !weatherByName[wxKey(p.barangay)]) return;
    const k = wxKey(p.barangay);
    weatherPinsByBarangay[k] = (weatherPinsByBarangay[k] || 0) + 1;
  });

  // Barangay-tier badges (zoomed out): automatic PAGASA-style warning dot for every barangay
  // Case count of the barangay pin each badge sits on, so the badge can lift
  // clear of a busy pin instead of burying its number.
  const barangayCaseCount = {};
  (barangayData || []).forEach(b => {
    if (b && b.barangayName) barangayCaseCount[wxKey(b.barangayName)] = b.totalCases;
  });
  const hazardBadgeItems = [];
  hazardScopeList.forEach(name => {
    const coords = findCoords(name);
    if (!coords) return;
    const w = weatherByName[wxKey(name)];
    const man = manualBarangayEvents[wxKey(name)] || [];
    const barLevelEvents = man.filter(m => !(m.latitude && m.longitude));
    const pinCount = (weatherPinsByBarangay[wxKey(name)] || 0) + man.filter(m => m.latitude && m.longitude).length;
    if (!w && man.length === 0) {
      const off = wxOfflineNames.has(wxKey(name));
      hazardBadgeItems.push({
        id: 'hzd-' + name,
        coords,
        svg: hazardSvgMarkup(off ? '⚠️' : '☁️', off ? '#f59e0b' : '#94a3b8', 38, off ? 'Off' : 'Clear'),
        count: 0,
        color: off ? '#f59e0b' : '#94a3b8',
        title: off ? `${name} — Weather offline` : `${name} — No active weather hazard`,
        size: 38,
        z: 1500,
        above: hazardBadgeLift(barangayCaseCount[wxKey(name)] || 0, 38, false),
        onClick: () => openBarangayPopup(name),
      });
      return;
    }
    const allTypes = [];
    if (w) allTypes.push(w.hazards[0]);
    barLevelEvents.forEach(e => allTypes.push(e.event_type));
    const mainType = allTypes[0] || (man.find(m => m.latitude && m.longitude) || {}).event_type || 'Flood';
    const details = [];
    if (w) details.push(`${w.hazards.join(', ')}${w.temperature != null ? ' ' + w.temperature + '°C' : ''}`);
    if (w && w.outlook) details.push(w.outlook);
    barLevelEvents.forEach(e => details.push(`${hazardIcon(e.event_type)} ${e.event_type} (${e.severity})`));
    const diseases = [...new Set(allTypes.flatMap(hazardDiseases))];
    const diseaseHint = diseases.length ? ` · Possible: ${diseases.join(', ')}` : '';
    hazardBadgeItems.push({
      id: 'hzd-' + name,
      coords,
      svg: hazardSvgIcon(mainType, 38),
      count: pinCount,
      color: hazardColor(mainType),
      title: `${name} — ${details.join(' · ')}${diseaseHint}`,
      size: 38,
      z: 1500,
      above: hazardBadgeLift(barangayCaseCount[wxKey(name)] || 0, 38, pinCount > 0),
      onClick: () => openBarangayPopup(name),
    });
  });

  // ── Disease-warning badges (panelist intervention flow) ──
  // A barangay carrying a flagged disease count with NO intervention logged yet
  // gets an amber ⚠ disc stacked clear above its hazard disc, so the CHO can see
  // at a glance which warnings still have no answer. The matching intervention is
  // resolved by epi_alert_id first (exact row) and by barangay + disease as the
  // fallback - the same two-tier match the Dashboard warning cards use.
  const alertsByBarangay = {};
  (epiAlerts || []).forEach(a => {
    if (!a || !a.barangay_name) return;
    const k = wxKey(a.barangay_name);
    const prev = alertsByBarangay[k];
    if (!prev || (Number(a.alert_value) || 0) > (Number(prev.alert_value) || 0)) alertsByBarangay[k] = a;
  });
  const interventionMatchesWarning = (alert) => {
    if (!alert) return null;
    const byId = actions.find(x => isWarningIntervention(x) && x.epi_alert_id && String(x.epi_alert_id) === String(alert.id));
    if (byId) return byId;
    return actions.find(x => isWarningIntervention(x)
      && wxKey(x.barangay_name) === wxKey(alert.barangay_name)
      && (x.target_disease || x.alert_disease || '') === (alert.disease_name || '')) || null;
  };
  // Warning-linked interventions grouped by barangay. A Dashboard-computed warning
  // (High Active Cases, a Recurring Hotspot, ...) has no `epi_alerts` row of its
  // own, so the logged intervention is the only evidence of it the map can see -
  // without this the "Disease Warning Interventions" card and the popup banner went
  // blank for every warning that was not a real epi_alerts row.
  const warnActionsByBarangay = {};
  actions.forEach(a => {
    if (!isWarningIntervention(a)) return;
    const name = a.barangay_name || a.alert_barangay || '';
    if (!name) return;
    const k = wxKey(name);
    (warnActionsByBarangay[k] = warnActionsByBarangay[k] || []).push(a);
  });

  // ── "Show interventions only" map layer ──
  // One pin PER intervention, carrying its own action-type glyph (Fogging / Spraying
  // / Community Cleaning) coloured by status. `barangay_actions` stores no
  // coordinates, so each intervention is plotted from the centroid of its OWN
  // barangay (findCoords); when several land in the same barangay they are fanned
  // out on a small ring so each gets its own pin instead of stacking on one dot.
  //
  // A citywide record (barangay_id NULL) is NEVER pinned. It has no location, and
  // falling back to the linked warning's barangay dropped the pin somewhere the
  // action was never carried out - a citywide Vaccination Drive answering a Dengue
  // alert in Niugan is not an intervention "in Niugan". This is the same rule the
  // action count discs already follow (`findCoords('Citywide')` resolves to nothing).
  // Position is barangay-level, and the sidebar card says so.
  const INTERVENTION_STATUS_COLORS = { planned: '#f59e0b', ongoing: '#0891b2', completed: '#10b981' };
  // The intervention discs are deliberately the largest badge on the map (the
  // CHO/BHW field crews must spot a logged intervention at a glance): 46px vs the
  // 38px hazard disc and the 34px warning disc. Also drives the fan-out radius.
  const INTERVENTION_PIN_SIZE = 46;
  const interventionRows = [];
  if (interventionsOnly) {
    const byOwnBarangay = {};
    actions.forEach(a => {
      if (!isWarningIntervention(a)) return;
      const own = a.barangay_name || '';
      if (!own) return;
      const k = wxKey(own);
      if (actionScopeKeys.size && !actionScopeKeys.has(k)) return;
      if (pinTier && pinFocusKey && k !== pinFocusKey) return;
      (byOwnBarangay[k] = byOwnBarangay[k] || []).push(a);
    });
    Object.entries(byOwnBarangay).forEach(([k, list]) => {
      const name = list[0].barangay_name || '';
      const base = findCoords(name);
      if (!base) return;
      const ring = barangayRing(name);
      const sorted = list.slice().sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
      const n = sorted.length;
      // Ring spacing keeps its tuned ratio to the disc size: the pins grew from
      // 30px to INTERVENTION_PIN_SIZE so the ring grows with them, otherwise the
      // bigger discs would merge into one blob. The border clamp below still
      // guarantees containment, so a narrow barangay just tightens the ring.
      const radius = (n <= 3 ? 0.0035 : n <= 6 ? 0.0048 : 0.0060) * (INTERVENTION_PIN_SIZE / 30);
      const lngRadius = radius / Math.max(0.2, Math.cos((base[0] * Math.PI) / 180));
      sorted.forEach((a, i) => {
        // A lone intervention sits on the centroid; several spread evenly from the top.
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
        let dLat = radius * Math.sin(angle);
        let dLng = lngRadius * Math.cos(angle);
        // Pull the pin back toward the centroid until it sits inside the barangay
        // border. The centroid is inside, so this converges; without it a fan-out
        // offset pokes outside a narrow barangay (the vaccination-drive report).
        for (let t = 0; t < 8 && !pointInRing(ring, base[0] + dLat, base[1] + dLng); t++) {
          dLat *= 0.6;
          dLng *= 0.6;
        }
        interventionRows.push({
          a,
          name,
          coords: n === 1 ? base : [base[0] + dLat, base[1] + dLng],
        });
      });
    });
    // Newest first for the sidebar list.
    interventionRows.sort((x, y) => (Number(y.a.id) || 0) - (Number(x.a.id) || 0));
  }
  const interventionPinItems = interventionRows.map(({ a, name, coords }) => {
    const glyph = ACTION_TYPE_ICONS[a.action_type] || '🗂';
    const color = INTERVENTION_STATUS_COLORS[a.status] || INTERVENTION_STATUS_COLORS.planned;
    const disease = a.target_disease || a.alert_disease || '';
    // Deliberately the largest badge on the map (the CHO/BHW field crews need to
    // spot a logged intervention at a glance): 46px disc vs the 38px hazard disc
    // and 34px warning disc, and it draws above both.
    return {
      id: `iv-${a.id}`,
      coords,
      svg: hazardSvgMarkup(glyph, color, INTERVENTION_PIN_SIZE, 'iv' + a.id),
      size: INTERVENTION_PIN_SIZE,
      color,
      z: 1700,
      title: `${glyph} ${a.action_type} · ${translateActionStatus(a.status)}${disease ? ` · ${disease}` : ''}${a.description ? ` — ${a.description}` : ''}`,
      onClick: () => openBarangayPopup(name),
    };
  });
  const warningBadgeItems = [];
  if (mapZoom < PUROK_ZOOM_THRESHOLD) {
    hazardScopeList.forEach(name => {
      const alert = alertsByBarangay[wxKey(name)];
      if (!alert) return;
      if (interventionMatchesWarning(alert)) return; // answered -> nothing to chase
      const coords = findCoords(name);
      if (!coords) return;
      const k = wxKey(name);
      const w = weatherByName[k];
      const man = manualBarangayEvents[k] || [];
      const pillCount = (weatherPinsByBarangay[k] || 0) + man.filter(e => e.latitude && e.longitude).length;
      // The hazard disc only renders its count pill when it has a hazard to count,
      // so the stack height has to follow the same rule or the warning disc drifts.
      const hazardPill = !!((w || man.length > 0) && pillCount > 0);
      // Stack above the hazard disc when that layer is drawn, otherwise take the
      // normal pin lift. Both come from the shared badge geometry.
      const hazardStack = (isDisasterMap && showDisasterLayer)
        ? hazardBadgeLift(barangayCaseCount[k] || 0, 38, hazardPill) + (hazardPill ? 50 : 38) + 2
        : 0;
      warningBadgeItems.push({
        id: 'warn-' + name,
        coords,
        svg: hazardSvgMarkup('⚠️', '#D97706', 34, 'Warn'),
        count: 0,
        color: '#D97706',
        title: `${name} — ${alert.disease_name} warning (${alert.alert_value} cases): no intervention logged yet`,
        size: 34,
        z: 1600,
        above: hazardStack || hazardBadgeLift(barangayCaseCount[k] || 0, 34, false),
        onClick: () => openBarangayPopup(name),
      });
    });
  }

  // ── Rapid outbreak pin (Hotspot Disease Map) ─────────────────────────────
  // The server tags a barangay whose disease count jumped inside 5 days with a
  // `rapid_outbreak` epi_alerts row. That barangay gets its own red siren disc so
  // CHO and BHW see at a glance which barangay is surging and with which disease.
  // Hotspot-map only, and it disappears once an intervention answers the alert.
  const OUTBREAK_PIN_SIZE = 42;
  const outbreakPinItems = [];
  if (!isDisasterMap && mapZoom < PUROK_ZOOM_THRESHOLD) {
    hazardScopeList.forEach(name => {
      const k = wxKey(name);
      const rows = (epiAlerts || []).filter(a => a && a.alert_type === 'rapid_outbreak'
        && wxKey(a.barangay_name) === k);
      if (!rows.length) return;
      // Highest-case outbreak in this barangay that nobody has answered yet.
      const top = rows.filter(a => !interventionMatchesWarning(a))
        .sort((a, b) => (Number(b.alert_value) || 0) - (Number(a.alert_value) || 0))[0];
      if (!top) return;
      const coords = findCoords(name);
      if (!coords) return;
      outbreakPinItems.push({
        id: 'outbreak-' + k,
        coords,
        svg: hazardSvgMarkup('🚨', '#dc2626', OUTBREAK_PIN_SIZE, 'Outbreak' + k),
        count: Number(top.alert_value) || 0,
        color: '#dc2626',
        size: OUTBREAK_PIN_SIZE,
        z: 1650,
        // Same rule as the hazard/warning discs: a badge sharing the barangay
        // centroid must clear the tall barangay pin or it buries the case number.
        // The disc always renders a count pill, so hasPill is true.
        above: hazardBadgeLift(barangayCaseCount[k] || 0, OUTBREAK_PIN_SIZE, true),
        title: `🚨 ${name} — rapid ${top.disease_name} outbreak: ${top.alert_value} cases in the last 5 days. Tap to see the purok/blk breakdown and log an intervention.`,
        onClick: () => openBarangayPopup(name),
      });
    });
  }

  // Pin tier (zoomed in). Weather pins follow the same tiers as the case pins:
  //   zoom 17 (phase tier)   -> ONLY the phases get weather pins (loose Purok/Blk/Lot
  //                             are folded into their nearest phase, never shown alone)
  //   zoom 18+ (address tier) -> every unit address + manual pin gets its weather pin
  const areaTier = mapZoom === PUROK_ZOOM_THRESHOLD;
  const pinSourceGroups = areaTier
    ? buildAreaTierItems(purokData, pinnedBarangay)
    : (purokData || []);

  // Manual hazard pins sit wherever the admin clicked rather than on a unit centre,
  // so measure the pin that actually renders underneath and lift past that one.
  const pinCountNear = (lat, lng) => {
    let best = null;
    let bestD = Infinity;
    pinSourceGroups.forEach(g => {
      if (!g || !g.coords) return;
      const d = (g.coords[0] - lat) ** 2 + (g.coords[1] - lng) ** 2;
      if (d < bestD) { bestD = d; best = g; }
    });
    return bestD <= 0.0015 ** 2 ? (best ? best.totalCases : 0) : 0;
  };

  const hazardPinItems = [];
  pinSourceGroups.forEach(p => {
    if (pinFocusKey && wxKey(p.barangay) !== pinFocusKey) return;
    const w = weatherByName[wxKey(p.barangay)];
    if (!w || !w.hazards || !w.hazards.length) return;
    const diseases = [...new Set(w.hazards.flatMap(hazardDiseases))];
    hazardPinItems.push({
      id: 'wxp-' + (p.purok || p.barangay) + '-' + p.barangay,
      coords: p.coords,
      svg: hazardSvgIcon(w.hazards[0], 32),
      color: hazardColor(w.hazards[0]),
      title: `${p.purok || p.barangay} — ${w.hazards.join(', ')}${diseases.length ? ` · Possible: ${diseases.join(', ')}` : ''}`,
      size: 32,
      above: hazardBadgeLift(p.totalCases),
      z: 1500,
      onClick: () => openBarangayPopup(p.barangay),
    });
  });
  manualPinEvents.forEach(ev => {
    if (pinFocusKey && wxKey(ev.barangay_name) !== pinFocusKey) return;
    const diseases = hazardDiseases(ev.event_type);
    let evCoords = [parseFloat(ev.latitude), parseFloat(ev.longitude)];
    if (manualPinZoneAnchor[ev.id]) {
      // Unit-named pin: anchor at its zone centroid, so it renders inside the zone
      // its cases were counted in (the same zone the engine links it to).
      evCoords = manualPinZoneAnchor[ev.id];
    } else if (areaTier) {
      // Phase tier: snap the manual pin onto the nearest phase pin; skip if there is none.
      let best = null, bestD = Infinity;
      pinSourceGroups.forEach(g => {
        const d = (g.coords[0] - evCoords[0]) ** 2 + (g.coords[1] - evCoords[1]) ** 2;
        if (d < bestD) { bestD = d; best = g; }
      });
      if (!best) return;
      evCoords = best.coords;
    }
    hazardPinItems.push({
      id: 'hzp-' + ev.id,
      coords: evCoords,
      svg: hazardSvgIcon(ev.event_type, 32),
      color: hazardColor(ev.event_type),
      title: `${ev.event_type}${ev.purok ? ' · ' + ev.purok : ''} (${ev.severity})${diseases.length ? ` · Possible: ${diseases.join(', ')}` : ''}`,
      size: 32,
      above: hazardBadgeLift(pinCountNear(evCoords[0], evCoords[1])),
      z: 1400,
      onClick: () => openBarangayPopup(ev.barangay_name),
    });
  });

  const popupActionKey = (popup && (popup.barangay || popup.barangayName)) || '';
  const popupActionsList = mapActions.filter(a => a.barangay_name === popupActionKey);
  // The flagged disease count for the inspected barangay (if any) and the
  // intervention that answers it - drives the popup warning banner.
  // A rapid outbreak gets its own red banner above the generic one. When the same
  // epi_alerts row is also the highest-counted warning, the generic banner steps
  // aside so the outbreak is not printed twice.
  const popupOutbreak = popupActionKey
    ? ((epiAlerts || []).filter(a => a && a.alert_type === 'rapid_outbreak' && wxKey(a.barangay_name) === wxKey(popupActionKey))
        .sort((a, b) => (Number(b.alert_value) || 0) - (Number(a.alert_value) || 0))[0] || null)
    : null;
  const popupOutbreakIntervention = interventionMatchesWarning(popupOutbreak);
  const popupWarningRaw = popupActionKey ? (alertsByBarangay[wxKey(popupActionKey)] || null) : null;
  const popupWarning = (popupOutbreak && popupWarningRaw && popupWarningRaw.id === popupOutbreak.id) ? null : popupWarningRaw;
  const popupWarningIntervention = interventionMatchesWarning(popupWarning);
  // Warning-linked interventions for the inspected barangay. When the warning came
  // from the Dashboard (no epi_alerts row) `popupWarning` is null, so this is what
  // shows the CHO that the field work for that warning is on record.
  const popupLoggedWarnings = popupActionKey ? (warnActionsByBarangay[wxKey(popupActionKey)] || []) : [];
  const popupWeather = popupActionKey ? weatherByName[wxKey(popupActionKey)] : null;
  const popupManualEvents = popupActionKey ? (manualBarangayEvents[wxKey(popupActionKey)] || []) : [];

  // Disaster Disease Map: the active hazard types for the inspected barangay.
  const popupHazardTypes = useMemo(() => {
    const set = new Set();
    (popupWeather?.hazards || []).forEach(h => set.add(h));
    popupManualEvents.forEach(ev => set.add(ev.event_type));
    return [...set];
  }, [popupWeather, popupManualEvents]);

  // Probable diseases = the hazard's linked diseases + the in-season diseases for the
  // current month + whatever is already ticking up in this barangay. Reasons are kept
  // so the reader can see why each disease is on the watch list.
  const popupSeason = seasonForMonth(new Date().getMonth());
  const popupProbable = useMemo(() => {
    if (!popup) return [];
    const reasons = {};
    const add = (d, why) => { if (!d) return; if (!reasons[d]) reasons[d] = new Set(); if (why) reasons[d].add(why); };
    popupHazardTypes.forEach(hz => hazardDiseases(hz).forEach(d => add(d, 'Hazard')));
    popupSeason.diseases.forEach(d => add(d, 'Seasonal'));
    Object.entries(popup.diseases || {}).forEach(([d, n]) => { if (n > 0) add(d, 'Current'); });
    return Object.entries(reasons)
      .map(([name, why]) => ({ name, why: [...why], cases: (popup.diseases || {})[name] || 0 }))
      .sort((a, b) => b.why.length - a.why.length || b.cases - a.cases || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [popup, popupHazardTypes, popupSeason]);
  const popupWxRaw = popupActionKey && Array.isArray(weatherHazards)
    ? weatherHazards.find(x => wxKey(x.name) === wxKey(popupActionKey))
    : null;

  // Hazards an action can be linked to. Manual pins only - auto-detected weather
  // hazards have no DB row, so they deliberately cannot be response targets.
  // Scoped to the user's area of responsibility like every other hazard layer.
  const linkableHazards = activeHazardEvents.filter(
    ev => !ev.barangay_id || !hazardScopeKeys.size || hazardScopeKeys.has(wxKey(ev.barangay_name))
  );
  const actionHazardOptions = linkableHazards
    .filter(ev => !actionForm.barangay_id || !ev.barangay_id ||
      String(ev.barangay_id) === String(actionForm.barangay_id))
    .slice()
    .sort((a, b) => String(b.date_started || '').localeCompare(String(a.date_started || '')));

  // Option lists for the inline custom dropdowns in the two CHO manage modals.
  // Same { value, label } shape Manage Cases feeds its .mc-custom-dropdown-* menus.
  const scopedBarangayEntries = Object.entries(barangayIdMap).filter(([_, name]) => (
    actionScopeKeys.size === 0 || actionScopeKeys.has(wxKey(name))
  ));
  const actionBarangayOptions = [
    { value: '', label: t('Citywide') },
    ...scopedBarangayEntries.map(([id, name]) => ({ value: id, label: name })),
  ];
  const actionTypeOptions = ACTION_TYPES.map(x => ({ value: x, label: x }));
  const actionStatusOptions = ACTION_STATUSES.map(s => ({ value: s, label: translateActionStatus(s) }));
  const targetDiseaseOptions = [
    { value: '', label: t('None') },
    ...diseaseOptions.filter(d => d && d !== 'All Diseases').map(d => ({ value: d, label: d })),
  ];
  const hazardLinkOptions = [
    { value: '', label: t('None - proactive action') },
    ...actionHazardOptions.map(ev => ({
      value: String(ev.id),
      label: `${hazardIcon(ev.event_type)} ${ev.event_type} · ${ev.severity}${ev.date_started ? ` · ${ev.date_started}` : ''}`,
    })),
  ];
  const hazardBarangayOptions = [
    { value: '', label: '—' },
    ...scopedBarangayEntries.map(([id, name]) => ({ value: id, label: name })),
  ];
  const hazardTypeOptions = DISASTER_EVENT_TYPES.map(x => ({ value: x, label: `${hazardIcon(x)} ${x}` }));
  const severityOptions = DISASTER_SEVERITIES.map(s => ({ value: s, label: s }));
  // Label for whichever value the actions form currently holds.
  const actionBarangayDisplay = barangayIdMap[actionForm.barangay_id] || t('Citywide');
  const hazardLinkDisplay = (hazardLinkOptions.find(o => String(o.value) === String(actionForm.hazard_id || '')) || {}).label;

  // How many actions across the user's scope point at a given hazard.
  const responseCountFor = (hazardId) => actions.filter(
    a => String(a.hazard_id || '') === String(hazardId) && a.status !== 'completed'
  ).length;

  // Response coverage: of the barangays currently carrying a hazard, how many
  // also have at least one non-completed action logged against that hazard.
  const hazardBarangays = [...new Set(
    (activeHazardEvents || [])
      .filter(ev => ev.barangay_id)
      .map(ev => String(ev.barangay_id))
  )];
  const responseCoveredCount = hazardBarangays.filter(bid =>
    actions.some(a => String(a.barangay_id) === bid && a.hazard_id && a.status !== 'completed')
  ).length;

  // Disease-warning coverage (panelist intervention flow): flagged counts from
  // `/api/epi-alerts` in the user's scope, plus any warning-linked intervention
  // whose warning the Dashboard computed (those have no epi_alerts row, so the
  // intervention itself is the map's only evidence of the warning).
  const warningBarangays = hazardScopeList
    .map(n => alertsByBarangay[wxKey(n)])
    .filter(Boolean)
    .sort((a, b) => (Number(b.alert_value) || 0) - (Number(a.alert_value) || 0));
  const warningItems = (() => {
    const items = warningBarangays.map(alert => {
      const intervention = interventionMatchesWarning(alert);
      return {
        key: 'alert-' + (alert.id != null ? alert.id : `${wxKey(alert.barangay_name)}-${alert.disease_name || ''}`),
        barangay_name: alert.barangay_name,
        disease_name: alert.disease_name,
        alert_value: alert.alert_value,
        alert_type: alert.alert_type,
        answered: !!intervention,
        intervention,
      };
    });
    const inScope = new Set(hazardScopeList.map(wxKey));
    Object.keys(warnActionsByBarangay).forEach(k => {
      if (alertsByBarangay[k]) return; // a live epi_alert already represents this warning
      if (inScope.size && !inScope.has(k)) return;
      const list = warnActionsByBarangay[k].slice().sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
      const latest = list[0];
      const name = latest.barangay_name || latest.alert_barangay || '';
      if (!name) return;
      items.push({
        key: `logged-${k}-${wxKey(latest.target_disease || latest.alert_disease || '')}`,
        barangay_name: name,
        disease_name: latest.target_disease || latest.alert_disease || '',
        alert_value: Number(latest.alert_value) || null,
        alert_type: latest.alert_kind || null,
        answered: true,
        intervention: latest,
        loggedCount: list.length,
      });
    });
    return items.sort((a, b) => (Number(b.alert_value) || 0) - (Number(a.alert_value) || 0));
  })();
  const warningAnsweredCount = warningItems.filter(w => w.answered).length;

  // Historical comparison for the open popup: the same calendar week one year ago
  useEffect(() => {
    if (!popupActionKey) { setHistSummary(null); return; }
    let alive = true;
    const nowDate = new Date();
    const day = nowDate.getDay() === 0 ? 7 : nowDate.getDay();
    const monday = new Date(nowDate); monday.setDate(nowDate.getDate() - (day - 1));
    const startPrev = new Date(monday); startPrev.setDate(monday.getDate() - 7); startPrev.setFullYear(monday.getFullYear() - 1);
    const endPrev = new Date(monday); endPrev.setFullYear(monday.getFullYear() - 1);
    const f = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setHistSummary(null);
    axios.get(API_URL + '/api/weather/historical', { params: { barangay: popupActionKey, from: f(startPrev), to: f(endPrev) } })
      .then(res => {
        if (!alive) return;
        const rows = (res.data && res.data.rows) || [];
        let totalRain = 0, rainy = 0, maxRain = 0;
        rows.forEach(r => {
          if (r.precipitation_sum == null) return;
          const v = Number(r.precipitation_sum);
          totalRain += v;
          if (v > 0) rainy++;
          if (v > maxRain) maxRain = v;
        });
        if (rainy === 0) { setHistSummary({ text: '' }); return; }
        setHistSummary({ text: `Same week last year in ${popupActionKey}: ${rainy} rainy day(s), ~${Math.round(totalRain)}mm · heaviest ${Math.round(maxRain)}mm` });
      })
      .catch(() => { if (alive) setHistSummary({ text: '' }); });
    return () => { alive = false; };
  }, [popupActionKey]);

  const openManageActions = () => {
    const popupId = popupActionKey
      ? (Object.keys(barangayIdMap).find(id => barangayIdMap[id] === popupActionKey) || '')
      : '';
    setActionForm({
      id: null, barangay_id: popupId, barangay_name: popupActionKey,
      hazard_id: '',
      action_type: ACTION_TYPES[0],
      description: '', target_disease: '', date_started: '', date_ended: '', status: 'planned',
    });
    setManageActionsOpen(true);
  };

  const saveAction = async () => {
    setActionsSaving(true);
    const payload = {
      barangay_id: actionForm.barangay_id || null,
      hazard_id: actionForm.hazard_id || null,
      action_type: actionForm.action_type,
      description: actionForm.description,
      target_disease: actionForm.target_disease,
      date_started: actionForm.date_started || null,
      date_ended: actionForm.date_ended || null,
      status: actionForm.status,
    };
    try {
      if (actionForm.id) {
        await axios.put(API_URL + '/api/barangay-actions/' + actionForm.id, payload);
        notify(t('Barangay action updated.'), 'success');
      } else {
        await axios.post(API_URL + '/api/barangay-actions', payload);
        notify(t('Barangay action added.'), 'success');
      }
      const res = await axios.get(API_URL + '/api/barangay-actions');
      setActions(Array.isArray(res.data) ? res.data : []);
      setManageActionsOpen(false);
    } catch (err) {
      notify(err.response?.data?.error || t('Failed to save action.'), 'error');
    } finally {
      setActionsSaving(false);
    }
  };

  const editAction = (a) => {
    setActionForm({
      id: a.id,
      barangay_id: a.barangay_id || '',
      barangay_name: a.barangay_name || '',
      hazard_id: a.hazard_id || '',
      action_type: a.action_type,
      description: a.description || '',
      target_disease: a.target_disease || '',
      date_started: a.date_started || '',
      date_ended: a.date_ended || '',
      status: a.status || 'planned',
    });
  };

  const deleteAction = async (id) => {
    if (!window.confirm(t('Delete this barangay action?'))) return;
    try {
      await axios.delete(API_URL + '/api/barangay-actions/' + id);
      notify(t('Barangay action deleted.'), 'success');
      const res = await axios.get(API_URL + '/api/barangay-actions');
      setActions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      notify(err.response?.data?.error || t('Failed to delete action.'), 'error');
    }
  };

  const openManageHazards = () => {
    const popupId = popupActionKey
      ? (Object.keys(barangayIdMap).find(id => barangayIdMap[id] === popupActionKey) || '')
      : '';
    setHazardForm({
      id: null, barangay_id: popupId, barangay_name: popupActionKey,
      event_type: DISASTER_EVENT_TYPES[0], severity: DISASTER_SEVERITIES[1],
      purok: '', latitude: '', longitude: '', date_started: '', date_ended: '', notes: '',
    });
    setManageHazardsOpen(true);
  };

  const saveHazard = async () => {
    if (!hazardForm.date_started) { notify(t('Start date is required.'), 'error'); return; }
    setHazardsSaving(true);
    const payload = {
      barangay_id: hazardForm.barangay_id || null,
      event_type: hazardForm.event_type,
      severity: hazardForm.severity,
      purok: hazardForm.purok,
      latitude: hazardForm.latitude ? parseFloat(hazardForm.latitude) : null,
      longitude: hazardForm.longitude ? parseFloat(hazardForm.longitude) : null,
      date_started: hazardForm.date_started,
      date_ended: hazardForm.date_ended || null,
      notes: hazardForm.notes,
    };
    try {
      if (hazardForm.id) {
        await axios.put(API_URL + '/api/disaster-events/' + hazardForm.id, payload);
        notify(t('Hazard pin updated.'), 'success');
      } else {
        await axios.post(API_URL + '/api/disaster-events', payload);
        notify(t('Hazard pin added.'), 'success');
      }
      const res = await axios.get(API_URL + '/api/disaster-events');
      setDisasterEvents(Array.isArray(res.data) ? res.data : []);
      setManageHazardsOpen(false);
    } catch (err) {
      notify(err.response?.data?.error || t('Failed to save hazard pin.'), 'error');
    } finally {
      setHazardsSaving(false);
    }
  };

  const deleteHazard = async (id) => {
    if (!window.confirm(t('Delete this hazard pin?'))) return;
    try {
      await axios.delete(API_URL + '/api/disaster-events/' + id);
      notify(t('Hazard pin deleted.'), 'success');
      const res = await axios.get(API_URL + '/api/disaster-events');
      setDisasterEvents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      notify(err.response?.data?.error || t('Failed to delete hazard pin.'), 'error');
    }
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

        {/* ─── PAGASA ADVISORY STRIP (Cabuyao = Southern Luzon / SLPRSD) ─── */}
        {pagasa && (
          <div style={{
            background: 'var(--input-bg)', border: '1px solid var(--border-color)',
            borderRadius: '10px', padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>🇵🇭 PAGASA · {pagasa.region}</span>
              {pagasa.issued && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>· {pagasa.issued}</span>}
            </div>
            {pagasa.advisories && pagasa.advisories.length > 0 ? pagasa.advisories.map((a, i) => (
              <div key={i} style={{
                padding: '6px 10px', borderRadius: '8px', marginBottom: '6px',
                background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)',
                fontSize: '12px', color: 'var(--text-main)', lineHeight: 1.4,
              }}>
                ⚠️ {a}
              </div>
            )) : (
              <div style={{ padding: '6px 10px', borderRadius: '8px', background: 'var(--bg-surface)', fontSize: '12px', color: 'var(--text-muted)' }}>
                {t('No active PAGASA advisory for Southern Luzon')}
              </div>
            )}
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {WEATHER_ATTRIBUTION} · auto-refresh 30s
            </div>
          </div>
        )}

        {/* ─── FILTER LAYER: AREA ─── */}
        <p style={sectionHeaderStyle}>{t('Filter by Area')}</p>

        {/* Barangay - all 18 hardcoded (hidden for BHW) */}
        {loginRole !== 'BHW' && (
          <div>
            <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-main)', marginBottom: '6px', fontWeight: '600' }}>{t('Barangay')}</label>
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
            <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-main)', marginBottom: '6px', fontWeight: '600' }}>{t('Barangay')}</label>
            <div style={{ padding: '9px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '7px', color: 'var(--text-main)', fontSize: '15px' }}>
              {loginBarangay}
            </div>
          </div>
        )}

        {/* Purok / Blk / Phase */}
        <div>
          <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-main)', marginBottom: '6px', fontWeight: '600' }}>{t('Purok / Blk / Phase')}</label>
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
          <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-main)', marginBottom: '6px', fontWeight: '600' }}>{t('Disease')}</label>
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

        {/* ─── FILTER LAYER: CONTRIBUTING FACTOR ─── */}
        <p style={sectionHeaderStyle}>{t('Filter by Contributing Factor')}</p>

        {/* Risk factor */}
        <div>
          <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-main)', marginBottom: '6px', fontWeight: '600' }}>{t('Contributing Factor')}</label>
          <div style={{ position: 'relative' }} ref={riskFactorRef}>
            <button type="button" onClick={() => setRiskFactorOpen(!riskFactorOpen)}
              style={{ ...SEL, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filterRiskFactor === 'All Factors' ? t(filterRiskFactor) : riskFactorLabel(filterRiskFactor)}</span>
              <span style={{ fontSize: '13px', opacity: 0.6, transition: 'transform 0.2s', transform: riskFactorOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            </button>
            {riskFactorOpen && (
              <div className="cdms-dropdown-panel" style={{ position: 'absolute', top: '105%', left: 0, width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 100, overflow: 'hidden', maxHeight: '260px', overflowY: 'auto' }}>
                <button type="button"
                  onClick={() => { setFilterRiskFactor('All Factors'); setRiskFactorOpen(false); }}
                  style={{ display: 'block', width: '100%', padding: '10px 14px', background: filterRiskFactor === 'All Factors' ? 'var(--input-bg)' : 'transparent', border: 'none', textAlign: 'left', fontSize: '15px', color: 'var(--text-main)', cursor: 'pointer', fontWeight: filterRiskFactor === 'All Factors' ? '600' : '400' }}
                  onMouseEnter={e => { if (filterRiskFactor !== 'All Factors') e.currentTarget.style.background = 'var(--input-bg)'; }}
                  onMouseLeave={e => { if (filterRiskFactor !== 'All Factors') e.currentTarget.style.background = 'transparent'; }}>
                  {t('All Factors')}
                </button>
                {RISK_FACTOR_GROUPS.map(g => (
                  <div key={g.id} style={{ padding: '4px 14px 0', marginTop: '4px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: g.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                      {g.icon} {t(g.label)}
                    </div>
                    {g.factors.map(f => (
                      <button key={f.key} type="button"
                        onClick={() => { setFilterRiskFactor(f.key); setRiskFactorOpen(false); }}
                        style={{ display: 'block', width: '100%', padding: '9px 14px', background: filterRiskFactor === f.key ? 'var(--input-bg)' : 'transparent', border: 'none', textAlign: 'left', fontSize: '14px', color: 'var(--text-main)', cursor: 'pointer', fontWeight: filterRiskFactor === f.key ? '600' : '400', borderRadius: '6px' }}
                        onMouseEnter={e => { if (filterRiskFactor !== f.key) e.currentTarget.style.background = 'var(--input-bg)'; }}
                        onMouseLeave={e => { if (filterRiskFactor !== f.key) e.currentTarget.style.background = 'transparent'; }}>
                        {riskFactorLabel(f.key)}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── FILTER LAYER: STATUS ─── */}
        <p style={sectionHeaderStyle}>{t('Filter by Status')}</p>

        {/* Status */}
        <div>
          <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-main)', marginBottom: '6px', fontWeight: '600' }}>{t('Status')}</label>
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

        {/* ─── FILTER LAYER: CASE TYPE ─── */}
        <p style={sectionHeaderStyle}>{t('Filter by Case Type')}</p>

        {/* Case Type */}
        <div>
          <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-main)', marginBottom: '6px', fontWeight: '600' }}>{t('Case Type')}</label>
          <div style={{ position: 'relative' }} ref={caseTypeRef}>
            <button type="button" onClick={() => setCaseTypeOpen(!caseTypeOpen)}
              style={{ ...SEL, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
              <span>{t(filterCaseType)}</span>
              <span style={{ fontSize: '13px', opacity: 0.6, transition: 'transform 0.2s', transform: caseTypeOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            </button>
            {caseTypeOpen && (
              <div className="cdms-dropdown-panel" style={{ position: 'absolute', top: '105%', left: 0, width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 100, overflow: 'hidden' }}>
                {['All Case Types', 'Suspected', 'Probable', 'Confirmed'].map(ct => (
                  <button key={ct} type="button"
                    onClick={() => { setFilterCaseType(ct); setCaseTypeOpen(false); }}
                    style={{ display: 'block', width: '100%', padding: '10px 14px', background: filterCaseType === ct ? 'var(--input-bg)' : 'transparent', border: 'none', textAlign: 'left', fontSize: '15px', color: 'var(--text-main)', cursor: 'pointer', fontWeight: filterCaseType === ct ? '600' : '400' }}
                    onMouseEnter={e => { if (filterCaseType !== ct) e.target.style.background = 'var(--input-bg)'; }}
                    onMouseLeave={e => { if (filterCaseType !== ct) e.target.style.background = 'transparent'; }}>
                    {t(ct)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── FILTER LAYER: DATE ─── */}
        <p style={sectionHeaderStyle}>{t('Filter by Date')}</p>

        {/* Filter Year - quick year presets */}
        <div style={{ position: 'relative', marginBottom: '10px' }} ref={yearRef}>
          <button type="button" onClick={() => setYearOpen(!yearOpen)}
            style={{ ...SEL, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
            <span>{filterYear || t('From / To dates')}</span>
            <span style={{ fontSize: '13px', opacity: 0.6, transition: 'transform 0.2s', transform: yearOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
          </button>
          {yearOpen && (
            <div className="cdms-dropdown-panel" style={{ position: 'absolute', top: '105%', left: 0, width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 100, overflow: 'hidden' }}>
              {yearOptions.map(y => (
                <button key={y} type="button"
                  onClick={() => { setFilterYear(y); setFilterDateFrom(`${y}-01-01`); setFilterDateTo(`${y}-12-31`); setYearOpen(false); }}
                  style={{ display: 'block', width: '100%', padding: '10px 14px', background: filterYear === y ? 'var(--input-bg)' : 'transparent', border: 'none', textAlign: 'left', fontSize: '15px', color: 'var(--text-main)', cursor: 'pointer', fontWeight: filterYear === y ? '600' : '400' }}
                  onMouseEnter={e => { if (filterYear !== y) e.target.style.background = 'var(--input-bg)'; }}
                  onMouseLeave={e => { if (filterYear !== y) e.target.style.background = 'transparent'; }}>
                  {t(y)}
                </button>
              ))}
              <div style={{ height: '1px', margin: '4px 12px', background: 'var(--border-color)' }} />
              <button type="button"
                onClick={() => { setFilterYear(''); setYearOpen(false); }}
                style={{ display: 'block', width: '100%', padding: '10px 14px', background: filterYear === '' ? 'var(--input-bg)' : 'transparent', border: 'none', textAlign: 'left', fontSize: '15px', color: 'var(--text-main)', cursor: 'pointer', fontWeight: filterYear === '' ? '600' : '400' }}
                onMouseEnter={e => { if (filterYear !== '') e.target.style.background = 'var(--input-bg)'; }}
                onMouseLeave={e => { if (filterYear !== '') e.target.style.background = 'transparent'; }}>
                {t('From / To dates')}
              </button>
            </div>
          )}
        </div>

        {/* Date range - From / To */}
        <div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-main)', marginBottom: '6px', fontWeight: '600' }}>{t('From')}</label>
              <DatePicker value={filterDateFrom} dateFormat={dateFormat} placeholder={t('Start date')} clearable={true}
                onChange={v => { setFilterDateFrom(v); setFilterYear(''); }}
                style={{ width: '100%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-main)', marginBottom: '6px', fontWeight: '600' }}>{t('To')}</label>
              <DatePicker value={filterDateTo} dateFormat={dateFormat} placeholder={t('End date')} clearable={true} anchorRight={true}
                onChange={v => { setFilterDateTo(v); setFilterYear(''); }}
                style={{ width: '100%' }} />
            </div>
          </div>
        </div>

        {/* Severity - includes Asymptomatic */}
        <div>
          <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-main)', marginBottom: '6px', fontWeight: '600' }}>{t('Severity')}</label>
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
            { color: '#7F1D1D', label: 'Critical Risk (60+ cases)' },
            { color: '#B91C1C', label: 'Very High Risk (40-59 cases)' },
            { color: '#DC2626', label: 'High Risk (20-39 cases)' },
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
            {!isDisasterMap && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '8px' }}>
                <span style={{ width: '13px', height: '13px', borderRadius: '50%', background: '#dc2626', border: '2px solid var(--bg-surface)', flexShrink: 0, display: 'inline-block', textAlign: 'center', lineHeight: '9px', fontSize: '8px' }}>🚨</span>
                <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{t('Rapid outbreak - a disease count jumped in under 5 days')}</span>
              </div>
            )}
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
              { label: 'Critical', count: criticalCount, color: '#7F1D1D' },
              { label: 'Very High', count: veryHighCount, color: '#B91C1C' },
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
            {t('Risk from the current filter scope. Thresholds: 20-39 red, 40-59 dark red, 60+ critical, 10-19 amber, <10 green.')}
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

        {/* Zone Hotspots - Phase 1 purok-level exposure overlay (hotspot map only) */}
        {!isDisasterMap && (
          <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('Zone Hotspots')}</p>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={showZones} onChange={e => setShowZones(e.target.checked)} style={{ cursor: 'pointer' }} />
                {t('Show')}
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                {t('Sensitivity')}
                <select value={zoneSensitivity} onChange={e => changeZoneSensitivity(e.target.value)} disabled={!showZones}
                  style={{ background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '3px 6px', fontSize: '12px', cursor: showZones ? 'pointer' : 'default' }}>
                  <option value="sensitive">{t('Sensitive')}</option>
                  <option value="standard">{t('Standard')}</option>
                  <option value="strict">{t('Strict')}</option>
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', cursor: showZones ? 'pointer' : 'default', marginLeft: 'auto' }}>
                <input type="checkbox" checked={showAllZoneCells} disabled={!showZones} onChange={e => setShowAllZoneCells(e.target.checked)} style={{ cursor: showZones ? 'pointer' : 'default' }} />
                {realBoundaryBarangays > 0 ? t('Show all boundaries') : t('Show all cells')}
              </label>
            </div>

            {!showZones ? (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                {t('Zone shading is hidden.')}
              </p>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  {[
                    { key: 'watch', label: ZONE_KINDS.watch.label, icon: ZONE_KINDS.watch.icon, color: ZONE_KINDS.watch.color },
                    { key: 'exposure', label: ZONE_KINDS.exposure.label, icon: ZONE_KINDS.exposure.icon, color: ZONE_KINDS.exposure.color },
                    { key: 'case', label: ZONE_KINDS.case.label, icon: ZONE_KINDS.case.icon, color: ZONE_KINDS.case.color },
                    { key: 'weather', label: ZONE_KINDS.weather.label, icon: ZONE_KINDS.weather.icon, color: ZONE_KINDS.weather.color },
                  ].map(({ key, label, icon, color }) => (
                    <div key={key} style={{ background: 'var(--input-bg)', borderRadius: '8px', padding: '9px 6px', textAlign: 'center', border: `1px solid ${color}33` }}>
                      <div style={{ fontSize: '20px', fontWeight: '800', color }}>{zoneCounts[key] || 0}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.2 }}>{icon} {t(label)}</div>
                    </div>
                  ))}
                </div>

                {zoneHotspots.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                    {t('No zone has crossed a case or flooding threshold in this scope.')}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {zoneHotspots.slice(0, 8).map(row => (
                      <button key={row.id} onClick={() => setZonePopup(row)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left',
                          padding: '7px 9px', borderRadius: '8px', cursor: 'pointer',
                          background: 'var(--input-bg)', border: `1px solid ${row.kindMeta.color}55`,
                        }}>
                        <span style={{ fontSize: '14px' }}>{row.kindMeta.icon}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row.barangay} · {row.label}{row.units.length === 1 && row.units[0] !== 'Unspecified' ? ` · ${row.units[0]}` : ''}
                          </span>
                          <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row.rapid && row.rapidDiseases.length > 0
                              ? `🚨 ${row.rapidDiseases[0].disease} · ${row.rapidDiseases[0].cases5} ${t('cases in the last 5 days')}`
                              : row.disease ? `${row.disease} · ${row.cases7}` : t('No cases flagged')}
                          </span>
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: row.kindMeta.color }}>{row.score}</span>
                      </button>
                    ))}
                    {zoneHotspots.length > 8 && (
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                        +{zoneHotspots.length - 8} {t('more in this scope')}
                      </p>
                    )}
                  </div>
                )}

                <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {realBoundaryBarangays > 0
                    ? t('Zones use the real purok boundaries supplied by the City where available, and the purok-level grid cell otherwise. A zone is watched for exposure when its own 24h/72h rain or an active flood pin reaches it, and flagged when cases cross the 7-day threshold.')
                    : t('Zones are the purok-level grid cell each case already snaps to. A zone is watched for exposure when 24h/72h rain or an active flood pin reaches it, and flagged when cases cross the 7-day threshold.')}
                </p>
                {realBoundaryBarangays > 0 && (
                  <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    {realBoundaryBarangays} {t('barangay(s) in this scope use real purok boundaries.')}
                  </p>
                )}
                <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {t('Zoom in to see a zone, then zoom in again to break it down into the puroks/blocks inside it.')}
                </p>
                <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {t('Sensitivity sets the case and rain thresholds. Near Threshold marks a zone that is climbing but still below the hotspot gate.')}
                </p>
              </>
            )}
          </div>
        )}

        {/* Hazard Response Coverage - are we answering the hazards we logged? */}
        <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('Hazard Response')}</p>
          {hazardBarangays.length === 0 ? (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>{t('No active hazard pins in this scope.')}</p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '6px' }}>
                <span style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main)' }}>{responseCoveredCount}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('of')}{` ${hazardBarangays.length} ${t('affected barangays')}`}</span>
              </div>
              <div style={{ height: '7px', background: 'var(--input-bg)', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{
                  width: `${hazardBarangays.length ? Math.round((responseCoveredCount / hazardBarangays.length) * 100) : 0}%`,
                  height: '100%',
                  background: responseCoveredCount === hazardBarangays.length ? '#10b981' : responseCoveredCount > 0 ? '#f59e0b' : '#dc2626',
                  borderRadius: '4px',
                }} />
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                {responseCoveredCount === 0
                  ? t('Affected barangays with no response logged yet.')
                  : t('Affected barangays with at least one active response logged.')}
              </p>
            </>
          )}
        </div>

        {/* Disease Warning Interventions - flagged counts (panelist requirement)
            and whether an intervention with remarks has answered each one. The
            checkbox filters the map down to the interventions themselves. */}
        <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('Disease Warning Interventions')}</p>
          {interventionsOnly ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '6px' }}>
                <span style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main)' }}>{interventionRows.length}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('interventions logged')}</span>
              </div>
              {interventionRows.length === 0 ? (
                <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--text-muted)' }}>{t('No interventions logged in this scope yet.')}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                  {interventionRows.slice(0, 8).map(({ a, name }) => {
                    const color = INTERVENTION_STATUS_COLORS[a.status] || INTERVENTION_STATUS_COLORS.planned;
                    const disease = a.target_disease || a.alert_disease || '';
                    return (
                      <button key={a.id} onClick={() => openBarangayPopup(name)}
                        title={`${a.action_type} · ${name}${disease ? ` · ${disease}` : ''}${a.description ? ` — ${a.description}` : ''}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 9px', borderRadius: '7px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}>
                        <span>{ACTION_TYPE_ICONS[a.action_type] || '🗂'}</span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(a.action_type)} · {name}{disease ? ` · ${disease}` : ''}</span>
                        <span style={{ fontSize: '11px', fontWeight: '700', color, flexShrink: 0 }}>{translateActionStatus(a.status)}</span>
                      </button>
                    );
                  })}
                  {interventionRows.length > 8 && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>+{interventionRows.length - 8}</span>
                  )}
                </div>
              )}
              <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                {t('Pins are at barangay level (approximate position). Citywide interventions have no pin - they have no single location.')}
              </p>
            </>
          ) : warningItems.length === 0 ? (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>{t('No flagged disease counts in this scope.')}</p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '6px' }}>
                <span style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main)' }}>{warningAnsweredCount}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('of')}{` ${warningItems.length} `}{t('warnings answered')}</span>
              </div>
              <div style={{ height: '7px', background: 'var(--input-bg)', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{
                  width: `${warningItems.length ? Math.round((warningAnsweredCount / warningItems.length) * 100) : 0}%`,
                  height: '100%',
                  background: warningAnsweredCount === warningItems.length ? '#10b981' : warningAnsweredCount > 0 ? '#f59e0b' : '#dc2626',
                  borderRadius: '4px',
                }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                {warningItems.slice(0, 6).map(w => (
                  <button key={w.key} onClick={() => openBarangayPopup(w.barangay_name)}
                    title={`${w.barangay_name} · ${w.disease_name || t('Disease warning')}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 9px', borderRadius: '7px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}>
                    <span>{w.answered ? '✔' : '⚠️'}</span>
                    <span style={{ flex: 1, fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.barangay_name} · {w.disease_name || t(ALERT_KIND_LABELS[w.alert_type] || 'Disease warning')}</span>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: w.answered ? '#10b981' : '#D97706' }}>{w.alert_value != null ? w.alert_value : '✔'}</span>
                  </button>
                ))}
              </div>
              <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                {warningAnsweredCount === 0
                  ? t('Flagged barangays with no intervention logged yet.')
                  : t('Flagged barangays with at least one intervention logged.')}
              </p>
            </>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-main)', cursor: 'pointer' }}>
            <input type="checkbox" checked={interventionsOnly} onChange={e => setInterventionsOnly(e.target.checked)}
              style={{ width: '15px', height: '15px', accentColor: '#0891b2' }} />
            {t('Show interventions only')}
          </label>
        </div>

        <button
          onClick={() => { setAutoDetectedBrgy(null); setFilterBarangay('All Barangays'); setFilterStatus('All Status'); setFilterCaseType('All Case Types'); setFilterDateFrom(`${currentYear}-01-01`); setFilterDateTo(`${currentYear}-12-31`); setFilterYear(String(currentYear)); setFilterSeverity('All Severities'); setFilterDisease('All Diseases'); setFilterPurok('All Puroks'); }}
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
        <button
          className="cdms-map-filter-btn"
          onClick={handleCacheOffline}
          disabled={tileCache.running}
          title={t('Downloads map tiles for your area so they work offline (zooms 12-17).')}
          style={{
            position: 'absolute', top: '58px', left: '12px', zIndex: 1000,
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '9px 14px', borderRadius: '8px', cursor: 'pointer',
            background: tileCache.running ? 'var(--input-bg)' : 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            fontSize: '14px', fontWeight: '600', color: 'var(--text-main)',
          }}
        >
          {tileCache.running ? (
            <>⬇ {t('Caching')}… {Math.round((tileCache.done / Math.max(1, tileCache.total)) * 100)}%</>
          ) : (
            <>⬇ {t('Cache map offline')}</>
          )}
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
          {/* "Show interventions only" is a real layer filter: case pins, warning
              badges and hazards are hidden so the map shows the intervention pins
              themselves (barangay outlines stay for orientation). */}
          {!interventionsOnly && mapZoom === 19 && <CaseDotMarkers key="case-dot-markers" cases={mapCases} zoom={mapZoom} t={t} translateStatus={translateStatus} />}
          {!interventionsOnly && mapZoom === 18 && purokData.length > 0 && zoneBreakdownItems.length === 0 && (
            <PulseMarkers key="unit-pins" barangayData={purokData} onHover={setTooltip} onLeave={() => setTooltip(null)} onClick={setPopup} />
          )}
          {!interventionsOnly && mapZoom === 17 && purokData.length > 0 && pinnedBarangay && (
            <AreaPins key="area-pins" groups={purokData} barangay={pinnedBarangay} onHover={setTooltip} onLeave={() => setTooltip(null)} onClick={setPopup} />
          )}
          {!interventionsOnly && mapZoom < 17 && <BarangayPins key="barangay-pins" barangayData={barangayData} onHover={setTooltip} onLeave={() => setTooltip(null)} onClick={setPopup} loginRole={loginRole} />}
          {!interventionsOnly && <LayerBadgeMarkers key="layer-outbreaks" items={outbreakPinItems} />}
          {isDisasterMap && showActionsLayer && !interventionsOnly && <LayerBadgeMarkers key="layer-actions" items={actionBadgeItems} />}
          {isDisasterMap && !interventionsOnly && <LayerBadgeMarkers key="layer-warnings" items={warningBadgeItems} />}
          {/* "Show interventions only" is an isolation mode: the weather/hazard
              pins are hidden too so the map shows nothing but the intervention
              discs (barangay outlines stay for orientation). */}
          {isDisasterMap && showDisasterLayer && !interventionsOnly && mapZoom < 17 && <LayerBadgeMarkers key="layer-hazards-badges" items={hazardBadgeItems} />}
          {isDisasterMap && showDisasterLayer && !interventionsOnly && mapZoom >= 17 && <LayerBadgeMarkers key="layer-hazards-pins" items={hazardPinItems} />}
          {interventionsOnly && <LayerBadgeMarkers key="layer-interventions" items={interventionPinItems} />}
          {zoneBreakdownItems.length > 0 && <ZoneBreakdownMarkers key="zone-breakdown" items={zoneBreakdownItems} />}
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
                if (loginRole !== 'BHW') {
                  layer.bindTooltip(html, {
                    permanent: true,
                    direction: 'center',
                    className: 'brgy-tooltip-label',
                    offset: LABEL_OFFSETS[barangayName] || [0, 0],
                    interactive: false,
                  });
                  const anchor = getLabelPoint(feature.geometry);
                  if (anchor) layer.getTooltip().setLatLng(anchor);
                }
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
          {/* "Show all cells" grid: every 6-cell zone outline of the scoped
              barangays, flagged or not, so the zone proxy is visible. Drawn
              under the flagged zones (Leaflet paints in mount order). */}
          {!isDisasterMap && showZones && showAllZoneCells && allZoneCellsFC.features.length > 0 && (
            <GeoJSON key="zone-grid" data={allZoneCellsFC} style={getGridStyle} interactive={false} />
          )}
          {/* Phase 1 zone (purok-level) overlay - drawn last so its shading sits
              above the barangay choropleth. It carries the flagged zones' colour;
              the choropleth keeps its own case-count fill (see getGeoJsonStyle),
              which drops to outline only when a single barangay is focused or for
              a BHW. Pins live in Leaflet's marker pane, so they stay on top of
              the shaded zones automatically. */}
          {!isDisasterMap && showZones && zoneHotspots.length > 0 && (
            <GeoJSON
              key={`zone-hotspots-${mapZoom >= ZONE_BREAKDOWN_ZOOM ? 'bd' : 'zone'}-${zoneHotspots.map(r => `${r.id}:${r.kind}`).join(',')}`}
              data={zoneFeatureCollection}
              style={(feature) => getZoneStyle(feature, mapZoom)}
              onEachFeature={onEachZone}
            />
          )}
        </MapContainer>

        {/* DISASTER vs HOTSPOT MAP MODE (replaces the old Actions / Hazards toggles) */}
        <div style={{
          position: 'absolute', bottom: '64px', left: '16px', zIndex: 1000,
          display: 'flex', gap: '4px', padding: '4px',
          background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
          borderRadius: '10px', boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
        }}>
          <button onClick={() => setMapMode('disaster')}
            title={t('Hazards, barangay actions and probable disease watch')}
            style={{
              padding: '6px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer',
              fontSize: '13px', fontWeight: '700',
              background: isDisasterMap ? '#2563eb' : 'transparent',
              color: isDisasterMap ? '#fff' : 'var(--text-muted)',
            }}>
            🌦 {t('Disaster Disease Map')}
          </button>
          <button onClick={() => setMapMode('hotspot')}
            title={t('Case density hotspots by disease and barangay')}
            style={{
              padding: '6px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer',
              fontSize: '13px', fontWeight: '700',
              background: !isDisasterMap ? '#dc2626' : 'transparent',
              color: !isDisasterMap ? '#fff' : 'var(--text-muted)',
            }}>
            🔥 {t('Hotspot Disease Map')}
          </button>
        </div>

        {/* Weather attribution (Open-Meteo, CC BY 4.0) when the hazard layer is on */}
        {isDisasterMap && showDisasterLayer && !interventionsOnly && (
          <div style={{
            position: 'absolute', bottom: '118px', left: '16px', zIndex: 1000,
            fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)', borderRadius: '6px', padding: '2px 8px',
          }}>
            {WEATHER_ATTRIBUTION}
          </div>
        )}

        {/* ─── PHILIPPINE SEASONS (PAGASA) - ON THE HOTSPOT DISEASE MAP ───
            Deliberately NOT in the Filters panel: it appears on the map itself when
            the user switches to the Hotspot Disease Map, naming the tropical season
            Cabuyao is in right now and the months each one covers. `bottom: 118px`
            is the slot the weather attribution vacates in hotspot mode. */}
        {!isDisasterMap && (
          <div style={{
            position: 'absolute', bottom: '118px', left: '16px', zIndex: 1000,
            width: '272px', maxWidth: 'calc(100vw - 32px)',
            background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
            borderRadius: '10px', padding: '10px 12px', boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '6px' }}>
              <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>🇵🇭 {t('Philippine Seasons')}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>PAGASA</span>
            </div>
            {PH_SEASONS.map(s => {
              const isNow = s.months.includes(new Date().getMonth());
              return (
                <div key={s.key} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 9px', borderRadius: '8px', marginBottom: '4px',
                  background: isNow ? `${s.color}22` : 'var(--input-bg)',
                  border: `1px solid ${isNow ? s.color : 'var(--border-color)'}`,
                }}>
                  <span style={{ fontSize: '14px', flexShrink: 0 }}>{s.icon}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: isNow ? '700' : '600', color: 'var(--text-main)' }}>{t(s.label)}</span>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t(s.monthsLabel)}</span>
                  {isNow && <span style={{ fontSize: '10px', fontWeight: '800', color: s.color, flexShrink: 0 }}>{t('now')}</span>}
                </div>
              );
            })}
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
              {t('Cabuyao, Laguna follows the PAGASA tropical seasons: rainy June to November, cool dry December to February, hot dry (summer) March to May.')}
            </div>
          </div>
        )}

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

        {/* ZOOM LEVEL INDICATOR */}
        {mapZoom === 18 && (
          <div style={{
            position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
            zIndex: 1000, padding: '6px 12px', borderRadius: '8px',
            background: 'rgba(0,14,203,0.15)', border: '1px solid rgba(0,14,203,0.3)',
            fontSize: '12px', fontWeight: '600', color: 'var(--brand-text)',
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
                          <span style={{ fontSize: '13px', background: 'var(--primary-900, #000768)', color: 'white', padding: '2px 6px', borderRadius: '10px', fontWeight: '700', flexShrink: 0 }}>
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

              <EpiPanel cases={popup.cases} t={t} />

              {/* Rapid outbreak (<5 days) for this barangay. Red so it reads as the
                  most urgent thing in the popup; the pin on the map led here. */}
              {popupOutbreak && (
                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    🚨 {t('Rapid Outbreak')}
                  </p>
                  <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.5)' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>
                      🚨 {popupOutbreak.disease_name} · {popupOutbreak.alert_value} {t('cases in the last 5 days')}
                    </div>
                    {popupOutbreak.detail ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>{popupOutbreak.detail}</div>
                    ) : null}
                    {popupOutbreakIntervention ? (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#10b981', fontWeight: '700' }}>
                        ✔ {t('Intervention logged')}: {ACTION_TYPE_ICONS[popupOutbreakIntervention.action_type] || '🗂'} {t(popupOutbreakIntervention.action_type)} · {translateActionStatus(popupOutbreakIntervention.status)}
                        {popupOutbreakIntervention.description ? (
                          <div style={{ marginTop: '3px', color: 'var(--text-muted)', fontWeight: '400', fontStyle: 'italic' }}>“{popupOutbreakIntervention.description}”</div>
                        ) : null}
                      </div>
                    ) : (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#dc2626', fontWeight: '700' }}>
                        ⚠ {t('No intervention recorded for this outbreak yet')}
                      </div>
                    )}
                    {loginRole === 'CHO' && (
                      <button onClick={() => openWarningIntervention(popupOutbreak)}
                        style={{ marginTop: '10px', padding: '6px 14px', borderRadius: '7px', border: '1px solid #129968', background: 'transparent', color: '#129968', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
                        ＋ {popupOutbreakIntervention ? t('Add Intervention') : t('Log Intervention')}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Disease warning for this barangay + its intervention (required
                  remarks). CHO logs one straight from the map popup. */}
              {popupWarning && (
                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('Disease Warning')}
                  </p>
                  <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(217,119,6,0.12)', border: '1px solid rgba(217,119,6,0.45)' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>
                      ⚠️ {popupWarning.disease_name} · {popupWarning.alert_value} {popupWarning.alert_value === 1 ? t('case') : t('cases')}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {t(ALERT_KIND_LABELS[popupWarning.alert_type] || 'Disease warning')}
                      {popupWarning.period_start ? ` · ${t('week of')} ${formatDateStr(popupWarning.period_start, dateFormat)}` : ''}
                    </div>
                    {popupWarningIntervention ? (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#10b981', fontWeight: '700' }}>
                        ✔ {t('Intervention logged')}: {ACTION_TYPE_ICONS[popupWarningIntervention.action_type] || '🗂'} {t(popupWarningIntervention.action_type)} · {translateActionStatus(popupWarningIntervention.status)}
                        {popupWarningIntervention.description ? (
                          <div style={{ marginTop: '3px', color: 'var(--text-muted)', fontWeight: '400', fontStyle: 'italic' }}>“{popupWarningIntervention.description}”</div>
                        ) : null}
                      </div>
                    ) : (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#D97706', fontWeight: '700' }}>
                        ⚠ {t('No intervention recorded for this warning yet')}
                      </div>
                    )}
                    {loginRole === 'CHO' && (
                      <button onClick={() => openWarningIntervention(popupWarning)}
                        style={{ marginTop: '10px', padding: '6px 14px', borderRadius: '7px', border: '1px solid #129968', background: 'transparent', color: '#129968', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
                        ＋ {popupWarningIntervention ? t('Add Intervention') : t('Log Intervention')}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* A warning the Dashboard computed has no epi_alerts row, so there is
                  nothing for the banner above to render. The logged intervention is
                  the record of that warning on the map. */}
              {!popupWarning && !popupOutbreak && popupLoggedWarnings.length > 0 && (
                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('Disease Warning Interventions')}
                  </p>
                  {popupLoggedWarnings.slice(0, 3).map(a => (
                    <div key={a.id} style={{ padding: '10px 12px', marginBottom: '7px', borderRadius: '8px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.45)' }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#10b981' }}>
                        ✔ {t('Intervention logged')}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '2px' }}>
                        {ACTION_TYPE_ICONS[a.action_type] || '🗂'} {t(a.action_type)}
                        {a.target_disease ? ` · ${a.target_disease}` : ''}
                        {a.status ? ` · ${translateActionStatus(a.status)}` : ''}
                      </div>
                      {a.description ? (
                        <div style={{ marginTop: '3px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>“{a.description}”</div>
                      ) : null}
                    </div>
                  ))}
                  {popupLoggedWarnings.length > 3 && (
                    <p style={{ margin: '0', fontSize: '12px', color: 'var(--text-muted)' }}>+{popupLoggedWarnings.length - 3}</p>
                  )}
                </div>
              )}

              {popupActionsList.length > 0 && (
                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('Barangay Actions')}
                  </p>
                  {popupActionsList.map(a => (
                    <div key={a.id} style={{
                      display: 'flex', alignItems: 'center', gap: '9px',
                      padding: '9px 12px', marginBottom: '7px', borderRadius: '8px',
                      background: 'var(--input-bg)', borderLeft: '3px solid #0891b2',
                    }}>
                      <span style={{ fontSize: '17px', flexShrink: 0 }}>{ACTION_TYPE_ICONS[a.action_type] || '📋'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>
                          {t(a.action_type)}{a.target_disease ? ` · ${a.target_disease}` : ''}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {a.description || ''}{a.date_started ? ` · from ${a.date_started}` : ''}
                        </div>
                        {isWarningIntervention(a) && (
                          <div style={{ fontSize: '12px', color: '#D97706', fontWeight: '600', marginTop: '2px' }}>
                            ⚠ {t('Answers')}: {a.alert_disease || a.target_disease || t('Disease warning')}
                            {a.alert_value ? ` (${a.alert_value} ${t('cases')})` : ''}
                          </div>
                        )}
                        {a.hazard_type && (
                          <div style={{ fontSize: '12px', color: 'var(--text-main)', opacity: 0.85, marginTop: '2px' }}>
                            ↳ {t('Responding to')} {hazardIcon(a.hazard_type)} {t(a.hazard_type)}
                          </div>
                        )}
                      </div>
                      <span style={{
                        flexShrink: 0, fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '10px',
                        background: a.status === 'completed' ? 'rgba(16,185,129,0.15)' : a.status === 'ongoing' ? 'rgba(8,145,178,0.15)' : 'rgba(245,158,11,0.15)',
                        color: a.status === 'completed' ? '#10b981' : a.status === 'ongoing' ? '#0891b2' : '#d97706',
                        textTransform: 'capitalize',
                      }}>
                        {translateActionStatus(a.status)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {isDisasterMap && popupWeather && popupWeather.hazards.length > 0 && (
                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    🌦 {t('Weather & Hazards')}
                  </p>
                  {popupWeather.hazards.map(hz => {
                    const dis = hazardDiseases(hz);
                    return (
                      <div key={hz} style={{
                        display: 'flex', alignItems: 'center', gap: '9px',
                        padding: '9px 12px', marginBottom: '7px', borderRadius: '8px',
                        background: 'var(--input-bg)', borderLeft: `3px solid ${hazardColor(hz)}`,
                      }}>
                        <span style={{ fontSize: '17px', flexShrink: 0 }}>{hazardIcon(hz)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>{hz}</div>
                          {dis.length > 0 && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {t('Possible diseases')}: {dis.map(dn => {
                                const cnt = (popup.diseases || {})[dn] || 0;
                                return `${dn}${cnt ? ` (${cnt} ${t('cases')})` : ''}`;
                              }).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '4px' }}>
                    {popupWeather.temperature != null ? `${popupWeather.temperature}°C` : ''}
                    {popupWeather.temperature != null && popupWeather.precipitation != null ? ' · ' : ''}
                    {popupWeather.precipitation != null ? `${popupWeather.precipitation} mm rain` : ''}
                    {popupWeather.temperature != null || popupWeather.precipitation != null ? ' · ' : ''}{WEATHER_ATTRIBUTION}
                  </div>
                </div>
              )}

              {isDisasterMap && popupProbable.length > 0 && (
                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    🧬 {t('Probable Diseases')}
                  </p>
                  <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {popupHazardTypes.length > 0 ? `${popupHazardTypes.join(', ')} · ` : ''}{popupSeason.label}
                  </p>
                  {popupProbable.map(p => (
                    <div key={p.name} style={{
                      display: 'flex', alignItems: 'center', gap: '9px',
                      padding: '9px 12px', marginBottom: '7px', borderRadius: '8px',
                      background: 'var(--input-bg)', borderLeft: '3px solid #7c3aed',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>{p.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {p.why.map(w => t(w)).join(' · ')}
                        </div>
                      </div>
                      <span style={{
                        flexShrink: 0, fontSize: '12px', fontWeight: '700', padding: '3px 9px', borderRadius: '10px',
                        background: p.cases > 0 ? 'rgba(220,38,38,0.15)' : 'var(--bg-surface)',
                        color: p.cases > 0 ? '#dc2626' : 'var(--text-muted)',
                      }}>
                        {p.cases > 0 ? `${p.cases} ${t('cases')}` : t('none yet')}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {isDisasterMap && popupManualEvents.length > 0 && (
                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('Active Hazard Pins')}
                  </p>
                  {popupManualEvents.map(ev => {
                    const responding = responseCountFor(ev.id);
                    return (
                    <div key={ev.id} style={{
                      display: 'flex', alignItems: 'center', gap: '9px',
                      padding: '9px 12px', marginBottom: '7px', borderRadius: '8px',
                      background: 'var(--input-bg)', borderLeft: `3px solid ${hazardColor(ev.event_type)}`,
                    }}>
                      <span style={{ fontSize: '17px', flexShrink: 0 }}>{hazardIcon(ev.event_type)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>
                          {ev.event_type}{ev.purok ? ` · ${ev.purok}` : ''}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {ev.severity} · {t('since')} {ev.date_started}{ev.date_ended ? ` · ${t('until')} ${ev.date_ended}` : ''}{ev.notes ? ` · ${ev.notes}` : ''}
                        </div>
                        <div style={{ fontSize: '12px', marginTop: '3px', color: responding > 0 ? '#10b981' : '#d97706', fontWeight: '600' }}>
                          {responding > 0
                            ? `✓ ${responding} ${t('action')}${responding === 1 ? '' : 's'} ${t('responding')}`
                            : `⚠ ${t('No response logged yet')}`}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}

              {histSummary && histSummary.text && (
                <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)', background: 'var(--input-bg)' }}>
                  📊 {histSummary.text}
                </div>
              )}

              {!popupWeather && popupManualEvents.length === 0 && (popupWxRaw || weatherOffline) && (
                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {popupWxRaw && popupWxRaw.error === 'offline'
                    ? `🌦 ${WEATHER_ATTRIBUTION} — ${t('offline')}`
                    : `☁️ ${t('No active weather hazard')} · ${WEATHER_ATTRIBUTION}`}
                </div>
              )}

              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                {t('Click "Go To →" to open Manage Cases filtered to that disease and barangay')}
              </div>
              {loginRole === 'CHO' && (
                <button onClick={openManageActions}
                  style={{
                    marginTop: '12px', width: '100%', padding: '9px 14px', borderRadius: '8px',
                    background: '#0891b2', color: 'white', border: 'none', cursor: 'pointer',
                    fontSize: '14px', fontWeight: '700',
                  }}>
                  🗂 {t('Manage Barangay Actions')}
                </button>
              )}
              {loginRole === 'CHO' && (
                <button onClick={openManageHazards}
                  style={{
                    marginTop: '8px', width: '100%', padding: '9px 14px', borderRadius: '8px',
                    background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer',
                    fontSize: '14px', fontWeight: '700',
                  }}>
                  🌦 {t('Manage Hazard Pins')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── MANAGE BARANGAY ACTIONS MODAL (CHO) ── */}
        {manageActionsOpen && loginRole === 'CHO' && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)', padding: '20px',
          }} onClick={() => setManageActionsOpen(false)}>
            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px',
              padding: '24px', width: '520px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto',
              boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
            }} ref={manageActionsRef} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-main)' }}>🗂 {t('Barangay Actions')}</h3>
                <button onClick={() => setManageActionsOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '24px', lineHeight: 1, padding: 0 }}>
                  ×
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  <span>{t('Barangay')}</span>
                  <div style={{ position: 'relative' }}>
                    <button type="button" className="mc-custom-dropdown-btn" style={{ width: '100%', fontSize: '14px' }}
                      onClick={() => setManageDD(manageDD === 'a:brgy' ? null : 'a:brgy')}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{actionBarangayDisplay}</span>
                      <span style={{ marginLeft: '6px', opacity: 0.6, transition: 'transform 0.2s', display: 'inline-block', flexShrink: 0, transform: manageDD === 'a:brgy' ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                    </button>
                    {manageDD === 'a:brgy' && (
                      <div className="mc-custom-dropdown-panel" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                        {actionBarangayOptions.map(o => (
                          <div key={o.label}
                            className={`mc-custom-dropdown-item ${String(actionForm.barangay_id) === String(o.value) ? 'mc-custom-dropdown-item--active' : ''}`}
                            onClick={() => { setActionForm({ ...actionForm, barangay_id: o.value, barangay_name: barangayIdMap[o.value] || '', hazard_id: '' }); setManageDD(null); }}>
                            {o.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  <span>{t('Action Type')}</span>
                  <div style={{ position: 'relative' }}>
                    <button type="button" className="mc-custom-dropdown-btn" style={{ width: '100%', fontSize: '14px' }}
                      onClick={() => setManageDD(manageDD === 'a:type' ? null : 'a:type')}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{actionForm.action_type}</span>
                      <span style={{ marginLeft: '6px', opacity: 0.6, transition: 'transform 0.2s', display: 'inline-block', flexShrink: 0, transform: manageDD === 'a:type' ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                    </button>
                    {manageDD === 'a:type' && (
                      <div className="mc-custom-dropdown-panel">
                        {actionTypeOptions.map(o => (
                          <div key={o.value}
                            className={`mc-custom-dropdown-item ${actionForm.action_type === o.value ? 'mc-custom-dropdown-item--active' : ''}`}
                            onClick={() => { setActionForm({ ...actionForm, action_type: o.value }); setManageDD(null); }}>
                            {o.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '10px' }}>
                <span>{t('Responding to hazard')} ({t('optional')})</span>
                <div style={{ position: 'relative' }}>
                  <button type="button" className="mc-custom-dropdown-btn" style={{ width: '100%', fontSize: '14px' }}
                    onClick={() => setManageDD(manageDD === 'a:hazard' ? null : 'a:hazard')}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {hazardLinkDisplay || t('None - proactive action')}
                    </span>
                    <span style={{ marginLeft: '6px', opacity: 0.6, transition: 'transform 0.2s', display: 'inline-block', flexShrink: 0, transform: manageDD === 'a:hazard' ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                  </button>
                  {manageDD === 'a:hazard' && (
                    <div className="mc-custom-dropdown-panel" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                      {hazardLinkOptions.map(o => (
                        <div key={o.value || 'none'}
                          className={`mc-custom-dropdown-item ${String(actionForm.hazard_id || '') === String(o.value) ? 'mc-custom-dropdown-item--active' : ''}`}
                          onClick={() => { setActionForm({ ...actionForm, hazard_id: o.value }); setManageDD(null); }}>
                          {o.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400' }}>
                  {actionHazardOptions.length === 0
                    ? t('No active hazard pins to link yet - log one under Manage Hazard Pins.')
                    : t('Links this action to the hazard it responds to.')}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '10px' }}>
                <span>{t('Target Disease')} ({t('optional')})</span>
                <div style={{ position: 'relative' }}>
                  <button type="button" className="mc-custom-dropdown-btn" style={{ width: '100%', fontSize: '14px' }}
                    onClick={() => setManageDD(manageDD === 'a:disease' ? null : 'a:disease')}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {actionForm.target_disease || t('None')}
                    </span>
                    <span style={{ marginLeft: '6px', opacity: 0.6, transition: 'transform 0.2s', display: 'inline-block', flexShrink: 0, transform: manageDD === 'a:disease' ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                  </button>
                  {manageDD === 'a:disease' && (
                    <div className="mc-custom-dropdown-panel" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                      {targetDiseaseOptions.map(o => (
                        <div key={o.label}
                          className={`mc-custom-dropdown-item ${String(actionForm.target_disease || '') === String(o.value) ? 'mc-custom-dropdown-item--active' : ''}`}
                          onClick={() => { setActionForm({ ...actionForm, target_disease: o.value }); setManageDD(null); }}>
                          {o.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '10px' }}>
                {t('Description')}
                <textarea
                  value={actionForm.description}
                  onChange={e => setActionForm({ ...actionForm, description: e.target.value })}
                  rows={3}
                  placeholder={t('e.g. Barangay-wide fogging, priority houses near stagnant water')}
                  style={{ padding: '8px 10px', borderRadius: '7px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '14px', resize: 'vertical' }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  {t('Start date')}
                  <DatePicker value={actionForm.date_started} onChange={v => setActionForm({ ...actionForm, date_started: v })} dateFormat={dateFormat} clearable />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  {t('End date')}
                  <DatePicker value={actionForm.date_ended} onChange={v => setActionForm({ ...actionForm, date_ended: v })} dateFormat={dateFormat} clearable />
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  <span>{t('Status')}</span>
                  <div style={{ position: 'relative' }}>
                    <button type="button" className="mc-custom-dropdown-btn" style={{ width: '100%', fontSize: '14px' }}
                      onClick={() => setManageDD(manageDD === 'a:status' ? null : 'a:status')}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{translateActionStatus(actionForm.status)}</span>
                      <span style={{ marginLeft: '6px', opacity: 0.6, transition: 'transform 0.2s', display: 'inline-block', flexShrink: 0, transform: manageDD === 'a:status' ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                    </button>
                    {manageDD === 'a:status' && (
                      <div className="mc-custom-dropdown-panel">
                        {actionStatusOptions.map(o => (
                          <div key={o.value}
                            className={`mc-custom-dropdown-item ${actionForm.status === o.value ? 'mc-custom-dropdown-item--active' : ''}`}
                            onClick={() => { setActionForm({ ...actionForm, status: o.value }); setManageDD(null); }}>
                            {o.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button onClick={saveAction} disabled={actionsSaving}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  background: '#0891b2', color: 'white', border: 'none', cursor: 'pointer',
                  fontSize: '15px', fontWeight: '700',
                }}>
                {actionsSaving ? t('Saving…') : actionForm.id ? t('Save Changes') : t('Save Barangay Action')}
              </button>

              {actionForm.id && (
                <button onClick={() => setActionForm({ id: null, barangay_id: actionForm.barangay_id, barangay_name: actionForm.barangay_name, hazard_id: '', action_type: ACTION_TYPES[0], description: '', target_disease: '', date_started: '', date_ended: '', status: 'planned' })}
                  style={{
                    width: '100%', marginTop: '8px', padding: '9px 14px', borderRadius: '8px',
                    background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)',
                    cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                  }}>
                  {t('Cancel Edit')}
                </button>
              )}

              <div style={{ marginTop: '18px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('Existing Actions')}
                </p>
                {actions.filter(a => a.barangay_name === (actionForm.barangay_name || null)).length === 0 && (
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>{t('No actions for this barangay yet.')}</p>
                )}
                {actions.filter(a => a.barangay_name === (actionForm.barangay_name || null)).map(a => (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                    marginBottom: '6px', borderRadius: '7px', background: 'var(--input-bg)',
                    border: '1px solid var(--border-color)',
                  }}>
                    <span style={{ fontSize: '15px' }}>{ACTION_TYPE_ICONS[a.action_type] || '📋'}</span>
                    <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-main)' }}>
                      {t(a.action_type)} · {translateActionStatus(a.status)}
                      {isWarningIntervention(a) && (
                        <span style={{ display: 'block', fontSize: '12px', color: '#D97706', fontWeight: '600' }}>
                          ⚠ {t('Answers')}: {a.alert_disease || a.target_disease || t('Disease warning')}
                          {a.alert_value ? ` (${a.alert_value} ${t('cases')})` : ''}
                        </span>
                      )}
                      {a.hazard_type && (
                        <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>
                          ↳ {t('Responding to')} {hazardIcon(a.hazard_type)} {t(a.hazard_type)}
                        </span>
                      )}
                    </span>
                    <button onClick={() => editAction(a)}
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: '#0891b2', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
                      {t('Edit')}
                    </button>
                    <button onClick={() => deleteAction(a.id)}
                      style={{ background: 'rgba(220,38,38,0.1)', border: 'none', color: '#dc2626', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
                      {t('Delete')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── MANAGE HAZARD PINS MODAL (CHO) ── */}
        {manageHazardsOpen && loginRole === 'CHO' && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)', padding: '20px',
          }} onClick={() => setManageHazardsOpen(false)}>
            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px',
              padding: '24px', width: '560px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto',
              boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
            }} ref={manageHazardsRef} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-main)' }}>🌦 {t('Manage Hazard Pins')}</h3>
                <button onClick={() => setManageHazardsOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '24px', lineHeight: 1, padding: 0 }}>
                  ×
                </button>
              </div>

              <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {t('Weather hazards (rain, thunderstorm, heat) update automatically from Open-Meteo.')}
                <br />
                {t('Add pins here for on-the-ground hazards weather can not detect, like a fire or flood phase in a purok.')}
              </p>

              <div style={{ margin: '0 0 14px 0', padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text-main)' }}>{t('Data Sources & References')}</strong>
                <br />
                🌦 {WEATHER_ATTRIBUTION} ({t('live API')})
                <br />
                🇵🇭 {t('PAGASA - official Philippine weather agency')} – <a href="https://www.pagasa.dost.gov.ph" target="_blank" rel="noreferrer" style={{ color: '#0891b2' }}>pagasa.dost.gov.ph</a>
                <br />
                📺 {t('MSN Weather - Cabuyao forecast')} – <a href="https://www.msn.com/en-ph/weather/forecast/in-Cabuyao,Calabarzon?loc=eyJsIjoiQ2FidXlhbyIsInIiOiJDYWxhYmFyem9uIiwiYyI6IlBoaWxpcHBpbmVzIiwiaSI6IlBIIiwiZyI6ImVuLXBoIiwieCI6IjEyMS4xNDg0Mjk4NzA2MDU0NyIsInkiOiIxNC4yNDAyMjc2OTkyNzk3ODV9&weadegreetype=C&ocid=msnheader&cvid=6acc43d5296042b1afd84b9adae70453" target="_blank" rel="noreferrer" style={{ color: '#0891b2' }}>MSN Weather</a>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  <span>{t('Barangay')}</span>
                  <div style={{ position: 'relative' }}>
                    <button type="button" className="mc-custom-dropdown-btn" style={{ width: '100%', fontSize: '14px' }}
                      onClick={() => setManageDD(manageDD === 'h:brgy' ? null : 'h:brgy')}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{barangayIdMap[hazardForm.barangay_id] || '—'}</span>
                      <span style={{ marginLeft: '6px', opacity: 0.6, transition: 'transform 0.2s', display: 'inline-block', flexShrink: 0, transform: manageDD === 'h:brgy' ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                    </button>
                    {manageDD === 'h:brgy' && (
                      <div className="mc-custom-dropdown-panel" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                        {hazardBarangayOptions.map(o => (
                          <div key={o.label}
                            className={`mc-custom-dropdown-item ${String(hazardForm.barangay_id) === String(o.value) ? 'mc-custom-dropdown-item--active' : ''}`}
                            onClick={() => { setHazardForm({ ...hazardForm, barangay_id: o.value, barangay_name: barangayIdMap[o.value] || '' }); setManageDD(null); }}>
                            {o.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  <span>{t('Hazard Type')}</span>
                  <div style={{ position: 'relative' }}>
                    <button type="button" className="mc-custom-dropdown-btn" style={{ width: '100%', fontSize: '14px' }}
                      onClick={() => setManageDD(manageDD === 'h:type' ? null : 'h:type')}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hazardIcon(hazardForm.event_type)} {hazardForm.event_type}</span>
                      <span style={{ marginLeft: '6px', opacity: 0.6, transition: 'transform 0.2s', display: 'inline-block', flexShrink: 0, transform: manageDD === 'h:type' ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                    </button>
                    {manageDD === 'h:type' && (
                      <div className="mc-custom-dropdown-panel">
                        {hazardTypeOptions.map(o => (
                          <div key={o.value}
                            className={`mc-custom-dropdown-item ${hazardForm.event_type === o.value ? 'mc-custom-dropdown-item--active' : ''}`}
                            onClick={() => { setHazardForm({ ...hazardForm, event_type: o.value }); setManageDD(null); }}>
                            {o.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  <span>{t('Severity')}</span>
                  <div style={{ position: 'relative' }}>
                    <button type="button" className="mc-custom-dropdown-btn" style={{ width: '100%', fontSize: '14px' }}
                      onClick={() => setManageDD(manageDD === 'h:sev' ? null : 'h:sev')}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hazardForm.severity}</span>
                      <span style={{ marginLeft: '6px', opacity: 0.6, transition: 'transform 0.2s', display: 'inline-block', flexShrink: 0, transform: manageDD === 'h:sev' ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                    </button>
                    {manageDD === 'h:sev' && (
                      <div className="mc-custom-dropdown-panel">
                        {severityOptions.map(o => (
                          <div key={o.value}
                            className={`mc-custom-dropdown-item ${hazardForm.severity === o.value ? 'mc-custom-dropdown-item--active' : ''}`}
                            onClick={() => { setHazardForm({ ...hazardForm, severity: o.value }); setManageDD(null); }}>
                            {o.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  {t('Purok')} ({t('optional')})
                  <input
                    value={hazardForm.purok}
                    onChange={e => setHazardForm({ ...hazardForm, purok: e.target.value })}
                    placeholder={t('e.g. Purok 3, Blk 8 Lot 8')}
                    style={{ padding: '8px 10px', borderRadius: '7px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '14px' }}
                  />
                </label>
              </div>

              {/* Full-width helper line: this used to sit in the third grid cell and
                  squeezed Severity/Purok and pushed Lat/Lng aside. */}
              <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                {t('Flood pins are matched to a zone by their location text (e.g. the same Purok/Blk as the cases) first, then by their coordinates.')}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  <span>Lat ({t('optional')})</span>
                  <input
                    value={hazardForm.latitude}
                    onChange={e => setHazardForm({ ...hazardForm, latitude: e.target.value })}
                    placeholder="14.xxx"
                    style={{ padding: '8px 10px', borderRadius: '7px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  <span>Lng ({t('optional')})</span>
                  <input
                    value={hazardForm.longitude}
                    onChange={e => setHazardForm({ ...hazardForm, longitude: e.target.value })}
                    placeholder="121.xxx"
                    style={{ padding: '8px 10px', borderRadius: '7px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
                  />
                </label>
              </div>

              {/* Read-only preview: where this pin will land. Coordinates win when
                  typed, otherwise the barangay centroid stands in. */}
              <div style={{ marginBottom: '12px' }}>
                <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  {t('Pin preview')} <span style={{ fontWeight: '400' }}>({t('read-only')})</span>
                </p>
                {!offlineMode ? (
                  <div style={{ height: '170px', borderRadius: '9px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <MapContainer key="hazard-preview-map" center={hazardPreviewCenter} zoom={hazardPreviewZoom}
                      style={{ height: '100%', width: '100%' }} zoomControl={false} dragging={false} scrollWheelZoom={false}
                      doubleClickZoom={false} boxZoom={false} keyboard={false} touchZoom={false} attributionControl={false}>
                      <TileLayer attribution="" maxZoom={19} url={mapLayer === 'SD'
                        ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                        : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'} />
                      <CircleMarker center={hazardPreviewCenter} radius={8}
                        pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.85, weight: 2 }} />
                      <HazardPreviewRecenter center={hazardPreviewCenter} />
                    </MapContainer>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                    {t('Map preview is unavailable offline. The pin will use the coordinates above, or the barangay center otherwise.')}
                  </p>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  {t('Start date')}
                  <DatePicker value={hazardForm.date_started} onChange={v => setHazardForm({ ...hazardForm, date_started: v })} dateFormat={dateFormat} clearable />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  {t('End date')}
                  <DatePicker value={hazardForm.date_ended} onChange={v => setHazardForm({ ...hazardForm, date_ended: v })} dateFormat={dateFormat} clearable />
                </label>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '12px' }}>
                {t('Notes')} ({t('optional')})
                <textarea
                  value={hazardForm.notes}
                  onChange={e => setHazardForm({ ...hazardForm, notes: e.target.value })}
                  rows={2}
                  placeholder={t('e.g. Phase 2 flood near the riverbank')}
                  style={{ padding: '8px 10px', borderRadius: '7px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '14px', resize: 'vertical' }}
                />
              </label>

              <button onClick={saveHazard} disabled={hazardsSaving}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer',
                  fontSize: '15px', fontWeight: '700',
                }}>
                {hazardsSaving ? t('Saving…') : hazardForm.id ? t('Save Hazard Pin') : t('Add Hazard Pin')}
              </button>

              <div style={{ marginTop: '18px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('Hazard Pins')}
                </p>
                {disasterEvents.filter(e => e.barangay_name === (hazardForm.barangay_name || '')).length === 0 && (
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>{t('No hazard pins for this barangay yet.')}</p>
                )}
                {disasterEvents
                  .filter(e => e.barangay_name === (hazardForm.barangay_name || ''))
                  .slice()
                  .sort((a, b) => (isDisasterActive(b) ? 1 : 0) - (isDisasterActive(a) ? 1 : 0))
                  .map(ev => {
                    const ended = !isDisasterActive(ev);
                    return (
                      <div key={ev.id} style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                        marginBottom: '6px', borderRadius: '7px', background: 'var(--input-bg)',
                        border: '1px solid var(--border-color)',
                        opacity: ended ? 0.6 : 1,
                      }}>
                        <span style={{ fontSize: '15px' }}>{hazardIcon(ev.event_type)}</span>
                        <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-main)' }}>
                          {ev.event_type}{ev.purok ? ` · ${ev.purok}` : ''} · <span style={{ textTransform: 'capitalize' }}>{ev.severity.toLowerCase()}</span>
                          {ended && (
                            <span style={{ marginLeft: '6px', padding: '1px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', background: 'var(--border-color)', color: 'var(--text-muted)' }}>
                              {t('Ended')}
                            </span>
                          )}
                        </span>
                        <button onClick={() => setHazardForm({
                          id: ev.id, barangay_id: String(ev.barangay_id || ''), barangay_name: ev.barangay_name,
                          event_type: ev.event_type, severity: ev.severity, purok: ev.purok || '',
                          latitude: ev.latitude != null ? String(ev.latitude) : '', longitude: ev.longitude != null ? String(ev.longitude) : '',
                          date_started: ev.date_started || '', date_ended: ev.date_ended || '', notes: ev.notes || '',
                        })}
                          style={{ background: 'rgba(8,145,178,0.1)', border: 'none', color: '#0891b2', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
                          {t('Edit')}
                        </button>
                        <button onClick={() => deleteHazard(ev.id)}
                          style={{ background: 'rgba(220,38,38,0.1)', border: 'none', color: '#dc2626', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
                          {t('Delete')}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* ── ZONE (PUROK-LEVEL) EVIDENCE CARD ── Phase 1: shows WHY a zone was
            flagged (case cluster vs rain/flood exposure) and lets the CHO answer
            it with the mandatory-remarks intervention modal. */}
        {zonePopup && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 2500,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)', padding: '20px',
          }} onClick={() => setZonePopup(null)}>
            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px',
              padding: '24px', width: '480px', maxWidth: '95vw', maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
            }} onClick={e => e.stopPropagation()}>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '19px', fontWeight: '700', color: 'var(--text-main)' }}>
                    {zonePopup.kindMeta.icon} {zonePopup.barangay} · {zonePopup.label}{zonePopup.units.length === 1 && zonePopup.units[0] !== 'Unspecified' ? ` · ${zonePopup.units[0]}` : ''}
                  </h3>
                  <span style={{
                    display: 'inline-block', fontSize: '12px', fontWeight: '700', padding: '3px 9px', borderRadius: '10px',
                    background: `${zonePopup.kindMeta.color}22`, color: zonePopup.kindMeta.color, border: `1px solid ${zonePopup.kindMeta.color}55`,
                  }}>
                    {t(zonePopup.kindMeta.label)} · {t('Score')} {zonePopup.score}
                  </span>
                </div>
                <button onClick={() => setZonePopup(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '24px', lineHeight: 1, padding: 0 }}>
                  ×
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', marginBottom: '12px' }} />

              {/* Rapid rise: this purok/blk is climbing fast inside a short window,
                  not just over the 7-day threshold. This is the zone to act on. */}
              {zonePopup.rapid && zonePopup.rapidDiseases.length > 0 && (
                <div style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.5)' }}>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    🚨 {t('Rapid rise in this zone')}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '4px' }}>
                    {zonePopup.rapidDiseases.map(rd => (
                      <div key={rd.disease}>
                        {rd.disease}: {rd.cases5} {t('cases in the last 5 days')}
                        {rd.prev5 > 0 ? ` · ${t('prev')} ${rd.prev5}` : ''}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Why - the case side */}
              <p style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('Case evidence')}</p>
              {zonePopup.diseases.length === 0 ? (
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                  {t('No disease crossed the 7-day case threshold in this zone.')}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                  {zonePopup.diseases.map(d => (
                    <div key={d.disease} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border-color)' }}>
                      <span style={{ flex: 1, fontSize: '14px', color: 'var(--text-main)', fontWeight: '600' }}>{d.disease}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {d.cases7} {t('in 7 days')}{d.prev7 > 0 ? ` · ${t('prev')} ${d.prev7}` : ''}
                      </span>
                      {d.rapid && (
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#dc2626', background: 'rgba(220,38,38,0.12)', padding: '2px 7px', borderRadius: '9px' }}>
                          🚨 {t('Rapid')}
                        </span>
                      )}
                      {d.surge && (
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#b91c1c', background: 'rgba(185,28,28,0.12)', padding: '2px 7px', borderRadius: '9px' }}>
                          ↑ {t('Surge')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Near the hotspot gate but not over it (the `watch` tier). Shown so
                  an early climb is visible without calling it a hotspot. */}
              {zonePopup.near && zonePopup.near.length > 0 && (
                <>
                  <p style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('Near-threshold cases')}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '6px' }}>
                    {zonePopup.near.map(d => (
                      <div key={d.disease} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', background: 'var(--input-bg)', border: `1px solid ${zonePopup.kindMeta.color}55` }}>
                        <span style={{ flex: 1, fontSize: '14px', color: 'var(--text-main)', fontWeight: '600' }}>{d.disease}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          {d.cases7} {t('in 7 days')}{d.prev7 > 0 ? ` · ${t('prev')} ${d.prev7}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {t('Below the hotspot threshold but climbing.')}
                  </p>
                </>
              )}

              {/* Why - the exposure side */}
              <p style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('Exposure evidence')}</p>
              {zonePopup.env.reasons.length === 0 ? (
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                  {t('No rain or flood threshold reached in this zone.')}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '12px' }}>
                  {zonePopup.env.reasons.map((r, i) => (
                    <div key={i} style={{ fontSize: '13px', color: 'var(--text-main)', padding: '6px 10px', borderRadius: '8px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.35)' }}>
                      💧 {r}
                    </div>
                  ))}
                </div>
              )}
              {zonePopup.env.gate && zonePopup.env.rainSource === 'zone' && (
                <p style={{ margin: '-6px 0 12px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {t('Rain measured at this zone, not the whole barangay.')}
                </p>
              )}

              {/* Watch for - the diseases a flood/rain exposure favours. Kept
                  visually separate from Case evidence: these are implied by the
                  hazard, not cases observed in the zone. */}
              {zonePopup.env.gate && (() => {
                const watch = new Set();
                (zonePopup.env.hazardTypes || []).forEach(type => {
                  if (type === 'Heavy Rain') RAINY_SEASON_DISEASES.forEach(d => watch.add(d));
                  else hazardDiseases(type).forEach(d => watch.add(d));
                });
                const list = [...watch];
                if (list.length === 0) return null;
                return (
                  <>
                    <p style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('Watch for')}</p>
                    <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text-main)', padding: '8px 10px', borderRadius: '8px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.35)' }}>
                      🌧 {list.join(', ')}
                    </div>
                  </>
                );
              })()}

              {zonePopup.seasonHit && (
                <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {t('Season note:')} {zonePopup.disease} {t('is flagged in the current Philippine season.')}
                </p>
              )}

              {zonePopup.breakdown && zonePopup.breakdown.length > 0 ? (
                <>
                  <p style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('Breakdown by location unit')}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                    {zonePopup.breakdown.map(b => (
                      <div key={b.unit} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '5px 9px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border-color)' }}>
                        <span style={{ flex: 1, color: 'var(--text-main)', fontWeight: '600' }}>{b.unit}</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {b.diseases.length === 0 ? t('No cases in 7 days') : b.diseases.map(d => `${d.disease} ${d.cases7}`).join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : zonePopup.units.length > 0 ? (
                <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {t('Location units in this zone:')} {zonePopup.units.join(', ')}
                </p>
              ) : null}

              {zonePopup.merged && (
                <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {t('Includes cases from a grid cell with no barangay land:')} {zonePopup.mergedIdx.map(i => `Zone ${i + 1}`).join(', ')}. {t('Zoom in for the per-unit breakdown.')}
                </p>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setZonePopup(null)}
                  style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                  {t('Close')}
                </button>
                {loginRole === 'CHO' && (
                  <button onClick={() => openZoneIntervention(zonePopup)}
                    style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', background: '#0891b2', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>
                    ＋ {t('Log Intervention')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── LOG INTERVENTION MODAL ── answers a disease warning with the
            mandatory remarks (shared with the Dashboard warning cards). */}
        <InterventionModal
          open={!!interventionCtx}
          context={interventionCtx}
          barangays={Object.entries(barangayIdMap).map(([id, name]) => ({ id: Number(id), name }))}
          diseases={diseaseOptions.filter(d => d && d !== 'All Diseases')}
          dateFormat={dateFormat}
          onClose={() => setInterventionCtx(null)}
          onSaved={reloadMapActions}
        />
      </div>
    </div>
  );
}