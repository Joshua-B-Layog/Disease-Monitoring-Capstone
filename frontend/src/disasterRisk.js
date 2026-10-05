// Shared config for the Barangay Actions (F), Disaster Watch (H) and Weather Hazards layers.

export const WEATHER_ATTRIBUTION = 'Weather: Open-Meteo.com';

// Unified hazard types (weather-derived + manually pinned). Icon, badge color and the
// disease risk correlation live in one place so every layer shows the same info.
export const HAZARD_CONFIG = {
  'Thunderstorm':  { icon: '⛈️', color: '#7c3aed', diseases: ['Leptospirosis', 'Diarrhea'] },
  'Heavy Rain':    { icon: '🌧️', color: '#3b82f6', diseases: ['Leptospirosis'] },
  'Flood':         { icon: '🌊',  color: '#2563eb', diseases: ['Leptospirosis', 'Diarrhea'] },
  'Typhoon':       { icon: '🌀',  color: '#7c3aed', diseases: ['Leptospirosis', 'Acute Respiratory Infection'] },
  'Extreme Heat':  { icon: '☀️',  color: '#f59e0b', diseases: ['Acute Respiratory Infection'] },
  'Fire':          { icon: '🔥',  color: '#dc2626', diseases: ['Acute Respiratory Infection'] },
};

export const ACTION_TYPES = ['Fogging', 'Vaccination Drive', 'Info Campaign', 'Active Case Finding', 'Home Visits', 'Sanitation'];

export const ACTION_TYPE_ICONS = {
  'Fogging': '💨',
  'Vaccination Drive': '💉',
  'Info Campaign': '📢',
  'Active Case Finding': '🔍',
  'Home Visits': '🏠',
  'Sanitation': '🧹',
};

export const ACTION_STATUSES = ['planned', 'ongoing', 'completed'];

export const DISASTER_EVENT_TYPES = ['Flood', 'Typhoon', 'Extreme Heat', 'Heavy Rain', 'Fire'];

export const DISASTER_ICONS = Object.fromEntries(
  Object.entries(HAZARD_CONFIG).map(([k, v]) => [k, v.icon])
);

export const DISASTER_SEVERITIES = ['Minor', 'Moderate', 'Severe'];

export const SEVERITY_COLORS = {
  'Minor': '#3b82f6',
  'Moderate': '#f59e0b',
  'Severe': '#dc2626',
};

// Fixed, config-driven disease-risk correlation for hazard events (no ML).
export const DISASTER_RISK_LINK = Object.fromEntries(
  Object.entries(HAZARD_CONFIG).map(([k, v]) => [k, v.diseases])
);

const HAZARD_TYPE_BY_WMO = [
  { min: 95, type: 'Thunderstorm' },
  { min: 80, type: 'Heavy Rain' },
  { min: 71, type: 'Heavy Rain' },
  { min: 51, type: 'Heavy Rain' },
];

// Maps an Open-Meteo WMO weather code to a hazard type (or null for clear/safe codes).
export const wmoToHazardType = (code) => {
  if (code == null) return null;
  for (const h of HAZARD_TYPE_BY_WMO) {
    if (code >= h.min) return h.type;
  }
  return null;
};

export const hazardDiseases = (type) => (HAZARD_CONFIG[type] || {}).diseases || [];
export const hazardIcon = (type) => (HAZARD_CONFIG[type] || {}).icon || '⚠️';
export const hazardColor = (type) => (HAZARD_CONFIG[type] || {}).color || '#94a3b8';
export const wmoToHazardLabel = (type) => (HAZARD_CONFIG[type] || {}).label || type;

// PAGASA-style guaranteed-visible icon: the emoji glyph rendered as <text> inside a
// colored warning circle. Works on any machine - even with no emoji font you still see
// the colored warning disc, and with an emoji font you see the familiar thunder/rain/fire glyph.
const svgIdSafe = (s) => String(s || 'x').replace(/[^a-zA-Z0-9]/g, '');
// Low-level PAGASA-style warning disc: emoji glyph as <text> inside a colored circle.
// Works on any machine - no emoji font means you still see the colored warning disc.
export const hazardSvgMarkup = (emoji, color = '#94a3b8', size = 26, tag = '') => {
  const gid = 'hgr' + svgIdSafe(tag);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" style="display:block">` +
    `<defs><radialGradient id="${gid}" cx="35%" cy="30%" r="90%"><stop offset="0%" stop-color="${color}" stop-opacity="0.85"/><stop offset="100%" stop-color="${color}"/></radialGradient></defs>` +
    `<circle cx="12" cy="12" r="11" fill="url(#${gid})" stroke="rgba(255,255,255,0.85)" stroke-width="0.8"/>` +
    `<text x="12" y="16.4" text-anchor="middle" font-size="12.5" font-family="'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji','Twemoji Mozilla',sans-serif">${emoji}</text>` +
    `</svg>`;
};
export const hazardSvgIcon = (type, size = 26) => hazardSvgMarkup(hazardIcon(type), hazardColor(type), size, type);

export const linkedDiseases = (eventType) => DISASTER_RISK_LINK[eventType] || [];

// An event is considered "active" when it has no end date or the end date is today/later.
export const isDisasterActive = (ev) => {
  if (!ev) return false;
  if (!ev.date_ended) return true;
  const end = new Date(ev.date_ended + 'T00:00:00');
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return end >= todayStart;
};

// Returns a compact "Disaster Watch" descriptor for a set of events:
// { label, hint } or null when nothing active.
export const getDisasterWatch = (events) => {
  const active = (events || []).filter(isDisasterActive);
  if (active.length === 0) return null;
  const first = active[0];
  const hints = active.flatMap(e => linkedDiseases(e.event_type));
  const uniqueHints = [...new Set(hints)];
  return {
    label: `${hazardIcon(first.event_type)} ${first.event_type}`,
    hint: uniqueHints.length ? `Monitor: ${uniqueHints.join(', ')}` : null,
    count: active.length,
  };
};