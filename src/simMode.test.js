import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setMode, getInclination, getEccentricity, MODES, getTimeScale, setTimeScale, onTimeScaleChange, _resetTimeScaleOverride, isRetrograde, toDisplay } from './simMode.js';

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

test('getEccentricity — Fyzikální vrátí eReal', () => {
  setMode(MODES.FYZIKALNI);
  assert.equal(getEccentricity({ e: 0.05, eReal: 0.21 }), 0.21);
});

test('getEccentricity — Pochopení vrátí e (clamped)', () => {
  setMode(MODES.POCHOPENI);
  assert.equal(getEccentricity({ e: 0.08, eReal: 0.21 }), 0.08);
  assert.equal(getEccentricity({ e: 0.02, eReal: 0.05 }), 0.02);
});

test('getEccentricity — chybí eReal vrátí e', () => {
  setMode(MODES.FYZIKALNI);
  assert.equal(getEccentricity({ e: 0.04 }), 0.04);
});

test('getTimeScale — default 0.5 v Pochopení', () => {
  setMode(MODES.POCHOPENI);
  setTimeScale(0.5); // explicit reset
  assert.equal(getTimeScale(), 0.5);
  _resetTimeScaleOverride(); // cleanup for test isolation
});

test('setTimeScale — listener fires on change', () => {
  let received = null;
  const unsub = onTimeScaleChange((v) => { received = v; });
  setTimeScale(2.0);
  assert.equal(received, 2.0);
  unsub();
  _resetTimeScaleOverride(); // cleanup for test isolation
});

test('setTimeScale — žádný fire pokud stejná hodnota', () => {
  setTimeScale(1.5);
  let count = 0;
  const unsub = onTimeScaleChange(() => { count++; });
  setTimeScale(1.5);
  assert.equal(count, 0);
  unsub();
  _resetTimeScaleOverride(); // cleanup for test isolation
});

test('isRetrograde — true pokud inclinationDeg > 90', () => {
  assert.equal(isRetrograde({ inclinationDeg: 157 }), true);
  assert.equal(isRetrograde({ inclinationDeg: 91 }), true);
  assert.equal(isRetrograde({ inclinationDeg: 90 }), false);
  assert.equal(isRetrograde({ inclinationDeg: 5 }), false);
  assert.equal(isRetrograde({ inclinationDeg: 0 }), false);
  assert.equal(isRetrograde({}), false);
});

test('Fyzikální: lineární měřítko AU', () => {
  setMode(MODES.FYZIKALNI);
  const p = toDisplay({ x: 1, y: 0, z: 0 }, 'earth');
  assert.ok(Math.abs(p.x - 3846) < 1); // AU × 3846
});

test('Pochopení: zachová směr, komprimuje poloměr', () => {
  setMode(MODES.POCHOPENI);
  const inAU = { x: 0, y: 0, z: 5.2 }; // Jupiter ~5.2 AU směr +z
  const p = toDisplay(inAU, 'jupiter');
  // směr zachován (jen +z složka)
  assert.ok(Math.abs(p.x) < 1e-6 && Math.abs(p.y) < 1e-6 && p.z > 0);
  // poloměr komprimován (menší než lineární 5.2×3846)
  assert.ok(Math.hypot(p.x, p.y, p.z) < 5.2 * 3846);
});

test('Pochopení zachová sklon (nenulové y zůstane nenulové)', () => {
  setMode(MODES.POCHOPENI);
  const p = toDisplay({ x: 1, y: 0.1, z: 0 }, 'mercury');
  assert.ok(p.y > 0);
});
