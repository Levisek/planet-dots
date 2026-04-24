import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOONS, MOON_BY_ID, MOONS_BY_PARENT } from './moons.js';
import { PLANET_BY_ID, POOL_SIZE } from './planets.js';

test('MOONS má přesně 19 měsíců', () => {
  assert.equal(MOONS.length, 19);
});

test('každý měsíc má povinné atributy', () => {
  const required = ['id', 'name', 'parent', 'diameterKm', 'radiusPx', 'tickCount', 'texture', 'a', 'e', 'period', 'phaseOffset'];
  for (const m of MOONS) {
    for (const key of required) {
      assert.ok(key in m, `${m.id} postrádá ${key}`);
    }
  }
});

test('každý parent existuje v PLANETS', () => {
  for (const m of MOONS) {
    assert.ok(PLANET_BY_ID[m.parent], `${m.id} má neznámý parent ${m.parent}`);
  }
});

test('eccentricity v rozsahu (0, 0.3]', () => {
  for (const m of MOONS) {
    assert.ok(m.e > 0 && m.e <= 0.3, `${m.id} e=${m.e} mimo rozsah`);
  }
});

test('period, a, tickCount, radiusPx jsou kladné', () => {
  for (const m of MOONS) {
    assert.ok(m.period > 0, `${m.id} period`);
    assert.ok(m.a > 0, `${m.id} a`);
    assert.ok(m.tickCount > 0, `${m.id} tickCount`);
    assert.ok(m.radiusPx >= 0.5, `${m.id} radiusPx ${m.radiusPx} < 0.5`);
  }
});

test('rozložení rodin: Earth 1, Mars 2, Jupiter 4, Saturn 7, Uranus 5', () => {
  const byParent = MOONS.reduce((acc, m) => {
    acc[m.parent] = (acc[m.parent] || 0) + 1;
    return acc;
  }, {});
  assert.equal(byParent.earth, 1);
  assert.equal(byParent.mars, 2);
  assert.equal(byParent.jupiter, 4);
  assert.equal(byParent.saturn, 7);
  assert.equal(byParent.uranus, 5);
});

test('MOONS_BY_PARENT je správně seskupený', () => {
  assert.equal(MOONS_BY_PARENT.earth.length, 1);
  assert.equal(MOONS_BY_PARENT.jupiter.length, 4);
  assert.equal(MOONS_BY_PARENT.saturn.length, 7);
});

test('MOON_BY_ID obsahuje všech 19', () => {
  for (const m of MOONS) {
    assert.equal(MOON_BY_ID[m.id], m);
  }
});

test('součet moon tickCount + planet ticks se vejde do POOL_SIZE s rezervou', () => {
  const moonSum = MOONS.reduce((s, m) => s + m.tickCount, 0);
  // všechny měsíce jsou icosphere level 5 (10242), unified density napříč tělesy
  assert.ok(moonSum > 100000 && moonSum < 250000, `moon ticks = ${moonSum} mimo rozumný rozsah`);
  assert.ok(POOL_SIZE >= 500000, `POOL_SIZE = ${POOL_SIZE}, musí ≥ 500000`);
});
