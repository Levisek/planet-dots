import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pchip, formationCameraPose, FILM_END, sunIgnitionScale, SUN_GROW_START, SUN_GROW_END,
  growthWindow, growthScale, revealFade, REVEAL_SEC, GROWTH_DELAY,
  protoTint, sunGlow, GLOW_STEADY, orbitTrace, sunTint, FUSION_START,
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

test('kamera formace: mrak zdálky, s kolapsem dovnitř k rovině disku, při fúzi u Slunce', () => {
  const start = formationCameraPose(0, MAIN);
  const disk = formationCameraPose(20, MAIN);
  assert.ok(len(start) > 1.3 * len(disk), 'mrak zdálky, s kolapsem blíž');
  assert.ok(len(disk) < 0.6 * len(MAIN));
  assert.ok(disk.y > 0);
  assert.ok(disk.y / len(disk) < start.y / len(start), 'kamera klesá k rovině disku');
  assert.ok(len(formationCameraPose(FUSION_START + 2, MAIN)) < 0.4 * len(MAIN));
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
    // nejdřív se sejde prach, planeta se ukáže až po části okna
    assert.equal(win.start, w.start + GROWTH_DELAY * (w.end - w.start));
    assert.ok(win.end > w.end && win.end < LIVE_START);
    assert.equal(growthScale(w.start, win), 0);
    assert.equal(growthScale(win.start, win), 0);
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

test('barva rostoucí planety: do půlky velikosti prach, plná velikost = vlastní barvy', () => {
  for (const cold of [false, true]) {
    assert.deepEqual(protoTint(0, cold), protoTint(0.5, cold));
    assert.deepEqual(protoTint(1, cold), [1, 1, 1]);
    assert.ok(protoTint(0, cold).every((c) => c > 0 && c <= 1) && protoTint(0, cold).some((c) => c < 1));
  }
  const hot = protoTint(0, false), cold = protoTint(0, true);
  assert.ok(hot[0] > hot[2] && cold[2] > cold[0], 'skalnaté do ruda, obři do modra');
});

test('záře Slunce: protohvězda slabě, zážeh fúze záblesk, pak trvalá záře', () => {
  assert.deepEqual(sunGlow(0), { flash: 0, glow: 0 });
  assert.deepEqual(sunGlow(SUN_GROW_START - 0.01), { flash: 0, glow: 0 });
  const proto = sunGlow(FUSION_START - 1);
  assert.equal(proto.flash, 0);
  assert.ok(proto.glow > 0 && proto.glow < GLOW_STEADY / 2);
  const peak = Math.max(...[0.1, 0.2, 0.3, 0.4].map((d) => sunGlow(FUSION_START + d).flash));
  assert.ok(peak > 0.99);
  assert.equal(sunGlow(FUSION_START + 4).flash, 0);
  assert.equal(sunGlow(LIVE_START + 100).glow, GLOW_STEADY);
});

test('barva Slunce: protohvězda rudá, po zážehu fúze plné barvy', () => {
  const p = sunTint(SUN_GROW_END);
  assert.ok(p[0] > p[1] && p[1] > p[2] && p[2] < 0.5);
  assert.deepEqual(sunTint(FUSION_START + 3), [1, 1, 1]);
  assert.deepEqual(sunTint(LIVE_START), [1, 1, 1]);
});

test('dráhy: kreslí se postupně zevnitř ven, všechny hotové před koncem formace', () => {
  let prevStart = 0;
  const byDistance = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']
    .map((id) => ACCRETION_WINDOWS.find((w) => w.planetId === id));
  for (const w of byDistance) {
    assert.equal(orbitTrace(w.end + 1.2, w.planetId), 0, 'až planeta doroste');
    assert.equal(orbitTrace(LIVE_START, w.planetId), 1);
    let t = w.start;
    while (orbitTrace(t, w.planetId) === 0) t += 0.05;
    assert.ok(t >= prevStart, `${w.planetId} nezačne dřív než vnitřní soused`);
    prevStart = t;
  }
  assert.equal(orbitTrace(0, 'ceres'), 1);
});
