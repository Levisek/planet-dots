import { PLANET_BY_ID } from './planets.js';
import { textToPoints } from './label.js';
import { fibonacciSphere } from './geometry.js';
import { PHASE } from './phase.js';

// hex (0xRRGGBB) → { r, g, b } v rozsahu 0..1 (lehká náhrada za THREE.Color
// v kontextu animation.js, aby modul nemusel importovat three a šel testovat v Node)
function hexToColor01(hex) {
  return {
    r: ((hex >> 16) & 0xff) / 255,
    g: ((hex >> 8) & 0xff) / 255,
    b: (hex & 0xff) / 255,
  };
}

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
  const color = hexToColor01(p.color);
  const data = { planet: p, labelPts, fibPts, color };
  _cache.set(key, data);
  return data;
}

/** Invokováno pro fázi planetárního slotu (sun, mercury, ... neptune). */
export function updatePhasePlanet(pool, ph, phaseT, dt, planetMeshes) {
  const planet = PLANET_BY_ID[ph.planetId];
  const slot = getPlanetSlotData(ph.planetId, planet.tickCount);

  // první frame fáze: rezervovat indexy z FREE pool, přiřadit label targets
  if (!ph._allocated) {
    ph._allocated = pool.takeFreeIndices(planet.tickCount);
    pool.assignLabelTargets(ph._allocated, slot.labelPts);
  }

  // sub-fáze dle phaseT:
  if (phaseT < SUB.LABEL_FORM_END) {
    // forming label — lerp k label pozici
    pool.lerpToTargets(0.18);
  } else if (phaseT < SUB.LABEL_HOLD_END) {
    // holding — drží
    pool.lerpToTargets(0.25);
  } else if (phaseT < SUB.FLY_END) {
    // flying to planet — přepnout targets pokud ještě ne
    if (!ph._retargeted) {
      pool.assignPlanetTargets(ph._allocated, planetMeshes[planet.id].position, slot.fibPts, slot.color);
      ph._retargeted = true;
    }
    pool.lerpToTargets(0.12);
  } else {
    // fade-in textury
    pool.lerpToTargets(0.08);
    const mesh = planetMeshes[planet.id];
    const targetOp = (phaseT - SUB.FLY_END) / (1 - SUB.FLY_END);
    mesh.material.opacity = Math.min(1, targetOp);
    if (mesh.material.opacity >= 1) mesh.material.transparent = false;
  }
}
