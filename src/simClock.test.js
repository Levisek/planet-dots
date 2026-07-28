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
