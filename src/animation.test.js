import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASES, phaseAt, phaseProgress, ACCRETION_WINDOWS, LIVE_START } from './animation.js';

test('PHASES pokrývají čas 0..22 s bez děr', () => {
  let t = 0;
  for (const ph of PHASES) {
    assert.equal(ph.start, t, `díra před ${ph.id}`);
    t = ph.end;
  }
});

test('PHASES končí fází live s end=Infinity a LIVE_START odpovídá', () => {
  const last = PHASES[PHASES.length - 1];
  assert.equal(last.id, 'live');
  assert.equal(last.end, Infinity);
  assert.equal(last.start, LIVE_START);
});

test('phaseAt vrátí správnou fázi pro čas', () => {
  assert.equal(phaseAt(0).id, 'beat_disk');
  assert.equal(phaseAt(3.9).id, 'beat_disk');
  assert.equal(phaseAt(4.0).id, 'beat_ignition');
  assert.equal(phaseAt(6.5).id, 'beat_accretion');
  assert.equal(phaseAt(16.9).id, 'beat_accretion');
  assert.equal(phaseAt(17).id, 'earth_moons');
  assert.equal(phaseAt(17.5).id, 'mars_moons');
  assert.equal(phaseAt(18.0).id, 'jupiter_moons');
  assert.equal(phaseAt(19.0).id, 'saturn_moons');
  assert.equal(phaseAt(20.2).id, 'uranus_moons');
  assert.equal(phaseAt(21.0).id, 'neptune_moons');
  assert.equal(phaseAt(22.0).id, 'live');
  assert.equal(phaseAt(99).id, 'live');
});

test('phaseProgress vrací 0..1 napříč earth_moons fází', () => {
  assert.equal(phaseProgress(17.0), 0);       // start of earth_moons
  assert.equal(phaseProgress(17.5), 1);       // end of earth_moons
  assert.ok(Math.abs(phaseProgress(17.25) - 0.5) < 1e-9);
});

const _NON_DATA_PHASES = new Set(['beat_disk', 'beat_ignition', 'beat_accretion', 'live']);
test('data fáze (mimo beaty a live) jsou moon sub-fáze s parentId', () => {
  for (const ph of PHASES) {
    if (_NON_DATA_PHASES.has(ph.id)) continue;
    assert.ok(ph.id.endsWith('_moons'), `${ph.id} neočekávaná fáze`);
    assert.ok(ph.parentId, `${ph.id} postrádá parentId`);
  }
});

test('moon sub-fáze mají správné parentId (6 rodin: earth/mars/jupiter/saturn/uranus/neptune)', () => {
  const moonPhases = PHASES.filter(ph => ph.id.endsWith('_moons'));
  assert.equal(moonPhases.length, 6);
  assert.equal(moonPhases[0].parentId, 'earth');
  assert.equal(moonPhases[1].parentId, 'mars');
  assert.equal(moonPhases[2].parentId, 'jupiter');
  assert.equal(moonPhases[3].parentId, 'saturn');
  assert.equal(moonPhases[4].parentId, 'uranus');
  assert.equal(moonPhases[5].parentId, 'neptune');
});

test('ACCRETION_WINDOWS: 8 planet, end > start, vše končí ≤17s (uvnitř beat_accretion)', () => {
  assert.equal(ACCRETION_WINDOWS.length, 8);
  for (const w of ACCRETION_WINDOWS) {
    assert.ok(w.end > w.start, `${w.planetId}: end <= start`);
    assert.ok(w.end <= 17, `${w.planetId}: end > 17`);
  }
});

test('ACCRETION_WINDOWS: sousední okna se překrývají (souběžná akrece, žádné dávky)', () => {
  for (let i = 0; i < ACCRETION_WINDOWS.length - 1; i++) {
    assert.ok(
      ACCRETION_WINDOWS[i + 1].start < ACCRETION_WINDOWS[i].end,
      `${ACCRETION_WINDOWS[i + 1].planetId} nezačíná před koncem ${ACCRETION_WINDOWS[i].planetId}`,
    );
  }
});
