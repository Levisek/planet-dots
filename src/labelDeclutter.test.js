import { test } from 'node:test';
import assert from 'node:assert/strict';
import { declutter, isBehindSphere } from './labelDeclutter.js';

const lbl = (x, y, priority, w = 40, h = 8) => ({ x, y, w, h, priority });

test('nepřekrývající se popisky zůstanou na místě', () => {
  const out = declutter([lbl(0, 0, 1), lbl(200, 0, 1)]);
  assert.deepEqual(out, [{ shift: 0, hidden: false }, { shift: 0, hidden: false }]);
});

test('při kolizi zůstane vyšší priorita, nižší se posune nahoru', () => {
  const out = declutter([lbl(0, 0, 1), lbl(10, 2, 5)]);
  assert.deepEqual(out[1], { shift: 0, hidden: false });
  assert.equal(out[0].hidden, false);
  assert.ok(out[0].shift >= 1);
});

test('když není místo ani po posunu, nižší priorita se skryje', () => {
  const items = [lbl(0, 0, 9), lbl(0, 0, 8), lbl(0, 0, 7), lbl(0, 0, 1)];
  const out = declutter(items, { maxShift: 2 });
  assert.deepEqual(out.map((o) => o.shift).slice(0, 3), [0, 1, 2]);
  assert.equal(out[3].hidden, true);
});

test('isBehindSphere: bod za koulí ano, před ní a vedle ne', () => {
  const cam = { x: 0, y: 0, z: 100 };
  const c = { x: 0, y: 0, z: 0 };
  assert.equal(isBehindSphere(cam, { x: 0, y: 0, z: -50 }, c, 10), true);
  assert.equal(isBehindSphere(cam, { x: 0, y: 0, z: 50 }, c, 10), false);
  assert.equal(isBehindSphere(cam, { x: 30, y: 0, z: -50 }, c, 10), false);
});
