import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANETS, PLANET_BY_ID } from './planets.js';

test('PLANETS má přesně 9 těles (Slunce + 8 planet)', () => {
  assert.equal(PLANETS.length, 9);
});

test('PLANETS obsahují všechna očekávaná tělesa v pořadí od Slunce', () => {
  const ids = PLANETS.map(p => p.id);
  assert.deepEqual(ids, ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
});

test('každá planeta má povinné atributy', () => {
  const required = ['id', 'name', 'realDiameterKm', 'radiusPx', 'texture', 'tickCount', 'axialTilt', 'rotationPeriod', 'direction', 'xPosition', 'color'];
  for (const p of PLANETS) {
    for (const key of required) {
      assert.ok(key in p, `${p.id} postrádá atribut ${key}`);
    }
  }
});

test('součet tickCount planet + prstence se vejde do POOL_SIZE s rezervou', () => {
  const sum = PLANETS.reduce((s, p) => s + p.tickCount + (p.ringTickCount || 0), 0);
  assert.ok(sum <= 400000, `součet ticks = ${sum}, musí ≤ 400000 (pool 600000 – moons + in-flight rezerva)`);
  assert.ok(sum >= 20000, `součet ticks = ${sum}, musí ≥ 20000 pro hustotu`);
});

test('proporce radiusPx vůči Jupiteru = 180 px referenční', () => {
  const jupiter = PLANET_BY_ID.jupiter;
  assert.equal(jupiter.radiusPx * 2, 180, 'Jupiter musí mít 180 px průměr');
});

test('Venuše má axialTilt > 90 (retrográdně)', () => {
  assert.ok(PLANET_BY_ID.venus.axialTilt > 90);
});

test('Uran má axialTilt ≈ 97 (leží na boku)', () => {
  const tilt = PLANET_BY_ID.uranus.axialTilt;
  assert.ok(tilt > 90 && tilt < 110, `Uran tilt = ${tilt}`);
});

test('Jupiter má nejkratší rotationPeriod mezi plynnými obry', () => {
  const gas = ['jupiter', 'saturn', 'uranus', 'neptune'];
  const periods = gas.map(id => ({ id, p: PLANET_BY_ID[id].rotationPeriod }));
  periods.sort((a, b) => a.p - b.p);
  assert.equal(periods[0].id, 'jupiter');
});

test('PLANET_BY_ID obsahuje všechny ids', () => {
  for (const p of PLANETS) {
    assert.equal(PLANET_BY_ID[p.id], p);
  }
});
