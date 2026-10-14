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
// ACCRETION_WINDOWS: prach zóny planety migruje k ní a pohltí se; tečky
//   povrchu planety se emitují pool.spawnFromDisk z okolí planety.
// clearing (38–44 s): plyn (část částic, řidší a šedomodrý) v zónách
//   kamenných planet a Marsu odfoukne mladé Slunce ven. Plyn v zónách obrů
//   obři pohltí v akreci (lavinovitě nabírají plyn).
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
const DISK_MIN_FACTOR = 0.75;      // disk sahá 0.75×r_min .. 1.1×r_max
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

const DUST_ALPHA = 0.75;
const GAS_ALPHA = 0.32;
const CLOUD_ALPHA = 0.45;
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
const GAS_COLOR = [0.62, 0.66, 0.74];

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
  const cloudR = CLOUD_FACTOR * diskMax;
  _cloudR = cloudR;
  _sizeK = cloudR / SIZE_REF_R;
  const sunMin = SUN_RESERVE_MIN_FACTOR * rMin;
  const sunMax = SUN_ZONE_FACTOR * rMin;

  const idle = pool.takeIdleIndices(DUST_COUNT);
  if (idle.length === 0) return;
  const n = idle.length;
  S = {
    idx: idle, entries, snowR,
    zone: new Int32Array(n),      // -1 = sluneční zásoba, jinak index do entries
    gas: new Uint8Array(n),
    cr: new Float32Array(n),      // mrak: vodorovný poloměr, výška, poloměr/Rc
    cy: new Float32Array(n),
    c01: new Float32Array(n),
    dr: new Float32Array(n),      // disk: poloměr a výška
    dy: new Float32Array(n),
    th: new Float32Array(n),      // azimut (integruje se)
    color: new Float32Array(n * 3), // barva v disku
    size: new Float32Array(n),      // velikost v disku
    migStart: new Float32Array(n),
    migrating: new Uint8Array(n),
    fromX: new Float32Array(n), fromY: new Float32Array(n), fromZ: new Float32Array(n),
    released: new Uint8Array(n),
  };
  const sunCount = Math.round(n * SUN_RESERVE_FRACTION);
  for (let k = 0; k < n; k++) {
    const i = idle[k];
    const isSun = k < sunCount;
    // v ~ U(0,1): pořadí od středu — stejné v mraku i v disku, ať se
    // částice při kolapsu nekříží napříč celým diskem.
    const v = Math.random();
    const dr = isSun
      ? sunMin + (sunMax - sunMin) * Math.sqrt(v)
      : diskMax - (diskMax - diskMin) * Math.sqrt(1 - v); // hustší dovnitř
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
    S.dy[k] = dr * gaussianRandom() * 0.06;
    S.th[k] = Math.random() * Math.PI * 2;

    let col;
    if (isSun) {
      S.zone[k] = -1;
      col = dustColor(dr, snowR, Math.random());
    } else {
      const z = assignZone(dr, zoneRadii);
      S.zone[k] = z;
      const e = entries[z];
      S.gas[k] = Math.random() < GAS_FRACTION ? 1 : 0;
      col = S.gas[k] ? GAS_COLOR : dustColor(dr, snowR, Math.random());
      // Plyn kamenných zón nikdo nepohltí — odfoukne ho Slunce (clearing).
      S.migStart[k] = S.gas[k] && ROCKY.has(e.planetId)
        ? Infinity
        : e.window.start + Math.random() * (e.window.end - e.window.start);
    }
    S.color[3 * k] = col[0]; S.color[3 * k + 1] = col[1]; S.color[3 * k + 2] = col[2];
    pool.color[3 * i] = CLOUD_COLOR[0];
    pool.color[3 * i + 1] = CLOUD_COLOR[1];
    pool.color[3 * i + 2] = CLOUD_COLOR[2];
    pool.alpha[i] = CLOUD_ALPHA;
    S.size[k] = (S.gas[k] ? 4.0 : 5.0) * _sizeK;
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
  pool.phase[i] = PHASE.IDLE;
  pool.owner[i] = -1;
  S.released[k] = 1;
}

function releaseAll(pool) {
  if (!S) return;
  for (let k = 0; k < S.idx.length; k++) if (!S.released[k]) releaseParticle(pool, k);
  pool.alphaAttr.needsUpdate = true;
  pool.posAttr.needsUpdate = true;
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
}

function updateDustFrame(pool, t, dt) {
  const omegaCloud = 2 * Math.PI / CLOUD_PERIOD;
  const front = t >= T_SHOCK && t < T_COLLAPSE + 1 ? shockFront(t) : null;
  const W = 0.12 * _cloudR;
  const n = S.idx.length;
  for (let k = 0; k < n; k++) {
    if (S.released[k]) continue;
    const i = S.idx[k];
    const zone = S.zone[k];
    const gas = S.gas[k];
    const alphaDisk = gas ? GAS_ALPHA : DUST_ALPHA;
    const e = collapseProgress(t, S.c01[k]);

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
      r = S.cr[k] + (S.dr[k] - S.cr[k]) * e;
      // Výška klesá rychleji než poloměr — mrak se zplošťuje do placky.
      const ey = Math.min(1, e * 1.6);
      y = S.cy[k] + (S.dy[k] - S.cy[k]) * ey;
      if (e < 1) blendLook(pool, i, k, e, alphaDisk);
    }

    // Azimut: mrak se skoro netočí, s kolapsem se roztáčí na Keplera.
    const w = omegaCloud + (keplerOmega(Math.max(r, 1), S.snowR) - omegaCloud) * e * e;
    S.th[k] += w * dt;
    let x = r * Math.cos(S.th[k]);
    let z = r * Math.sin(S.th[k]);

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
      // Plyn kamenných zón: mladé Slunce ho vyfouká ven.
      if (S.migStart[k] === Infinity && t >= T_CLEAR) {
        const b = Math.min(1, (t - T_CLEAR - 2 * (1 - S.dr[k] / (S.snowR * 1.4))) / 3);
        if (b > 0) {
          const out = 1 + 2.5 * b * b;
          x *= out; z *= out; y *= out;
          pool.alpha[i] = GAS_ALPHA * (1 - b);
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
        pool.alpha[i] = alphaDisk * (1 - f);
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
      const dust = dustColor(Math.hypot(sourcePos.x, sourcePos.z), _snowR, Math.random());
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
