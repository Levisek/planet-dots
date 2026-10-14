// planetOrbits — pozice z positionProvider (ephemeris/Kepler), zobrazovací
// transformace (Pochopení/Fyzikální) přes simMode.toDisplay.
// V4.4: nahrazuje starý orbit.js Kepler solver napojený na elapsed (V4.2/V4.3).

import { getHelioPosition } from './positionProvider.js';
import { toDisplay } from './simMode.js';

// Real AU: Mercury 0.39 · Venus 0.72 · Earth 1.00 · Mars 1.52
//          Jupiter 5.20 · Saturn 9.55 · Uranus 19.20 · Neptune 30.05
// Slunce v Pochopení r = 260 (main.js).
//   Merkur 0,39 → 849 · Země 1 → 1500 · Jupiter 5,2 → 4035 · Neptun 30 → 11560
//   (mocnina AU^0,6, viz scale.js)
// Sdíleno se simMode.js přes scale.js (kvůli cyklickému importu re-export zde).
export { auToDisplayRadius } from './scale.js';

/**
 * Pozice planety ke konkrétnímu datu (JS Date). Heliocentrická AU pozice
 * z positionProvider (ephemeris nebo Kepler), přepočtená na scene units
 * přes aktuální zobrazovací mód (Pochopení/Fyzikální).
 */
export function orbitalPosition(planet, date) {
  if (planet.id === 'sun') return { x: 0, y: 0, z: 0 };
  const helioAU = getHelioPosition(planet.id, date);
  return toDisplay(helioAU, planet.id);
}

/**
 * Aktualizuje pozice všech planet anchors ke konkrétnímu datu.
 * Sun zůstává v origin.
 */
export function updatePlanetOrbits(anchors, planets, date) {
  for (const p of planets) {
    const a = anchors[p.id];
    if (!a) continue;
    const pos = orbitalPosition(p, date);
    a.position.set(pos.x, pos.y, pos.z);
  }
}
