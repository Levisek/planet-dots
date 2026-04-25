import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleRingColor } from './saturnRingMath.js';

test('sampleRingColor: t=0 vrátí první pixel (inner)', () => {
  const imageData = {
    data: new Uint8ClampedArray([
      255, 0, 0, 255,   // pixel 0 — red
      0, 255, 0, 128,   // pixel 1 — green half-alpha
      0, 0, 255, 0,     // pixel 2 — blue transparent
      128, 128, 128, 255, // pixel 3 — gray
    ]),
    width: 4,
    height: 1,
  };
  const [r, g, b, a] = sampleRingColor(imageData, 0);
  assert.ok(Math.abs(r - 1) < 0.01);
  assert.ok(Math.abs(g) < 0.01);
  assert.ok(Math.abs(b) < 0.01);
  assert.ok(Math.abs(a - 1) < 0.01);
});

test('sampleRingColor: t=1 vrátí poslední pixel (outer)', () => {
  const imageData = {
    data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]),
    width: 2,
    height: 1,
  };
  const [r0] = sampleRingColor(imageData, 0);
  const [r1] = sampleRingColor(imageData, 1);
  assert.ok(r0 > r1, `inner red ${r0} > outer red ${r1}`);
});

test('sampleRingColor: alpha průchozí (částečně průhledné)', () => {
  const imageData = {
    data: new Uint8ClampedArray([255, 255, 255, 64]),
    width: 1,
    height: 1,
  };
  const [, , , a] = sampleRingColor(imageData, 0);
  assert.ok(a < 0.3 && a > 0.2, `alpha=${a} ≈ 0.25`);
});
