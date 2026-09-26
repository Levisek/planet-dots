// cameraDistance — jak daleko od tělesa má kamera stát v detail view.
// Pure funkce (bez Three); poloměr tělesa dodá main.js callbackem
// getBodyRadiusRaw (Slunce mění velikost s módem).

import { PLANET_BY_ID } from './planets.js';
import { MOONS } from './moons.js';
import { moonDisplaySemiMajor } from './moonScale.js';

/**
 * Vzdálenost kamery od fokusovaného tělesa v detail view.
 * @param {string} id
 * @param {boolean} fyz - isFyzikalni() — real měřítko měsíců
 * @param {(id: string) => number} getBodyRadiusRaw
 */
export function cameraDistanceFor(id, fyz, getBodyRadiusRaw) {
  // Pro planety se zahrnou i jejich měsíce (camera z-offset zahrne max moon dist).
  const p = PLANET_BY_ID[id];
  if (!p) {
    // Měsíc / asteroid — těleso má zabrat zhruba třetinu výšky záběru.
    // Dřív floor 12 (měsíc) resp. natvrdo 40 (asteroid): měsíc s radiusPx
    // 0.5 pak měl na obrazovce ~4° z 45°.
    const r = getBodyRadiusRaw(id);
    return Math.max(r * 6, r + 2);
  }
  const baseDist = getBodyRadiusRaw(id) * 4.5;
  // Irregular měsíce (Phoebe, Sinope, Pasiphae, Iapetus, Nereid...) se do
  // distance nepočítají v ŽÁDNÉM módu — jejich orbity jsou řádově větší
  // než regulární měsíce (VISUAL-AUDIT I2). Uživatel může zoom-out.
  const childMoons = MOONS.filter(
    (mm) => mm.parent === id && mm.category !== 'irregular',
  );
  if (childMoons.length === 0) return baseDist;
  let maxMoonDist = 0;
  for (const m of childMoons) {
    const moonDist = moonDisplaySemiMajor(m, fyz);
    if (moonDist > maxMoonDist) maxMoonDist = moonDist;
  }
  // Camera musí být dál než nejvzdálenější měsíc a celý orbit musí být ve viewportu.
  // FOV=45° → half_angle=22.5° → tan(22.5°)≈0.414. S 15% safety marginem:
  // cameraDist = maxMoonDist / tan(22.5°) * 1.15 ≈ maxMoonDist * 2.78
  // Safety cap: max p.radiusPx × 40, aby planeta zůstala viditelná (angul. > 2.8°).
  const rawDist = Math.max(baseDist, maxMoonDist * 2.8 + p.radiusPx);
  return Math.min(rawDist, p.radiusPx * 40);
}
