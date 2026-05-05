import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleKeplerCurve } from './moonOrbitLines.js';

test('sampleKeplerCurve vrátí 64 bodů', () => {
  const points = sampleKeplerCurve(64, 100, 0.1, 0);
  assert.equal(points.length, 64);
});

test('sampleKeplerCurve closed loop (first ≈ last)', () => {
  const points = sampleKeplerCurve(64, 100, 0.1, 0);
  // First a last by měl být blízko (closed elipsa)
  const dx = points[0].x - points[63].x;
  const dz = points[0].z - points[63].z;
  // 1/64 cyklu rozdíl, ne identický, ale blízko
  assert.ok(Math.sqrt(dx*dx + dz*dz) < 30);
});

test('sampleKeplerCurve s inc=15° vrátí Y≠0', () => {
  const points = sampleKeplerCurve(32, 100, 0.0, 15);
  let hasNonZeroY = false;
  for (const p of points) {
    if (Math.abs(p.y) > 0.1) { hasNonZeroY = true; break; }
  }
  assert.ok(hasNonZeroY);
});
