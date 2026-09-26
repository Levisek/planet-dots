import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraDistanceFor } from './cameraDistance.js';

test('měsíc/asteroid — max(r*6, r+2)', () => {
  // io: radiusPx 2.3 → r*6=13.8, r+2=4.3 → max=13.8
  const d = cameraDistanceFor('io', false, () => 2.3);
  assert.equal(d, Math.max(2.3 * 6, 2.3 + 2));
});

test('planeta bez regulárních měsíců → r*4.5', () => {
  // Merkur nemá měsíce
  const d = cameraDistanceFor('mercury', false, (id) => (id === 'mercury' ? 50 : 1));
  assert.equal(d, 50 * 4.5);
});

test('Jupiter — cap na radiusPx*40 a výsledek ≥ baseDist (fyzikální módu měsíce daleko)', () => {
  const getR = (id) => (id === 'jupiter' ? 90 : 3);
  const d = cameraDistanceFor('jupiter', true, getR);
  assert.equal(d, 90 * 40);
  assert.ok(d >= 90 * 4.5);
});
