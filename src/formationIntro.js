// formationIntro — prach a plyn při vzniku soustavy (docs/vznik-plan.md).
//
// cloud/shock (0–12 s): 30k částic v chladném mraku (zploštělá koule
//   ~1,35× disk), pomalu se točí; ve scéně shock jím projde rázová vlna
//   (zjasní ho a postrčí).
// collapse (12–20 s): mrak se hroutí zevnitř ven (vnitřek dřív), částice
//   jdou z mraku na svou dráhu v disku a roztáčejí se (moment hybnosti);
//   sluneční zásoba padá do středu.
// disk (20 s →): keplerovská rotace, ω ~ r^(−3/2) — vnitřek obíhá rychleji.
//   Barva podle sněžné čáry (dustColor).
// Vzhled disku (jako ALMA snímek HL Tau): hladký souvislý disk z velkých
//   překrývajících se teček, jas klesá ven (žlutobílý střed → oranžová →
//   tmavě rudý okraj), hustota ~ r^-0,15 v počtu částic (plošně ~ r^-1,15).
// Mezery: rostoucí obři (GAP_PLANETS) vytlačují prach ze své zóny — částice
//   se posouvají od dráhy planety (mezera) a hromadí na okrajích (prstenec).
//   Jen prach těsně u dráhy (|x| < 1) opravdu padá do planety (akreční okno).
// ACCRETION_WINDOWS: prach zóny planety migruje k ní a pohltí se; tečky
//   povrchu planety se emitují pool.spawnFromDisk z okolí planety.
// clearing (38–44 s): plyn a zbytek disku v zónách obrů a Marsu a plyn
//   kamenných zón odfoukne mladé Slunce ven. Prach kamenných zón zůstává
//   pro jejich planety (akrece od 44 s).
// fusion (54 s): zbytek se uvolní.

import { ACCRETION_WINDOWS, resetPhaseEmissions, sceneStart } from './animation.js';
import { PLANETS, PLANET_BY_ID } from './planets.js';
import { getPlanetTargets } from './planetTargets.js';
import { PHASE } from './phase.js';
import { Vector3 } from 'three';

const _tmpTarget = new Vector3();

const DUST_COUNT = 30000;
const SUN_RESERVE_MIN_FACTOR = 0.04;
const SUN_RESERVE_FRACTION = 0.15; // podíl DUST_COUNT vyhrazený jako sluneční zásoba
const GAS_FRACTION = 0.45;         // podíl zbytku, který je plyn
const DISK_MIN_FACTOR = 0.3;       // disk sahá 0.3×r_min .. 1.1×r_max (těsně k hvězdě)
const SUN_ZONE_FACTOR = DISK_MIN_FACTOR; // zásoba končí tam, kde disk začíná
const DISK_MAX_FACTOR = 1.1;
const CLOUD_FACTOR = 1.9;          // poloměr mraku / vnější okraj disku
const CLOUD_FLATTEN = 0.75;        // mrak je mírně zploštělý (už se točí)
const CLOUD_PERIOD = 120;          // s / otočka mraku (skoro stojí)
const KEPLER_PERIOD_SNOW = 18;     // s / oběh na sněžné čáře
const SOURCE_MIN_RADIUS_FACTOR = 8;  // anulus zdroje emise: 8×radiusPx .. 30×radiusPx
const SOURCE_MAX_RADIUS_FACTOR = 30;
const TRAVEL_TIME_MIN = 0.6;
const TRAVEL_TIME_MAX = 1.2;
const ROCKY = new Set(['mercury', 'venus', 'earth', 'mars']);

const T_SHOCK = sceneStart('shock');
const T_COLLAPSE = sceneStart('collapse');
const T_DISK = sceneStart('disk');
const T_CLEAR = sceneStart('clearing');
const T_CLEAR_END = sceneStart('rocky');
const T_END = sceneStart('fusion');
const COLLAPSE_SPREAD = 3; // vnějšek mraku začne padat o tolik s později
const COLLAPSE_DUR = T_DISK - T_COLLAPSE - COLLAPSE_SPREAD;

