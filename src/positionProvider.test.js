import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getHelioPosition, getRelativePosition, sourceOf } from './positionProvider.js';

const D = new Date('2010-05-05T00:00:00Z');

test('planety jsou ephemeris, asteroidy kepler', () => {
  assert.equal(sourceOf('earth'), 'ephemeris');
  assert.equal(sourceOf('jupiter'), 'ephemeris');
  assert.equal(sourceOf('ceres'), 'kepler');
  assert.equal(sourceOf('io'), 'ephemeris');
  assert.equal(sourceOf('titan'), 'kepler');
});

test('getHelioPosition earth ~1 AU', () => {
  const p = getHelioPosition('earth', D);
  assert.ok(Math.abs(Math.hypot(p.x, p.y, p.z) - 1) < 0.02);
});

test('getRelativePosition titan vrací nenulovou pozici', () => {
  const p = getRelativePosition('titan', D);
  assert.ok(Math.hypot(p.x, p.y, p.z) > 0);
  // Titan aAU ≈ 0.00817; pozice vůči Saturnu musí být v tomto řádu.
  const r = Math.hypot(p.x, p.y, p.z);
  assert.ok(r > 0.007 && r < 0.009, `titan r=${r} mimo očekávaný rozsah`);
});
