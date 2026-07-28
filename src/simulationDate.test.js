import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSimulationDate, formatRelative, formatCalendar } from './simulationDate.js';

test('getSimulationDate(0) je J2000 epoch', () => {
  const d = getSimulationDate(0);
  assert.equal(d.toISOString(), '2000-01-01T12:00:00.000Z');
});

test('getSimulationDate Earth period (10s) = 1 rok', () => {
  const d = getSimulationDate(10);
  // Mírná tolerance kvůli leap year (365.25 days)
  const days = (d.getTime() - new Date('2000-01-01T12:00:00Z').getTime()) / 86400000;
  assert.ok(Math.abs(days - 365.25) < 0.5);
});

test('formatRelative t=0 → +0d', () => {
  assert.match(formatRelative(0), /\+\s*0d/);
});

test('formatRelative negativní → znaménko −', () => {
  assert.match(formatRelative(-5), /−/);
});

test('formatCalendar běžné datum', () => {
  assert.equal(formatCalendar(new Date('2026-07-27T00:00:00Z')), '27. 7. 2026');
});

test('formatCalendar rok 1 = 1 n. l.', () => {
  assert.equal(formatCalendar(new Date('0001-01-01T00:00:00Z')), '1. 1. 1');
});

test('formatCalendar BCE: astronomický rok 0 = 1 př. n. l.', () => {
  assert.equal(formatCalendar(new Date('0000-01-01T00:00:00Z')), '1. 1. 1 př. n. l.');
});

test('formatCalendar BCE: rok -44 = 45 př. n. l.', () => {
  assert.equal(formatCalendar(new Date('-000044-03-15T00:00:00Z')), '15. 3. 45 př. n. l.');
});
