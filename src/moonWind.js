import * as THREE from 'three';
import { MOONS, MOONS_BY_PARENT } from './moons.js';
import { PLANET_BY_ID } from './planets.js';
import { fibonacciSphere } from './geometry.js';
import { phaseAt } from './animation.js';
import { MOON_OWNER_BASE } from './phase.js';
import { sampleColor, sphericalUV } from './textureUtils.js';

export const MOON_TRAVEL_TIME = 0.3;

const MOON_INDEX_BY_ID = Object.fromEntries(MOONS.map((m, i) => [m.id, i]));

/**
 * Per-moon: Fibonacci sphere surface points + sampled colors.
 * Cached — nezávisí na čase, jen na moon datech a textuře.
 */
function buildMoonTargetsLocal(moon, moonImageData) {
  const surfacePts = fibonacciSphere(moon.tickCount, moon.radiusPx);
  const out = [];
  for (let k = 0; k < surfacePts.length; k++) {
    const off = surfacePts[k];
    const [u, v] = sphericalUV(off[0], off[1], off[2], moon.radiusPx);
    const color = sampleColor(moonImageData, u, v);
    out.push({
      localOffset: { x: off[0], y: off[1], z: off[2] },
      color,
    });
  }
  return out;
}

const _targetCache = new Map();
function getMoonTargets(moon, moonImageData) {
  if (_targetCache.has(moon.id)) return _targetCache.get(moon.id);
  const t = buildMoonTargetsLocal(moon, moonImageData);
  _targetCache.set(moon.id, t);
  return t;
}

const _tmpVec = new THREE.Vector3();

/**
 * Sub-fáze emise měsíců per rodina.
 * Aktivuje se během fází s id končícím `_moons` (viz animation.js Task 7).
 * Každý frame: dopočítat expected počet teček podle phase progress, vzít IDLE,
 * pro každou vypočítat world pos cíle přes `moonAnchor.matrixWorld` (který je fresh
 * z main.js updateMoonOrbits), emitovat přes `pool.spawnFromPlanet`.
 *
 * @param {ParticlePool} pool
 * @param {number} currentTime — elapsed (s)
 * @param {number} dt
 * @param {Object<string,THREE.Object3D>} planetAnchors
 * @param {Object<string,THREE.Object3D>} moonAnchors
 * @param {Object<string,ImageData>} planetImageData
 * @param {Object<string,ImageData>} moonImageData
 */
export function updateMoonWind(pool, currentTime, dt, planetAnchors, moonAnchors, planetImageData, moonImageData) {
  const ph = phaseAt(currentTime);
  if (!ph || !ph.id.endsWith('_moons')) return;

  const parentId = ph.parentId;
  if (!parentId) return;

  const parent = PLANET_BY_ID[parentId];
  const parentAnchor = planetAnchors[parentId];
  const parentTex = planetImageData[parentId];
  if (!parent || !parentAnchor || !parentTex) return;

  const moons = MOONS_BY_PARENT[parentId] || [];
  if (moons.length === 0) return;

  // Aggregate targets per rodina (localOffset + color + ref na moonAnchor).
  const allTargets = [];
  for (const m of moons) {
    const moonAnchor = moonAnchors[m.id];
    const moonTex = moonImageData[m.id];
    if (!moonAnchor || !moonTex) continue;
    const tgts = getMoonTargets(m, moonTex);
    const moonIdx = MOON_INDEX_BY_ID[m.id];
    for (const t of tgts) {
      allTargets.push({
        localOffset: t.localOffset,
        color: t.color,
        moonAnchor,
        moonIdx,
      });
    }
  }
  if (allTargets.length === 0) return;

  const phaseDuration = ph.end - ph.start;
  const progress = Math.min(1, (currentTime - ph.start) / phaseDuration);
  const expected = Math.floor(progress * allTargets.length);

  if (ph._emittedCount === undefined) ph._emittedCount = 0;
  const emitCount = expected - ph._emittedCount;
  if (emitCount <= 0) return;

  // Planet center v world space.
  const planetCenter = {
    x: parentAnchor.position.x,
    y: parentAnchor.position.y,
    z: parentAnchor.position.z,
  };

  // Planet color = sample z textury (random bod pro variety mezi emisemi).
  const planetColor = sampleColor(parentTex, Math.random(), Math.random());

  const idleIndices = pool.takeIdleIndices(emitCount);
  for (let k = 0; k < idleIndices.length; k++) {
    const idx = idleIndices[k];
    const t = allTargets[ph._emittedCount + k];
    if (!t) break;

    // World pos cíle = moonAnchor.matrixWorld × localOffset.
    _tmpVec.set(t.localOffset.x, t.localOffset.y, t.localOffset.z);
    _tmpVec.applyMatrix4(t.moonAnchor.matrixWorld);
    const moonOrbitWorld = { x: _tmpVec.x, y: _tmpVec.y, z: _tmpVec.z };

    const moon = MOONS[t.moonIdx];
    pool.spawnFromPlanet(
      idx,
      planetCenter,
      parent.radiusPx,
      moonOrbitWorld,
      t.localOffset,
      planetColor,
      t.color,
      MOON_OWNER_BASE + t.moonIdx,
      currentTime,
      MOON_TRAVEL_TIME,
      moon.dotSize ?? 5.0,
    );
  }
  ph._emittedCount += idleIndices.length;
}

/** Reset per-moon targets cache (volá se při restartu animace). */
export function resetMoonWind() {
  _targetCache.clear();
}
