import * as THREE from 'three';
import { PLANETS } from './planets.js';
import { createScene, createStarfield } from './scene.js';
import { createPlanetAnchors } from './planetAnchors.js';
import { ParticlePool } from './particles.js';
import { rotateAnchors } from './rotation.js';
import { phaseAt, phaseProgress, updatePhaseInit, updatePhasePlanet, updatePhaseLive } from './animation.js';

const { renderer, scene, camera } = createScene();
createStarfield(scene);
const { anchors, imageData, loaded } = createPlanetAnchors(scene);

// Indexovaná pole anchorů (stejné pořadí jako PLANETS) — pro applyClusterRotation.
// Počítá se jednou; anchory jsou perzistentní Object3D reference.
const anchorsByIndex = PLANETS.map(p => anchors[p.id]);

const pool = new ParticlePool(2000);
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

  // Rotace anchorů probíhá celou dobu (updatuje matrixWorld)
  rotateAnchors(anchors, dt);

  if (ph.id === 'init') {
    updatePhaseInit(pool, elapsed, dt);
  } else if (ph.id === 'live') {
    updatePhaseLive(pool, elapsed, dt, anchors);
  } else if (ph.planetId) {
    updatePhasePlanet(pool, ph, pt, dt, anchors, imageData);
  }

  // Tečky v ON_PLANET/ON_RING fázi následují rotující anchor.
  pool.applyClusterRotation(anchorsByIndex);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// Start render loop only after textures are ready, so color sampling works.
loaded.then(() => {
  clock.start();
  requestAnimationFrame(tick);
}).catch((err) => {
  console.error('Texture preload failed:', err);
  // start anyway without textures
  clock.start();
  requestAnimationFrame(tick);
});
