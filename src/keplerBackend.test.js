import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keplerHelio } from './keplerBackend.js';

const J2000 = new Date('2000-01-01T12:00:00Z');

test('kruhová orbita a=2 AU: |pos| ≈ 2 AU v každém čase', () => {
  const el = { aAU: 2, e: 0, incDeg: 0, OmegaDeg: 0, omegaDeg: 0, M0Deg: 0, periodDays: 1000 };
  for (const days of [0, 250, 500, 750]) {
    const d = new Date(J2000.getTime() + days * 86400000);
    const p = keplerHelio(el, d);
    assert.ok(Math.abs(Math.hypot(p.x, p.y, p.z) - 2) < 1e-6, `days=${days}`);
  }
});

test('M0=0 v epoše → periapsis (blíž fokusu pro e>0)', () => {
  const el = { aAU: 2, e: 0.3, incDeg: 0, OmegaDeg: 0, omegaDeg: 0, M0Deg: 0, periodDays: 1000 };
  const p = keplerHelio(el, J2000);
  assert.ok(Math.abs(Math.hypot(p.x, p.y, p.z) - 2 * (1 - 0.3)) < 1e-6);
});

test('inc=90° → pohyb má nenulovou složku Y (mimo ekliptiku)', () => {
  const el = { aAU: 2, e: 0, incDeg: 90, OmegaDeg: 0, omegaDeg: 0, M0Deg: 90, periodDays: 1000 };
  const p = keplerHelio(el, J2000);
  assert.ok(Math.abs(p.y) > 0.5);
});
