import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGridData, GRID_HALF, GRID_STEP } from './eclipticGrid.js';

test('buildGridData: vrcholy po dvou (úsečky), barev stejně jako vrcholů', () => {
  const { positions, colors } = buildGridData();
  assert.equal(positions.length, colors.length);
  assert.equal((positions.length / 3) % 2, 0);
});

test('buildGridData: leží v rovině ekliptiky (y = 0) a v mezích čtverce', () => {
  const { positions } = buildGridData();
  for (let i = 0; i < positions.length; i += 3) {
    assert.equal(positions[i + 1], 0);
    assert.ok(Math.abs(positions[i]) <= GRID_HALF + 1e-6);
    assert.ok(Math.abs(positions[i + 2]) <= GRID_HALF + 1e-6);
  }
});

test('buildGridData: čáry slábnou od středu (okraj tmavší než střed)', () => {
  const { positions, colors } = buildGridData(GRID_HALF, GRID_STEP);
  let center = 0, edge = 0;
  let dc = Infinity, de = -1;
  for (let i = 0; i < positions.length; i += 3) {
    const d = Math.hypot(positions[i], positions[i + 2]);
    if (d < dc) { dc = d; center = colors[i + 2]; }
    if (d > de) { de = d; edge = colors[i + 2]; }
  }
  assert.ok(edge < center * 0.3, `edge=${edge} center=${center}`);
});
