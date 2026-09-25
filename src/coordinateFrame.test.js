import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eclToScene, sceneToEcl, poleToScene } from './coordinateFrame.js';

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

test('poleToScene: pól Země svírá s eklipt. severem 23.44°', () => {
  const p = poleToScene(0, 90);
  const deg = (Math.acos(p.y) * 180) / Math.PI;
  assert.ok(Math.abs(deg - 23.44) < 0.01, `sklon ${deg}`);
  assert.ok(Math.abs(Math.hypot(p.x, p.y, p.z) - 1) < 1e-12);
});

test('poleToScene: Saturnův rovník = rovina drah jeho měsíců (normála Titanu)', () => {
  const p = poleToScene(40.589, 83.537);
  // Normála dráhy s inc/Ω vůči ekliptice J2000 (Titan z JPL elementů).
  const inc = (27.71834 * Math.PI) / 180, node = (169.23916 * Math.PI) / 180;
  const n = eclToScene({ x: Math.sin(inc) * Math.sin(node), y: -Math.sin(inc) * Math.cos(node), z: Math.cos(inc) });
  const angle = (Math.acos(p.x * n.x + p.y * n.y + p.z * n.z) * 180) / Math.PI;
  assert.ok(angle < 1.5, `odchylka ${angle}°`);
});
