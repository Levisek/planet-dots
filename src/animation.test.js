import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCENES, sceneAt, sceneStart, sceneEnd, realYearsAt, formatAge, SOLAR_AGE_YEARS,
  PHASES, ACCRETION_WINDOWS, LIVE_START,
} from './animation.js';

test('scény jdou za sebou od 0, mají popisek a krátký fakt, poslední je Dnes', () => {
  assert.equal(SCENES[0].start, 0);
  for (let i = 1; i < SCENES.length; i++) assert.ok(SCENES[i].start > SCENES[i - 1].start);
  for (const s of SCENES) {
    assert.ok(s.label.length > 2 && s.fact.length > 20 && s.fact.length <= 110, s.id);
  }
  assert.equal(SCENES.at(-1).id, 'today');
  assert.ok(SCENES.at(-1).start < LIVE_START);
  assert.equal(sceneEnd('today'), LIVE_START);
  assert.equal(sceneEnd('cloud'), sceneStart('shock'));
});

test('sceneAt: hranice scén a čas po filmu', () => {
  assert.equal(sceneAt(0).id, 'cloud');
  assert.equal(sceneAt(sceneStart('giants')).id, 'giants');
  assert.equal(sceneAt(sceneStart('giants') - 0.01).id, 'disk');
  assert.equal(sceneAt(LIVE_START + 100).id, 'today');
});

test('pořadí jako ve skutečnosti: Jupiter první, Mars před Zemí, fúze před stěhováním obrů', () => {
  const w = Object.fromEntries(ACCRETION_WINDOWS.map((x) => [x.planetId, x]));
  for (const id of ['saturn', 'uranus', 'neptune', 'mars', 'mercury', 'venus', 'earth']) {
    assert.ok(w.jupiter.start < w[id].start, `Jupiter před ${id}`);
  }
  assert.ok(w.mars.end < w.earth.start, 'Mars hotový dřív, než Země začne');
  // kamenné planety až po odfouknutí plynu, obři před ním
  for (const id of ['mercury', 'venus', 'earth']) assert.ok(w[id].start >= sceneStart('rocky'));
  for (const id of ['jupiter', 'saturn', 'uranus', 'neptune']) assert.ok(w[id].end <= sceneStart('clearing'));
  const ids = SCENES.map((s) => s.id);
  assert.ok(ids.indexOf('collapse') < ids.indexOf('disk'));
  assert.ok(ids.indexOf('fusion') < ids.indexOf('migration'));
  // Měsíc až po srážce s Theiou
  const earthMoons = PHASES.find((p) => p.parentId === 'earth');
  assert.ok(earthMoons.start >= sceneStart('theia'));
});

test('akreční okna: 8 planet, end > start, všechna končí před zážehem fúze', () => {
  assert.equal(ACCRETION_WINDOWS.length, 8);
  for (const w of ACCRETION_WINDOWS) {
    assert.ok(w.end > w.start, w.planetId);
    assert.ok(w.end < sceneStart('fusion'), w.planetId);
  }
});

test('měsíční fáze: 6 rodin, každá po dorůstání rodiče a před koncem filmu', () => {
  assert.equal(PHASES.length, 6);
  for (const ph of PHASES) {
    assert.ok(ph.id.endsWith('_moons') && ph.parentId, ph.id);
    const w = ACCRETION_WINDOWS.find((x) => x.planetId === ph.parentId);
    assert.ok(ph.start > w.end + 1.2, `${ph.id} až po dorůstání rodiče`);
    assert.ok(ph.end <= LIVE_START, ph.id);
  }
});

test('skutečný čas: před kolapsem nic, pak roste až na dnešek', () => {
  assert.equal(realYearsAt(0), null);
  assert.equal(realYearsAt(sceneStart('collapse')), 0);
  assert.equal(realYearsAt(LIVE_START), SOLAR_AGE_YEARS);
  let prev = -1;
  for (let t = sceneStart('collapse'); t <= LIVE_START; t += 0.25) {
    const y = realYearsAt(t);
    assert.ok(y >= prev, `monotónní v ${t}`);
    prev = y;
  }
  // Jupiter (jádro do ~1 mil. let), plyn pryč do ~4 mil. let
  assert.ok(realYearsAt(sceneStart('giants')) <= 1e6);
  assert.ok(realYearsAt(sceneStart('rocky')) <= 1e7);
});

test('formatAge: česky a zaokrouhleně', () => {
  assert.equal(formatAge(null), 'před 4,57 mld let');
  assert.equal(formatAge(0), '0 let');
  assert.equal(formatAge(120000), '120 tis. let');
  assert.equal(formatAge(3.24e6), '3,2 mil. let');
  assert.equal(formatAge(6e7), '60 mil. let');
  assert.equal(formatAge(1.5e9), '1,5 mld let');
  assert.equal(formatAge(SOLAR_AGE_YEARS), 'dnes');
});
