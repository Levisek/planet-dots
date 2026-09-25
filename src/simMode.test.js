import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setMode, MODES, toDisplay } from './simMode.js';

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
