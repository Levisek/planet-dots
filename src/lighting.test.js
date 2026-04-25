import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSunUniform, computeSunDirection } from './lighting.js';

test('computeSunDirection vrátí jednotkový vektor od bodu ke středu Slunce', () => {
  // Sun at (-1500, 0, 0), point at origin
  const dir = computeSunDirection({ x: 0, y: 0, z: 0 }, { x: -1500, y: 0, z: 0 });
  assert.ok(Math.abs(dir.x - (-1)) < 1e-6);
  assert.ok(Math.abs(dir.y) < 1e-6);
  assert.ok(Math.abs(dir.z) < 1e-6);
});

test('computeSunDirection — point za Sluncem', () => {
  // Sun at (-1500, 0, 0), point at (-3000, 0, 0) → dir points +X (away from sun to point, flipped)
  const dir = computeSunDirection({ x: -3000, y: 0, z: 0 }, { x: -1500, y: 0, z: 0 });
  assert.ok(Math.abs(dir.x - 1) < 1e-6);
});

test('createSunUniform vytvoří uniform objekt s value = THREE.Vector3 typ', () => {
  const u = createSunUniform({ x: -1500, y: 0, z: 0 });
  assert.equal(typeof u.value, 'object');
  assert.equal(u.value.x, -1500);
  assert.equal(u.value.y, 0);
  assert.equal(u.value.z, 0);
});
