import { PLANETS, PLANET_BY_ID } from './planets.js';
import { fibonacciSphere } from './geometry.js';
import { phaseAt } from './animation.js';
import { PHASE } from './phase.js';
import { sampleColor, sphericalUV } from './textureUtils.js';

export const TRAVEL_TIME = 0.35;

// Per-planet targets: Fibonacci sphere surface body. Cache per planet.id.
function buildTargetsForPlanet(planet, anchor, imageData) {
  const targets = [];
  const cx = anchor.position.x;
  const cy = anchor.position.y;
  const cz = anchor.position.z;
  const surfacePts = fibonacciSphere(planet.tickCount, planet.radiusPx * 1.02);
  for (const off of surfacePts) {
    const [u, v] = sphericalUV(off[0], off[1], off[2], planet.radiusPx * 1.02);
    targets.push({
      pos: { x: cx + off[0], y: cy + off[1], z: cz + off[2] },
      localOffset: { x: off[0], y: off[1], z: off[2] },
      color: sampleColor(imageData, u, v),
      phase: PHASE.ON_PLANET,
    });
  }
  return targets;
}

const _cache = new Map();

function getPlanetTargets(planet, anchor, imageData) {
  if (_cache.has(planet.id)) return _cache.get(planet.id);
  const targets = buildTargetsForPlanet(planet, anchor, imageData);
  _cache.set(planet.id, targets);
  return targets;
}

/**
 * Per-phase controller: tracks progress a emituje správný počet teček.
 * Stav (emittedCount) se ukládá přímo do phase objektu (mutation).
 */
export function updateSolarWind(pool, currentTime, dt, anchors, imageData) {
  const ph = phaseAt(currentTime);
  if (!ph) return;
  // Sun fáze (1..2s) — Sun base dotty zůstávají alpha=0, mesh je canonical.
  // Flares ze sunActivity spawn vlastní visible dotty nezávisle.
  if (ph.id === 'sun' || ph.id === 'init' || ph.id === 'live') return;
  if (!ph.planetId) return;

  const planet = PLANET_BY_ID[ph.planetId];
  const anchor = anchors[planet.id];
  const tex = imageData[planet.id];
  if (!anchor || !tex) return;

  const targets = getPlanetTargets(planet, anchor, tex);

  const phaseDuration = ph.end - ph.start;
  const progress = Math.min(1, (currentTime - ph.start) / phaseDuration);
  const expected = Math.floor(progress * targets.length);
  if (ph._emittedCount === undefined) ph._emittedCount = 0;
  const emitCount = expected - ph._emittedCount;
  if (emitCount <= 0) return;

  const sunAnchor = anchors.sun;
  const sunCenter = { x: sunAnchor.position.x, y: sunAnchor.position.y, z: sunAnchor.position.z };
  const sunRadius = PLANETS[0].radiusPx;
  const planetIdx = PLANETS.findIndex((p) => p.id === planet.id);

  const idleIndices = pool.takeIdleIndices(emitCount);
  for (let k = 0; k < idleIndices.length; k++) {
    const idx = idleIndices[k];
    const t = targets[ph._emittedCount + k];
    if (!t) break;
    pool.spawnFromSun(
      idx, sunCenter, sunRadius, t.pos, t.localOffset, t.color,
      planetIdx, t.phase, currentTime, TRAVEL_TIME,
      planet.alpha ?? 1.0, planet.dotSize ?? 6.0,
    );
  }
  ph._emittedCount += idleIndices.length;
}

export function resetSolarWind() {
  _cache.clear();
}
