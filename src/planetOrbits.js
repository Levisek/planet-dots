// planetOrbits — pure-math helpers pro 3D orbity planet kolem Slunce.
// Slunce je v origin (0,0,0), planety obíhají v XZ rovině (Y=0).
// Žádný eccentricity (kruhové orbity pro V4.2 — eccentricity přijde s V4.3).

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
 * Pozice planety v čase elapsed (s). Kruhová orbita v XZ rovině.
 * @param {{ orbitRadius: number, orbitalPeriodSec: number, initialPhaseRad: number }} planet
 * @param {number} elapsed
 */
export function orbitalPosition(planet, elapsed) {
  if (planet.orbitRadius === 0) return { x: 0, y: 0, z: 0 };
  const omega = (2 * Math.PI) / planet.orbitalPeriodSec;
  const theta = planet.initialPhaseRad + omega * elapsed;
  return {
    x: planet.orbitRadius * Math.cos(theta),
    y: 0,
    z: planet.orbitRadius * Math.sin(theta),
  };
}

/**
 * Aktualizuje pozici všech planet anchors podle aktuálního času.
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
