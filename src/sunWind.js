// sunWind.js — ambientní sluneční vítr (V4.4 Task 4 F3).
//
// Kosmetická vrstva nahrazující smazanou solarWind planet-emisi: kontinuální
// tenký proud částic vylétávajících radiálně z povrchu Slunce (Slunce sedí
// ve world-space origin), fade-out a návrat do poolu. Modul je nezávislý na
// PHASES/simClock — řídí se jen currentTime (main.js _realElapsed) a dt;
// main.js ho gatuje natvrdo (_realElapsed >= 4.0, beat_ignition start), pak
// běží nepřetržitě dál. Nereversuje — žádný couvací efekt v čase.
//
// Vlastní stav letu (position += velocity*dt, lineární alpha fade) — NE
// pool.updateFlight, protože částice nemají target (jen radiální směr).

import { PHASE } from './phase.js';

const RATE = 40;             // částic / sekundu
const CAP = 150;              // max aktivních částic najednou (safety cap)
const SPEED = 600;            // units / s, radiálně ven z povrchu
const SPEED_VARIANCE = 0.2;   // ±20 %
const LIFETIME = 2.5;         // s do fade-out (alpha 0.9 → 0) → IDLE
const SIZE = 2.5;

// Mimo standard PHASE enum — stejný trik jako formationIntro prach (99),
// aby updateFlight/countSettled tyto částice ignorovaly.
export const SUN_WIND_PHASE = 98;

let _carry = 0;   // emisní akumulátor (zlomkové částice mezi frame)
let _active = []; // [{ idx, birth }] — vlastní seznam aktivních indexů

function releaseParticle(pool, idx) {
  pool.phase[idx] = PHASE.IDLE;
  pool.owner[idx] = -1;
  pool.alpha[idx] = 0;
}

/**
 * Kontinuální emise + per-frame let/fade slunečního větru.
 * @param {ParticlePool} pool
 * @param {number} currentTime — _realElapsed (s), monotónně dopředu
 * @param {number} dt
 * @param {number} sunRadius — poloměr Slunce (world units), Slunce v origin
 */
export function updateSunWind(pool, currentTime, dt, sunRadius) {
  // 1) Let + fade + recyklace stávajících aktivních částic.
  for (let k = _active.length - 1; k >= 0; k--) {
    const p = _active[k];
    const i = p.idx;
    const age = currentTime - p.birth;
    if (age >= LIFETIME) {
      releaseParticle(pool, i);
      _active.splice(k, 1);
      continue;
    }
    pool.position[3 * i]     += pool.velocity[3 * i]     * dt;
    pool.position[3 * i + 1] += pool.velocity[3 * i + 1] * dt;
    pool.position[3 * i + 2] += pool.velocity[3 * i + 2] * dt;
    pool.alpha[i] = 0.9 * (1 - age / LIFETIME);
  }

  // 2) Emisní akumulátor — kontinuální ~RATE částic/s, cap ~150 aktivních.
  _carry += dt * RATE;
  let spawn = Math.floor(_carry);
  _carry -= spawn;

  const room = CAP - _active.length;
  if (spawn > 0 && room > 0) {
    spawn = Math.min(spawn, room);
    const idle = pool.takeIdleIndices(spawn);
    for (let k = 0; k < idle.length; k++) {
      const i = idle[k];
      // Náhodný uniformní směr na jednotkové sféře (start = povrch Slunce).
      const rx = (Math.random() - 0.5) * 2;
      const ry = (Math.random() - 0.5) * 2;
      const rz = (Math.random() - 0.5) * 2;
      const len = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
      const dx = rx / len, dy = ry / len, dz = rz / len;

      pool.position[3 * i]     = dx * sunRadius;
      pool.position[3 * i + 1] = dy * sunRadius;
      pool.position[3 * i + 2] = dz * sunRadius;

      const speed = SPEED * (1 + (Math.random() * 2 - 1) * SPEED_VARIANCE);
      pool.velocity[3 * i]     = dx * speed;
      pool.velocity[3 * i + 1] = dy * speed;
      pool.velocity[3 * i + 2] = dz * speed;

      // Žlutobílá s variancí.
      pool.color[3 * i]     = 1.0;
      pool.color[3 * i + 1] = 0.9 + Math.random() * 0.1;
      pool.color[3 * i + 2] = 0.6 + Math.random() * 0.2;
      pool.alpha[i] = 0.9;
      pool.size[i] = SIZE;
      pool.owner[i] = -1;
      pool.phase[i] = SUN_WIND_PHASE;

      _active.push({ idx: i, birth: currentTime });
    }
  }

  pool.posAttr.needsUpdate = true;
  pool.colorAttr.needsUpdate = true;
  pool.alphaAttr.needsUpdate = true;
  pool.sizeAttr.needsUpdate = true;
}

/** Uvolní všechny aktivní částice zpět do IDLE (reset/restart animace). */
export function resetSunWind(pool) {
  if (pool) {
    for (const p of _active) releaseParticle(pool, p.idx);
  }
  _active = [];
  _carry = 0;
}
