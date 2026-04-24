// MOONS — data 19 měsíců V2.
// `a` je semi-major axis jako násobek parent radius (dekorativně komprimované).
// `e` je eccentricity po zveličení (real × ~7, clamp ≤ 0.3).
// `period` v sekundách (per-family normalized).
// `phaseOffset` deterministický offset (rad) pro staggered start.

export const MOONS = [
  { id: 'luna', name: 'LUNA', parent: 'earth',
    diameterKm: 3474, radiusPx: 2.2, tickCount: 120,
    texture: 'textures/luna.jpg',
    a: 2.0, e: 0.275, period: 20, phaseOffset: 0.3 },

  { id: 'phobos', name: 'PHOBOS', parent: 'mars',
    diameterKm: 22, radiusPx: 0.5, tickCount: 20,
    texture: 'textures/phobos.jpg',
    a: 1.3, e: 0.1, period: 2, phaseOffset: 0.0 },
  { id: 'deimos', name: 'DEIMOS', parent: 'mars',
    diameterKm: 12, radiusPx: 0.5, tickCount: 20,
    texture: 'textures/deimos.jpg',
    a: 2.0, e: 0.05, period: 8, phaseOffset: 1.5 },

  { id: 'io', name: 'IO', parent: 'jupiter',
    diameterKm: 3643, radiusPx: 2.3, tickCount: 130,
    texture: 'textures/io.jpg',
    a: 1.33, e: 0.04, period: 5, phaseOffset: 0.5 },
  { id: 'europa', name: 'EUROPA', parent: 'jupiter',
    diameterKm: 3122, radiusPx: 2.0, tickCount: 100,
    texture: 'textures/europa.jpg',
    a: 1.56, e: 0.09, period: 10, phaseOffset: 1.2 },
  { id: 'ganymede', name: 'GANYMEDE', parent: 'jupiter',
    diameterKm: 5268, radiusPx: 3.4, tickCount: 300,
    texture: 'textures/ganymede.jpg',
    a: 1.78, e: 0.02, period: 20, phaseOffset: 2.0 },
  { id: 'callisto', name: 'CALLISTO', parent: 'jupiter',
    diameterKm: 4820, radiusPx: 3.1, tickCount: 250,
    texture: 'textures/callisto.jpg',
    a: 2.0, e: 0.07, period: 47, phaseOffset: 3.5 },

  { id: 'titan', name: 'TITAN', parent: 'saturn',
    diameterKm: 5150, radiusPx: 3.3, tickCount: 300,
    texture: 'textures/titan.jpg',
    a: 3.8, e: 0.2, period: 50, phaseOffset: 1.8 },
  { id: 'rhea', name: 'RHEA', parent: 'saturn',
    diameterKm: 1527, radiusPx: 1.0, tickCount: 60,
    texture: 'textures/rhea.jpg',
    a: 3.1, e: 0.02, period: 14.3, phaseOffset: 0.9 },
  { id: 'iapetus', name: 'IAPETUS', parent: 'saturn',
    diameterKm: 1470, radiusPx: 0.95, tickCount: 60,
    texture: 'textures/iapetus.jpg',
    a: 4.4, e: 0.2, period: 60, phaseOffset: 2.5 },
  { id: 'dione', name: 'DIONE', parent: 'saturn',
    diameterKm: 1123, radiusPx: 0.72, tickCount: 45,
    texture: 'textures/dione.jpg',
    a: 2.9, e: 0.02, period: 8.7, phaseOffset: 1.1 },
  { id: 'tethys', name: 'TETHYS', parent: 'saturn',
    diameterKm: 1062, radiusPx: 0.68, tickCount: 45,
    texture: 'textures/tethys.jpg',
    a: 2.7, e: 0.02, period: 6, phaseOffset: 0.4 },
  { id: 'enceladus', name: 'ENCELADUS', parent: 'saturn',
    diameterKm: 504, radiusPx: 0.5, tickCount: 25,
    texture: 'textures/enceladus.jpg',
    a: 2.55, e: 0.05, period: 4.3, phaseOffset: 2.2 },
  { id: 'mimas', name: 'MIMAS', parent: 'saturn',
    diameterKm: 396, radiusPx: 0.5, tickCount: 20,
    texture: 'textures/mimas.jpg',
    a: 2.4, e: 0.2, period: 3, phaseOffset: 0.1 },

  { id: 'miranda', name: 'MIRANDA', parent: 'uranus',
    diameterKm: 471, radiusPx: 0.5, tickCount: 25,
    texture: 'textures/miranda.jpg',
    a: 1.7, e: 0.02, period: 4, phaseOffset: 1.7 },
  { id: 'ariel', name: 'ARIEL', parent: 'uranus',
    diameterKm: 1158, radiusPx: 0.74, tickCount: 50,
    texture: 'textures/ariel.jpg',
    a: 1.9, e: 0.02, period: 7, phaseOffset: 0.8 },
  { id: 'umbriel', name: 'UMBRIEL', parent: 'uranus',
    diameterKm: 1169, radiusPx: 0.75, tickCount: 50,
    texture: 'textures/umbriel.jpg',
    a: 2.15, e: 0.04, period: 12, phaseOffset: 2.7 },
  { id: 'titania', name: 'TITANIA', parent: 'uranus',
    diameterKm: 1577, radiusPx: 1.01, tickCount: 80,
    texture: 'textures/titania.jpg',
    a: 2.5, e: 0.02, period: 25, phaseOffset: 3.0 },
  { id: 'oberon', name: 'OBERON', parent: 'uranus',
    diameterKm: 1523, radiusPx: 0.98, tickCount: 80,
    texture: 'textures/oberon.jpg',
    a: 2.8, e: 0.02, period: 38, phaseOffset: 0.6 },
];

export const MOON_BY_ID = Object.fromEntries(MOONS.map(m => [m.id, m]));

export const MOONS_BY_PARENT = MOONS.reduce((acc, m) => {
  (acc[m.parent] ??= []).push(m);
  return acc;
}, {});
