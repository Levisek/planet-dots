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

test('ownerAlphaMul má velikost podle počtu vlastníků (žádné NaN pro vysoké indexy)', () => {
  const pool = new ParticlePool(8, 35);
  assert.equal(pool.ownerAlphaMul.length, 35);
  pool.spawnFromPlanet(0, { x: 0, y: 0, z: 0 }, 1, { x: 5, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    [1, 1, 1], [1, 1, 1], 34, 0, 0.3);
  assert.equal(pool.ownerAlpha[0], 1);
});

test('releaseSettled uvolní usazené tečky a compact zúží activeEnd', () => {
  const pool = new ParticlePool(10);
  const idx = pool.takeIdleIndices(6);
  assert.equal(pool.activeEnd, 6);
  for (const i of idx) { pool.phase[i] = PHASE.ON_PLANET; pool.owner[i] = 1; }
  pool.phase[2] = 98; // živá částice uprostřed (vítr)
  const n = pool.releaseSettled();
  assert.equal(n, 5);
  assert.equal(pool.activeEnd, 3, 'konec rozsahu = poslední živá + 1');
  pool.phase[2] = PHASE.IDLE;
  pool.compact();
  assert.equal(pool.activeEnd, 0);
});

test('updateFlight bez letících teček nenahrává atributy', () => {
  const pool = new ParticlePool(8);
  pool.takeIdleIndices(4);
  const v = pool.posAttr.version;
  pool.updateFlight(1, 0.016);
  assert.equal(pool.posAttr.version, v);
});

test('setOwnerSize platí i pro tečky vypuštěné až po něm (detail během formace)', () => {
  const pool = new ParticlePool(8, 4);
  pool.setOwnerSize(3, 0.05);
  pool.spawnFromDisk(0, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    [1, 1, 1], 3, PHASE.ON_PLANET, 0, 1, 1, 6.0);
  assert.ok(Math.abs(pool.size[0] - 0.05) < 1e-6);
  // Prstenec si drží vlastní velikost, jiný vlastník výchozí.
  pool.spawnFromDisk(1, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    [1, 1, 1], 3, PHASE.ON_RING, 0, 1, 1, 4.5);
  assert.equal(pool.size[1], 4.5);
  pool.spawnFromDisk(2, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    [1, 1, 1], 2, PHASE.ON_PLANET, 0, 1, 1, 6.0);
  assert.equal(pool.size[2], 6.0);
});
