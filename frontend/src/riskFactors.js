// Shared contributing risk-factor taxonomy for the epidemiology layer.
// Keys are stored (as a JSON array string) on disease_cases.risk_factors and
// case_add_requests.risk_factors. Keep keys short and stable; labels are translatable.

export const RISK_FACTOR_GROUPS = [
  {
    id: 'water',
    label: 'Water & Sanitation',
    icon: '\u{1F6B0}',
    color: '#2563eb',
    factors: [
      { key: 'unsafe_water', label: 'Unsafe drinking water' },
      { key: 'flood_stagnant', label: 'Flood / stagnant water' },
      { key: 'poor_sanitation', label: 'Poor sanitation / open sewage' },
    ],
  },
  {
    id: 'housing',
    label: 'Housing & Vector',
    icon: '\u{1F3E0}',
    color: '#7c3aed',
    factors: [
      { key: 'overcrowding', label: 'Overcrowding' },
      { key: 'no_vector_protection', label: 'No mosquito nets/screens' },
      { key: 'breeding_sites', label: 'Stagnant containers / breeding sites' },
      { key: 'rodent_pest', label: 'Rodent / pest infestation' },
    ],
  },
  {
    id: 'behavior',
    label: 'Behaviour & Occupation',
    icon: '\u{1F9D1}\u200D\u{1F33E}',
    color: '#0891b2',
    factors: [
      { key: 'animal_contact', label: 'Animal / livestock contact' },
      { key: 'farm_occupation', label: 'Farming / occupational exposure' },
      { key: 'unsafe_food', label: 'Unsafe food handling' },
      { key: 'travel_history', label: 'Travel to outbreak area' },
    ],
  },
  {
    id: 'host',
    label: 'Host / Patient',
    icon: '\u{1FA7A}',
    color: '#dc2626',
    factors: [
      { key: 'comorbidity', label: 'Comorbidity (diabetes, hypertension, asthma)' },
      { key: 'immunocompromised', label: 'Immunocompromised' },
      { key: 'malnutrition', label: 'Malnutrition' },
      { key: 'young_child', label: 'Child under 5' },
      { key: 'elderly', label: 'Senior (60+)' },
    ],
  },
  {
    id: 'immunization',
    label: 'Immunization',
    icon: '\u{1F489}',
    color: '#16a34a',
    factors: [
      { key: 'unvaccinated', label: 'Not vaccinated / incomplete' },
    ],
  },
];

export const ALL_RISK_FACTORS = RISK_FACTOR_GROUPS.flatMap(g => g.factors);

export const RISK_FACTOR_LABELS = Object.fromEntries(
  ALL_RISK_FACTORS.map(f => [f.key, f.label])
);

export const riskFactorLabel = (key) => RISK_FACTOR_LABELS[key] || key;

// Maps an active hazard type to the risk factors it typically introduces, so the
// capture form can pre-check the plausible ones for the affected barangay.
export const HAZARD_SUGGESTED_FACTORS = {
  'Thunderstorm': ['flood_stagnant', 'breeding_sites'],
  'Heavy Rain': ['flood_stagnant'],
  'Flood': ['flood_stagnant', 'poor_sanitation', 'unsafe_water'],
  'Typhoon': ['flood_stagnant', 'breeding_sites', 'overcrowding'],
  'Extreme Heat': ['unsafe_water'],
  'Fire': ['overcrowding', 'unsafe_water'],
};

// Parse a JSON array string / comma list / array into a clean array of factor keys.
export const parseRiskFactors = (value) => {
  let list = value;
  if (typeof list === 'string') {
    const s = list.trim();
    if (!s) return [];
    try { list = JSON.parse(s); } catch (e) { list = s.split(','); }
  }
  if (!Array.isArray(list)) return [];
  return list.map(v => String(v || '').trim()).filter(Boolean);
};

// Aggregate a list of cases into { key: count } plus a per-factor disease breakdown.
export const summarizeRiskFactors = (cases) => {
  const totals = {};
  const byDisease = {};
  let tagged = 0;
  (cases || []).forEach(c => {
    const keys = parseRiskFactors(c.risk_factors);
    if (keys.length) tagged++;
    keys.forEach(k => {
      totals[k] = (totals[k] || 0) + 1;
      const disease = c.disease_name || 'Unknown';
      byDisease[k] = byDisease[k] || {};
      byDisease[k][disease] = (byDisease[k][disease] || 0) + 1;
    });
  });
  const ranked = Object.entries(totals)
    .map(([key, count]) => {
      const diseases = Object.entries(byDisease[key] || {}).sort((a, b) => b[1] - a[1]);
      return { key, label: riskFactorLabel(key), count, topDisease: diseases[0] ? diseases[0][0] : null, topDiseaseCount: diseases[0] ? diseases[0][1] : 0 };
    })
    .sort((a, b) => b.count - a.count);
  return { total: (cases || []).length, tagged, totals, ranked };
};
