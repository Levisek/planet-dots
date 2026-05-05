import * as THREE from 'three';
import { PLANETS } from './planets.js';

// Lokální Y osa planety (po aplikaci axial tilt přes anchor.rotation.x).
const LOCAL_Y = new THREE.Vector3(0, 1, 0);

/**
 * Rotuje každý planetární anchor kolem své lokální Y osy
 * realistickými poměry period (Země = 10 s, ostatní přepočteny).
 *
 * @param {Object} anchorsById — { [planetId]: Object3D }
 * @param {number} dtSeconds
 */
export function rotateAnchors(anchorsById, dtSeconds) {
  for (const p of PLANETS) {
    const anchor = anchorsById[p.id];
    if (!anchor) continue;
    rotateOne(anchor, p, dtSeconds);
  }
}

/**
 * Rotuje jediný anchor — pro use case "v detail view rotuj jen focus body".
 *
 * @param {THREE.Object3D} anchor
 * @param {{ rotationPeriod: number, direction: number }} planet
 * @param {number} dtSeconds
 */
export function rotateOne(anchor, planet, dtSeconds) {
  const omega = (Math.PI * 2) / planet.rotationPeriod;
  anchor.rotateOnAxis(LOCAL_Y, omega * planet.direction * dtSeconds);
  anchor.updateMatrixWorld(true);
}
