import { createScene, createStarfield } from './scene.js';

const { renderer, scene, camera } = createScene();
createStarfield(scene);

function tick() {
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
