// moonScale — měřítko vzdálenosti měsíce od rodiče (AU → scene units).
//
// Relativní pozice z efemerid/Kepleru (AU) se násobí konstantou per měsíc,
// takže tvar dráhy (excentricita, sklon, uzel) i fáze zůstávají reálné —
// mění se jen velikost:
//
//   POCHOPENÍ:  velká poloosa = m.a × poloměr rodiče (ručně laděná komprese
//               z V4.3 — soustava měsíců se vejde mezi dráhy planet).
//   FYZIKÁLNÍ:  věrný poměr k ZOBRAZENÉ velikosti rodiče (km → px podle
//               rodičova poloměru). Planety jsou oproti vzdálenostem ~50×
//               zvětšené, tak musí být i jejich soustavy měsíců — lineární
//               AU měřítko by strčilo všechny měsíce pod povrch planety.
//
// V4.4 F1 zavedl jednu konstantu (sqrt(r) × 60000) pro všechny — Luna pak
// obíhala 3000 j. od Země (dál než je Země od Slunce) a ve Fyzikálním byly
// měsíce uvnitř planet. Kalibrace „v Task 10" se nikdy nestala.

import { PLANET_BY_ID } from './planets.js';

export const AU_KM = 149_597_870.7;

/** Kolik scene units je 1 km v soustavě rodiče (Fyzikální). */
function parentPxPerKm(parent) {
  return parent.radiusPx / (parent.realDiameterKm / 2);
}

/** Zobrazená velká poloosa měsíce (scene units) v daném módu. */
export function moonDisplaySemiMajor(moon, fyz) {
  const parent = PLANET_BY_ID[moon.parent];
  if (fyz) return moon.realSemiMajorAxisKm * parentPxPerKm(parent);
  return moon.a * parent.radiusPx;
}

/** Násobitel AU → scene units pro relativní pozici měsíce. */
export function moonDisplayScale(moon, fyz) {
  const aRealAU = moon.realSemiMajorAxisKm / AU_KM;
  return moonDisplaySemiMajor(moon, fyz) / aRealAU;
}
