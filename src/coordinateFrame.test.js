import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eclToScene, sceneToEcl } from './coordinateFrame.js';

test('eclToScene mapuje ekliptický sever (+z) na scene up (+y)', () => {
  const s = eclToScene({ x: 0, y: 0, z: 1 });
  assert.ok(Math.abs(s.y - 1) < 1e-12 && Math.abs(s.x) < 1e-12 && Math.abs(s.z) < 1e-12);
});

test('eclToScene je proper rotace (zachová délku)', () => {
  const p = { x: 0.3, y: -0.7, z: 0.2 };
  const s = eclToScene(p);
  const l1 = Math.hypot(p.x, p.y, p.z), l2 = Math.hypot(s.x, s.y, s.z);
  assert.ok(Math.abs(l1 - l2) < 1e-12);
});

test('sceneToEcl je inverzní k eclToScene', () => {
  const p = { x: 0.3, y: -0.7, z: 0.2 };
  const back = sceneToEcl(eclToScene(p));
  assert.ok(Math.abs(back.x - p.x) < 1e-12);
  assert.ok(Math.abs(back.y - p.y) < 1e-12);
  assert.ok(Math.abs(back.z - p.z) < 1e-12);
});
