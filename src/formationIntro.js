// formationIntro — narativní intro vzniku sluneční soustavy (V4.2 Beat 1+2).
// Beat 1 (0-3s): molekulární oblak rotuje v sférické distribuci kolem origin.
// Beat 2 (3-6s): gravitační kolaps — pozice lerp k 0 + alpha fade.
// Po Beat 2 cloud zmizí, solarWind převezme normální emise (Beat 3+).
//
// Cloud particles používají IDLE indices z poolu a vrátí je IDLE po Beat 2,
// aby je solarWind mohl recyklovat pro planet emisi.

import { phaseAt } from './animation.js';

const CLOUD_COUNT = 12000;
const CLOUD_MIN_RADIUS = 800;
const CLOUD_MAX_RADIUS = 4500;
const ROTATION_PERIOD = 30; // sec / full cloud spin

let _cloudIndices = null;
let _localOffsets = null;

function initCloud(pool) {
  if (_cloudIndices) return;
  const idle = pool.takeIdleIndices(CLOUD_COUNT);
  if (idle.length === 0) return;
  _cloudIndices = idle;
  _localOffsets = new Float32Array(idle.length * 3);
  for (let k = 0; k < idle.length; k++) {
    const i = idle[k];
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = CLOUD_MIN_RADIUS + Math.random() * (CLOUD_MAX_RADIUS - CLOUD_MIN_RADIUS);
    // Disk-shape: y squished o ~0.3 ať cloud vypadá jako protoplanetary disk.
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi) * 0.3;
    const z = r * Math.sin(phi) * Math.sin(theta);
    _localOffsets[k * 3] = x;
    _localOffsets[k * 3 + 1] = y;
    _localOffsets[k * 3 + 2] = z;
    pool.position[3 * i] = x;
    pool.position[3 * i + 1] = y;
    pool.position[3 * i + 2] = z;
    // Šedo-modrá protoplanet dust.
    pool.color[3 * i] = 0.45 + Math.random() * 0.18;
    pool.color[3 * i + 1] = 0.50 + Math.random() * 0.18;
    pool.color[3 * i + 2] = 0.62 + Math.random() * 0.20;
    pool.alpha[i] = 0.65;
    pool.size[i] = 4.0;
    pool.phase[i] = 99; // mimo standard PHASE enum — kustomní cloud
    pool.owner[i] = -1;
    pool.ownerAlpha[i] = 1;
  }
  pool.flushAll();
}

function releaseCloud(pool) {
  if (!_cloudIndices) return;
  for (const i of _cloudIndices) {
    pool.alpha[i] = 0;
    pool.phase[i] = 0; // PHASE.IDLE
    pool.owner[i] = -1;
  }
  pool.alphaAttr.needsUpdate = true;
  _cloudIndices = null;
  _localOffsets = null;
}

export function updateFormationIntro(pool, currentTime, dt) {
  const ph = phaseAt(currentTime);
  if (!ph) return;

  if (ph.id === 'beat1_cloud') {
    initCloud(pool);
    if (!_cloudIndices) return;
    // Slow rotation kolem Y osy.
    const omega = (2 * Math.PI) / ROTATION_PERIOD;
    const angle = omega * dt;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    for (let k = 0; k < _cloudIndices.length; k++) {
      const i = _cloudIndices[k];
      const x = pool.position[3 * i];
      const z = pool.position[3 * i + 2];
      const nx = x * c - z * s;
      const nz = x * s + z * c;
      pool.position[3 * i] = nx;
      pool.position[3 * i + 2] = nz;
      _localOffsets[k * 3] = nx;
      _localOffsets[k * 3 + 2] = nz;
    }
    pool.posAttr.needsUpdate = true;
    return;
  }

  if (ph.id === 'beat2_collapse') {
    initCloud(pool); // pojistka pokud Beat 1 přeskočil
    if (!_cloudIndices) return;
    // t 0..1, smooth ease (1 → 0) — pozice lerp k 0, alpha fade out.
    const t = (currentTime - ph.start) / (ph.end - ph.start);
    const collapseFactor = (1 - t) * (1 - t);
    for (let k = 0; k < _cloudIndices.length; k++) {
      const i = _cloudIndices[k];
      const lx = _localOffsets[k * 3];
      const ly = _localOffsets[k * 3 + 1];
      const lz = _localOffsets[k * 3 + 2];
      pool.position[3 * i] = lx * collapseFactor;
      pool.position[3 * i + 1] = ly * collapseFactor;
      pool.position[3 * i + 2] = lz * collapseFactor;
      pool.alpha[i] = collapseFactor * 0.65;
    }
    pool.posAttr.needsUpdate = true;
    pool.alphaAttr.needsUpdate = true;
    return;
  }

  // Po Beat 2 — uvolni cloud particles do IDLE poolu (solarWind je recykluje).
  if (_cloudIndices) releaseCloud(pool);
}

export function resetFormationIntro(pool) {
  if (pool && _cloudIndices) releaseCloud(pool);
  _cloudIndices = null;
  _localOffsets = null;
}
