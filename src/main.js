import * as THREE from 'three';
import { createScene, createStarfield } from './scene.js';
import { createPlanetMeshes } from './planetMeshes.js';
import { updateRotations } from './rotation.js';
import { ParticlePool } from './particles.js';
import { phaseAt, updatePhaseInit } from './animation.js';

const { renderer, scene, camera } = createScene();
createStarfield(scene);
const { meshes, rings } = createPlanetMeshes(scene);

const pool = new ParticlePool(1500);
scene.add(pool.mesh);
pool.resetAllToFree();

const clock = new THREE.Clock();
let elapsed = 0;
let paused = false;

function tick() {
  const dt = paused ? 0 : clock.getDelta();
  elapsed += dt;

  const ph = phaseAt(elapsed);
  if (ph.id === 'init') updatePhaseInit(pool, elapsed, dt);
  // ostatní fáze doplníme v dalších taskech

  // po 7s se roztočí rotace
  if (elapsed >= 7) updateRotations(meshes, dt);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
