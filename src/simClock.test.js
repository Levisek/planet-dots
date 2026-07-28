import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as clock from './simClock.js';

test('scrubTo nastaví datum a pauzuje', () => {
  clock.play();
  clock.scrubTo(new Date('1969-07-20T20:17:00Z'));
  assert.equal(clock.getDate().getUTCFullYear(), 1969);
  assert.equal(clock.isPlaying(), false);
});

test('scrubTo clampuje na [-4000, 8000]', () => {
  clock.scrubTo(new Date('0001-01-01T00:00:00Z')); // referenční rok
  const tooEarly = new Date(Date.UTC(-9000, 0, 1));
  clock.scrubTo(tooEarly);
  assert.equal(clock.getDate().getUTCFullYear(), -4000);
  const tooLate = new Date(Date.UTC(20000, 0, 1));
  clock.scrubTo(tooLate);
  assert.equal(clock.getDate().getUTCFullYear(), 8000);
});

test('tick posouvá datum jen když playing', () => {
  clock.scrubTo(new Date('2000-01-01T12:00:00Z'));
  clock.setTimeScale(1);
  clock.tick(1000); // pauznuto po scrubTo
  assert.equal(clock.getDate().toISOString(), '2000-01-01T12:00:00.000Z');
  clock.play();
  clock.tick(1000);
  assert.ok(clock.getDate().getTime() > Date.UTC(2000,0,1,12));
});

test('reverse (timeScale<0) posune datum zpět', () => {
  clock.scrubTo(new Date('2000-06-01T00:00:00Z'));
  clock.play();
  clock.setTimeScale(-1);
  clock.tick(1000);
  assert.ok(clock.getDate().getTime() < Date.UTC(2000,5,1));
});

test('onDateChange se zavolá při scrubTo', () => {
  let called = 0;
  const off = clock.onDateChange(() => { called++; });
  clock.scrubTo(new Date('2010-01-01T00:00:00Z'));
  assert.ok(called >= 1);
  off();
});

test('tick na horní hranici zůstává v roce 8000', () => {
  clock.scrubTo(new Date(Date.UTC(8000, 11, 31)));
  clock.setTimeScale(1);
  clock.play();
  clock.tick(100000);
  assert.equal(clock.getDate().getUTCFullYear(), 8000);
  const lastMoment = Date.UTC(8001, 0, 1) - 1;
  assert.equal(clock.getDate().getTime(), lastMoment);
});

test('chybující listener nezastaví ostatní ani tick', () => {
  let counter = 0;
  const off1 = clock.onDateChange(() => {
    throw new Error('boom');
  });
  const off2 = clock.onDateChange(() => {
    counter++;
  });
  clock.scrubTo(new Date('2020-01-01T00:00:00Z'));
  assert.equal(counter, 1);
  off1();
  off2();
});

test('getDate vrací kopii', () => {
  clock.scrubTo(new Date('2015-06-15T00:00:00Z'));
  const d = clock.getDate();
  d.setUTCFullYear(1);
  assert.notEqual(clock.getDate().getUTCFullYear(), 1);
});
