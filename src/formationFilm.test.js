import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pchip, formationCameraPose, FILM_END, sunIgnitionScale, SUN_GROW_START, SUN_GROW_END,
  growthWindow, growthScale, revealFade, REVEAL_SEC,
} from './formationFilm.js';
import { LIVE_START, ACCRETION_WINDOWS } from './animation.js';

const MAIN = { x: 0, y: 5000, z: 9000 };
const FYZ = { x: 0, y: 90000, z: 160000 };
const len = (a) => Math.hypot(a.x, a.y, a.z);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test('pchip: prochází body, bez překmitu mezi monotónními body', () => {
  const ts = [0, 1, 3, 4], ys = [0, 2, 2.5, 10];
  for (let i = 0; i < ts.length; i++) assert.ok(Math.abs(pchip(ts, ys, ts[i]) - ys[i]) < 1e-12);
  let prev = -Infinity;
  for (let t = 0; t <= 4; t += 0.01) {
    const y = pchip(ts, ys, t);
    assert.ok(y >= prev - 1e-12, `monotónní v ${t}`);
    assert.ok(y >= 0 && y <= 10);
    prev = y;
  }
});

test('kamera formace: končí přesně na výchozí pozici obou módů, pak tam stojí', () => {
  for (const m of [MAIN, FYZ]) {
    const end = formationCameraPose(FILM_END, m);
    assert.ok(dist(end, m) < 1e-6 * len(m));
    assert.deepEqual(formationCameraPose(LIVE_START, m), m);
    // těsně před koncem už skoro doma (dosedá plynule, bez skoku)
    assert.ok(dist(formationCameraPose(FILM_END - 0.05, m), m) < 0.001 * len(m));
  }
});

test('kamera formace: plynulá — žádný skok mezi snímky 1/30 s', () => {
  let prev = formationCameraPose(0, MAIN);
  let maxStep = 0;
  for (let t = 1 / 30; t <= FILM_END + 0.1; t += 1 / 30) {
    const p = formationCameraPose(t, MAIN);
    maxStep = Math.max(maxStep, dist(p, prev));
    prev = p;
  }
  // nejrychlejší úsek (oddálení během akrece) pod ~2 % vzdálenosti za snímek
  assert.ok(maxStep < 0.02 * len(MAIN), `max krok ${maxStep.toFixed(0)}`);
});

test('kamera formace: při zážehu blízko Slunce, nad rovinou disku', () => {
  const p = formationCameraPose(6.5, MAIN);
  assert.ok(len(p) < 0.4 * len(MAIN));
  assert.ok(p.y > 0);
  const start = formationCameraPose(0, MAIN);
  assert.ok(p.y / len(p) < start.y / len(start), 'k zážehu kamera klesá k rovině disku');
});

test('Slunce: před zážehem nula, roste monotónně, na konci ignition plné', () => {
  assert.equal(sunIgnitionScale(0), 0);
  assert.equal(sunIgnitionScale(SUN_GROW_START), 0);
  assert.equal(sunIgnitionScale(SUN_GROW_END), 1);
  assert.equal(sunIgnitionScale(LIVE_START), 1);
  let prev = 0;
  for (let t = SUN_GROW_START; t <= SUN_GROW_END; t += 0.05) {
    const s = sunIgnitionScale(t);
    assert.ok(s >= prev);
    prev = s;
  }
});

test('růst: planety podle akrečního okna, měsíce podle fáze rodiče, po formaci plná velikost', () => {
  for (const w of ACCRETION_WINDOWS) {
    const win = growthWindow(w.planetId);
    assert.equal(win.start, w.start);
    assert.ok(win.end > w.end && win.end < LIVE_START);
    assert.equal(growthScale(w.start, win), 0);
    assert.ok(growthScale((win.start + win.end) / 2, win) > 0.5);
    assert.equal(growthScale(LIVE_START, win), 1);
  }
  const luna = growthWindow('luna', 'earth');
  assert.ok(luna && luna.start >= 17 && luna.end <= LIVE_START + 1);
  assert.equal(growthScale(LIVE_START + 1, luna), 1);
  assert.equal(growthWindow('ceres'), null);
  assert.equal(growthScale(0, null), 1);
});

test('prolnutí po formaci: 0 před LIVE_START, 1 po REVEAL_SEC', () => {
  assert.equal(revealFade(LIVE_START - 1), 0);
  assert.equal(revealFade(LIVE_START), 0);
  assert.equal(revealFade(LIVE_START + REVEAL_SEC), 1);
  const mid = revealFade(LIVE_START + REVEAL_SEC / 2);
  assert.ok(Math.abs(mid - 0.5) < 1e-9);
});
