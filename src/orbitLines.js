// orbitLines — kruhy v XZ rovině per planeta, vyznačují trajektorii kolem Slunce.
// Reagují na simMode (Pochopení vs Fyzikální = jiný orbitRadius). Velmi tenké
// šedé linie, transparent, ne v cestě dotty/mesh.

import * as THREE from 'three';
import { PLANETS } from './planets.js';
import { ASTEROIDS } from './asteroids.js';
import { getOrbitRadius, getEccentricity, getInclination, onModeChange, isFyzikalni } from './simMode.js';
import { sampleKeplerCurve } from './moonOrbitLines.js';
import { auToDisplayRadius } from './planetOrbits.js';

const AU_TO_DISPLAY_REAL = 3846; // linear AU mapping per planets.js V4.2 spec

function asteroidOrbitRadius(a) {
  return isFyzikalni() ? a.a * AU_TO_DISPLAY_REAL : auToDisplayRadius(a.a);
}

const SEGMENTS = 192;

function buildPositions(radius) {
  const positions = new Float32Array((SEGMENTS + 1) * 3);
  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * Math.PI * 2;
    positions[i * 3] = radius * Math.cos(theta);
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = radius * Math.sin(theta);
  }
  return positions;
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
    const r = getOrbitRadius(p);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(buildPositions(r), 3));
    const line = new THREE.Line(geom, material);
    line.userData.planetId = p.id;
    scene.add(line);
    lines.push({ planetId: p.id, line });
  }

  // Při změně simMode přepočítej radii všech čar.
  onModeChange(() => {
    for (const entry of lines) {
      const planet = PLANETS.find((p) => p.id === entry.planetId);
      const r = getOrbitRadius(planet);
      const positions = entry.line.geometry.attributes.position.array;
      for (let i = 0; i <= SEGMENTS; i++) {
        const theta = (i / SEGMENTS) * Math.PI * 2;
        positions[i * 3] = r * Math.cos(theta);
        positions[i * 3 + 2] = r * Math.sin(theta);
      }
      entry.line.geometry.attributes.position.needsUpdate = true;
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
    const radius = asteroidOrbitRadius(a);
    const e = getEccentricity(a);
    const inc = getInclination(a);
    const points = sampleKeplerCurve(128, radius, e, inc);
    const geom = new THREE.BufferGeometry().setFromPoints(
      points.map((p) => new THREE.Vector3(p.x, p.y, p.z))
    );
    const line = new THREE.LineLoop(geom, ASTEROID_ORBIT_MATERIAL);
    line.userData.asteroidId = a.id;
    scene.add(line);
    lines.push({ asteroidId: a.id, line });
  }

  // Při změně simMode přepočítej orbity asteroidů.
  onModeChange(() => {
    for (const entry of lines) {
      const asteroid = ASTEROIDS.find((a) => a.id === entry.asteroidId);
      const radius = asteroidOrbitRadius(asteroid);
      const e = getEccentricity(asteroid);
      const inc = getInclination(asteroid);
      const points = sampleKeplerCurve(128, radius, e, inc);
      entry.line.geometry.dispose();
      entry.line.geometry = new THREE.BufferGeometry().setFromPoints(
        points.map((p) => new THREE.Vector3(p.x, p.y, p.z))
      );
    }
  });

  return {
    setVisible(v) {
      for (const entry of lines) entry.line.visible = v;
    },
  };
}
