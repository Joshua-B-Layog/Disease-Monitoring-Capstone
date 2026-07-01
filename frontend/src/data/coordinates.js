// Approximate offsets (lat, lng) for purok/blk/lot/phase markers relative to barangay center
const PUROK_OFFSETS = {
  'Purok 1': [-0.004, -0.006],  'Purok 2': [0.004, -0.004],
  'Purok 3': [0.002, 0.005],    'Purok 4': [-0.005, 0.003],
  'Purok 5': [0.006, -0.002],   'Purok 6': [-0.003, 0.007],
  'Blk 1': [-0.007, -0.005],    'Blk 2': [0.005, 0.006],
  'Blk 3': [-0.002, -0.007],    'Blk 4': [0.007, 0.003],
  'Blk 5': [-0.006, 0.004],     'Phase 1': [0.004, -0.008],
  'Phase 2': [-0.004, 0.008],   'Phase 3': [0.008, 0.002],
  'Lot 1': [-0.008, -0.002],    'Lot 2': [0.003, -0.009],
  'Lot 3': [-0.003, 0.009],     'Lot 4': [0.009, 0.004],
  'Lot 5': [-0.009, 0.006],
};

export function findPurokCoords(barangay, purok, barangayCoords) {
  if (!barangay || !purok) return null;
  const center = barangayCoords[barangay];
  if (!center) return null;
  const offset = PUROK_OFFSETS[purok];
  if (!offset) return null;
  return [center[0] + offset[0], center[1] + offset[1]];
}

export default PUROK_OFFSETS;
