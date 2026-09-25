import * as THREE from 'three';
import { PLANETS } from './planets.js';

// Lokální Y osa spin nodu = osa rotace (pól IAU, viz planetAnchors.js).
const LOCAL_Y = new THREE.Vector3(0, 1, 0);

// `rotationPeriod` v planets.js je v sekundách při Země = 10 s → dny = / 10.
const SEC_PER_DAY_IN_DATA = 10;

// Strop rychlosti rotace (simulační dny za reálnou sekundu): 0,1 = Země
// 10 s/den. Simulace běží při 1× 36,5 dne/s — reálně svázaná rotace by
// byla stroboskop (Země 36 otáček/s). Pod stropem platí reálný poměr
// k oběhům: v detailu Marsu (0,04 dne/s) Phobos oběhne za 8 s, Mars se
// otočí za 26 s — Phobos je opravdu rychlejší než den na Marsu.
export const ROTATION_MAX_DAYS_PER_SEC = 0.1;

/**
 * Kolik simulačních dnů za reálnou sekundu má ubíhat rotace.
 * Dřív se planety točily v reálném čase — i v pauze, a při zpětném chodu
 * dopředu. Teď: pauza = stojí, reverz = točí se obráceně, strop viz výše.
 *
 * @param {{ formation: boolean, playing: boolean, simDaysPerSec: number }} s
 *   simDaysPerSec — se znaménkem (timeScale × násobitel detailu × 36,5).
 */
export function rotationDaysPerSec({ formation, playing, simDaysPerSec }) {
  // Během formace hodiny stojí na dnešku, ale planety se tvoří a točí.
  if (formation) return ROTATION_MAX_DAYS_PER_SEC;
  if (!playing) return 0;
  const mag = Math.min(Math.abs(simDaysPerSec), ROTATION_MAX_DAYS_PER_SEC);
  return Math.sign(simDaysPerSec) * mag;
}

/**
 * Rotuje spin node každé planety kolem její osy — reálné poměry period.
 *
 * @param {Object} spinsById — { [planetId]: Object3D }
 * @param {number} dtSeconds
 * @param {number} daysPerSec — z rotationDaysPerSec()
 */
export function rotateAnchors(spinsById, dtSeconds, daysPerSec) {
  for (const p of PLANETS) {
    const spin = spinsById[p.id];
    if (!spin) continue;
    const periodDays = p.rotationPeriod / SEC_PER_DAY_IN_DATA;
    const angle = ((Math.PI * 2) / periodDays) * daysPerSec * dtSeconds * p.direction;
    if (angle !== 0) spin.rotateOnAxis(LOCAL_Y, angle);
  }
}
