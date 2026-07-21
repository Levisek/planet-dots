import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Astronomy from '../vendor/astronomy/astronomy.js';

test('astronomy-engine exportuje očekávané API', () => {
  assert.equal(typeof Astronomy.HelioVector, 'function');
  assert.equal(typeof Astronomy.Ecliptic, 'function');
  assert.equal(typeof Astronomy.GeoVector, 'function');
  assert.equal(typeof Astronomy.JupiterMoons, 'function');
  assert.ok(Astronomy.Body && Astronomy.Body.Earth !== undefined);
});

test('Země helio vektor má délku ~1 AU', () => {
  const t = Astronomy.MakeTime(new Date('2000-01-01T12:00:00Z'));
  const v = Astronomy.HelioVector(Astronomy.Body.Earth, t);
  const r = Math.hypot(v.x, v.y, v.z);
  assert.ok(r > 0.98 && r < 1.02, `r=${r}`);
});

test('JupiterMoons vrací 4 měsíce jako stavové vektory', () => {
  const t = Astronomy.MakeTime(new Date('2000-01-01T12:00:00Z'));
  const m = Astronomy.JupiterMoons(t);
  for (const k of ['io', 'europa', 'ganymede', 'callisto']) {
    assert.ok(m[k] && typeof m[k].x === 'number', `${k} chybí`);
  }
});
