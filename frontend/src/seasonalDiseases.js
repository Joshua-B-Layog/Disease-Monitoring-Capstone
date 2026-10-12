// Seasonal disease watch list for Cabuyao, Laguna (Philippines).
//
// Used by the Map View "Disaster Disease Map": when a barangay is inspected the
// probable-disease panel cross-checks the hazard's linked diseases against the
// diseases that are typically in season for the current month.
//
// Disease names are kept identical to the `diseases` table so counts line up.

// Three Philippine seasons.
export const SEASONS = {
  cool: {
    id: 'cool',
    label: 'Cool Dry (Dec-Feb)',
    months: [12, 1, 2],
    diseases: ['Influenza', 'Influenza A', 'Measles', 'Chickenpox', 'Acute Respiratory Infection', 'Tuberculosis'],
  },
  hot: {
    id: 'hot',
    label: 'Hot Dry (Mar-May)',
    months: [3, 4, 5],
    diseases: ['Dengue', 'Diarrhea', 'Typhoid Fever', 'Sore Eyes', 'Chickenpox', 'Hand Foot and Mouth Disease'],
  },
  rainy: {
    id: 'rainy',
    label: 'Rainy (Jun-Nov)',
    months: [6, 7, 8, 9, 10, 11],
    diseases: ['Dengue', 'Leptospirosis', 'Typhoid Fever', 'Diarrhea', 'Acute Respiratory Infection', 'Hand Foot and Mouth Disease'],
  },
};

// Accepts a 0-based JS month index (or a 1-12 month number via monthOfYear()).
export const seasonForMonth = (monthIndex0 = new Date().getMonth()) => {
  const m = (((Number(monthIndex0) || 0) % 12) + 12) % 12 + 1;
  return Object.values(SEASONS).find(s => s.months.includes(m)) || SEASONS.rainy;
};

export const seasonalDiseases = (monthIndex0) => seasonForMonth(monthIndex0).diseases;
