import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPlanetTargets, resetPlanetTargets } from './planetTargets.js';
import { PLANET_BY_ID } from './planets.js';
import { PHASE } from './phase.js';

const fakeImageData = { width: 1, height: 1, data: new Uint8ClampedArray([128, 128, 128, 255]) };

test('getPlanetTargets: vrací tickCount cílů s očekávaným tvarem', () => {
  const planet = PLANET_BY_ID.mercury;
  resetPlanetTargets();
  const targets = getPlanetTargets(planet, fakeImageData);
  assert.equal(targets.length, planet.tickCount);
  for (const t of targets) {
    assert.equal(typeof t.localOffset.x, 'number');
    assert.equal(typeof t.localOffset.y, 'number');
    assert.equal(typeof t.localOffset.z, 'number');
    assert.equal(t.color.length, 3);
    assert.equal(t.phase, PHASE.ON_PLANET);
  }
});

test('getPlanetTargets: druhé volání vrací stejnou (cached) referenci', () => {
  const planet = PLANET_BY_ID.venus;
  resetPlanetTargets();
  const a = getPlanetTargets(planet, fakeImageData);
  const b = getPlanetTargets(planet, fakeImageData);
  assert.equal(a, b);
});

test('resetPlanetTargets: po resetu se vytvoří nová reference', () => {
  const planet = PLANET_BY_ID.earth;
  resetPlanetTargets();
  const a = getPlanetTargets(planet, fakeImageData);
  resetPlanetTargets();
  const b = getPlanetTargets(planet, fakeImageData);
  assert.notEqual(a, b);
});
