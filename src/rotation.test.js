import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { rotateAnchors, rotationDaysPerSec, ROTATION_MAX_DAYS_PER_SEC } from './rotation.js';

test('pauza zastaví rotaci, formace se točí i se stojícími hodinami', () => {
  assert.equal(rotationDaysPerSec({ formation: false, playing: false, simDaysPerSec: 36.5 }), 0);
  assert.equal(rotationDaysPerSec({ formation: true, playing: false, simDaysPerSec: 0 }), ROTATION_MAX_DAYS_PER_SEC);
});

test('rychlá simulace narazí na strop, pomalá drží reálné tempo, reverz otočí směr', () => {
  assert.equal(rotationDaysPerSec({ formation: false, playing: true, simDaysPerSec: 36.5 }), ROTATION_MAX_DAYS_PER_SEC);
  assert.equal(rotationDaysPerSec({ formation: false, playing: true, simDaysPerSec: 0.04 }), 0.04);
  assert.equal(rotationDaysPerSec({ formation: false, playing: true, simDaysPerSec: -36.5 }), -ROTATION_MAX_DAYS_PER_SEC);
});

test('Země na stropu = jedna otáčka za 10 s; Venuše opačně', () => {
  const earth = new THREE.Object3D();
  const venus = new THREE.Object3D();
  for (let i = 0; i < 100; i++) rotateAnchors({ earth, venus }, 0.1, ROTATION_MAX_DAYS_PER_SEC);
  // Po 10 s plná otáčka → zpět na výchozí orientaci.
  assert.ok(earth.quaternion.angleTo(new THREE.Quaternion()) < 1e-6);
  const v = new THREE.Object3D();
  rotateAnchors({ venus: v }, 1, 1);
  const axis = new THREE.Vector3(0, 1, 0);
  const expected = new THREE.Quaternion().setFromAxisAngle(axis, -(2 * Math.PI) / 243);
  assert.ok(v.quaternion.angleTo(expected) < 1e-6); // opačný směr by dal 0,05 rad
});
