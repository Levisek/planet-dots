import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHexagonGeometry, computeTangentFrame } from './voxelTileMath.js';

// --- buildHexagonGeometry ---

test('hexagon má 7 vrcholů (center + 6 rohů)', () => {
  const { positions } = buildHexagonGeometry(1.0);
  assert.equal(positions.length / 3, 7);
});

test('hexagon má 6 trojúhelníků (18 indices)', () => {
  const { indices } = buildHexagonGeometry(1.0);
  assert.equal(indices.length, 18);
});

test('hexagon corners leží na kružnici o daném poloměru', () => {
  const radius = 2.5;
  const { positions } = buildHexagonGeometry(radius);
  for (let i = 1; i <= 6; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const d = Math.sqrt(x * x + y * y);
    assert.ok(Math.abs(d - radius) < 1e-6, `roh ${i} je ${d}, čekáno ${radius}`);
  }
});

test('hexagon center v (0,0,0)', () => {
  const { positions } = buildHexagonGeometry(1.0);
  assert.equal(positions[0], 0);
  assert.equal(positions[1], 0);
  assert.equal(positions[2], 0);
});

test('hexagon trojúhelníky jsou fan z centra', () => {
  const { indices } = buildHexagonGeometry(1.0);
  // Každý triangle má první index = 0 (center)
  for (let i = 0; i < 6; i++) {
    assert.equal(indices[i * 3], 0);
  }
});

// --- computeTangentFrame ---

test('computeTangentFrame: normal je normalizovaný radius', () => {
  const { normal } = computeTangentFrame([2, 0, 0]);
  assert.ok(Math.abs(normal[0] - 1) < 1e-6);
  assert.ok(Math.abs(normal[1]) < 1e-6);
  assert.ok(Math.abs(normal[2]) < 1e-6);
});

test('computeTangentFrame: tangent je kolmý na normal', () => {
  const vertex = [1, 2, 3];
  const { normal, tangent } = computeTangentFrame(vertex);
  const dot = normal[0] * tangent[0] + normal[1] * tangent[1] + normal[2] * tangent[2];
  assert.ok(Math.abs(dot) < 1e-6, `tangent není kolmý: dot=${dot}`);
});

test('computeTangentFrame: tangent je jednotkový', () => {
  const { tangent } = computeTangentFrame([5, -3, 7]);
  const len = Math.sqrt(tangent[0] ** 2 + tangent[1] ** 2 + tangent[2] ** 2);
  assert.ok(Math.abs(len - 1) < 1e-6);
});

test('computeTangentFrame: edge case — vertex na +Y ose (sever pole)', () => {
  const { normal, tangent } = computeTangentFrame([0, 5, 0]);
  assert.ok(Math.abs(normal[1] - 1) < 1e-6);
  assert.ok(Math.abs(tangent[1]) < 1e-6, 'tangent musí být kolmý na Y');
  const tlen = Math.sqrt(tangent[0] ** 2 + tangent[1] ** 2 + tangent[2] ** 2);
  assert.ok(Math.abs(tlen - 1) < 1e-6);
});

test('computeTangentFrame: edge case — vertex na -Y ose (jih pole)', () => {
  const { tangent } = computeTangentFrame([0, -5, 0]);
  assert.ok(Math.abs(tangent[1]) < 1e-6);
});
