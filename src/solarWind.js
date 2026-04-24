import { PLANETS, PLANET_BY_ID, LABEL_TICK_COUNT } from './planets.js';
import { fibonacciSphere } from './geometry.js';
import { textToPoints } from './label.js';
import { phaseAt } from './animation.js';
import { PHASE } from './phase.js';

export const TRAVEL_TIME = 0.35;
export const LABEL_HOLD = 0.3;

/**
 * Vzorkuje RGB z ImageData podle UV (0..1).
 * Vrací [r,g,b] v rozsahu 0..1.
 */
function sampleColor(imageData, u, v) {
  const { data, width, height } = imageData;
  const px = Math.min(width - 1, Math.max(0, Math.floor(u * width)));
  const py = Math.min(height - 1, Math.max(0, Math.floor((1 - v) * height)));
  const idx = (py * width + px) * 4;
  return [data[idx] / 255, data[idx + 1] / 255, data[idx + 2] / 255];
}

/**
 * Spočítá UV pro Fibonacci sphere bod [x,y,z] (sphere of given radius).
 */
function sphericalUV(x, y, z, r) {
  const u = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
  const v = Math.asin(y / r) / Math.PI + 0.5;
  return [u, v];
}

/**
 * Per-planet targets: label pozice + Fibonacci sphere surface + (pro Saturn) ring.
 * Vrací pole objektů { pos, localOffset, color, phase, isLabel, labelFallTarget }.
 */
function buildTargetsForPlanet(planet, anchor, imageData, ringImageData) {
  const targets = [];
  const centerX = anchor.position.x;
  const centerY = anchor.position.y;
  const centerZ = anchor.position.z;

  // 1. Label pozice (LABEL_TICK_COUNT bodů) — nad planetou a mírně vpředu.
  const labelPts = textToPoints(planet.name, LABEL_TICK_COUNT);
  const labelCenterY = centerY + Math.max(180, planet.radiusPx * 1.5);
  const labelCenterZ = centerZ + 80;

  // 2. Surface Fibonacci points — první LABEL_TICK_COUNT z nich slouží jako cíle pro label tečky (po hold spadnou sem).
  const surfacePts = fibonacciSphere(planet.tickCount, planet.radiusPx * 1.02);

  // Label entries first — jejich labelFallTarget = surfacePts[k]
  for (let k = 0; k < labelPts.length && k < LABEL_TICK_COUNT; k++) {
    const lp = labelPts[k];
    const surfOffset = surfacePts[k];
    const [u, v] = sphericalUV(surfOffset[0], surfOffset[1], surfOffset[2], planet.radiusPx * 1.02);
    const color = sampleColor(imageData, u, v);
    targets.push({
      pos: { x: centerX + lp[0] * 0.8, y: labelCenterY + lp[1] * 0.8, z: labelCenterZ },
      localOffset: { x: surfOffset[0], y: surfOffset[1], z: surfOffset[2] },
      color,
      phase: PHASE.ON_PLANET,
      isLabel: true,
      labelFallTarget: { x: centerX + surfOffset[0], y: centerY + surfOffset[1], z: centerZ + surfOffset[2] },
    });
  }

  // Surface-only (zbytek Fibonacci — přeskoč prvních LABEL_TICK_COUNT, už je použito pro labely)
  for (let k = LABEL_TICK_COUNT; k < surfacePts.length; k++) {
    const off = surfacePts[k];
    const [u, v] = sphericalUV(off[0], off[1], off[2], planet.radiusPx * 1.02);
    const color = sampleColor(imageData, u, v);
    targets.push({
      pos: { x: centerX + off[0], y: centerY + off[1], z: centerZ + off[2] },
      localOffset: { x: off[0], y: off[1], z: off[2] },
      color,
      phase: PHASE.ON_PLANET,
      isLabel: false,
      labelFallTarget: null,
    });
  }

  // 3. Saturn ring
  if (planet.ringTexture && planet.ringTickCount && ringImageData) {
    const tilt = planet.axialTilt * Math.PI / 180;
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    const { data, width, height } = ringImageData;
    const py = Math.floor(0.5 * height);
    for (let k = 0; k < planet.ringTickCount; k++) {
      const t = Math.random();
      const r = Math.sqrt(planet.ringInnerRadius ** 2 + t * (planet.ringOuterRadius ** 2 - planet.ringInnerRadius ** 2));
      const theta = Math.random() * Math.PI * 2;
      const lx = Math.cos(theta) * r;
      const ly = 0;
      const lz = Math.sin(theta) * r;
      // apply axial tilt (rotace kolem Z)
      const ox = lx;
      const oy = ly * cosT - lz * sinT;
      const oz = ly * sinT + lz * cosT;
      const px = Math.min(width - 1, Math.max(0, Math.floor(t * width)));
      const idx = (py * width + px) * 4;
      const alpha = data[idx + 3] / 255;
      targets.push({
        pos: { x: centerX + ox, y: centerY + oy, z: centerZ + oz },
        localOffset: { x: ox, y: oy, z: oz },
        color: [data[idx] / 255, data[idx + 1] / 255, data[idx + 2] / 255],
        phase: PHASE.ON_RING,
        isLabel: false,
        labelFallTarget: null,
        ringAlpha: alpha,
      });
    }
  }

  return targets;
}

