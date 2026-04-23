import * as THREE from 'three';
import { createScene, createStarfield } from './scene.js';
import { createPlanetMeshes } from './planetMeshes.js';
import { updateRotations } from './rotation.js';
import { ParticlePool } from './particles.js';
import { phaseAt, phaseProgress, updatePhaseInit, updatePhasePlanet } from './animation.js';

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
  const pt = phaseProgress(elapsed);

  if (ph.id === 'init') {
    updatePhaseInit(pool, elapsed, dt);
  } else if (ph.planetId) {
    updatePhasePlanet(pool, ph, pt, dt, meshes);
  }
  // live phase doplníme v Task 20

  if (elapsed >= 7) updateRotations(meshes, dt);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
