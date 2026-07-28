import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateSunWind, resetSunWind, SUN_WIND_PHASE } from './sunWind.js';
import { PHASE } from './phase.js';

// Fake pool — plain objekt s poli místo Three.js BufferAttribute (idiom viz
// formationIntro.test.js). Dost velký pro cap (150) i opakovanou emisi v testech.
function makeFakePool(size = 2000) {
  return {
    count: size,
    position: new Float32Array(size * 3),
    velocity: new Float32Array(size * 3),
    color: new Float32Array(size * 3),
    alpha: new Float32Array(size),
    size: new Float32Array(size),
    phase: new Array(size).fill(PHASE.IDLE),
    owner: new Array(size).fill(-1),
    posAttr: { needsUpdate: false },
    colorAttr: { needsUpdate: false },
    alphaAttr: { needsUpdate: false },
    sizeAttr: { needsUpdate: false },
    takeIdleIndices(count) {
      const out = [];
      for (let i = 0; i < this.count && out.length < count; i++) {
        if (this.phase[i] === PHASE.IDLE) out.push(i);
      }
      return out;
    },
  };
}

function activeIndices(pool) {
  const out = [];
  for (let i = 0; i < pool.count; i++) {
    if (pool.phase[i] === SUN_WIND_PHASE) out.push(i);
  }
  return out;
}

function dot3(ax, ay, az, bx, by, bz) {
  return ax * bx + ay * by + az * bz;
}

test('updateSunWind: emituje ~40 částic/s, start na povrchu Slunce, radiálně ven', () => {
  const pool = makeFakePool();
  resetSunWind(pool);

  updateSunWind(pool, 10, 1.0, 60);

  const active = activeIndices(pool);
  assert.ok(Math.abs(active.length - 40) <= 2, `emitováno ${active.length}, čekáno ~40`);

  for (const i of active) {
    const px = pool.position[3 * i], py = pool.position[3 * i + 1], pz = pool.position[3 * i + 2];
    const vx = pool.velocity[3 * i], vy = pool.velocity[3 * i + 1], vz = pool.velocity[3 * i + 2];
    const r = Math.sqrt(px * px + py * py + pz * pz);
    assert.ok(Math.abs(r - 60) < 1, `|position| = ${r}, čekáno ≈60`);
    assert.ok(dot3(px, py, pz, vx, vy, vz) > 0, 'velocity nemíří radiálně ven (dot <= 0)');
    assert.equal(pool.owner[i], -1);
    assert.equal(pool.size[i], 2.5);
  }
});

test('updateSunWind: interní cap ~150 aktivních — velký spawn se ořízne', () => {
  const pool = makeFakePool();
  resetSunWind(pool);

  // dt=10 → carry=400 částic k emisi, ale cap=150 a pool je čerstvý (room=150).
  updateSunWind(pool, 0, 10, 60);

  const active = activeIndices(pool);
  assert.equal(active.length, 150, `aktivních ${active.length}, čekáno přesně 150 (cap)`);
});

test('updateSunWind: cap drží i přes opakované volání s průběžnou recyklací', () => {
  const pool = makeFakePool();
  resetSunWind(pool);

  updateSunWind(pool, 10, 1.0, 60); // ~40 aktivních, age=0
  let t = 10;
  for (let step = 0; step < 10; step++) {
    t += 0.5;
    updateSunWind(pool, t, 0.5, 60);
    const active = activeIndices(pool);
    assert.ok(active.length <= 150, `krok ${step}: aktivních ${active.length} > cap 150`);
  }
});

test('updateSunWind: částice starší ~2.5s se recyklují do IDLE', () => {
  const pool = makeFakePool();
  resetSunWind(pool);

  updateSunWind(pool, 10, 1.0, 60);
  const batch1 = activeIndices(pool);
  assert.ok(batch1.length > 0);

  // t=13 → age batch1 = 3s (> 2.5s lifetime). dt zanedbatelné → žádná nová emise
  // (carry přírůstek 0.0001*40 << 1), takže žádná záměna indexů reuse emisí.
  updateSunWind(pool, 13.0, 0.0001, 60);

  for (const i of batch1) {
    assert.equal(pool.phase[i], PHASE.IDLE, `částice ${i} nebyla recyklována do IDLE`);
    assert.equal(pool.alpha[i], 0, `částice ${i} má nenulovou alpha po recyklaci`);
    assert.equal(pool.owner[i], -1);
  }
});

test('updateSunWind: alpha lineárně klesá s věkem částice (fade 0.9 → 0)', () => {
  const pool = makeFakePool();
  resetSunWind(pool);

  // dt = 1/40 → carry přesně 1.0 → spawn přesně 1 částice.
  updateSunWind(pool, 0, 1 / 40, 60);
  let active = activeIndices(pool);
  assert.equal(active.length, 1);
  const idx = active[0];
  const alphaAtBirth = pool.alpha[idx];
  assert.ok(Math.abs(alphaAtBirth - 0.9) < 1e-6, `alpha při zrodu = ${alphaAtBirth}, čekáno 0.9`);

  // Posun o 1s (tiny dt → žádná nová emise), age=1.0 → alpha = 0.9*(1-1/2.5) = 0.54.
  updateSunWind(pool, 1.0, 1e-6, 60);
  const alphaLater = pool.alpha[idx];
  assert.ok(alphaLater < alphaAtBirth, `alpha nekleslo: ${alphaAtBirth} → ${alphaLater}`);
  assert.ok(Math.abs(alphaLater - 0.54) < 1e-3, `alpha po 1s = ${alphaLater}, čekáno ≈0.54`);
});

test('resetSunWind: uvolní všechny aktivní částice do IDLE', () => {
  const pool = makeFakePool();
  resetSunWind(pool);
  updateSunWind(pool, 10, 1.0, 60);
  assert.ok(activeIndices(pool).length > 0);

  resetSunWind(pool);
  assert.equal(activeIndices(pool).length, 0);
  for (let i = 0; i < pool.count; i++) {
    assert.equal(pool.phase[i], PHASE.IDLE);
  }
});
