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
//  - sunGlow: záblesk při zážehu a trvalá záře kolem Slunce.
//  - protoTint: rostoucí planeta je zprvu zbarvená do prachu, ze kterého
//    vzniká, a teprve s plnou velikostí dostane své barvy.
//  - orbitTrace: dráha planety se dokreslí od planety dokola, jakmile dorostla.
//  - revealFade: pás, mřížka a popisky se po formaci prolnou dovnitř.
//
// Čisté funkce bez three.js — testy v formationFilm.test.js.

import { PHASES, ACCRETION_WINDOWS, LIVE_START, sceneStart } from './animation.js';

const DEG = Math.PI / 180;

// Klíčové snímky jízdy: čas (s), azimut (°, 0 = výchozí pohled), výška nad
// rovinou (°), vzdálenost (násobek vzdálenosti výchozí kamery). Poslední
// výška se doplní z výchozí pozice (Pochopení i Fyzikální mají ~29°).
const KEYS = [
  { t: 0,  az: -75, el: 30, d: 0.8 },  // mrak: celý v záběru
  { t: 11, az: -60, el: 26, d: 0.72 }, // rázová vlna prošla
  { t: 20, az: -42, el: 16, d: 0.55 }, // kolaps: s mrakem dovnitř, k rovině disku
  { t: 28, az: -32, el: 12, d: 0.5 },  // disk zblízka, nízko
  { t: 38, az: -22, el: 24, d: 0.78 }, // obři a mezera po Jupiteru
  { t: 44, az: -16, el: 28, d: 0.8 },  // plyn odfouknutý
  { t: 54, az: -10, el: 15, d: 0.34 }, // kamenné planety u Slunce
  { t: 58, az: -6,  el: 14, d: 0.3 },  // zážeh fúze
  { t: 64, az: -3,  el: 30, d: 0.95 }, // stěhování obrů
  { t: 70, az: -2,  el: 22, d: 0.45 }, // Theia a Země
  { t: 75, az: 0,   el: null, d: 1 },  // přehled — výchozí pozice
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

// Protohvězda: Slunce roste během kolapsu (prach sluneční zásoby do něj
// padá); hvězdou se stane až zážehem fúze (FUSION_START, sunTint/sunGlow).
export const SUN_GROW_START = sceneStart('collapse') + 1;
export const SUN_GROW_END = sceneStart('disk') - 0.5;
export const FUSION_START = sceneStart('fusion');
const FUSION_DUR = 2.5;

/** Poloměr Slunce během zážehu jako podíl plné velikosti (0 = ještě není). */
export function sunIgnitionScale(t) {
  const p = clamp01((t - SUN_GROW_START) / (SUN_GROW_END - SUN_GROW_START));
  return 1 - Math.pow(1 - p, 3); // rychle se nafoukne, pomalu dosedne
}

// Tečky letí ještě až 1,2 s po konci emisního okna (TRAVEL_TIME_MAX
// ve formationIntro) — těleso dorůstá, dokud nedoletí poslední.
const TRAVEL_TAIL = 1.2;

// Planeta se ukáže až po téhle části akrečního okna — nejdřív se musí
// sejít prach (dřív se hotová koule objevila uprostřed řídkého oblaku).
export const GROWTH_DELAY = 0.4;

/** Okno růstu tělesa: planeta z ACCRETION_WINDOWS, měsíc z fáze rodiče. */
export function growthWindow(id, parentId = null) {
  const w = ACCRETION_WINDOWS.find((a) => a.planetId === id);
  if (w) return { start: w.start + GROWTH_DELAY * (w.end - w.start), end: w.end + TRAVEL_TAIL };
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

const smooth = (p) => p * p * (3 - 2 * p);

// Barva prachu, ze kterého planeta roste (násobí barvy povrchu): skalnaté
// planety jsou rozžhavené, obři za sněžnou čarou ledově studení.
const PROTO_HOT = [1.0, 0.5, 0.3];
const PROTO_COLD = [0.55, 0.62, 0.8];

/** Násobitel barvy rostoucí planety; k = growthScale, 1 → vlastní barvy. */
export function protoTint(k, cold) {
  const base = cold ? PROTO_COLD : PROTO_HOT;
  const u = smooth(clamp01((k - 0.5) / 0.5)); // do poloviny velikosti jen prach
  if (u >= 1) return [1, 1, 1];
  return base.map((c) => c + (1 - c) * u);
}

// Protohvězda svítí jen slabě a rudě (smršťováním se zahřívá); při zážehu
// fúze záblesk (náběh 0,3 s, dozní za ~3 s) a trvalá záře. Hodnoty jsou
// průhlednost spritu (0..1).
export const GLOW_STEADY = 0.75;
const GLOW_PROTO = 0.3;
const FLASH_RISE = 0.3;
const FLASH_FALL = 3.2;
/** @returns {{ flash: number, glow: number }} */
export function sunGlow(t) {
  if (t < SUN_GROW_START) return { flash: 0, glow: 0 };
  const proto = GLOW_PROTO * smooth(clamp01((t - SUN_GROW_START) / (SUN_GROW_END - SUN_GROW_START)));
  if (t < FUSION_START) return { flash: 0, glow: proto };
  const dt = t - FUSION_START;
  const flash = dt < FLASH_RISE
    ? smooth(dt / FLASH_RISE)
    : 1 - smooth(clamp01((dt - FLASH_RISE) / (FLASH_FALL - FLASH_RISE)));
  const glow = proto + (GLOW_STEADY - proto) * smooth(clamp01(dt / FUSION_DUR));
  return { flash, glow };
}

// Barva protohvězdy (násobí texturu Slunce): tmavě rudá, se zážehem plné barvy.
const PROTO_SUN = [0.85, 0.32, 0.16];
/** Násobitel barvy Slunce (a jeho záře) v čase t. */
export function sunTint(t) {
  const u = smooth(clamp01((t - FUSION_START) / FUSION_DUR));
  if (u >= 1) return [1, 1, 1];
  return PROTO_SUN.map((c) => c + (1 - c) * u);
}

// Dráhy se dokreslí ve scéně Dnes, zevnitř ven (po stěhování obrů už
// planety stojí na dnešních drahách).
export const ORBIT_TRACE_SEC = 2.4;
const ORBIT_ORDER = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
const ORBIT_STAGGER = 0.35;
/** Kolik dráhy planety je nakresleno (0..1). */
export function orbitTrace(t, planetId) {
  const i = ORBIT_ORDER.indexOf(planetId);
  if (i < 0) return 1;
  const start = sceneStart('today') + ORBIT_STAGGER * i;
  return smooth(clamp01((t - start) / ORBIT_TRACE_SEC));
}

export const REVEAL_SEC = 1.6;
/** Prolnutí drah, pásu a popisků po formaci (0 → 1, hladký start i konec). */
export function revealFade(t) {
  const p = clamp01((t - LIVE_START) / REVEAL_SEC);
  return p * p * (3 - 2 * p);
}
