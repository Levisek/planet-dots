import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planetBoost, PLANET_BOOST } from './planetBoost.js';
import { PLANET_BY_ID } from './planets.js';
import { auToDisplayRadius } from './scale.js';

test('planetBoost: váha 0 = věrná velikost, Slunce a neznámé = 1', () => {
  for (const id of Object.keys(PLANET_BOOST)) assert.equal(planetBoost(id, 0), 1);
  assert.equal(planetBoost('sun', 1), 1);
});

test('planetBoost: váha 1 = plný boost, mimo rozsah se ořízne', () => {
  assert.equal(planetBoost('earth', 1), PLANET_BOOST.earth);
  assert.equal(planetBoost('earth', 5), PLANET_BOOST.earth);
  assert.equal(planetBoost('earth', -1), 1);
});

test('planetBoost: zvětšená planeta nepřesáhne polovinu mezery k sousední dráze', () => {
  const ids = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
  const au = { mercury: 0.39, venus: 0.72, earth: 1, mars: 1.52, jupiter: 5.2, saturn: 9.55, uranus: 19.2, neptune: 30.05 };
  ids.forEach((id, i) => {
    const p = PLANET_BY_ID[id];
    const extent = (p.ringOuterRadius ?? p.radiusPx) * planetBoost(id, 1);
    const prev = i > 0 ? auToDisplayRadius(au[id]) - auToDisplayRadius(au[ids[i - 1]]) : Infinity;
    const next = i < ids.length - 1 ? auToDisplayRadius(au[ids[i + 1]]) - auToDisplayRadius(au[id]) : Infinity;
    assert.ok(extent <= Math.min(prev, next), `${id}: ${extent} vs mezera ${Math.min(prev, next)}`);
  });
});
