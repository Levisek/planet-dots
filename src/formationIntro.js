// formationIntro — akreční formace sluneční soustavy (V4.4 F3).
//
// beat_disk      (0–4s):    12k prachových částic v protoplanetárním disku
//                           (poloměr dle reálných orbit z anchors), pomalá
//                           rotace kolem Y.
// beat_ignition  (4–6.5s):  prach s r < 0.55×r(Merkur) spirálovitě kolabuje
//                           do středu + fade (vznik Slunce); zbytek disku
//                           dál rotuje beze změny.
// beat_accretion (6.5–17s): per-planeta okna (ACCRETION_WINDOWS): tečky
//                           planet se emitují pool.spawnFromDisk ze zdrojů
//                           v lokální zóně planety (anulus kolem aktuální
//                           anchor pozice, disk-flattened y×0.3); prachové
//                           částice zóny současně manuálně migrují k planetě
//                           a na dojezdu fade → IDLE (pohltí je planeta).
// Po beat_accretion se zbylý prach uvolní (IDLE) — disk je „vyčištěný".
//
// Sun mesh reveal (side-efekt zážehu) řeší main.js (Task 5) — tady se
// pracuje jen s prachem/tečkami.

import { phaseAt, ACCRETION_WINDOWS, resetPhaseEmissions } from './animation.js';
import { PLANETS, PLANET_BY_ID } from './planets.js';
import { getPlanetTargets } from './planetTargets.js';
import { PHASE } from './phase.js';

const DUST_COUNT = 12000;
const ROTATION_PERIOD = 30; // sec / full disk spin
const SUN_ZONE_FACTOR = 0.55; // r < 0.55×r(Merkur) = sluneční zásoba (kolabuje v ignition)
const DISK_MIN_FACTOR = 0.75; // disk sahá 0.75×r_min .. 1.1×r_max
const DISK_MAX_FACTOR = 1.1;
const SOURCE_MIN_RADIUS_FACTOR = 8;  // anulus zdroje emise: 8×radiusPx .. 30×radiusPx
const SOURCE_MAX_RADIUS_FACTOR = 30;
const TRAVEL_TIME_MIN = 0.6;
const TRAVEL_TIME_MAX = 1.2;

/**
 * Čistá funkce: přiřadí poloměr r nejbližší zóně (planetě) podle |r - r_zone|.
 * Testovatelná bez poolu. Deterministická (žádná náhoda).
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

function gaussianRandom() {
  // Box-Muller — přibližná normální distribuce (pro placka-tvar disku).
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ——— Interní stav disku (module-level singleton, jako dřívější cloud) ———
let _dustIndices = null;       // pool indexy prachu
let _dustZone = null;          // Int32Array: -1 = sluneční zásoba, jinak index do _zoneEntries
let _dustMigrationStart = null; // Float32Array: kdy (currentTime) začne migrace k planetě
let _dustMigrating = null;     // Uint8Array: 1 = právě migruje (start pozice zachycena)
let _dustFromX = null, _dustFromY = null, _dustFromZ = null; // pozice zachycená na startu migrace
let _dustReleased = null;      // Uint8Array: 1 = už vráceno do IDLE
let _zoneEntries = null;       // [{ planetId, radius, window }] — jen planety s dostupným anchorem
let _emitted = {};             // { [planetId]: count } — emisní tempo teček planety

function initDisk(pool, anchors) {
  if (_dustIndices) return;

  // Zóny mode-aware: poloměr = délka XZ vektoru anchor pozice (snapshot při initu).
  const entries = [];
  for (const w of ACCRETION_WINDOWS) {
    const anchor = anchors[w.planetId];
    if (!anchor) continue;
    const { x, z } = anchor.position;
    const radius = Math.sqrt(x * x + z * z);
    entries.push({ planetId: w.planetId, radius, window: w });
  }
  if (entries.length === 0) return;
  _zoneEntries = entries;
  const zoneRadii = entries.map((e) => e.radius);

  const rMin = zoneRadii[0];
  const rMax = zoneRadii[zoneRadii.length - 1];
  const diskMin = DISK_MIN_FACTOR * rMin;
  const diskMax = DISK_MAX_FACTOR * rMax;
  const sunZoneMax = SUN_ZONE_FACTOR * rMin;

  const idle = pool.takeIdleIndices(DUST_COUNT);
  if (idle.length === 0) return;

  _dustIndices = idle;
  _dustZone = new Int32Array(idle.length);
  _dustMigrationStart = new Float32Array(idle.length);
  _dustMigrating = new Uint8Array(idle.length);
  _dustFromX = new Float32Array(idle.length);
  _dustFromY = new Float32Array(idle.length);
  _dustFromZ = new Float32Array(idle.length);
  _dustReleased = new Uint8Array(idle.length);

  for (let k = 0; k < idle.length; k++) {
    const i = idle[k];
    // Sqrt-uniform v anulu, ale invertované (denser dovnitř): u blízko 1 → r blízko diskMin.
    const r = diskMax - (diskMax - diskMin) * Math.sqrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);
    const y = r * gaussianRandom() * 0.06; // placka

    pool.position[3 * i] = x;
    pool.position[3 * i + 1] = y;
    pool.position[3 * i + 2] = z;
    // Šedo-modrá protoplanetární prach paleta.
    pool.color[3 * i] = 0.45 + Math.random() * 0.18;
    pool.color[3 * i + 1] = 0.50 + Math.random() * 0.18;
    pool.color[3 * i + 2] = 0.62 + Math.random() * 0.20;
    pool.alpha[i] = 0.65;
    pool.size[i] = 4.0;
    pool.phase[i] = 99; // mimo standard PHASE enum — kustomní disk prach
    pool.owner[i] = -1;

    if (r < sunZoneMax) {
      _dustZone[k] = -1; // sluneční zásoba
    } else {
      const zoneIdx = assignZone(r, zoneRadii);
      _dustZone[k] = zoneIdx;
      const w = entries[zoneIdx].window;
      _dustMigrationStart[k] = w.start + Math.random() * (w.end - w.start);
    }
  }
  pool.flushAll();
}

/** Uvolní jednu prachovou částici do IDLE (planeta ji pohltila / zážeh skončil). */
function releaseDustParticle(pool, k) {
  const i = _dustIndices[k];
  pool.alpha[i] = 0;
  pool.phase[i] = PHASE.IDLE;
  pool.owner[i] = -1;
  _dustReleased[k] = 1;
}

