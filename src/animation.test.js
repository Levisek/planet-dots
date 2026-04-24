import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASES, phaseAt, phaseProgress } from './animation.js';

test('PHASES pokrývají čas 0..8.6 s bez děr', () => {
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
  assert.equal(phaseAt(0).id, 'init');
  assert.equal(phaseAt(0.5).id, 'init');
  assert.equal(phaseAt(1.5).id, 'sun');
  assert.equal(phaseAt(2.2).id, 'mercury');
  assert.equal(phaseAt(2.7).id, 'venus');
  assert.equal(phaseAt(3.5).id, 'earth');
  assert.equal(phaseAt(6.5).id, 'saturn');
  assert.equal(phaseAt(8.6).id, 'live');
  assert.equal(phaseAt(100).id, 'live');
});

test('phaseProgress vrací 0..1 napříč fází', () => {
  assert.equal(phaseProgress(1.0), 0);       // start of sun phase
  assert.equal(phaseProgress(2.0), 1);       // end of sun phase (== start of mercury)
  assert.ok(Math.abs(phaseProgress(1.5) - 0.5) < 1e-9);
});

test('každá non-live fáze má planet id pokud není init', () => {
  for (const ph of PHASES) {
    if (ph.id === 'init' || ph.id === 'live') continue;
    assert.ok(ph.planetId, `${ph.id} postrádá planetId`);
    assert.ok(ph.label, `${ph.id} postrádá label`);
  }
});
