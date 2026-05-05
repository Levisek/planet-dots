import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASTEROIDS, ASTEROID_BELT } from './asteroids.js';

test('ASTEROIDS obsahuje Ceres/Vesta/Pallas', () => {
  const ids = ASTEROIDS.map(a => a.id);
  assert.deepEqual(ids.sort(), ['ceres', 'pallas', 'vesta']);
});

test('Ceres má category dwarf', () => {
  const ceres = ASTEROIDS.find(a => a.id === 'ceres');
  assert.equal(ceres.category, 'dwarf');
});

test('Pallas má category irregular (35° inc)', () => {
  const pallas = ASTEROIDS.find(a => a.id === 'pallas');
  assert.equal(pallas.category, 'irregular');
  assert.ok(pallas.inclinationDeg > 30);
});

test('ASTEROID_BELT config sanity', () => {
  assert.equal(ASTEROID_BELT.count, 300);
  assert.ok(ASTEROID_BELT.innerAU < ASTEROID_BELT.peakAU);
  assert.ok(ASTEROID_BELT.peakAU < ASTEROID_BELT.outerAU);
});
