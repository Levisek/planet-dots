import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sphericalUV } from './textureUtils.js';

test('sphericalUV: východ vpravo při pohledu zvenku (ne zrcadlově)', () => {
  // Pohled z +x na bod (1,0,0): pravá ruka diváka míří k −z.
  const [u0] = sphericalUV(1, 0, 0, 1);
  const [uRight] = sphericalUV(Math.cos(0.1), 0, -Math.sin(0.1), 1);
  assert.equal(u0, 0.5);
  assert.ok(uRight > u0, 'vpravo = větší u = víc na východ');
  const [, vTop] = sphericalUV(0, 1, 0, 1);
  assert.equal(vTop, 1);
});
