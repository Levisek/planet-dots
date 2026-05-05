import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setMode, getInclination, MODES } from './simMode.js';

test('getInclination — Fyzikální vrátí real', () => {
  setMode(MODES.FYZIKALNI);
  assert.equal(getInclination({ inclinationDeg: 157, category: 'irregular' }), 157);
  assert.equal(getInclination({ inclinationDeg: 35, category: 'irregular' }), 35);
});

test('getInclination — Pochopení clamp per category', () => {
  setMode(MODES.POCHOPENI);
  assert.equal(getInclination({ inclinationDeg: 7, category: 'planet' }), 5);
  assert.equal(getInclination({ inclinationDeg: 3, category: 'planet' }), 3);
  assert.equal(getInclination({ inclinationDeg: 15, category: 'moon' }), 15);
  assert.equal(getInclination({ inclinationDeg: 30, category: 'irregular' }), 30);
  assert.equal(getInclination({ inclinationDeg: 35, category: 'irregular' }), 30);
});

test('getInclination — suplementární clamp pro high-inc', () => {
  setMode(MODES.POCHOPENI);
  // Triton 157° (effective 23 < 30) → no clamp, vrátí 157
  assert.equal(getInclination({ inclinationDeg: 157, category: 'irregular' }), 157);
  // Phoebe 175.3° (effective 4.7 < 30) → no clamp, vrátí 175.3
  assert.ok(Math.abs(getInclination({ inclinationDeg: 175.3, category: 'irregular' }) - 175.3) < 0.001);
  // Hypotetický 110° (effective 70 > 30) → clamp na 30, vrátí 150
  assert.equal(getInclination({ inclinationDeg: 110, category: 'irregular' }), 150);
});
