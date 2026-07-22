// moonOrbitLines — křivky vzorkované ze stejného provideru jako moon dot pozice
// (getRelativePosition + toDisplayRelative), přes jednu oběžnou periodu, aby
// linie a dot koincidovaly by construction (V4.4, viz task-9 brief).

import * as THREE from 'three';
import { getRelativePosition } from './positionProvider.js';
import { toDisplayRelative } from './simMode.js';

const ORBIT_LINE_MATERIAL = new THREE.LineBasicMaterial({
  color: 0x6688aa,
  transparent: true,
  opacity: 0.4,
});

const SEGMENTS = 96;

// EPHEMERIS_MOONS (luna, io, europa, ganymede, callisto) nemají elements —
// perioda z reálných astronomických dat (dny), viz task-9 brief.
const MOON_PERIOD_DAYS = {
  luna: 27.322, io: 1.769, europa: 3.551, ganymede: 7.155, callisto: 16.689,
};

function periodDaysOf(moon) {
  return moon.elements ? moon.elements.periodDays : MOON_PERIOD_DAYS[moon.id];
}

/**
 * Vzorkuje relativní pozici měsíce (vůči rodičovské planetě) přes jednu
 * oběžnou periodu pomocí stejných funkcí, které main.js používá pro dot.
 * Pure function nad providerem — vrací THREE.Vector3[] v relativních scene units.
 */
function sampleMoonCurve(moon, baseDate, segments = SEGMENTS) {
  const period = periodDaysOf(moon);
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const d = new Date(baseDate.getTime() + (i / segments) * period * 86400000);
    const rel = getRelativePosition(moon.id, d);
    const disp = toDisplayRelative(rel);
    points.push(new THREE.Vector3(disp.x, disp.y, disp.z));
  }
  return points;
}

/**
 * Vytvoří moon orbit lines pro všechny moony jedné planety.
 * Lines jsou children planet anchoru (dědí axial tilt), vzorkované z reálného
 * position provideru — kryjí se s moon dot pozicí by construction.
 *
 * @param {string} planetId
 * @param {Object<string, import('three').Object3D>} planetAnchors
 * @param {object} moonsByPlanet — { [planetId]: [moon1, moon2, ...] }
 * @returns {import('three').LineLoop[]}
 */
export function showFor(planetId, planetAnchors, moonsByPlanet) {
  const planet = planetAnchors[planetId];
  if (!planet) return [];
  const moons = moonsByPlanet[planetId] || [];
  const baseDate = new Date();
  const lines = [];
  for (const m of moons) {
    const points = sampleMoonCurve(m, baseDate);
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.LineLoop(geom, ORBIT_LINE_MATERIAL);
    planet.add(line);
    lines.push(line);
  }
  return lines;
}

/**
 * Dispose moon orbit lines (cleanup).
 * @param {import('three').LineLoop[]} lines
 */
export function disposeAll(lines) {
  for (const l of lines) {
    if (l.parent) l.parent.remove(l);
    l.geometry.dispose();
  }
}
