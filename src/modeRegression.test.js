import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setMode, MODES, getEccentricity, getInclination, getMoonPeriod, _resetTimeScaleOverride } from './simMode.js';
import { PLANETS } from './planets.js';
import { MOONS } from './moons.js';
import { ASTEROIDS } from './asteroids.js';
import { orbitalPosition } from './planetOrbits.js';

test('5× mode switch — žádný NaN, positions actually change', () => {
  _resetTimeScaleOverride();
  const samples = [];
  for (let i = 0; i < 5; i++) {
    const mode = i % 2 === 0 ? MODES.POCHOPENI : MODES.FYZIKALNI;
    setMode(mode);
    const earth = PLANETS.find(p => p.id === 'earth');
    const pos = orbitalPosition(earth, 5);
    samples.push({ mode, pos });
    assert.ok(!isNaN(pos.x));
    assert.ok(!isNaN(pos.y));
    assert.ok(!isNaN(pos.z));
  }
  // Mode 0 (Pochopení) ≠ Mode 1 (Fyzikální) positions
  assert.notEqual(samples[0].pos.x, samples[1].pos.x);
});

test('Triton inc=157° v obou módech (suplementární clamp)', () => {
  const triton = MOONS.find(m => m.id === 'triton');
  setMode(MODES.POCHOPENI);
  const pochInc = getInclination(triton);
  setMode(MODES.FYZIKALNI);
  const fyzInc = getInclination(triton);
  assert.equal(pochInc, 157.0);
  assert.equal(fyzInc, 157.0);
});

test('Pallas inc=30 v Pochopení, 34.84 v Fyzikální', () => {
  const pallas = ASTEROIDS.find(a => a.id === 'pallas');
  setMode(MODES.POCHOPENI);
  assert.equal(getInclination(pallas), 30);
  setMode(MODES.FYZIKALNI);
  assert.ok(Math.abs(getInclination(pallas) - 34.84) < 0.001);
});

test('Mercury e=0.08 v Pochopení, 0.2056 v Fyzikální', () => {
  const mercury = PLANETS.find(p => p.id === 'mercury');
  setMode(MODES.POCHOPENI);
  assert.equal(getEccentricity(mercury), 0.08);
  setMode(MODES.FYZIKALNI);
  assert.equal(getEccentricity(mercury), 0.2056);
});

test('všechny moony mají schema validní v obou módech', () => {
  for (const mode of [MODES.POCHOPENI, MODES.FYZIKALNI]) {
    setMode(mode);
    for (const m of MOONS) {
      const e = getEccentricity(m);
      const inc = getInclination(m);
      const period = getMoonPeriod(m);
      assert.ok(!isNaN(e) && e >= 0 && e < 1, `${m.id} e=${e} invalid`);
      assert.ok(!isNaN(inc) && inc >= 0 && inc < 180, `${m.id} inc=${inc} invalid`);
      assert.ok(!isNaN(period) && period > 0, `${m.id} period=${period} invalid`);
    }
  }
});
