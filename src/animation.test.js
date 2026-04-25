import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASES, phaseAt, phaseProgress } from './animation.js';

test('PHASES pokrývají čas 0..13.0 s bez děr', () => {
  let t = 0;
  for (const ph of PHASES) {
    assert.equal(ph.start, t, `díra před ${ph.id}`);
    t = ph.end;
  }
});

test('PHASES končí fází live s end=Infinity', () => {
  const last = PHASES[PHASES.length - 1];
  assert.equal(last.id, 'live');
  assert.equal(last.end, Infinity);
});

test('phaseAt vrátí správnou fázi pro čas', () => {
  assert.equal(phaseAt(0).id, 'beat1_cloud');
  assert.equal(phaseAt(2.5).id, 'beat1_cloud');
  assert.equal(phaseAt(3.5).id, 'beat2_collapse');
  assert.equal(phaseAt(6.5).id, 'init');
  assert.equal(phaseAt(7.5).id, 'sun');
  assert.equal(phaseAt(8.2).id, 'mercury');
  assert.equal(phaseAt(8.7).id, 'venus');
  assert.equal(phaseAt(9.5).id, 'earth');
  assert.equal(phaseAt(12.5).id, 'saturn');
  // moon sub-fáze
  assert.equal(phaseAt(14.7).id, 'earth_moons');
  assert.equal(phaseAt(15.2).id, 'mars_moons');
  assert.equal(phaseAt(15.8).id, 'jupiter_moons');
  assert.equal(phaseAt(17.0).id, 'saturn_moons');
  assert.equal(phaseAt(18.5).id, 'uranus_moons');
  assert.equal(phaseAt(19.5).id, 'neptune_moons');
  assert.equal(phaseAt(20.0).id, 'live');
  assert.equal(phaseAt(100).id, 'live');
});

test('phaseProgress vrací 0..1 napříč sun fází', () => {
  assert.equal(phaseProgress(7.0), 0);       // start of sun phase
  assert.equal(phaseProgress(8.0), 1);       // end of sun phase
  assert.ok(Math.abs(phaseProgress(7.5) - 0.5) < 1e-9);
});

const _NON_DATA_PHASES = new Set(['init', 'live', 'beat1_cloud', 'beat2_collapse']);
test('každá data fáze má planetId (planety) nebo parentId (měsíce)', () => {
  for (const ph of PHASES) {
    if (_NON_DATA_PHASES.has(ph.id)) continue;
    if (ph.id.endsWith('_moons')) {
      assert.ok(ph.parentId, `${ph.id} postrádá parentId`);
    } else {
      assert.ok(ph.planetId, `${ph.id} postrádá planetId`);
      assert.ok(ph.label, `${ph.id} postrádá label`);
    }
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
