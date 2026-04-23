import * as THREE from 'three';
import { createScene, createStarfield } from './scene.js';
import { createPlanetMeshes } from './planetMeshes.js';
import { updateRotations } from './rotation.js';

const { renderer, scene, camera } = createScene();
createStarfield(scene);
const { meshes, rings } = createPlanetMeshes(scene);

// DEBUG — zobrazit všechny okamžitě.
for (const m of Object.values(meshes)) { m.material.opacity = 1; m.material.transparent = false; }
for (const r of Object.values(rings)) { r.material.opacity = 0.9; }

const clock = new THREE.Clock();

function tick() {
  const dt = clock.getDelta();
  updateRotations(meshes, dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
