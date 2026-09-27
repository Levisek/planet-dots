import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCameraRig } from './cameraRig.js';

function makeRig(bodyPositions) {
  const camera = new THREE.PerspectiveCamera();
  // enabled: true jako v aplikaci (main.js drží OrbitControls zapnuté v MAIN i DETAIL).
  const controls = { enabled: true, target: new THREE.Vector3() };
  const controlsTarget = { x: 0, y: 0, z: 0 };
  const getBodyPos = (id) => ({ ...bodyPositions[id] });
  const rig = createCameraRig({ camera, controls, controlsTarget, getBodyPos });
  return { rig, camera, controls, controlsTarget, bodyPositions };
}

test('flyTo bez followId doletí přesně na toPos/toTarget', () => {
  const { rig, camera, controlsTarget } = makeRig({});
  camera.position.set(0, 0, 0);
  rig.flyTo({ x: 10, y: 20, z: 30 }, { x: 1, y: 2, z: 3 }, 1.0);
  rig.update(1.0, false); // celý duration najednou → sample(t>=duration) = konec (clamp)
  assert.equal(camera.position.x, 10);
  assert.equal(camera.position.y, 20);
  assert.equal(camera.position.z, 30);
  assert.deepEqual(controlsTarget, { x: 1, y: 2, z: 3 });
});

test('flyTo s followId: přílet kompenzuje drift tělesa — cíl skončí na NOVÉ poloze tělesa', () => {
  const bodyPositions = { earth: { x: 100, y: 0, z: 0 } };
  const { rig, controlsTarget, camera } = makeRig(bodyPositions);
  camera.position.set(0, 0, 0);
  // toTarget = startovní poloha tělesa (100,0,0) — typický use-case (kamera
  // míří na těleso, kolem kterého kroužila). Těleso se mezitím posune.
  rig.flyTo({ x: 0, y: 0, z: 500 }, { x: 100, y: 0, z: 0 }, 1.0, 'earth');
  bodyPositions.earth = { x: 150, y: 10, z: -5 }; // drift během tweenu
  rig.update(1.0, false); // t>=duration → e=1 → plná kompenzace driftu
  assert.deepEqual(controlsTarget, { x: 150, y: 10, z: -5 });
});

test('po dokončení tweenu s followId kamera+target sledují těleso (inDetail)', () => {
  const bodyPositions = { earth: { x: 100, y: 0, z: 0 } };
  const { rig, controlsTarget, camera, controls } = makeRig(bodyPositions);
  camera.position.set(0, 0, 0);
  rig.flyTo({ x: 0, y: 0, z: 500 }, { x: 100, y: 0, z: 0 }, 1.0, 'earth');
  rig.update(1.0, false); // dokončí tween → nastaví _follow
  const posAfterArrival = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
  const targetAfterArrival = { ...controlsTarget };
  // Těleso poletí dál — bez inDetail se follow neuplatní.
  bodyPositions.earth = { x: 120, y: 0, z: 0 };
  rig.update(0.1, false);
  assert.deepEqual({ x: camera.position.x, y: camera.position.y, z: camera.position.z }, posAfterArrival, 'mimo detail se kamera nehýbe');
  assert.deepEqual(controlsTarget, targetAfterArrival);
  // V detailu se kamera i target posunou o delta oproti POSLEDNÍ zaznamenané
  // poloze tělesa — tou je stav při dokončení tweenu (100,0,0), protože
  // predchozí update (inDetail=false) follow vůbec nevyhodnotil, takže
  // _follow.last se neposunul na 120.
  bodyPositions.earth = { x: 140, y: 5, z: -2 };
  rig.update(0.1, true);
  assert.equal(camera.position.x, posAfterArrival.x + (140 - 100));
  assert.equal(camera.position.y, posAfterArrival.y + (5 - 0));
  assert.equal(camera.position.z, posAfterArrival.z + (-2 - 0));
  assert.equal(controlsTarget.x, targetAfterArrival.x + (140 - 100));
  assert.equal(controls.target.x, controlsTarget.x);
});

test('cancelUnfollowedTween zruší jen tween bez followId', () => {
  const bodyPositions = { earth: { x: 100, y: 0, z: 0 } };
  const { rig, camera, controlsTarget } = makeRig(bodyPositions);
  camera.position.set(0, 0, 0);

  // Tween BEZ followId — cancel ho zruší, update pak nedělá nic.
  rig.flyTo({ x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1.0);
  rig.cancelUnfollowedTween();
  rig.update(1.0, false);
  assert.deepEqual({ x: camera.position.x, y: camera.position.y, z: camera.position.z }, { x: 0, y: 0, z: 0 }, 'zrušený tween nehýbe kamerou');

  // Tween S followId — cancelUnfollowedTween ho nesmí zrušit.
  rig.flyTo({ x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1.0, 'earth');
  rig.cancelUnfollowedTween();
  rig.update(1.0, false);
  // Těleso se nehnulo → žádný drift ke kompenzaci, tween doletí na toPos/toTarget.
  assert.equal(camera.position.x, 10, 'follow tween doletí normálně');
  assert.deepEqual(controlsTarget, { x: 0, y: 0, z: 0 });
});

test('dlouhý přelet cestou oddálí kameru a flyTo vrací délku letu', () => {
  const bodyPositions = { neptune: { x: 3000, y: 0, z: 0 } };
  const { rig, camera, controlsTarget } = makeRig(bodyPositions);
  camera.position.set(0, 10, 50); // kamera u Země v počátku, 50 od cíle
  const d = rig.flyTo({ x: 3000, y: 20, z: 200 }, { x: 3000, y: 0, z: 0 }, null, 'neptune');
  assert.ok(d > 1 && d <= 4, `délka letu ${d}`);
  let maxDist = 0;
  for (let i = 0; i < 40; i++) {
    rig.update(d / 40, false);
    const dist = Math.hypot(camera.position.x - controlsTarget.x, camera.position.y - controlsTarget.y, camera.position.z - controlsTarget.z);
    maxDist = Math.max(maxDist, dist);
  }
  assert.ok(maxDist > 1000, `cestou má být vidět víc soustavy (max ${maxDist.toFixed(0)})`);
  assert.deepEqual(controlsTarget, { x: 3000, y: 0, z: 0 });
});

test('isFlying je true jen během letu', () => {
  const { rig, camera } = makeRig({});
  camera.position.set(0, 0, 100);
  assert.equal(rig.isFlying(), false);
  const d = rig.flyTo({ x: 10, y: 0, z: 10 }, { x: 10, y: 0, z: 0 });
  assert.equal(rig.isFlying(), true);
  rig.update(d, false);
  assert.equal(rig.isFlying(), false);
});

test('stopHere: let skončí na místě a kamera dál sleduje těleso', () => {
  const bodyPositions = { earth: { x: 100, y: 0, z: 0 } };
  const { rig, camera } = makeRig(bodyPositions);
  camera.position.set(100, 0, 50);
  rig.flyTo({ x: 100, y: 50, z: 0 }, { x: 100, y: 0, z: 0 }, 2, 'earth');
  rig.update(0.5, true);
  const mid = camera.position.clone();
  rig.stopHere();
  assert.equal(rig.isFlying(), false);
  bodyPositions.earth = { x: 110, y: 0, z: 0 };
  rig.update(0.1, true);
  assert.ok(Math.abs(camera.position.x - (mid.x + 10)) < 1e-9, 'jede s tělesem, nezačne letět znovu');
  assert.ok(Math.abs(camera.position.y - mid.y) < 1e-9);
});
