// Komprese vzdálenosti pro Pochopení mód (sdílené simMode i planetOrbits).
// Mocnina r ~ AU^0,6: poměry vzdáleností drží směr skutečnosti (Neptun je
// 13,6× dál než Merkur, ve skutečnosti 77×, Fyzikální je lineární), ale
// vnitřní planety mají pořád vlastní čitelné dráhy. Dřív logaritmus
// (1500 + 450·ln AU) — Neptun jen 2,8× dál než Merkur, tělesa namačkaná.
//   Merkur 849 · Venuše 1235 · Země 1500 · Mars 1931 · Jupiter 4035
//   Saturn 5804 · Uran 8830 · Neptun 11560   (Slunce má r = 260, main.js)
const EARTH_R = 1500;
const POWER = 0.6;
const MIN_R = 700; // perihel Merkuru (0,307 AU → 739) nesmí zajet do Slunce
export function auToDisplayRadius(au) {
  return Math.max(MIN_R, EARTH_R * Math.pow(au, POWER));
}
/** Poloměr dráhy Neptunu v Pochopení — měřítko pro kameru, mřížku a film. */
export const POCHOPENI_SYSTEM_R = auToDisplayRadius(30.07);