const _cache = new Map();

function getPlanetTargets(planet, anchor, imageData, ringImageData) {
  if (_cache.has(planet.id)) return _cache.get(planet.id);
  const targets = buildTargetsForPlanet(planet, anchor, imageData, ringImageData);
  _cache.set(planet.id, targets);
  return targets;
}

/**
 * Per-phase controller: tracks progress a emituje správný počet teček.
 * Stav (emittedCount) se ukládá přímo do phase objektu (mutation).
 *
 * @param {ParticlePool} pool
 * @param {number} currentTime
 * @param {number} dt
 * @param {Object} anchors — { [planetId]: Object3D }
 * @param {Object} imageData — { [planetId]: ImageData, [planetId+"_ring"]: ImageData }
 */
export function updateSolarWind(pool, currentTime, dt, anchors, imageData) {
  const ph = phaseAt(currentTime);
  if (!ph || ph.id === 'init' || ph.id === 'live' || ph.id === 'sun') return;
  if (!ph.planetId) return;

  const planet = PLANET_BY_ID[ph.planetId];
  const anchor = anchors[planet.id];
  const tex = imageData[planet.id];
  if (!anchor || !tex) return;

  const ringTex = planet.ringTexture ? imageData[`${planet.id}_ring`] : null;
  const targets = getPlanetTargets(planet, anchor, tex, ringTex);

  // Progress uvnitř fáze → očekávaný počet emisí.
  const phaseDuration = ph.end - ph.start;
  const progress = Math.min(1, (currentTime - ph.start) / phaseDuration);
  const expected = Math.floor(progress * targets.length);

  if (ph._emittedCount === undefined) ph._emittedCount = 0;

  const emitCount = expected - ph._emittedCount;
  if (emitCount <= 0) return;

  // Sun center (PLANETS[0] = sun) — zdroj proudu.
  const sunAnchor = anchors.sun;
  const sunCenter = { x: sunAnchor.position.x, y: sunAnchor.position.y, z: sunAnchor.position.z };
  const sunRadius = PLANETS[0].radiusPx;
  const planetIdx = PLANETS.findIndex(p => p.id === planet.id);

  const idleIndices = pool.takeIdleIndices(emitCount);

  for (let k = 0; k < idleIndices.length; k++) {
    const idx = idleIndices[k];
    const targetIdx = ph._emittedCount + k;
    const t = targets[targetIdx];
    if (!t) break;

    pool.spawnFromSun(
      idx,
      sunCenter,
      sunRadius,
      t.pos,
      t.localOffset,
      t.color,
      planetIdx,
      t.phase,
      currentTime,
      TRAVEL_TIME,
      t.isLabel ? t.pos : null,
      LABEL_HOLD,
    );

    // Pro label: postArrivalTarget musí být labelFallTarget (povrch), ne label pozice.
    if (t.isLabel && t.labelFallTarget) {
      pool.postArrivalTarget[3 * idx]     = t.labelFallTarget.x;
      pool.postArrivalTarget[3 * idx + 1] = t.labelFallTarget.y;
      pool.postArrivalTarget[3 * idx + 2] = t.labelFallTarget.z;
    }

    // Ring alpha korekce velikosti tečky.
    if (t.ringAlpha !== undefined) {
      pool.size[idx] = 2.8 * t.ringAlpha;
    }
  }

  ph._emittedCount += idleIndices.length;
}

export function resetSolarWind() {
  _cache.clear();
}
