import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveKepler, orbitPosition, trueAnomaly } from './orbit.js';

test('solveKepler(0, e) = 0', () => {
  for (const e of [0, 0.1, 0.3]) {
    assert.ok(Math.abs(solveKepler(0, e)) < 1e-9, `e=${e}`);
  }
});

test('solveKepler(M, 0) = M (zero eccentricity)', () => {
  for (const M of [0.1, 1.5, Math.PI, 2 * Math.PI]) {
    assert.ok(Math.abs(solveKepler(M, 0) - M) < 1e-9, `M=${M}`);
  }
});

test('Kepler identity: E - e·sin(E) ≈ M after 5 iterations', () => {
  for (const M of [0.1, 0.5, 1.0, 2.0, 3.0]) {
    for (const e of [0.01, 0.1, 0.2, 0.3]) {
      const E = solveKepler(M, e);
      const residual = E - e * Math.sin(E) - M;
      assert.ok(Math.abs(residual) < 1e-6, `M=${M}, e=${e}, resid=${residual}`);
    }
  }
});

test('orbitPosition at t=0 with phaseOffset=0 is periapsis', () => {
  const { x, z } = orbitPosition(0, 0, 10, 100, 0.2);
  // periapsis: E=0 → x = a(1-e), z = 0
  assert.ok(Math.abs(x - 100 * (1 - 0.2)) < 1e-6);
  assert.ok(Math.abs(z) < 1e-6);
});

test('orbitPosition half-period is apoapsis', () => {
  const { x, z } = orbitPosition(5, 0, 10, 100, 0.2);
  // apoapsis: E=π → x = a(-1-e), z ≈ 0
  assert.ok(Math.abs(x - 100 * (-1 - 0.2)) < 1e-5);
  assert.ok(Math.abs(z) < 1e-5);
});

test('trueAnomaly(0, e) = 0', () => {
  for (const e of [0, 0.1, 0.3]) {
    assert.ok(Math.abs(trueAnomaly(0, e)) < 1e-9);
  }
});

test('trueAnomaly(π, e) = π', () => {
  for (const e of [0.01, 0.1, 0.3]) {
    assert.ok(Math.abs(trueAnomaly(Math.PI, e) - Math.PI) < 1e-6);
  }
});

test('orbitPosition returns E for downstream use', () => {
  const { E } = orbitPosition(2.5, 0, 10, 100, 0.1);
  assert.ok(typeof E === 'number' && E > 0 && E < Math.PI);
});
