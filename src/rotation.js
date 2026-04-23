import * as THREE from 'three';
import { PLANETS } from './planets.js';

// Lokální Y osa planety (po aplikaci axial tilt přes anchor.rotation.z).
const LOCAL_Y = new THREE.Vector3(0, 1, 0);

/**
 * Rotuje každý planetární anchor kolem své lokální Y osy
 * realistickými poměry period (Země = 10 s, ostatní přepočteny).
 * Po úpravě rotace volá updateMatrixWorld aby matrixWorld byl fresh.
 *
 * @param {Object} anchorsById — { [planetId]: Object3D }
 * @param {number} dtSeconds
 */
export function rotateAnchors(anchorsById, dtSeconds) {
  for (const p of PLANETS) {
    const anchor = anchorsById[p.id];
    if (!anchor) continue;
    const omega = (Math.PI * 2) / p.rotationPeriod;
    anchor.rotateOnAxis(LOCAL_Y, omega * p.direction * dtSeconds);
    anchor.updateMatrixWorld(true);
  }
}
