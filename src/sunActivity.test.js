import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSunActivity, parabolicArcPos } from './sunActivity.js';

function makeMockPool(count) {
  return {
    count,
    owner: new Int16Array(count).fill(0),
    color: new Float32Array(count * 3).fill(1),
    alpha: new Float32Array(count).fill(1),
    phase: new Uint8Array(count),
    position: new Float32Array(count * 3),
    localOffset: new Float32Array(count * 3),
    colorAttr: { needsUpdate: false },
  };
}

test('spawnSunspot označí ~30-50 teček', () => {
  const pool = makeMockPool(1000);
  for (let i = 0; i < 1000; i++) {
    pool.localOffset[3*i] = Math.cos(i);
    pool.localOffset[3*i+1] = Math.sin(i);
    pool.localOffset[3*i+2] = Math.cos(i * 2);
  }
  const act = createSunActivity({ sunOwner: 0, sunRadius: 1 });
  const spot = act._spawnSunspot(pool, 0);
  assert.ok(spot.indices.length >= 20 && spot.indices.length <= 60,
    `cluster size = ${spot.indices.length}`);
});

test('lifecycle: fade-in → stable → fade-out → dead', () => {
  const act = createSunActivity({ sunOwner: 0, sunRadius: 1 });
  const spot = { bornAt: 0, stableAt: 3, deathAt: 31, indices: [1, 2, 3] };
  assert.equal(act._intensityAt(spot, 0), 0, 'at birth = 0');
  assert.ok(Math.abs(act._intensityAt(spot, 1.5) - 0.5) < 0.05, 'halfway fade-in ~0.5');
  assert.equal(act._intensityAt(spot, 15), 1, 'stable = 1');
  assert.ok(act._intensityAt(spot, 27) < 1, 'fading out');
  assert.equal(act._intensityAt(spot, 32), 0, 'dead = 0');
});

test('update: spawnuje nový sunspot po intervalu (low intensity)', () => {
  const pool = makeMockPool(500);
  for (let i = 0; i < 500; i++) {
    pool.localOffset[3*i] = Math.cos(i);
    pool.localOffset[3*i+1] = Math.sin(i);
    pool.localOffset[3*i+2] = Math.cos(i*2);
  }
  const act = createSunActivity({ sunOwner: 0, sunRadius: 1, seed: 42 });
  act.update(pool, 0, 0.016, { intensity: 'low' });
  for (let t = 0; t < 30; t += 1) {
    act.update(pool, t, 1, { intensity: 'low' });
  }
  assert.ok(act._activeSpots().length >= 1, 'po 30s má být alespoň 1 spot');
});

test('parabolicArcPos: t=0 = A, t=1 = B', () => {
  const A = { x: 0, y: 0, z: 0 };
  const B = { x: 10, y: 0, z: 0 };
  const peak = 2;
  const p0 = parabolicArcPos(A, B, peak, 0);
  const p1 = parabolicArcPos(A, B, peak, 1);
  assert.ok(Math.abs(p0.x - 0) < 0.001);
  assert.ok(Math.abs(p1.x - 10) < 0.001);
});

test('parabolicArcPos: max výška při t=0.5', () => {
  const A = { x: 0, y: 0, z: 0 };
  const B = { x: 10, y: 0, z: 0 };
  const peak = 2;
  const mid = parabolicArcPos(A, B, peak, 0.5);
  assert.ok(Math.abs(mid.y - peak) < 0.01, `y = ${mid.y}, expected ~${peak}`);
});
