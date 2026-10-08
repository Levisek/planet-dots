// Komprese vzdálenosti pro Pochopení mód (sdílené simMode i planetOrbits).
// Logaritmická: vnitřní planety (Merkur–Mars) dostanou vlastní, čitelné
// dráhy místo změti čar kolem Slunce, vnější zůstanou v záběru.
//   Merkur 1076 · Venuše 1370 · Země 1500 · Mars 1689 · Jupiter 2243
//   Saturn 2517 · Uran 2828 · Neptun 3030   (Slunce má r = 400, main.js)
const BASE = 1500;
const PER_E = 450;
const MIN_R = 800; // perihel Merkuru (0,307 AU) nesmí zajet do Slunce
export function auToDisplayRadius(au) {
  return Math.max(MIN_R, BASE + PER_E * Math.log(au));
}
