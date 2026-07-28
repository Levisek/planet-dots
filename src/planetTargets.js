// planetTargets — povrchové cíle teček planet (sdílí formace/akrece).
// Přesunuto ze solarWind.js (V4.4 F3): targets nejsou vlastnost větru,
// ale planety samotné.
import { fibonacciSphere } from './geometry.js';
import { PHASE } from './phase.js';
import { sampleColor, sphericalUV } from './textureUtils.js';

function buildTargetsForPlanet(planet, imageData) {
  const targets = [];
  const surfacePts = fibonacciSphere(planet.tickCount, planet.radiusPx * 1.02);
  for (const off of surfacePts) {
    const [u, v] = sphericalUV(off[0], off[1], off[2], planet.radiusPx * 1.02);
    targets.push({
      localOffset: { x: off[0], y: off[1], z: off[2] },
      color: sampleColor(imageData, u, v),
      phase: PHASE.ON_PLANET,
    });
  }
  return targets;
}

const _cache = new Map();

export function getPlanetTargets(planet, imageData) {
  if (_cache.has(planet.id)) return _cache.get(planet.id);
  const targets = buildTargetsForPlanet(planet, imageData);
  _cache.set(planet.id, targets);
  return targets;
}

export function resetPlanetTargets() {
  _cache.clear();
}
