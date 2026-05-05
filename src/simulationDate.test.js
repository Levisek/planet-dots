import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSimulationDate, formatRelative } from './simulationDate.js';

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
