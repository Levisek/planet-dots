import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { framingShift, viewOffsetParams, createViewFraming } from './viewFraming.js';

test('framingShift: bez panelu žádný posun', () => {
  assert.deepEqual(framingShift({ vw: 390, vh: 780, panel: null }), { dx: 0, dy: 0 });
});

test('framingShift: telefon — těleso doprostřed mezi horní lištu a panel', () => {
  // panel přes šířku od y=520, horní lišta končí na 80
  const s = framingShift({ vw: 390, vh: 780, panel: { left: 12, top: 520, width: 366, height: 156 }, topInset: 80 });
  assert.equal(s.dx, 0);
  assert.equal(s.dy, 80 + 220 - 390); // střed volna (300) − střed displeje (390)
});

test('framingShift: rozbalený panel přes skoro celý displej → neposouvat', () => {
  const s = framingShift({ vw: 390, vh: 780, panel: { left: 12, top: 120, width: 366, height: 560 }, topInset: 80 });
  assert.deepEqual(s, { dx: 0, dy: 0 });
});

test('framingShift: počítač — doleva mezi seznam těles a panel vpravo', () => {
  const s = framingShift({ vw: 1200, vh: 750, panel: { left: 780, top: 290, width: 400, height: 400 }, leftInset: 135 });
  assert.equal(s.dy, 0);
  assert.equal(s.dx, Math.round(135 + (780 - 135) / 2 - 600));
  assert.ok(s.dx < 0);
});

test('viewOffsetParams: střed virtuálního snímku padne na obrazovce na (w/2+dx, h/2+dy)', () => {
  for (const [dx, dy] of [[0, -90], [-142, 0], [30, 40]]) {
    const p = viewOffsetParams(390, 780, dx, dy);
    assert.equal(p.fullW / 2 - p.x, 390 / 2 + dx);
    assert.equal(p.fullH / 2 - p.y, 780 / 2 + dy);
    assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= p.fullW && p.y + p.h <= p.fullH);
    assert.equal(p.aspect, p.fullW / p.fullH);
  }
});

test('createViewFraming: bod v cíli pohledu se promítne posunutý o dy, po zrušení zpět doprostřed', () => {
  const camera = new THREE.PerspectiveCamera(45, 390 / 780, 1, 1000);
  camera.position.set(0, 0, 100);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const f = createViewFraming({ camera, getSize: () => ({ w: 390, h: 780 }) });
  f.setShift({ dx: 0, dy: -90 });
  for (let i = 0; i < 60; i++) f.update(0.05);
  const p = new THREE.Vector3(0, 0, 0).project(camera);
  const screenY = (1 - p.y) / 2 * 780;
  assert.ok(Math.abs(screenY - (390 - 90)) < 0.5, `y ${screenY}`);
  f.setShift({ dx: 0, dy: 0 });
  for (let i = 0; i < 60; i++) f.update(0.05);
  assert.equal(camera.view === null || camera.view.enabled === false, true);
  assert.ok(Math.abs(camera.aspect - 0.5) < 1e-12);
});
