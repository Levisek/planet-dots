import * as THREE from 'three';
import { createScene, createStarfield } from './scene.js';
import { createPlanetMeshes } from './planetMeshes.js';
import { updateRotations } from './rotation.js';
import { ParticlePool, PHASE } from './particles.js';

const { renderer, scene, camera } = createScene();
createStarfield(scene);
const { meshes, rings } = createPlanetMeshes(scene);

// DEBUG planet visible.
for (const m of Object.values(meshes)) { m.material.opacity = 1; m.material.transparent = false; }
for (const r of Object.values(rings)) { r.material.opacity = 0.9; }

const pool = new ParticlePool(1500);
scene.add(pool.mesh);

// DEBUG: rozmístit tečky náhodně a ukázat je.
for (let i = 0; i < pool.count; i++) {
  pool.setPosition(i,
    (Math.random() - 0.5) * 1600,
    (Math.random() - 0.5) * 700,
    (Math.random() - 0.5) * 400,
  );
  pool.alpha[i] = 0.7;
}
pool.flushDirty();

const clock = new THREE.Clock();
function tick() {
  const dt = clock.getDelta();
  updateRotations(meshes, dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
