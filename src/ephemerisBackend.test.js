import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ephemHelio, ephemMoonRelative } from './ephemerisBackend.js';

const D = new Date('2000-01-01T12:00:00Z');

test('Země helio ~1 AU, blízko ekliptiky (malé |y|)', () => {
  const p = ephemHelio('earth', D);
  assert.ok(Math.abs(Math.hypot(p.x, p.y, p.z) - 1) < 0.02);
  assert.ok(Math.abs(p.y) < 0.001); // Země definuje ekliptiku → y≈0
});

test('Slunce helio = počátek', () => {
  const p = ephemHelio('sun', D);
  assert.ok(Math.hypot(p.x, p.y, p.z) < 1e-9);
});

test('Io vůči Jupiteru: vzdálenost ~0.0028 AU (421700 km)', () => {
  const p = ephemMoonRelative('io', D);
  const r = Math.hypot(p.x, p.y, p.z);
  assert.ok(r > 0.002 && r < 0.004, `r=${r}`);
});
