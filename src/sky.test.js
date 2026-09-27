import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bvToKelvin, kelvinToRgb, starColor, starStyle, decodeStars, decodeMilkyWay } from './sky.js';
import { STAR_COUNT, MILKY_WAY_COUNT } from './skyData.js';
import { poleToScene } from './coordinateFrame.js';

test('bvToKelvin: Slunce (B–V 0,65) ~5 800 K, Vega (0) ~10 000 K, Betelgeuse (1,85) ~3 500 K', () => {
  assert.ok(Math.abs(bvToKelvin(0.65) - 5800) < 300);
  assert.ok(Math.abs(bvToKelvin(0) - 10000) < 800);
  assert.ok(Math.abs(bvToKelvin(1.85) - 3500) < 400);
});

test('kelvinToRgb: horká hvězda modrá, chladná červená, hodnoty 0..1', () => {
  const hot = kelvinToRgb(20000), cool = kelvinToRgb(3200);
  assert.ok(hot[2] > hot[0], 'horká: víc modré');
  assert.ok(cool[0] > cool[2], 'chladná: víc červené');
  for (const c of [...hot, ...cool, ...kelvinToRgb(1000), ...kelvinToRgb(40000)]) assert.ok(c >= 0 && c <= 1);
});

test('starColor zůstává světlá (zjemněná k bílé)', () => {
  for (const bv of [-0.3, 0, 0.65, 1.5, 2]) assert.ok(Math.min(...starColor(bv)) >= 0.45);
});

test('starStyle: jasnější = větší a jasnější, meze drží', () => {
  const sirius = starStyle(-1.46), faint = starStyle(6), dim = starStyle(8);
  assert.ok(sirius.size > 3.5 && sirius.size <= 4);
  assert.equal(faint.size, 1);
  assert.deepEqual(dim, faint);
  assert.ok(sirius.alpha > faint.alpha);
});

test('decodeStars: katalog sedí — počet, rozsahy, nejjasnější je Sirius na správném místě', () => {
  const stars = decodeStars();
  assert.equal(stars.length, STAR_COUNT);
  assert.ok(STAR_COUNT > 5000);
  for (const s of stars) {
    assert.ok(s.ra >= 0 && s.ra <= 360 && s.dec >= -90 && s.dec <= 90);
    assert.ok(s.mag <= 6.5);
  }
  // Sirius: RA 101,29°, Dec −16,72°, V −1,46
  const sirius = stars[0];
  assert.ok(Math.abs(sirius.ra - 101.29) < 0.05 && Math.abs(sirius.dec + 16.72) < 0.05, `${sirius.ra} ${sirius.dec}`);
  assert.ok(sirius.mag < -1.4);
});

test('decodeMilkyWay: jádro (úroveň 4) leží u středu Galaxie ve Střelci', () => {
  const mw = decodeMilkyWay();
  assert.equal(mw.length, MILKY_WAY_COUNT);
  const core = mw.filter((p) => p.level === 4);
  assert.ok(core.length > 500);
  // Střed Galaxie: RA 266,4°, Dec −28,9°. Většina jádra do 40°.
  const gc = poleToScene(266.4, -28.9);
  const near = core.filter((p) => {
    const d = poleToScene(p.ra, p.dec);
    return d.x * gc.x + d.y * gc.y + d.z * gc.z > Math.cos((40 * Math.PI) / 180);
  });
  assert.ok(near.length / core.length > 0.6, `jen ${near.length}/${core.length} u středu Galaxie`);
});
