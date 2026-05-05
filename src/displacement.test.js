import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySimplexDisplacement, makeSeededSimplex } from './displacement.js';

test('seeded simplex je deterministic', () => {
  const noise1 = makeSeededSimplex('hyperion');
  const noise2 = makeSeededSimplex('hyperion');
  assert.equal(noise1(0.5, 0.5, 0.5), noise2(0.5, 0.5, 0.5));
});

test('different seeds produkují different output', () => {
  const noise1 = makeSeededSimplex('seed1');
  const noise2 = makeSeededSimplex('seed2');
  assert.notEqual(noise1(0.5, 0.5, 0.5), noise2(0.5, 0.5, 0.5));
});

test('applySimplexDisplacement modifikuje vertices in-place', () => {
  // Mock geometry (jen array s position attribute)
  const positions = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const normals = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const geometry = {
    attributes: {
      position: {
        count: 3,
        getX: (i) => positions[i*3],
        getY: (i) => positions[i*3+1],
        getZ: (i) => positions[i*3+2],
        setX: (i, v) => { positions[i*3] = v; },
        setY: (i, v) => { positions[i*3+1] = v; },
        setZ: (i, v) => { positions[i*3+2] = v; },
        needsUpdate: false,
      },
      normal: {
        getX: (i) => normals[i*3],
        getY: (i) => normals[i*3+1],
        getZ: (i) => normals[i*3+2],
      },
    },
    computeVertexNormals: () => {},
  };
  const before = positions.slice();
  applySimplexDisplacement(geometry, { amplitude: 0.1, seed: 'test' });
  // Aspoň jeden vertex se změnil
  let changed = false;
  for (let i = 0; i < positions.length; i++) {
    if (Math.abs(positions[i] - before[i]) > 1e-10) { changed = true; break; }
  }
  assert.ok(changed);
});
