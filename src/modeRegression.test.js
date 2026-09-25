import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setMode, MODES } from './simMode.js';
import { PLANETS } from './planets.js';
import { orbitalPosition } from './planetOrbits.js';

test('5× mode switch — žádný NaN, positions actually change', () => {
  const D = new Date('2015-07-14T00:00:00Z');
  const samples = [];
  for (let i = 0; i < 5; i++) {
    const mode = i % 2 === 0 ? MODES.POCHOPENI : MODES.FYZIKALNI;
    setMode(mode);
    const earth = PLANETS.find(p => p.id === 'earth');
    const pos = orbitalPosition(earth, D);
    samples.push({ mode, pos });
    assert.ok(!isNaN(pos.x));
    assert.ok(!isNaN(pos.y));
    assert.ok(!isNaN(pos.z));
  }
  // Mode 0 (Pochopení) ≠ Mode 1 (Fyzikální) positions
  assert.notEqual(samples[0].pos.x, samples[1].pos.x);
});

test('5× přepnutí módu: žádné NaN, Pochopení < Fyzikální poloměr (Saturn)', () => {
  const D = new Date('2015-07-14T00:00:00Z');
  const saturn = PLANETS.find(p => p.id === 'saturn');
  for (let i = 0; i < 5; i++) {
    setMode(MODES.FYZIKALNI);
    const f = orbitalPosition(saturn, D);
    setMode(MODES.POCHOPENI);
    const p = orbitalPosition(saturn, D);
    assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.z));
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
    assert.ok(Math.hypot(p.x, p.y, p.z) < Math.hypot(f.x, f.y, f.z));
  }
});
