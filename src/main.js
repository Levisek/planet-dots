import { createScene, createStarfield } from './scene.js';
import { createPlanetMeshes } from './planetMeshes.js';

const { renderer, scene, camera } = createScene();
createStarfield(scene);
const planetMeshes = createPlanetMeshes(scene);

// DEBUG — zobrazit všechny okamžitě (odstraníme v Task 17).
for (const mesh of Object.values(planetMeshes)) {
  mesh.material.opacity = 1;
  mesh.material.transparent = false;
}

function tick() {
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
