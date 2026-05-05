import * as THREE from 'three';
import { applyInclination, solveKepler } from './orbit.js';
import { getEccentricity, getInclination } from './simMode.js';

const ORBIT_LINE_MATERIAL = new THREE.LineBasicMaterial({
  color: 0x6688aa,
  transparent: true,
  opacity: 0.4,
});

/**
 * Sample N bodů na eliptické orbitě s inclination.
 * Pure function — žádný THREE.js dependency v vstupu ani výstupu.
 * @param {number} samples — počet bodů
 * @param {number} a — semi-major axis (px)
 * @param {number} e — eccentricity
 * @param {number} incDeg — sklon orbity (stupně)
 * @returns {{x:number, y:number, z:number}[]}
 */
export function sampleKeplerCurve(samples, a, e, incDeg) {
  const points = [];
  for (let i = 0; i < samples; i++) {
    const M = (2 * Math.PI * i) / samples;
    const E = solveKepler(M, e);
    const x = a * (Math.cos(E) - e);
    const z = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const inclined = applyInclination({ x, y: 0, z }, incDeg);
    points.push(inclined);
  }
  return points;
}

/**
 * Vytvoří moon orbit lines pro všechny moony jedné planety.
 * Lines jsou children planet anchoru (dědí axial tilt).
 *
 * @param {string} planetId
 * @param {Object<string, import('three').Object3D>} planetAnchors
 * @param {object} moonsByPlanet — { [planetId]: [moon1, moon2, ...] }
 * @param {Object<string, object>} planetByIdLookup — pro radiusPx
 * @returns {import('three').LineLoop[]}
 */
export function showFor(planetId, planetAnchors, moonsByPlanet, planetByIdLookup) {
  const planet = planetAnchors[planetId];
  if (!planet) return [];
  const planetData = planetByIdLookup ? planetByIdLookup[planetId] : null;
  const parentRadiusPx = planetData?.radiusPx || 100;
  const moons = moonsByPlanet[planetId] || [];
  const lines = [];
  for (const m of moons) {
    const a = m.a * parentRadiusPx;
    const e = getEccentricity(m);
    const inc = getInclination(m);
    const points = sampleKeplerCurve(64, a, e, inc);
    const geom = new THREE.BufferGeometry().setFromPoints(
      points.map(p => new THREE.Vector3(p.x, p.y, p.z))
    );
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
