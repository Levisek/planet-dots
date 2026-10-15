import { test } from 'node:test';
import assert from 'node:assert/strict';
import { averageFaceColor, downsample4 } from './bodyMesh.js';
import { srgbToLinear } from './textureUtils.js';

// Textura 8×4: levá polovina černá, pravá bílá.
function halfTexture() {
  const width = 8, height = 4, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = x < width / 2 ? 0 : 255;
    data[i + 3] = 255;
  }
  return { data, width, height };
}

test('averageFaceColor: jednolitá plocha → její barva', () => {
  const tex = halfTexture();
  // trojúhelník u u≈0.75 (bílá polovina): atan2(z, x) ≈ +π/2 → z > 0
  const c = averageFaceColor(tex, [0.1, 0.1, 1], [-0.1, 0.1, 1], [0, -0.1, 1]);
  for (const ch of c) assert.ok(Math.abs(ch - 1) < 1e-9);
});

test('averageFaceColor: trojúhelník přes hranici barev → průměr, ne jeden pixel', () => {
  const tex = halfTexture();
  // hranice černá/bílá je u u = 0.5 → atan2(z, x) = 0 → směr +x
  const [r] = averageFaceColor(tex, [1, 0.2, -0.2], [1, 0.2, 0.2], [1, -0.2, 0]);
  assert.ok(r > 0.2 && r < 0.8, `r=${r}`);
  assert.ok(r !== srgbToLinear(0) && r !== srgbToLinear(1));
});

test('downsample4: průměr bloků 4×4', () => {
  const width = 8, height = 4, data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data[i * 4] = (i % width) < 2 ? 160 : 0;
  const s = downsample4({ data, width, height });
  assert.equal(s.width, 2); assert.equal(s.height, 1);
  assert.equal(s.data[0], 80);
  assert.equal(s.data[4], 0);
});
