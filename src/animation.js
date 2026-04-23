import { PLANETS, PLANET_BY_ID } from './planets.js';
import { textToPoints } from './label.js';
import { fibonacciSphere } from './geometry.js';
import { PHASE } from './phase.js';

// Animation timeline — fáze V1.

export const PHASES = [
  { start: 0,   end: 1,   id: 'init' },
  { start: 1,   end: 2,   id: 'sun',     planetId: 'sun',     label: 'SLUNCE' },
  { start: 2,   end: 2.4, id: 'mercury', planetId: 'mercury', label: 'MERKUR' },
  { start: 2.4, end: 2.9, id: 'venus',   planetId: 'venus',   label: 'VENUŠE' },
  { start: 2.9, end: 3.4, id: 'earth',   planetId: 'earth',   label: 'ZEMĚ' },
  { start: 3.4, end: 3.9, id: 'mars',    planetId: 'mars',    label: 'MARS' },
  { start: 3.9, end: 5,   id: 'jupiter', planetId: 'jupiter', label: 'JUPITER' },
  { start: 5,   end: 6,   id: 'saturn',  planetId: 'saturn',  label: 'SATURN' },
  { start: 6,   end: 6.5, id: 'uranus',  planetId: 'uranus',  label: 'URAN' },
  { start: 6.5, end: 7,   id: 'neptune', planetId: 'neptune', label: 'NEPTUN' },
  { start: 7,   end: Infinity, id: 'live' },
];

export function phaseAt(t) {
  for (const ph of PHASES) {
    if (t >= ph.start && t < ph.end) return ph;
  }
  return PHASES[PHASES.length - 1];
}

export function phaseProgress(t) {
  // Na hraně t === ph.end (pro non-init konečné fáze) vracíme 1 této fáze,
  // nikoliv 0 následující — kvůli plynulému dojezdu animace.
  for (const ph of PHASES) {
    if (ph.id === 'init') continue;
    if (isFinite(ph.end) && t === ph.end) return 1;
  }
  const ph = phaseAt(t);
  if (!isFinite(ph.end)) return 0;
  return (t - ph.start) / (ph.end - ph.start);
}

// Sub-fáze uvnitř každého planet slotu:
//   0.0 – 0.25  : label forming
//   0.25 – 0.55 : label holding
//   0.55 – 0.85 : flying to planet
//   0.85 – 1.0  : fade-in textury
export const SUB = Object.freeze({
  LABEL_FORM_END: 0.25,
  LABEL_HOLD_END: 0.55,
  FLY_END: 0.85,
});

export function updatePhaseInit(pool, tSeconds, dt) {
  // 0..1s — materializace (fade-in alpha) + noise drift
  pool.fadeInAll(1.2, dt);
  pool.noiseDriftAll(tSeconds, dt, 8);
}

// cache pro label points a fibonacci body (nezávislé na čase)
const _cache = new Map();

function getPlanetSlotData(planetId, tickCount) {
  const key = `${planetId}:${tickCount}`;
  if (_cache.has(key)) return _cache.get(key);
  const p = PLANET_BY_ID[planetId];
  const labelPts = textToPoints(p.name, Math.min(tickCount, 240));
  const fibPts = fibonacciSphere(tickCount, p.radiusPx * 1.02);
  const planetIndex = PLANETS.findIndex((pp) => pp.id === planetId);
  const data = { planet: p, labelPts, fibPts, planetIndex };
  _cache.set(key, data);
  return data;
}

/**
 * Invokováno pro fázi planetárního slotu (sun, mercury, ... neptune).
 * Dots-only: žádné mesh fade-in, tečky se sesypou z labelu na planetu
 * a získají barvy sampled z textury. Saturn má navíc ring dots.
 *
 * @param {ParticlePool} pool
 * @param {Object} ph — fáze z PHASES
 * @param {number} phaseT — progress uvnitř fáze (0..1)
 * @param {number} dt
 * @param {Object} anchors — { [planetId]: Object3D }
 * @param {Object} imageData — { [planetId]: ImageData, [planetId+"_ring"]: ImageData }
 */
export function updatePhasePlanet(pool, ph, phaseT, dt, anchors, imageData) {
  const planet = PLANET_BY_ID[ph.planetId];
  const slot = getPlanetSlotData(ph.planetId, planet.tickCount);
  const anchor = anchors[planet.id];
  const texData = imageData[planet.id];
  if (!anchor || !texData) return; // textury ještě nenačtené

  // první frame fáze: rezervovat indexy pro planet dots + label
  if (!ph._allocated) {
    ph._allocated = pool.takeFreeIndices(planet.tickCount);
    pool.assignLabelTargets(ph._allocated, slot.labelPts);

    // Saturn: rezervovat i ring dots (zatím v label-holding stavu, vlastní label nemají)
    if (planet.ringTexture && planet.ringTickCount) {
      ph._ringAllocated = pool.takeFreeIndices(planet.ringTickCount);
      // Ring tečky drží "stranou" (stejný label area), sesypou se souběžně s Saturnem
      pool.assignLabelTargets(ph._ringAllocated, slot.labelPts);
    }
  }

  // sub-fáze dle phaseT:
  if (phaseT < SUB.LABEL_FORM_END) {
    pool.lerpToTargets(0.18);
  } else if (phaseT < SUB.LABEL_HOLD_END) {
    pool.lerpToTargets(0.25);
  } else if (phaseT < SUB.FLY_END) {
    // flying to planet — přepnout targets na sphere surface s color sampling
    if (!ph._retargeted) {
      const center = anchor.position;
      pool.assignPlanetDotsFromTexture(
        ph._allocated,
        center,
        slot.fibPts,
        texData,
        slot.planetIndex,
      );
      // Saturn ring:
      if (ph._ringAllocated && imageData[`${planet.id}_ring`]) {
        const tilt = planet.axialTilt * Math.PI / 180;
        pool.assignRingDotsFromTexture(
          ph._ringAllocated,
          center,
          planet.ringInnerRadius,
          planet.ringOuterRadius,
          imageData[`${planet.id}_ring`],
          tilt,
          slot.planetIndex,
        );
      }
      ph._retargeted = true;
    }
    pool.lerpToTargets(0.12);
  } else {
    // final settle — lerp a přepnout na ON_PLANET / ON_RING stav
    pool.lerpToTargets(0.08);
    // první frame v této sub-fázi → promote FLYING_TO_PLANET na ON_PLANET / ON_RING
    if (!ph._settled) {
      for (const i of ph._allocated) {
        if (pool.phase[i] === PHASE.FLYING_TO_PLANET) pool.phase[i] = PHASE.ON_PLANET;
      }
      if (ph._ringAllocated) {
        for (const i of ph._ringAllocated) {
          if (pool.phase[i] === PHASE.FLYING_TO_PLANET) pool.phase[i] = PHASE.ON_RING;
        }
      }
      ph._settled = true;
    }
  }
}

export function updatePhaseLive(pool, tSeconds, dt, anchors) {
  // Safety: cokoli ještě FLYING_TO_PLANET → ON_PLANET / ON_RING
  for (let i = 0; i < pool.count; i++) {
    if (pool.phase[i] === PHASE.FLYING_TO_PLANET) {
      pool.phase[i] = pool.size[i] < 2.0 ? PHASE.ON_RING : PHASE.ON_PLANET;
    }
  }
  // Free tečky pokračují v noise driftu
  pool.noiseDriftAll(tSeconds, dt, 3);
}
