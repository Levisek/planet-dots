// asteroids — V4.3 teaser (Ceres + Vesta + Pallas + 300-particle ring).
// Schema kompatibilní s budoucím rozšířením V4.5+ (10+ named asteroids,
// Kirkwoodovy mezery, Trojané, NEO).

export const ASTEROIDS = [
  { id: 'ceres', name: 'CERES', category: 'dwarf',
    a: 2.766, e: 0.0758, eReal: 0.0758, inclinationDeg: 10.59,
    period: 25, periodReal: 46.0, phaseOffset: 0.0,
    realDiameterKm: 940, realSemiMajorAxisKm: 414.01e6,
    color: '#9a8d7a', texture: 'textures/ceres.jpg',
    coverageNote: null,
  },
  { id: 'vesta', name: 'VESTA', category: 'dwarf',
    a: 2.362, e: 0.0887, eReal: 0.0887, inclinationDeg: 7.14,
    period: 22, periodReal: 36.6, phaseOffset: 1.7,
    realDiameterKm: 525, realSemiMajorAxisKm: 353.32e6,
    color: '#b0a08c', texture: 'textures/vesta.jpg',
    shape: { scale: [1.0, 0.93, 0.88] },
  },
  { id: 'pallas', name: 'PALLAS', category: 'irregular',
    a: 2.772, e: 0.08, eReal: 0.2305, inclinationDeg: 34.84,
    period: 26, periodReal: 46.6, phaseOffset: 2.9,
    realDiameterKm: 512, realSemiMajorAxisKm: 414.7e6,
    color: '#8a8a8a', texture: 'textures/pallas.jpg',
    shape: { scale: [1.0, 0.95, 0.90] },
    coverageNote: 'Pallas fotografována jen Hubble dalekohledem. Detaily neznámé.',
  },
];

export const ASTEROID_BELT = {
  count: 300,
  innerAU: 2.2,
  outerAU: 3.2,
  peakAU: 2.8,
  distribution: 'gaussian',
  sigmaAU: 0.25,
  colorRange: { min: '#3a3530', max: '#7a7065' },
  sizeRange: { minPx: 1, maxPx: 3 },
};
