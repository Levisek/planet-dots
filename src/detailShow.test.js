import { test } from 'node:test';
import assert from 'node:assert/strict';
import { showViews, createDetailShow, SHOW_HOLD_SEC } from './detailShow.js';

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);

test('showViews: jednotkové směry, „nad pólem" je nad pólem, srpek proti Slunci', () => {
  const bodyPos = { x: 1450, y: 0, z: 0 }; // Slunce je v -x
  const pole = { x: 0, y: 0.92, z: 0.39 };
  const v = showViews({ bodyPos, radius: 8, dist: 50, pole });
  assert.equal(v.length, 3);
  for (const w of v) assert.ok(Math.abs(len(w.dir) - 1) < 1e-9, w.label);
  const toSun = { x: -1, y: 0, z: 0 };
  assert.ok(dot(v[0].dir, toSun) > 0.5, 'denní strana míří ke Slunci');
  assert.ok(dot(v[1].dir, pole) > 0.7, 'nad pólem');
  assert.ok(dot(v[2].dir, toSun) < -0.4, 'proti Slunci');
});

test('showViews: prstenec — záběr skoro v rovině rovníku, blízko planety', () => {
  const pole = { x: 0, y: 1, z: 0 };
  const v = showViews({ bodyPos: { x: 0, y: 0, z: -2182 }, radius: 60, dist: 874, pole, ringed: true });
  const ring = v.find((w) => w.label === 'rovina prstence');
  assert.ok(ring);
  assert.ok(Math.abs(dot(ring.dir, pole)) < 0.05, 'jen kousek nad rovinou');
  assert.ok(ring.dist < 874 && ring.dist >= 330);
});

test('showViews: Slunce v počátku nedá NaN', () => {
  const v = showViews({ bodyPos: { x: 0, y: 0, z: 0 }, radius: 400, dist: 1800 });
  for (const w of v) for (const k of ['x', 'y', 'z']) assert.ok(Number.isFinite(w.dir[k]));
});

function makeShow() {
  const log = [];
  let flying = false;
  const show = createDetailShow({
    flyToView: (v) => log.push(['fly', v.label]),
    setAutoRotate: (on) => log.push(['rotate', on]),
    getViews: () => [{ label: 'a' }, { label: 'b' }, { label: 'c' }],
    isFlying: () => flying,
  });
  return { show, log, setFlying: (f) => { flying = f; } };
}

test('show: po příletu krouží, po HOLD přejede na další úhel a cyklí dokola', () => {
  const { show, log } = makeShow();
  show.start('earth');
  assert.deepEqual(log, [['rotate', true]]);
  show.tick(SHOW_HOLD_SEC - 0.1);
  assert.equal(log.length, 1, 'ještě drží');
  show.tick(0.2);
  assert.deepEqual(log.at(-1), ['fly', 'b']);
  show.tick(SHOW_HOLD_SEC);
  assert.deepEqual(log.at(-1), ['fly', 'c']);
  show.tick(SHOW_HOLD_SEC);
  assert.deepEqual(log.at(-1), ['fly', 'a']);
});

test('show: během letu čas neběží, stop vypne kroužení a další tick nic nedělá', () => {
  const { show, log, setFlying } = makeShow();
  show.start('mars');
  setFlying(true);
  show.tick(100);
  assert.equal(log.length, 1, 'za letu se nepočítá');
  setFlying(false);
  show.stop();
  assert.deepEqual(log.at(-1), ['rotate', false]);
  assert.equal(show.active(), false);
  show.tick(100);
  assert.deepEqual(log.at(-1), ['rotate', false]);
  show.stop(); // podruhé nic
  assert.equal(log.filter((l) => l[0] === 'rotate').length, 2);
});
