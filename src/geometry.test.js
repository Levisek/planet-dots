import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fibonacciSphere, ringPoints } from './geometry.js';

test('fibonacciSphere vrací správný počet bodů', () => {
  const pts = fibonacciSphere(100, 10);
  assert.equal(pts.length, 100);
});

test('fibonacciSphere body leží na povrchu koule o zadaném poloměru', () => {
  const r = 12;
  for (const [x, y, z] of fibonacciSphere(50, r)) {
    const d = Math.sqrt(x*x + y*y + z*z);
    assert.ok(Math.abs(d - r) < 1e-6, `bod ve vzdálenosti ${d}, očekáváno ${r}`);
  }
});

test('ringPoints vrací počet bodů rovnoměrně mezi inner a outer', () => {
  const pts = ringPoints(200, 10, 20);
  assert.equal(pts.length, 200);
  for (const [x, y, z] of pts) {
    const r = Math.sqrt(x*x + y*y);
    assert.ok(r >= 10 && r <= 20, `bod na poloměru ${r}`);
    assert.equal(z, 0);
  }
});
