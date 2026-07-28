import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATE_PRESETS } from './datePresets.js';

test('presety mají id, label, platné Date v rozsahu', () => {
  assert.ok(DATE_PRESETS.length >= 3);
  for (const p of DATE_PRESETS) {
    assert.equal(typeof p.id, 'string');
    assert.equal(typeof p.label, 'string');
    assert.ok(p.date instanceof Date && !isNaN(p.date.getTime()), p.id);
    const y = p.date.getUTCFullYear();
    assert.ok(y >= -4000 && y <= 8000, `${p.id} mimo rozsah`);
  }
});

test('obsahuje Apollo 11, Halley, transit Venuše', () => {
  const ids = DATE_PRESETS.map((p) => p.id);
  for (const id of ['apollo11', 'halley1986', 'venus-transit-2012']) {
    assert.ok(ids.includes(id), `chybí ${id}`);
  }
});
