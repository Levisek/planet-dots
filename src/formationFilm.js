// formationFilm — režie formace (vznik soustavy), ať jde stejným jazykem
// jako přelety a show v detailu: kamera plynule jede, tělesa rostou,
// nic „necvakne".
//
//  - formationCameraPose: jízda kamery. Začíná nízko nad rotujícím diskem,
//    při zážehu se přiblíží ke Slunci, během akrece vyjede do přehledu
//    (přesně na výchozí pozici, ať přechod na live je bez skoku).
//    Klíčové snímky v KEYS níž.
//  - sunIgnitionScale: Slunce vyroste z bodu, zatímco do něj padá prach.
//  - growthScale: planeta / měsíc roste, jak do něj dopadají tečky
//    (dřív byla neviditelná a při 95 % najednou naskočila celá).
//  - revealFade: dráhy, pás a popisky se po formaci prolnou dovnitř.
//
// Čisté funkce bez three.js — testy v formationFilm.test.js.

import { PHASES, ACCRETION_WINDOWS, LIVE_START } from './animation.js';

const DEG = Math.PI / 180;

// Klíčové snímky jízdy: čas (s), azimut (°, 0 = výchozí pohled), výška nad
// rovinou (°), vzdálenost (násobek vzdálenosti výchozí kamery). Poslední
// výška se doplní z výchozí pozice (Pochopení i Fyzikální mají ~29°).
const KEYS = [
  { t: 0,    az: -60, el: 30, d: 0.62 }, // mlhovina: shora šikmo, celý disk v záběru
  { t: 4.0,  az: -40, el: 20, d: 0.42 }, // hroucení: klesá blíž ke středu
  { t: 6.5,  az: -26, el: 14, d: 0.30 }, // zážeh: Slunce zblízka, skoro z roviny disku
  { t: 11.0, az: -12, el: 25, d: 0.55 }, // akrece: vnitřní planety, vnější přicházejí
  { t: 17.5, az: 0,   el: null, d: 1 },  // přehled — výchozí pozice
];
export const FILM_END = KEYS[KEYS.length - 1].t;

/** Monotónní kubická interpolace (Fritsch–Carlson): bez překmitů, na
 *  krajích nulová rychlost — kamera se rozjede i dosedne plynule. */
export function pchip(ts, ys, t) {
  const n = ts.length;
  if (t <= ts[0]) return ys[0];
  if (t >= ts[n - 1]) return ys[n - 1];
  const h = [], s = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(ts[i + 1] - ts[i]);
    s.push((ys[i + 1] - ys[i]) / h[i]);
  }
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    if (s[i - 1] * s[i] <= 0) continue;
    const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
    m[i] = (w1 + w2) / (w1 / s[i - 1] + w2 / s[i]);
  }
  let k = 0;
  while (t > ts[k + 1]) k++;
  const u = (t - ts[k]) / h[k];
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * ys[k] + (u3 - 2 * u2 + u) * h[k] * m[k]
    + (-2 * u3 + 3 * u2) * ys[k + 1] + (u3 - u2) * h[k] * m[k + 1];
}

/**
 * Pozice kamery během formace. Cíl je vždy střed soustavy.
 * @param {number} t — čas formace (s)
 * @param {{x:number,y:number,z:number}} mainPos — výchozí pozice kamery módu
 * @returns {{x:number,y:number,z:number}}
 */
export function formationCameraPose(t, mainPos) {
  const r0 = Math.hypot(mainPos.x, mainPos.y, mainPos.z);
  const az0 = Math.atan2(mainPos.x, mainPos.z) / DEG;
  const el0 = Math.asin(mainPos.y / r0) / DEG;
  if (t >= FILM_END) return { x: mainPos.x, y: mainPos.y, z: mainPos.z };
  const ts = KEYS.map((k) => k.t);
  const az = (pchip(ts, KEYS.map((k) => k.az), t) + az0) * DEG;
  const el = pchip(ts, KEYS.map((k) => k.el ?? el0), t) * DEG;
  // Vzdálenost v logaritmu — přiblížení i oddálení stejně rychlé „na oko".
  const d = r0 * Math.exp(pchip(ts, KEYS.map((k) => Math.log(k.d)), t));
  return { x: d * Math.cos(el) * Math.sin(az), y: d * Math.sin(el), z: d * Math.cos(el) * Math.cos(az) };
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));

// Zážeh: Slunce roste z bodu od SUN_GROW_START do konce beat_ignition
// (prach sluneční zásoby do něj mezitím padá).
const IGNITION = PHASES.find((p) => p.id === 'beat_ignition');
export const SUN_GROW_START = IGNITION.start + 0.6;
export const SUN_GROW_END = IGNITION.end;

/** Poloměr Slunce během zážehu jako podíl plné velikosti (0 = ještě není). */
export function sunIgnitionScale(t) {
  const p = clamp01((t - SUN_GROW_START) / (SUN_GROW_END - SUN_GROW_START));
  return 1 - Math.pow(1 - p, 3); // rychle se nafoukne, pomalu dosedne
}

// Tečky letí ještě až 1,2 s po konci emisního okna (TRAVEL_TIME_MAX
// ve formationIntro) — těleso dorůstá, dokud nedoletí poslední.
const TRAVEL_TAIL = 1.2;

/** Okno růstu tělesa: planeta z ACCRETION_WINDOWS, měsíc z fáze rodiče. */
export function growthWindow(id, parentId = null) {
  const w = ACCRETION_WINDOWS.find((a) => a.planetId === id);
  if (w) return { start: w.start, end: w.end + TRAVEL_TAIL };
  const ph = parentId && PHASES.find((p) => p.parentId === parentId);
  if (ph) return { start: ph.start, end: ph.end + 0.4 };
  return null;
}

/** Poloměr rostoucího tělesa jako podíl plné velikosti. Hmota přibývá
 *  rovnoměrně, poloměr ~ odmocnina — růst je vidět celou dobu okna. */
export function growthScale(t, win) {
  if (!win) return 1;
  return Math.sqrt(clamp01((t - win.start) / (win.end - win.start)));
}

export const REVEAL_SEC = 1.6;
/** Prolnutí drah, pásu a popisků po formaci (0 → 1, hladký start i konec). */
export function revealFade(t) {
  const p = clamp01((t - LIVE_START) / REVEAL_SEC);
  return p * p * (3 - 2 * p);
}
