import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOcean, flattenOcean } from './earthOcean.js';

// Barvy změřené v textures/earth.jpg (zmenšeno na 512×256).
test('oceán i mělčiny jsou oceán; poušť, prales, tundra, led ne', () => {
  for (const c of [[6, 13, 35], [2, 10, 32], [23, 62, 107], [28, 71, 126], [2, 4, 12], [5, 6, 9]]) assert.ok(isOcean(...c), c.join());
  for (const c of [[200, 166, 122], [21, 37, 10], [44, 50, 26], [116, 73, 45], [235, 240, 245], [12, 20, 8]]) assert.ok(!isOcean(...c), c.join());
});

test('flattenOcean: mělčina i hlubina skoro stejně, pevnina beze změny', () => {
  const d = new Uint8ClampedArray([6, 13, 35, 255, 28, 71, 126, 255, 200, 166, 122, 255]);
  flattenOcean(d);
  assert.ok(Math.abs(d[2] - d[6]) < 20, `hlubina ${d[2]} vs mělčina ${d[6]}`);
  assert.deepEqual([...d.slice(8)], [200, 166, 122, 255]);
});
