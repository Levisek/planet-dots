// planetOrbits — thin wrapper nad orbit.js Kepler solveru.
// V V4.2 byl kruhový (cos/sin), V4.3 sjednoceno na Kepler s inclination.

import { orbitPosition } from './orbit.js';
import {
  getOrbitRadius, getOrbitalPeriod, getEccentricity, getInclination,
} from './simMode.js';

// Real AU: Mercury 0.39 · Venus 0.72 · Earth 1.00 · Mars 1.52
//          Jupiter 5.20 · Saturn 9.55 · Uranus 19.20 · Neptune 30.05
// displayR = 1100 + 350×sqrt(au) — Sun radius 995, buffer ~324 u Mercuru,
// vnitřní planety čitelně oddělené od Slunce, outer roztaženy ale ne extrém.
//   Mercury 0.39 → 1318  · Venus 1.0  → 1397
//   Earth   1.0  → 1450  · Mars  1.52 → 1532
//   Jupiter 5.2  → 1898  · Saturn 9.55 → 2182
//   Uranus 19.2 → 2635   · Neptune 30 → 3018
export function auToDisplayRadius(au) {
  return 1100 + 350 * Math.sqrt(au);
}

/**
 * Pozice planety v čase elapsed (s). Eliptická orbita s inclination.
 * Bere aktuální orbitRadius/period/e/inc podle simMode (Pochopení/Fyzikální).
 */
export function orbitalPosition(planet, elapsed) {
  const a = getOrbitRadius(planet);
  if (a === 0) return { x: 0, y: 0, z: 0 };
  const period = getOrbitalPeriod(planet);
  const e = getEccentricity(planet);
  const inc = getInclination(planet);
  const { x, y, z } = orbitPosition(elapsed, planet.initialPhaseRad, period, a, e, inc);
  return { x, y, z };
}

/**
 * Aktualizuje pozice všech planet anchors podle aktuálního času.
 * Sun (orbitRadius=0) zůstává v origin.
 */
export function updatePlanetOrbits(anchors, planets, elapsed) {
  for (const p of planets) {
    const a = anchors[p.id];
    if (!a) continue;
    const pos = orbitalPosition(p, elapsed);
    a.position.set(pos.x, pos.y, pos.z);
  }
}
