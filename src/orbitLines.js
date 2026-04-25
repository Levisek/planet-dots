// orbitLines — kruhy v XZ rovině per planeta, vyznačují trajektorii kolem Slunce.
// Reagují na simMode (Pochopení vs Fyzikální = jiný orbitRadius). Velmi tenké
// šedé linie, transparent, ne v cestě dotty/mesh.

import * as THREE from 'three';
import { PLANETS } from './planets.js';
import { getOrbitRadius, onModeChange } from './simMode.js';

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