/** Uvolní všechen ještě neuvolněný prach (konec beat_accretion / reset). */
function releaseAllDust(pool) {
  if (!_dustIndices) return;
  for (let k = 0; k < _dustIndices.length; k++) {
    if (!_dustReleased[k]) releaseDustParticle(pool, k);
  }
  pool.alphaAttr.needsUpdate = true;
  pool.posAttr.needsUpdate = true;
}

/**
 * Per-frame update prachu: rotace zbytku disku, kolaps sluneční zásoby
 * (beat_ignition), migrace zónového prachu k planetě (beat_accretion).
 */
function updateDustFrame(pool, phId, currentTime, dt) {
  const omega = (2 * Math.PI) / ROTATION_PERIOD;
  const angle = omega * dt;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  const ignitionPh = phId === 'beat_ignition' ? phaseAt(currentTime) : null;

  for (let k = 0; k < _dustIndices.length; k++) {
    if (_dustReleased[k]) continue;
    const i = _dustIndices[k];
    const zone = _dustZone[k];

    if (zone === -1) {
      // Sluneční zásoba — rotuje během beat_disk, kolabuje během beat_ignition.
      if (phId === 'beat_ignition') {
        const t = (currentTime - ignitionPh.start) / (ignitionPh.end - ignitionPh.start);
        const collapseFactor = (1 - t) * (1 - t);
        // Zachytí "poslední rotovanou" pozici jako lokální bázi při prvním vstupu.
        if (!_dustMigrating[k]) {
          _dustFromX[k] = pool.position[3 * i];
          _dustFromY[k] = pool.position[3 * i + 1];
          _dustFromZ[k] = pool.position[3 * i + 2];
          _dustMigrating[k] = 1;
        }
        pool.position[3 * i] = _dustFromX[k] * collapseFactor;
        pool.position[3 * i + 1] = _dustFromY[k] * collapseFactor;
        pool.position[3 * i + 2] = _dustFromZ[k] * collapseFactor;
        pool.alpha[i] = collapseFactor * 0.65;
        if (t >= 1) releaseDustParticle(pool, k);
        continue;
      }
      if (phId === 'beat_disk') {
        const x = pool.position[3 * i];
        const z = pool.position[3 * i + 2];
        pool.position[3 * i] = x * cosA - z * sinA;
        pool.position[3 * i + 2] = x * sinA + z * cosA;
        continue;
      }
      // beat_accretion a dál — sluneční zásoba už měla zkolabovat v ignition;
      // pojistka kdyby ignition beat přeskočil (test volá update napřímo).
      releaseDustParticle(pool, k);
      continue;
    }

    // Planetová zóna.
    if (currentTime < _dustMigrationStart[k]) {
      // Ještě rotuje jako součást disku (beat_disk i beat_ignition, "zbytek disku dál rotuje").
      const x = pool.position[3 * i];
      const z = pool.position[3 * i + 2];
      pool.position[3 * i] = x * cosA - z * sinA;
      pool.position[3 * i + 2] = x * sinA + z * cosA;
      continue;
    }

    // Migrace k anchor planety.
    const entry = _zoneEntries[zone];
    const w = entry.window;
    if (!_dustMigrating[k]) {
      _dustFromX[k] = pool.position[3 * i];
      _dustFromY[k] = pool.position[3 * i + 1];
      _dustFromZ[k] = pool.position[3 * i + 2];
      _dustMigrating[k] = 1;
    }
    const duration = Math.max(1e-6, w.end - _dustMigrationStart[k]);
    const t = Math.min(1, (currentTime - _dustMigrationStart[k]) / duration);
    const factor = t * t; // ease-in — akcelerace pádu do akrece
    const anchor = entry.anchorPos;
    pool.position[3 * i] = _dustFromX[k] + (anchor.x - _dustFromX[k]) * factor;
    pool.position[3 * i + 1] = _dustFromY[k] + (anchor.y - _dustFromY[k]) * factor;
    pool.position[3 * i + 2] = _dustFromZ[k] + (anchor.z - _dustFromZ[k]) * factor;
    pool.alpha[i] = 0.65 * (1 - factor);
    if (t >= 1) releaseDustParticle(pool, k);
  }
  pool.posAttr.needsUpdate = true;
  pool.alphaAttr.needsUpdate = true;
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

/** Emise teček planet z lokálních zón disku (beat_accretion), per okno v ACCRETION_WINDOWS. */
function emitAccretion(pool, currentTime, anchors, imageData) {
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

    const planetIdx = PLANETS.findIndex((p) => p.id === w.planetId);
    const cx = anchor.position.x, cy = anchor.position.y, cz = anchor.position.z;

    const idleIndices = pool.takeIdleIndices(emitCount);
    for (let k = 0; k < idleIndices.length; k++) {
      const idx = idleIndices[k];
      const t = targets[_emitted[w.planetId] + k];
      if (!t) break;
      const targetPos = { x: cx + t.localOffset.x, y: cy + t.localOffset.y, z: cz + t.localOffset.z };
      const sourcePos = randomAnnulusSource(anchor.position, planet.radiusPx);
      const travelTime = TRAVEL_TIME_MIN + Math.random() * (TRAVEL_TIME_MAX - TRAVEL_TIME_MIN);
      pool.spawnFromDisk(
        idx, sourcePos, targetPos, t.localOffset, t.color,
        planetIdx, t.phase, currentTime, travelTime,
        planet.alpha ?? 1.0, planet.dotSize ?? 6.0,
      );
    }
    _emitted[w.planetId] += idleIndices.length;
  }
}

