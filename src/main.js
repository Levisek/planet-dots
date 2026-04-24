import * as THREE from 'three';
import { PLANETS, PLANET_BY_ID, POOL_SIZE } from './planets.js';
import { MOONS } from './moons.js';
import { createScene, createStarfield } from './scene.js';
import { createPlanetAnchors } from './planetAnchors.js';
import { createMoonAnchors } from './moonAnchors.js';
import { ParticlePool } from './particles.js';
import { rotateAnchors } from './rotation.js';
import { updateSolarWind } from './solarWind.js';
import { updateMoonWind } from './moonWind.js';
import { orbitPosition, trueAnomaly } from './orbit.js';

const { renderer, scene, camera } = createScene();
createStarfield(scene);
const { anchors, imageData, loaded } = createPlanetAnchors(scene);
const { anchors: moonAnchors, imageData: moonImageData, loaded: moonsLoaded } = createMoonAnchors(scene, anchors);

// Unified anchor array — planety 0..8, měsíce 9..27 (MOON_OWNER_BASE=9). Používá applyClusterRotation.
const anchorsByIndex = [
  ...PLANETS.map(p => anchors[p.id]),
  ...MOONS.map(m => moonAnchors[m.id]),
];

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

/**
 * Per-frame update moon orbitálních pozic + tidal lock spin angle.
 * Moon anchor je child parent anchoru, takže .position je v lokálním frame.
 * Po update voláme updateMatrixWorld aby matrixWorld byl fresh pro moonWind spawn cíl.
 */
function updateMoonOrbits(t) {
  for (const m of MOONS) {
    const parent = PLANET_BY_ID[m.parent];
    const parentRadius = parent.radiusPx;
    const aPx = m.a * parentRadius;
    const { x, z, E } = orbitPosition(t, m.phaseOffset, m.period, aPx, m.e);
    const moonAnchor = moonAnchors[m.id];
    if (!moonAnchor) continue;
    moonAnchor.position.set(x, 0, z);
    const nu = trueAnomaly(E, m.e);
    moonAnchor.rotation.y = nu + Math.PI; // tidal lock: near side vždy k parent
    moonAnchor.updateMatrixWorld(true);
  }
}

function tick() {
  const dt = paused ? 0 : clock.getDelta();
  elapsed += dt;

  // Rotace planet (V1) — před orbit update, aby matrixWorld planety byl fresh.
  rotateAnchors(anchors, dt);
  // Moon orbit + tidal lock — aktualizuje moon anchors lokálně a propaguje matrixWorld.
  updateMoonOrbits(elapsed);

  // Emise ze Slunce (V1) — běží během planet fází.
  updateSolarWind(pool, elapsed, dt, anchors, imageData);
  // Emise z planet (V2) — běží během moon sub-fází.
  updateMoonWind(pool, elapsed, dt, anchors, moonAnchors, imageData, moonImageData);

  // Tečky v letu: position += velocity * dt, lerp color, arrival snap.
  pool.updateFlight(elapsed, dt);

  // Usazené tečky (ON_SUN / ON_PLANET / ON_RING / ON_MOON) sledují rotující anchor.
  pool.applyClusterRotation(anchorsByIndex);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

Promise.all([loaded, moonsLoaded]).then(() => {
  initAfterLoad();
  clock.start();
  requestAnimationFrame(tick);
}).catch((err) => {
  console.error('Texture preload failed:', err);
  clock.start();
  requestAnimationFrame(tick);
});
