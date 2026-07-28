import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ParticlePool } from './particles.js';
import { PHASE } from './phase.js';

test('spawnFromDisk: start = sourcePos, let k cíli, owner a finalPhase nastaveny', () => {
  const pool = new ParticlePool(8);
  const src = { x: 100, y: 5, z: -30 };
  const tgt = { x: 200, y: 0, z: 0 };
  pool.spawnFromDisk(0, src, tgt, { x: 1, y: 0, z: 0 }, [0.5, 0.4, 0.3], 3,
    PHASE.ON_PLANET, 10.0, 2.0);
  assert.equal(pool.position[0], 100);
  assert.equal(pool.position[1], 5);
  assert.equal(pool.position[2], -30);
  assert.equal(pool.owner[0], 3);
  assert.equal(pool.phase[0], PHASE.FLYING);
  assert.equal(pool.finalPhase[0], PHASE.ON_PLANET);
  assert.equal(pool.arrivalTime[0], 12.0);
  // velocity míří k cíli
  assert.ok(pool.velocity[0] > 0);
});

function closeTo(actual, expected, eps = 1e-6) {
  assert.ok(Math.abs(actual - expected) < eps, `expected ${actual} ≈ ${expected}`);
}

test('spawnFromDisk: start barva = prachová paleta, alpha 0.8', () => {
  const pool = new ParticlePool(8);
  pool.spawnFromDisk(0, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    [0.9, 0.9, 0.9], 2, PHASE.ON_RING, 0.0, 1.0);
  closeTo(pool.color[0], 0.5);
  closeTo(pool.color[1], 0.55);
  closeTo(pool.color[2], 0.68);
  closeTo(pool.alpha[0], 0.8);
});

test('spawnFromDisk: finalColor jde do postArrivalColor, finalAlpha/finalSize respektovány', () => {
  const pool = new ParticlePool(8);
  pool.spawnFromDisk(1, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    [0.1, 0.2, 0.3], 4, PHASE.ON_PLANET, 0.0, 1.0, 0.5, 3.0);
  closeTo(pool.postArrivalColor[3], 0.1);
  closeTo(pool.postArrivalColor[4], 0.2);
  closeTo(pool.postArrivalColor[5], 0.3);
  closeTo(pool.postArrivalAlpha[1], 0.5);
  assert.equal(pool.size[1], 3.0);
});