export function updateFormationIntro(pool, currentTime, dt, anchors, imageData) {
  const ph = phaseAt(currentTime);
  if (!ph) return;

  if (ph.id !== 'beat_disk' && ph.id !== 'beat_ignition' && ph.id !== 'beat_accretion') {
    // Po formaci (moon fáze / live) — uvolni zbylý prach, disk je „vyčištěný".
    if (_dustIndices) releaseAllDust(pool);
    return;
  }

  initDisk(pool, anchors);
  if (!_dustIndices) return;

  // _zoneEntries potřebuje anchorPos snapshot pro migraci — doplní se lazy
  // (anchors se během formace hýbou pomalu, ale migrace cílí na aktuální
  // pozici v okamžiku volání, ne na snapshot z initu).
  for (const entry of _zoneEntries) {
    const a = anchors[entry.planetId];
    if (a) entry.anchorPos = a.position;
  }

  updateDustFrame(pool, ph.id, currentTime, dt);

  if (ph.id === 'beat_accretion') {
    emitAccretion(pool, currentTime, anchors, imageData);
  }
}

export function resetFormationIntro(pool) {
  if (pool && _dustIndices) releaseAllDust(pool);
  _dustIndices = null;
  _dustZone = null;
  _dustMigrationStart = null;
  _dustMigrating = null;
  _dustFromX = null;
  _dustFromY = null;
  _dustFromZ = null;
  _dustReleased = null;
  _zoneEntries = null;
  _emitted = {};
  resetPhaseEmissions();
}
