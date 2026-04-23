import { test } from 'node:test';
import assert from 'node:assert/strict';
import { samplePoints } from './label.js';

// Pure helper samplePoints bere mock ImageData-like objekt a vrací pozice.
test('samplePoints vybere alpha>threshold pixely', () => {
  const w = 6, h = 4;
  // Řádek 2, pixely 1..3 mají alpha 255.
  const data = new Uint8ClampedArray(w * h * 4);
  for (let x = 1; x <= 3; x++) {
    const idx = (2 * w + x) * 4 + 3;
    data[idx] = 255;
  }
  const points = samplePoints({ data, width: w, height: h }, { step: 1, alphaThreshold: 128 });
  assert.equal(points.length, 3);
  // y osa invertovaná (screen y roste dolů, scene y roste nahoru)
  for (const [x, y] of points) {
    assert.ok(x >= 1 - w/2 && x <= 3 - w/2);
    assert.equal(y, -(2 - h/2));
  }
});

test('samplePoints respektuje step', () => {
  const w = 10, h = 10;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 3; i < w * h * 4; i += 4) data[i] = 255; // všechny pixely
  const dense = samplePoints({ data, width: w, height: h }, { step: 1, alphaThreshold: 128 });
  const sparse = samplePoints({ data, width: w, height: h }, { step: 2, alphaThreshold: 128 });
  assert.equal(dense.length, w * h);
  assert.equal(sparse.length, Math.ceil(w / 2) * Math.ceil(h / 2));
});
