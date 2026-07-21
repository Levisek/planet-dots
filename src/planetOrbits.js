// planetOrbits — pozice z positionProvider (ephemeris/Kepler), zobrazovací
// transformace (Pochopení/Fyzikální) přes simMode.toDisplay.
// V4.4: nahrazuje starý orbit.js Kepler solver napojený na elapsed (V4.2/V4.3).

import { getHelioPosition } from './positionProvider.js';
import { toDisplay } from './simMode.js';

// Real AU: Mercury 0.39 · Venus 0.72 · Earth 1.00 · Mars 1.52
//          Jupiter 5.20 · Saturn 9.55 · Uranus 19.20 · Neptune 30.05
// displayR = 1100 + 350×sqrt(au) — Sun radius 995, buffer ~324 u Mercuru,
// vnitřní planety čitelně oddělené od Slunce, outer roztaženy ale ne extrém.
//   Mercury 0.39 → 1318  · Venus 1.0  → 1397
//   Earth   1.0  → 1450  · Mars  1.52 → 1532
//   Jupiter 5.2  → 1898  · Saturn 9.55 → 2182
//   Uranus 19.2 → 2635   · Neptune 30 → 3018
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
