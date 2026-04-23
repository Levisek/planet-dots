import * as THREE from 'three';
import { createScene } from './scene.js';

const { renderer, scene, camera } = createScene();

function tick() {
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
