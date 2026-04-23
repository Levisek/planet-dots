import * as THREE from 'three';
import { PLANETS } from './planets.js';

// Rotace kolem lokální Y osy (severní pól = +Y po aplikaci tilt).
// Používáme Object3D.rotateOnAxis s vektorem (0,1,0) v LOCAL prostoru,
// aby rotace respektovala axial tilt aplikovaný přes mesh.rotation.z.
const LOCAL_Y = new THREE.Vector3(0, 1, 0);

export function updateRotations(meshes, dtSeconds) {
  for (const p of PLANETS) {
    const mesh = meshes[p.id];
    if (!mesh) continue;
    const omega = (Math.PI * 2) / p.rotationPeriod; // rad/s
    mesh.rotateOnAxis(LOCAL_Y, omega * p.direction * dtSeconds);
  }
}