/**
 * Čistá funkce: přiřadí poloměr r nejbližší zóně (planetě) podle |r - r_zone|.
 * @param {number} radius
 * @param {number[]} zoneRadii — poloměry zón ve stejném pořadí jako ACCRETION_WINDOWS
 * @returns {number} index nejbližší zóny
 */
export function assignZone(radius, zoneRadii) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < zoneRadii.length; i++) {
    const d = Math.abs(radius - zoneRadii[i]);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

// Skoro nepropustné tečky: překryv stejné barvy splyne do hladké hmoty,
// jas nese barva (rampa) a řídnutí v mezerách.
const DUST_ALPHA = 0.85;
const GAS_ALPHA = 0.74;
// Měkká hrana teček disku (particles.js aSoft): gaussovský okraj, tečky
// splývají do souvislé hmoty. Roste s kolapsem (mrak zůstává beze změny).
const DISK_SOFT = 1;
// Průhlednost prachu klesá s poloměrem — vnější prstence nejsou jasnější
// než vnitřní, jas disku plynule slábne ven.
const ALPHA_FALLOFF = 0.4;
const CLOUD_ALPHA = 0.45;
// Mezery v disku: obři vyhloubí pás kolem své dráhy. Šířka (σ) jako podíl
// poloměru dráhy, amplituda posunu (A < 2,24 drží zobrazení monotónní),
// v hloubce mezery zbývá ~1/(1+A) hustoty, na okrajích ~1/(1−0,446·A).
const GAP_PLANETS = { mars: 0.6, jupiter: 1, saturn: 1, uranus: 1, neptune: 1 };
const GAP_AMPLITUDE = 1.7;
const GAP_WIDTH = 0.1;
// Vedlejší mezery obra (rezonance): na 0,78× a 1,22× poloměru dráhy, užší a mělčí.
const GHOST_OFFSETS = [0.78, 1.22];
const GHOST_AMP = 0.45;     // podíl amplitudy hlavní mezery
const GHOST_WIDTH = 0.07;
const GHOST_DEPLETION = 0.55;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const GAP_LEAD = 4;        // jádro obra otvírá mezeru dřív, než planeta viditelně vyroste
const FEED_HALF_WIDTH = 1; // prach v |x| < 1 σ od dráhy padá do planety
const FEED_PROB = 0.7;
const PROFILE_EXP = 0.85;  // počet částic do poloměru r ~ r^0,85 (plošná hustota ~ r^-1,15)
const GAP_DEPLETION = 0.8; // o kolik se v hloubce mezery ztlumí alpha prachu (čistě tmavá)
const DISK_THICKNESS = 0.02;
// Velikost tečky mraku: kamera je zdálky a velikost se dělí vzdáleností
// (particles.js) — s velikostí disku by mrak nebyl vidět.
const CLOUD_SIZE = 42;
// Velikosti výš platí pro mrak o poloměru SIZE_REF_R; větší soustava (natažené
// Pochopení, Fyzikální) má kameru dál, tečky se úměrně zvětší.
const SIZE_REF_R = 4500;
let _sizeK = 1;

/**
 * Barva prachu podle vzdálenosti od středu: u mladé hvězdy teplý, rozžhavený
 * (skalnaté planety), za sněžnou čarou (mezi Marsem a Jupiterem) studený
 * namodralý led (obři). Jitter 0..1 = rozptyl, ať disk není jednolitý.
 * @param {number} r — vzdálenost od středu
 * @param {number} snowR — poloměr sněžné čáry ve stejných jednotkách
 * @returns {[number, number, number]}
 */
export function dustColor(r, snowR, jitter = 0.5) {
  const warm = [0.95, 0.72, 0.48];
  const cold = [0.52, 0.60, 0.78];
  const t = Math.min(1, Math.max(0, (r / snowR - 0.7) / 0.5));
  const j = 0.85 + 0.3 * jitter;
  return [0, 1, 2].map((c) => Math.min(1, (warm[c] + (cold[c] - warm[c]) * t) * j));
}

const CLOUD_COLOR = [0.5, 0.4, 0.36]; // chladný mrak: tlumená prachová hněď

// Barva disku podle poloměru (podíl vnějšího okraje): žlutobílý střed →
// oranžová → tmavě rudý okraj, jako jas ALMA snímku mladé soustavy.
const DISK_RAMP = [
  [0.0, [1.0, 0.95, 0.66]],
  [0.04, [1.0, 0.78, 0.3]],
  [0.12, [0.96, 0.55, 0.14]],
  [0.35, [0.74, 0.28, 0.06]],
  [1.0, [0.36, 0.07, 0.02]],
];
export function diskColor(r01, jitter = 0.5) {
  const x = Math.min(1, Math.max(0, r01));
  let k = 0;
  while (k < DISK_RAMP.length - 2 && x > DISK_RAMP[k + 1][0]) k++;
  const [x0, c0] = DISK_RAMP[k];
  const [x1, c1] = DISK_RAMP[k + 1];
  const u = Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
  const j = 0.97 + 0.06 * jitter; // skoro bez rozptylu — hladký přechod jasu
  return [0, 1, 2].map((c) => Math.min(1, (c0[c] + (c1[c] - c0[c]) * u) * j));
}

/** Keplerovská úhlová rychlost (rad/s) na poloměru r. */
export function keplerOmega(r, snowR) {
  return (2 * Math.PI / KEPLER_PERIOD_SNOW) * Math.pow(snowR / Math.max(r, 1e-6), 1.5);
}

/** Postup kolapsu částice (0..1): vnitřek mraku padá dřív (inside-out). */
export function collapseProgress(t, cloudR01) {
  const p = (t - T_COLLAPSE - COLLAPSE_SPREAD * cloudR01) / COLLAPSE_DUR;
  const c = Math.min(1, Math.max(0, p));
  return c * c * (3 - 2 * c);
}

function gaussianRandom() {
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ——— Interní stav (module-level singleton) ———
let S = null; // viz initDisk
let _snowR = 1;   // sněžná čára — barva prachu letícího k planetě
let _cloudR = 0;  // poloměr mraku (pro rázovou vlnu a záběr kamery)
let _diskMax = 1; // vnější okraj disku

/** Velikost tečky disku (světové jednotky) — velké, ať se překrývají do hladké hmoty. */
function diskDotSize(r01) {
  return _diskMax * 0.05 * (0.45 + 0.9 * Math.sqrt(Math.min(1, Math.max(0, r01))));
}
let _emitted = {};

/** Poloměr mraku v aktuálním módu (0 před initem). */
export function getCloudRadius() { return _cloudR; }

function initDisk(pool, anchors) {
  if (S) return;
  const entries = [];
  for (const w of ACCRETION_WINDOWS) {
    const anchor = anchors[w.planetId];
    if (!anchor) continue;
    const { x, z } = anchor.position;
    entries.push({ planetId: w.planetId, radius: Math.hypot(x, z), window: w, anchorPos: anchor.position });
  }
  if (entries.length === 0) return;
  const zoneRadii = entries.map((e) => e.radius);
  const rMin = Math.min(...zoneRadii);
  const rMax = Math.max(...zoneRadii);
  const diskMin = DISK_MIN_FACTOR * rMin;
  const diskMax = DISK_MAX_FACTOR * rMax;
  const rOf = (id) => entries.find((e) => e.planetId === id)?.radius;
  const snowR = rOf('mars') && rOf('jupiter') ? (rOf('mars') + rOf('jupiter')) / 2 : (rMin + rMax) / 3;
  _snowR = snowR;
  _diskMax = diskMax;
  const cloudR = CLOUD_FACTOR * diskMax;
  _cloudR = cloudR;
  _sizeK = cloudR / SIZE_REF_R;
  const sunMin = SUN_RESERVE_MIN_FACTOR * rMin;
  const sunMax = SUN_ZONE_FACTOR * rMin;

  const gaps = entries
    .filter((e) => GAP_PLANETS[e.planetId] !== undefined)
    .map((e) => ({ e, rp: e.radius, w: GAP_WIDTH * e.radius, amp: GAP_AMPLITUDE * GAP_PLANETS[e.planetId], dep: GAP_DEPLETION, g: 0 }));
  // Vedlejší mezery téhož obra (otevírají se se stejnou planetou).
  for (const main of gaps.slice()) {
    if (main.e.planetId === 'mars') continue;
    for (const off of GHOST_OFFSETS) {
      const rp = main.rp * off;
      if (rp > 0.97 * diskMax || rp < 1.5 * diskMin) continue;
      gaps.push({ e: main.e, rp, w: GHOST_WIDTH * rp, amp: main.amp * GHOST_AMP, dep: GHOST_DEPLETION, g: 0 });
    }
  }

  const idle = pool.takeIdleIndices(DUST_COUNT);
  if (idle.length === 0) return;
  const n = idle.length;
  S = {
    idx: idle, entries, snowR, gaps,
    zone: new Int32Array(n),      // -1 = sluneční zásoba, jinak index do entries
    gas: new Uint8Array(n),
    clear: new Uint8Array(n),     // 1 = odfoukne se při clearing
    alpha: new Float32Array(n),   // alpha v disku
    cr: new Float32Array(n),      // mrak: vodorovný poloměr, výška, poloměr/Rc
    cy: new Float32Array(n),
    c01: new Float32Array(n),
    dr: new Float32Array(n),      // disk: poloměr a výška
    dy: new Float32Array(n),
    th: new Float32Array(n),      // azimut (integruje se)
    dth: new Float32Array(n),     // posun azimutu mrak → disk (zlatý úhel: rovnoměrné pokrytí)
    color: new Float32Array(n * 3), // barva v disku
    size: new Float32Array(n),      // velikost v disku
    migStart: new Float32Array(n),
    migrating: new Uint8Array(n),
    fromX: new Float32Array(n), fromY: new Float32Array(n), fromZ: new Float32Array(n),
    released: new Uint8Array(n),
  };
  const sunCount = Math.round(n * SUN_RESERVE_FRACTION);
  // Hodnoty v (pořadí od středu) losujeme předem: v disku se z nich stane
  // pořadí (rank), ze kterého jde rovnoměrný poloměr + zlatý úhel — tečky
  // netvoří shluky a díry (zrnitost), ale pořadí od středu zůstává.
  const vs = new Float32Array(n);
  for (let k = 0; k < n; k++) vs[k] = Math.random();
  const order = [];
  for (let k = sunCount; k < n; k++) order.push(k);
  order.sort((a, b) => vs[a] - vs[b]);
  const rankOf = new Float32Array(n);
  order.forEach((k, m) => { rankOf[k] = m; });
  const dustN = Math.max(1, order.length);
  for (let k = 0; k < n; k++) {
    const i = idle[k];
    const isSun = k < sunCount;
    // v ~ U(0,1): pořadí od středu — stejné v mraku i v disku, ať se
    // částice při kolapsu nekříží napříč celým diskem.
    const v = vs[k];
    const vd = isSun ? v : (rankOf[k] + 0.5) / dustN;
    // Disk: počet částic do r ~ r^0,85 → plošná hustota ~ r^-1,15 (jasný střed).
    const a0 = Math.pow(diskMin, PROFILE_EXP);
    const dr = isSun
      ? sunMin + (sunMax - sunMin) * Math.sqrt(v)
      : Math.pow(a0 + (Math.pow(diskMax, PROFILE_EXP) - a0) * vd, 1 / PROFILE_EXP);
    // Mrak: hustota plynule roste ke středu (poloměr ~ v^0,8 → řidký okraj).
    const r01 = isSun ? 0.25 * Math.sqrt(v) : 0.02 + 0.98 * Math.pow(v, 0.8);
    const c01 = Math.min(1, r01 * (0.85 + 0.3 * Math.random()));
    // Bod v kouli o poloměru c01·Rc: náhodný sklon od roviny.
    const cosEl = Math.sqrt(Math.random());
    const sign = Math.random() < 0.5 ? -1 : 1;
    S.cr[k] = c01 * cloudR * cosEl;
    S.cy[k] = sign * c01 * cloudR * Math.sqrt(1 - cosEl * cosEl) * CLOUD_FLATTEN;
    S.c01[k] = c01;
    S.dr[k] = dr;
    S.dy[k] = dr * gaussianRandom() * DISK_THICKNESS;
    S.th[k] = Math.random() * Math.PI * 2;
    S.dth[k] = isSun ? 0 : ((rankOf[k] * GOLDEN_ANGLE) % (2 * Math.PI)) - S.th[k];

    let col;
    if (isSun) {
      S.zone[k] = -1;
      col = diskColor(dr / diskMax, Math.random());
      S.alpha[k] = DUST_ALPHA;
    } else {
      const z = assignZone(dr, zoneRadii);
      S.zone[k] = z;
      const e = entries[z];
      S.gas[k] = Math.random() < GAS_FRACTION ? 1 : 0;
      col = diskColor(dr / diskMax, Math.random());
      if (S.gas[k]) col = col.map((c) => c * 0.96);
      S.alpha[k] = (S.gas[k] ? GAS_ALPHA : DUST_ALPHA) * (1 - ALPHA_FALLOFF * Math.pow(dr / diskMax, 0.7));
      // Do planety padá jen prach těsně u její dráhy (zbytek zóny mezeru
      // obklopuje); prach kamenných zón (Merkur–Země) zůstává pro jejich
      // planety, jejich plyn a zbytek zón obrů a Marsu odfoukne Slunce.
      const inner = ROCKY.has(e.planetId) && e.planetId !== 'mars';
      const near = GAP_PLANETS[e.planetId] !== undefined
        && Math.abs(dr - e.radius) < FEED_HALF_WIDTH * GAP_WIDTH * e.radius
        && Math.random() < FEED_PROB;
      const feeds = inner ? !S.gas[k] : near;
      S.clear[k] = feeds ? 0 : 1;
      S.migStart[k] = feeds
        ? e.window.start + Math.random() * (e.window.end - e.window.start)
        : Infinity;
    }
    S.color[3 * k] = col[0]; S.color[3 * k + 1] = col[1]; S.color[3 * k + 2] = col[2];
    pool.color[3 * i] = CLOUD_COLOR[0];
    pool.color[3 * i + 1] = CLOUD_COLOR[1];
    pool.color[3 * i + 2] = CLOUD_COLOR[2];
    pool.alpha[i] = CLOUD_ALPHA;
    S.size[k] = diskDotSize(dr / diskMax) * (S.gas[k] ? 1.15 : 1);
    pool.size[i] = CLOUD_SIZE * _sizeK;
    pool.phase[i] = 99; // mimo standard PHASE enum — kustomní prach
    pool.owner[i] = -1;
  }
  pool.flushAll();
}

/** Uvolní jednu částici do IDLE (planeta ji pohltila / odfouknutá / konec). */
function releaseParticle(pool, k) {
  const i = S.idx[k];
  pool.alpha[i] = 0;
  if (pool.soft) pool.soft[i] = 0;
  pool.phase[i] = PHASE.IDLE;
  pool.owner[i] = -1;
  S.released[k] = 1;
}

function releaseAll(pool) {
  if (!S) return;
  for (let k = 0; k < S.idx.length; k++) if (!S.released[k]) releaseParticle(pool, k);
  pool.alphaAttr.needsUpdate = true;
  pool.posAttr.needsUpdate = true;
  if (pool.soft) { pool.softActive = false; pool.softAttr.needsUpdate = true; }
  S = null; // nic dalšího se nepočítá
}

// Rázová vlna: rovinná fronta jde mrakem od supernovy (setShockSource).
const SHOCK_DIR = { x: 0.93, y: -0.12, z: 0.34 };
/** Odkud přijde rázová vlna (poloha supernovy; mrak je ve středu). */
export function setShockSource(p) {
  const l = Math.hypot(p.x, p.y, p.z) || 1;
  SHOCK_DIR.x = -p.x / l; SHOCK_DIR.y = -p.y / l; SHOCK_DIR.z = -p.z / l;
}
function shockFront(t) {
  const u = (t - T_SHOCK) / (T_COLLAPSE - T_SHOCK);
  return (-1.25 + 2.5 * u) * _cloudR;
}

/** Okraj mraku řídne (jinak by měl ostrou hranu koule). */
const edgeAlpha = (c01) => CLOUD_ALPHA * Math.exp(-2.6 * c01 * c01);

/** Barva/alpha částice mezi mrakem (e = 0) a diskem (e = 1). */
function blendLook(pool, i, k, e, alphaDisk) {
  const c0 = CLOUD_COLOR;
  pool.color[3 * i] = c0[0] + (S.color[3 * k] - c0[0]) * e;
  pool.color[3 * i + 1] = c0[1] + (S.color[3 * k + 1] - c0[1]) * e;
  pool.color[3 * i + 2] = c0[2] + (S.color[3 * k + 2] - c0[2]) * e;
  const a0 = edgeAlpha(S.c01[k]);
  pool.alpha[i] = a0 + (alphaDisk - a0) * e;
  pool.size[i] = CLOUD_SIZE * _sizeK + (S.size[k] - CLOUD_SIZE * _sizeK) * e;
  if (pool.soft) pool.soft[i] = DISK_SOFT * e;
}

function updateDustFrame(pool, t, dt) {
  const omegaCloud = 2 * Math.PI / CLOUD_PERIOD;
  const front = t >= T_SHOCK && t < T_COLLAPSE + 1 ? shockFront(t) : null;
  const W = 0.12 * _cloudR;
  const n = S.idx.length;
  // Hloubka mezery každého obra: jádro ji otvírá už před viditelným růstem
  // planety a plně vyhloubí s koncem akrečního okna.
  for (const gp of S.gaps) {
    const win = gp.e.window;
    const u = (t - (win.start - GAP_LEAD)) / (0.6 * (win.end - win.start) + GAP_LEAD);
    const c = Math.min(1, Math.max(0, u));
    gp.g = c * c * (3 - 2 * c);
  }
  for (let k = 0; k < n; k++) {
    if (S.released[k]) continue;
    const i = S.idx[k];
    const zone = S.zone[k];
    const gas = S.gas[k];
    const alphaDisk = S.alpha[k];
    const e = collapseProgress(t, S.c01[k]);
    // Disk: poloměr po vytlačení prachu rostoucími obři (mezery a prstence).
    // Prach z mezery navíc ubývá (padá na planetu) — mezera je tmavší.
    let drNow = S.dr[k];
    let gapMul = 1;
    if (zone !== -1 && e > 0) {
      for (const gp of S.gaps) {
        if (gp.g <= 0) continue;
        const gx = (S.dr[k] - gp.rp) / gp.w;
        if (gx > 5 || gx < -5) continue;
        const gg = Math.exp(-0.5 * gx * gx);
        drNow += gp.g * gp.amp * gp.w * gx * gg;
        gapMul *= 1 - gp.dep * gp.g * gg;
      }
    }
    const aEff = alphaDisk * gapMul;
    if (e >= 1 && pool.soft) pool.soft[i] = DISK_SOFT;

    // Poloměr a výška: mrak → disk (sluneční zásoba → střed).
    let r, y;
    if (zone === -1) {
      r = S.cr[k] + (S.dr[k] - S.cr[k]) * e;
      y = S.cy[k] + (S.dy[k] - S.cy[k]) * e;
      // Po dosednutí do zásoby padá dál do Slunce (protohvězda roste).
      const fall = Math.min(1, Math.max(0, (t - T_COLLAPSE - 2 - 4 * S.c01[k]) / 3));
      r *= 1 - fall; y *= 1 - fall;
      if (fall >= 1) { releaseParticle(pool, k); continue; }
      blendLook(pool, i, k, e, DUST_ALPHA * (1 - fall));
    } else {
      r = S.cr[k] + (drNow - S.cr[k]) * e;
      // Výška klesá rychleji než poloměr — mrak se zplošťuje do placky.
      const ey = Math.min(1, e * 1.6);
      y = S.cy[k] + (S.dy[k] - S.cy[k]) * ey;
      if (e < 1) blendLook(pool, i, k, e, aEff);
      else pool.alpha[i] = aEff;
    }

    // Azimut: mrak se skoro netočí, s kolapsem se roztáčí na Keplera.
    const w = omegaCloud + (keplerOmega(Math.max(r, 1), S.snowR) - omegaCloud) * e * e;
    S.th[k] += w * dt;
    const ang = S.th[k] + S.dth[k] * e;
    let x = r * Math.cos(ang);
    let z = r * Math.sin(ang);

    // Rázová vlna: zjasní a postrčí to, čím právě prochází.
    if (front !== null) {
      const d = x * SHOCK_DIR.x + y * SHOCK_DIR.y + z * SHOCK_DIR.z;
      const q = (d - front) / W;
      const g = Math.exp(-q * q);
      if (d < front) {
        const push = 0.07 * _cloudR * Math.min(1, (front - d) / W);
        x += SHOCK_DIR.x * push; y += SHOCK_DIR.y * push; z += SHOCK_DIR.z * push;
      }
      if (e === 0) {
        // Za čelem vlny je mrak stlačený a zahřátý — světlejší.
        const hot = d < front ? 0.35 : 0;
        pool.alpha[i] = Math.min(1, edgeAlpha(S.c01[k]) * (1 + 2.5 * g + hot));
        const w = Math.min(1, 1.2 * g);
        pool.color[3 * i] = CLOUD_COLOR[0] + (1 - CLOUD_COLOR[0]) * w;
        pool.color[3 * i + 1] = CLOUD_COLOR[1] + (0.92 - CLOUD_COLOR[1]) * w;
        pool.color[3 * i + 2] = CLOUD_COLOR[2] + (0.85 - CLOUD_COLOR[2]) * w;
      }
    }

    if (zone !== -1) {
      // Plyn a zbytek zón obrů: mladé Slunce ho vyfouká ven.
      if (S.clear[k] && t >= T_CLEAR) {
        const b = Math.min(1, (t - T_CLEAR - 2 * (1 - S.dr[k] / (S.snowR * 1.4))) / 3);
        if (b > 0) {
          const out = 1 + 2.5 * b * b;
          x *= out; z *= out; y *= out;
          pool.alpha[i] = aEff * (1 - b);
          if (b >= 1 || t >= T_CLEAR_END) { releaseParticle(pool, k); continue; }
        }
      }
      // Migrace k planetě (akreční okno její zóny).
      if (t >= S.migStart[k]) {
        if (!S.migrating[k]) {
          S.fromX[k] = x; S.fromY[k] = y; S.fromZ[k] = z;
          S.migrating[k] = 1;
        }
        const win = S.entries[zone].window;
        const u = Math.min(1, (t - S.migStart[k]) / Math.max(1e-6, win.end - S.migStart[k]));
        const f = u * u; // ease-in — akcelerace pádu do akrece
        const a = S.entries[zone].anchorPos;
        x = S.fromX[k] + (a.x - S.fromX[k]) * f;
        y = S.fromY[k] + (a.y - S.fromY[k]) * f;
        z = S.fromZ[k] + (a.z - S.fromZ[k]) * f;
        pool.alpha[i] = aEff * (1 - f);
        if (u >= 1) { releaseParticle(pool, k); continue; }
      }
    }
    pool.position[3 * i] = x;
    pool.position[3 * i + 1] = y;
    pool.position[3 * i + 2] = z;
  }
  pool.posAttr.needsUpdate = true;
  pool.alphaAttr.needsUpdate = true;
  pool.colorAttr.needsUpdate = true;
  pool.sizeAttr.needsUpdate = true;
  if (pool.soft) { pool.softActive = t >= T_COLLAPSE; pool.softAttr.needsUpdate = true; }
}

/** Náhodný bod v anulu kolem `center` (disk-flattened, y×0.3) — zdroj emise teček planety. */
function randomAnnulusSource(center, radiusPx) {
  const r = radiusPx * (SOURCE_MIN_RADIUS_FACTOR + Math.random() * (SOURCE_MAX_RADIUS_FACTOR - SOURCE_MIN_RADIUS_FACTOR));
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.cos(phi) * 0.3;
  const z = r * Math.sin(phi) * Math.sin(theta);
  return { x: center.x + x, y: center.y + y, z: center.z + z };
}

/**
 * Emise teček planet z lokálních zón disku (beat_accretion), per okno v
 * ACCRETION_WINDOWS. V peaku akrece běží až 8 oken souběžně — takeIdleIndices
 * je O(pool.count), takže se volá NEJVÝŠ jednou za frame (součet emitCount
 * všech aktivních oken najednou), ne jednou per okno.
 */
function emitAccretion(pool, currentTime, anchors, imageData) {
  const active = [];
  for (const w of ACCRETION_WINDOWS) {
    if (currentTime < w.start) continue;
    const planet = PLANET_BY_ID[w.planetId];
    const anchor = anchors[w.planetId];
    const tex = imageData[w.planetId];
    if (!planet || !anchor || !tex) continue;

    const targets = getPlanetTargets(planet, tex);
    const duration = w.end - w.start;
    const progress = Math.min(1, (currentTime - w.start) / duration);
    const expected = Math.floor(progress * targets.length);
    if (_emitted[w.planetId] === undefined) _emitted[w.planetId] = 0;
    const emitCount = expected - _emitted[w.planetId];
    if (emitCount <= 0) continue;

    active.push({ w, planet, anchor, targets, emitCount });
  }
  if (active.length === 0) return;

  const totalEmit = active.reduce((sum, a) => sum + a.emitCount, 0);
  const idleIndices = pool.takeIdleIndices(totalEmit);

  let offset = 0;
  for (const { w, planet, anchor, targets, emitCount } of active) {
    // Pojistka: pokud pool nestíhal (idleIndices.length < totalEmit), rozděl
    // se postupně v pořadí oken — chybějící se dožene v příštím frame
    // (_emitted se navýší jen o skutečně přidělený počet).
    const available = Math.min(emitCount, idleIndices.length - offset);
    if (available <= 0) continue;

    const planetIdx = PLANETS.findIndex((p) => p.id === w.planetId);
    const cx = anchor.position.x, cy = anchor.position.y, cz = anchor.position.z;
    // localOffset je v frame spin nodu (osa + rotace planety) — cíl letu musí
    // být tam, kam tečku po přistání posadí applyClusterRotation.
    const spinMatrix = anchor.userData?.spin?.matrixWorld ?? null;

    for (let k = 0; k < available; k++) {
      const idx = idleIndices[offset + k];
      const t = targets[_emitted[w.planetId] + k];
      if (!t) break;
      let targetPos;
      if (spinMatrix) {
        _tmpTarget.set(t.localOffset.x, t.localOffset.y, t.localOffset.z).applyMatrix4(spinMatrix);
        targetPos = { x: _tmpTarget.x, y: _tmpTarget.y, z: _tmpTarget.z };
      } else {
        targetPos = { x: cx + t.localOffset.x, y: cy + t.localOffset.y, z: cz + t.localOffset.z };
      }
      const sourcePos = randomAnnulusSource(anchor.position, planet.radiusPx);
      const travelTime = TRAVEL_TIME_MIN + Math.random() * (TRAVEL_TIME_MAX - TRAVEL_TIME_MIN);
      // Tečka letí jako prach disku a barvu povrchu dostane až u planety.
      const dust = diskColor(Math.hypot(sourcePos.x, sourcePos.z) / _diskMax, Math.random());
      pool.spawnFromDisk(
        idx, sourcePos, targetPos, t.localOffset, t.color,
        planetIdx, t.phase, currentTime, travelTime,
        planet.alpha ?? 1.0, planet.dotSize ?? 6.0, dust,
      );
    }
    _emitted[w.planetId] += available;
    offset += available;
  }
}

export function updateFormationIntro(pool, currentTime, dt, anchors, imageData) {
  if (currentTime >= T_END) {
    // Slunce zažehlo — zbytek prachu je pryč (rozmetaný, pohlcený).
    if (S) releaseAll(pool);
    return;
  }
  initDisk(pool, anchors);
  if (!S) return;
  for (const e of S.entries) {
    const a = anchors[e.planetId];
    if (a) e.anchorPos = a.position;
  }
  updateDustFrame(pool, currentTime, dt);
  if (currentTime >= ACCRETION_START) emitAccretion(pool, currentTime, anchors, imageData);
}

const ACCRETION_START = Math.min(...ACCRETION_WINDOWS.map((w) => w.start));

export function resetFormationIntro(pool) {
  if (pool && S) releaseAll(pool);
  S = null;
  _emitted = {};
  resetPhaseEmissions();
}
