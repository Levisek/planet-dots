import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCalendar } from './simulationDate.js';

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
