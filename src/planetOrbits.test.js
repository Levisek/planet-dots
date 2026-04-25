import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auToDisplayRadius, orbitalPosition } from './planetOrbits.js';

test('auToDisplayRadius: Mercury (0.39 AU) → ~1318', () => {
  const r = auToDisplayRadius(0.39);
  assert.ok(Math.abs(r - 1318) < 5, `r=${r}`);
});

test('auToDisplayRadius: Earth (1.0) → 1450', () => {
  assert.equal(auToDisplayRadius(1.0), 1450);
});

test('auToDisplayRadius: Neptune (30.05) → ~3018', () => {
  const r = auToDisplayRadius(30.05);
  assert.ok(Math.abs(r - 3018) < 5);
});

test('orbitalPosition: t=0 + initialPhase=0 → x=r, z=0', () => {
  const planet = { orbitRadius: 1300, orbitalPeriodSec: 10, initialPhaseRad: 0 };
  const p = orbitalPosition(planet, 0);
  assert.ok(Math.abs(p.x - 1300) < 1e-6);
  assert.equal(p.y, 0);
  assert.ok(Math.abs(p.z) < 1e-6);
});

test('orbitalPosition: půl periody → x=-r', () => {
  const planet = { orbitRadius: 1000, orbitalPeriodSec: 10, initialPhaseRad: 0 };
  const p = orbitalPosition(planet, 5);
  assert.ok(Math.abs(p.x - (-1000)) < 1e-6);
});

test('orbitalPosition: čtvrt periody → z=r (CCW orbit)', () => {
  const planet = { orbitRadius: 1000, orbitalPeriodSec: 10, initialPhaseRad: 0 };
  const p = orbitalPosition(planet, 2.5);
  assert.ok(Math.abs(p.x) < 1e-6);
  assert.ok(Math.abs(p.z - 1000) < 1e-6);
});

test('orbitalPosition: Sun (orbitRadius=0) → vždy origin', () => {
  const sun = { orbitRadius: 0, orbitalPeriodSec: 1, initialPhaseRad: 1.5 };
  const p = orbitalPosition(sun, 100);
  assert.equal(p.x, 0);
  assert.equal(p.z, 0);
});
