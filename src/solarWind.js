import { PLANETS, PLANET_BY_ID } from './planets.js';
import { phaseAt } from './animation.js';
import { getPlanetTargets, resetPlanetTargets } from './planetTargets.js';

export const TRAVEL_TIME = 0.35;

/**
 * Per-phase controller: tracks progress a emituje správný počet teček.
 * Stav (emittedCount) se ukládá přímo do phase objektu (mutation).
 */
export function updateSolarWind(pool, currentTime, dt, anchors, imageData) {
  const ph = phaseAt(currentTime);
  if (!ph) return;
  // Sun fáze (1..2s) — Sun base dotty zůstávají alpha=0, mesh je canonical.
  if (ph.id === 'sun' || ph.id === 'init' || ph.id === 'live') return;
  if (!ph.planetId) return;

  const planet = PLANET_BY_ID[ph.planetId];
  const anchor = anchors[planet.id];
  const tex = imageData[planet.id];
  if (!anchor || !tex) return;

  const targets = getPlanetTargets(planet, tex);

  const phaseDuration = ph.end - ph.start;
  const progress = Math.min(1, (currentTime - ph.start) / phaseDuration);
  const expected = Math.floor(progress * targets.length);
  if (ph._emittedCount === undefined) ph._emittedCount = 0;
  const emitCount = expected - ph._emittedCount;
  if (emitCount <= 0) return;

  // Sun a planet pozice live — anchory se hýbou (Sun v origin, planety obíhají).
  const sunAnchor = anchors.sun;
  const sunCenter = { x: sunAnchor.position.x, y: sunAnchor.position.y, z: sunAnchor.position.z };
  const sunRadius = PLANETS[0].radiusPx;
  const planetIdx = PLANETS.findIndex((p) => p.id === planet.id);
  const cx = anchor.position.x, cy = anchor.position.y, cz = anchor.position.z;

  const idleIndices = pool.takeIdleIndices(emitCount);
  for (let k = 0; k < idleIndices.length; k++) {
    const idx = idleIndices[k];
    const t = targets[ph._emittedCount + k];
    if (!t) break;
    // Aktuální abs target pos = anchor.position + localOffset (anchor se hýbe).
    const targetPos = {
      x: cx + t.localOffset.x,
      y: cy + t.localOffset.y,
      z: cz + t.localOffset.z,
    };
    pool.spawnFromSun(
      idx, sunCenter, sunRadius, targetPos, t.localOffset, t.color,
      planetIdx, t.phase, currentTime, TRAVEL_TIME,
      planet.alpha ?? 1.0, planet.dotSize ?? 6.0,
    );
  }
  ph._emittedCount += idleIndices.length;
}

export function resetSolarWind() {
  resetPlanetTargets();
}
