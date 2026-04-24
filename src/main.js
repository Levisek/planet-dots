import * as THREE from 'three';
import { PLANETS, POOL_SIZE } from './planets.js';
import { createScene, createStarfield } from './scene.js';
import { createPlanetAnchors } from './planetAnchors.js';
import { ParticlePool } from './particles.js';
import { rotateAnchors } from './rotation.js';
import { updateSolarWind } from './solarWind.js';

const { renderer, scene, camera } = createScene();
createStarfield(scene);
const { anchors, imageData, loaded } = createPlanetAnchors(scene);
const anchorsByIndex = PLANETS.map(p => anchors[p.id]);

const pool = new ParticlePool(POOL_SIZE);
scene.add(pool.mesh);

const clock = new THREE.Clock();
let elapsed = 0;
const paused = false;

function initAfterLoad() {
  // Naplň Slunce initial Fibonacci clusterem (PLANETS[0] = sun).
  const sun = PLANETS[0];
  const sunAnchor = anchors.sun;
  pool.initFullSun(
    sunAnchor.position,
    sun.radiusPx,
    imageData.sun,
    sun.tickCount,
  );
}

function tick() {
  const dt = paused ? 0 : clock.getDelta();
  elapsed += dt;

  // Rotace anchorů běží stále — aby matrixWorld byl aktuální pro applyClusterRotation.
  rotateAnchors(anchors, dt);

  // Solar wind: emit částic ze Slunce k aktuální target planetě.
  updateSolarWind(pool, elapsed, dt, anchors, imageData);

  // Tečky v letu: position += velocity * dt, lerp color, arrival snap, hold/fall.
  pool.updateFlight(elapsed, dt);

  // Usazené tečky (ON_PLANET / ON_RING / ON_SUN) následují rotující anchor.
  pool.applyClusterRotation(anchorsByIndex);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

loaded.then(() => {
  initAfterLoad();
  clock.start();
  requestAnimationFrame(tick);
}).catch((err) => {
  console.error('Texture preload failed:', err);
  clock.start();
  requestAnimationFrame(tick);
});
