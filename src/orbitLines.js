// orbitLines — křivky vzorkované ze stejného provideru jako dot pozice
// (planetOrbits.orbitalPosition), přes jednu oběžnou periodu. Line a dot se
// tak kryjí by construction (V4.4 — dřív kruh/kepler-curve z clamped getterů,
// dot z real provideru → planeta stála mimo vlastní linii, viz Jupiter report).
// Reagují na simMode (Pochopení vs Fyzikální = jiné mapování vzdáleností) přes
// re-sample při onModeChange. Velmi tenké šedé linie, transparent, ne v cestě
// dotty/mesh.

import * as THREE from 'three';
import { PLANETS } from './planets.js';
import { ASTEROIDS } from './asteroids.js';
import { onModeChange } from './simMode.js';
import { orbitalPosition } from './planetOrbits.js';

const SEGMENTS = 192;
const ASTEROID_SEGMENTS = 128;

// Ephemeris planety (Mercury..Neptune) nemají elements.periodDays — perioda
// z reálných astronomických dat (dny), viz task-9 brief.
const PLANET_PERIOD_DAYS = {
  mercury: 87.969, venus: 224.701, earth: 365.256, mars: 686.980,
  jupiter: 4332.589, saturn: 10759.22, uranus: 30685.4, neptune: 60189,
};

function periodDaysOf(body) {
  return body.elements ? body.elements.periodDays : PLANET_PERIOD_DAYS[body.id];
}

/**
 * Vzorkuje pozici tělesa (planeta nebo asteroid) přes jednu oběžnou periodu
 * pomocí stejné funkce `orbitalPosition`, kterou main.js používá pro dot.
 */
function sampleOrbitCurve(body, baseDate, segments) {
  const period = periodDaysOf(body);
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const d = new Date(baseDate.getTime() + (i / segments) * period * 86400000);
    const p = orbitalPosition(body, d);
    points.push(new THREE.Vector3(p.x, p.y, p.z));
  }
  return points;
}

export function createOrbitLines(scene) {
  const lines = [];
  const material = new THREE.LineBasicMaterial({
    color: 0x666666,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  for (const p of PLANETS) {
    if (p.id === 'sun' || p.orbitRadius === 0) continue;
    const points = sampleOrbitCurve(p, new Date(), SEGMENTS);
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.LineLoop(geom, material);
    line.userData.planetId = p.id;
    scene.add(line);
    lines.push({ planetId: p.id, line });
  }

  // Při změně simMode je mapování AU→scene units jiné → re-sample z provideru.
  onModeChange(() => {
    for (const entry of lines) {
      const planet = PLANETS.find((p) => p.id === entry.planetId);
      const points = sampleOrbitCurve(planet, new Date(), SEGMENTS);
      entry.line.geometry.dispose();
      entry.line.geometry = new THREE.BufferGeometry().setFromPoints(points);
    }
  });

  return {
    setVisible(v) {
      for (const entry of lines) entry.line.visible = v;
    },
  };
}

const ASTEROID_ORBIT_MATERIAL = new THREE.LineBasicMaterial({
  color: 0x665544,
  transparent: true,
  opacity: 0.3,
  depthWrite: false,
});

export function createAsteroidOrbitLines(scene) {
  const lines = [];
  for (const a of ASTEROIDS) {
    const points = sampleOrbitCurve(a, new Date(), ASTEROID_SEGMENTS);
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.LineLoop(geom, ASTEROID_ORBIT_MATERIAL);
    line.userData.asteroidId = a.id;
    scene.add(line);
    lines.push({ asteroidId: a.id, line });
  }

  // Při změně simMode přepočítej orbity asteroidů (re-sample z provideru).
  onModeChange(() => {
    for (const entry of lines) {
      const asteroid = ASTEROIDS.find((a) => a.id === entry.asteroidId);
      const points = sampleOrbitCurve(asteroid, new Date(), ASTEROID_SEGMENTS);
      entry.line.geometry.dispose();
      entry.line.geometry = new THREE.BufferGeometry().setFromPoints(points);
    }
  });

  return {
    setVisible(v) {
      for (const entry of lines) entry.line.visible = v;
    },
  };
}
