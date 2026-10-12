import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTour, TOUR_STOPS, TOUR_HOLD_SEC, TOUR_OVERVIEW_SEC } from './tour.js';
import { BODY_DATA } from './bodyData.js';

function setup(over = {}) {
  const log = [];
  const state = { busy: false, refuse: 0, changes: [] };
  const tour = createTour({
    goTo: (s) => {
      if (state.refuse > 0) { state.refuse--; return false; }
      log.push(s.id);
    },
    isBusy: () => state.busy,
    onChange: (info) => state.changes.push(info),
    ...over,
  });
  return { tour, log, state };
}

test('zastávky: každé těleso existuje v BODY_DATA, text je krátký, žádné se neopakuje', () => {
  const seen = new Set();
  for (const s of TOUR_STOPS) {
    if (s.id !== null) assert.ok(BODY_DATA[s.id], `neznámé těleso ${s.id}`);
    else assert.ok(s.name, 'přehled má vlastní název');
    assert.ok(s.text.length > 20 && s.text.length <= 110, `${s.id}: ${s.text.length} znaků`);
    assert.ok(!seen.has(s.id));
    seen.add(s.id);
  }
  assert.equal(TOUR_STOPS[0].id, null, 'začíná přehledem');
});

test('start pošle kameru na první zastávku, podruhé nic nedělá', () => {
  const { tour, log } = setup();
  assert.equal(tour.active(), false);
  tour.start();
  tour.tick(0.1);
  assert.deepEqual(log, [null]);
  tour.start({ from: 5 });
  tour.tick(0.1);
  assert.deepEqual(log, [null]);
  assert.equal(tour.index(), 0);
});

test('po uplynutí doby jede dál; přelet se do času nepočítá', () => {
  const { tour, log, state } = setup();
  tour.start();
  tour.tick(0.1); // goTo
  state.busy = true;
  for (let i = 0; i < 1000; i++) tour.tick(0.1); // 100 s letu
  assert.equal(tour.index(), 0);
  assert.equal(tour.progress(), 0);
  state.busy = false;
  for (let t = 0; t < TOUR_OVERVIEW_SEC - 0.5; t += 0.1) tour.tick(0.1);
  assert.equal(tour.index(), 0);
  assert.ok(tour.progress() > 0.9);
  for (let i = 0; i < 10; i++) tour.tick(0.1);
  assert.equal(tour.index(), 1);
  assert.deepEqual(log, [null, 'sun']);
});

test('po poslední zastávce začne znovu (spořič)', () => {
  const { tour, log } = setup();
  tour.start({ from: TOUR_STOPS.length - 1 });
  tour.tick(0.1);
  for (let t = 0; t <= TOUR_HOLD_SEC + 0.2; t += 0.1) tour.tick(0.1);
  assert.equal(tour.index(), 0);
  assert.deepEqual(log, ['triton', null]);
});

test('další / předchozí: skok hned, čas od nuly, přes okraj dokola', () => {
  const { tour, log } = setup();
  tour.next(); // neběží → nic
  assert.equal(tour.active(), false);
  tour.start();
  tour.tick(0.1);
  for (let i = 0; i < 50; i++) tour.tick(0.1);
  tour.prev();
  assert.equal(tour.index(), TOUR_STOPS.length - 1);
  assert.equal(tour.progress(), 0);
  tour.next();
  tour.next();
  tour.tick(0.1);
  assert.equal(tour.index(), 1);
  // Rychlé přeskočení: kamera letí jen na poslední vybranou zastávku.
  assert.deepEqual(log, [null, 'sun']);
});

test('goTo vrátí false → zkouší to každý snímek, čas zastávky neběží', () => {
  const { tour, log, state } = setup();
  state.refuse = 3;
  tour.start({ from: 1 });
  for (let i = 0; i < 3; i++) tour.tick(1);
  assert.deepEqual(log, []);
  tour.tick(1);
  assert.deepEqual(log, ['sun']);
  assert.equal(tour.progress(), 0);
});

test('stop: konec, onChange(null); auto příznak a indexOf', () => {
  const { tour, state } = setup();
  tour.start({ auto: true, from: tour.indexOf('earth') });
  assert.equal(tour.isAuto(), true);
  assert.equal(state.changes[0].stop.id, 'earth');
  assert.equal(state.changes[0].total, TOUR_STOPS.length);
  tour.stop();
  assert.equal(tour.active(), false);
  assert.equal(tour.isAuto(), false);
  assert.equal(state.changes.at(-1), null);
  tour.tick(100);
  assert.equal(tour.index(), -1);
  assert.equal(tour.indexOf('pluto'), -1);
});
