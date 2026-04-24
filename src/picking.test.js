import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rayHitsSphere } from './pickingMath.js';

test('rayHitsSphere: přímý zásah', () => {
  const hit = rayHitsSphere(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: 10 },
    2,
  );
  assert.ok(hit > 0);
});

test('rayHitsSphere: žádný zásah (paprsek míjí)', () => {
  const hit = rayHitsSphere(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 10, y: 0, z: 10 },
    2,
  );
  assert.equal(hit, null);
});

test('rayHitsSphere: sféra za ray (negativní t) = null', () => {
  const hit = rayHitsSphere(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -10 },
    2,
  );
  assert.equal(hit, null);
});

test('rayHitsSphere: edge case — ray právě tečný', () => {
  const hit = rayHitsSphere(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 2, y: 0, z: 10 },
    2,
  );
  assert.ok(hit !== null, 'tečný ray by měl hit (nebo velmi blízko)');
});
