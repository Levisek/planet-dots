import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { showFor, disposeAll } from './moonOrbitLines.js';
import { MOONS_BY_PARENT } from './moons.js';

function makeAnchors(ids) {
  const anchors = {};
  for (const id of ids) anchors[id] = new THREE.Object3D();
  return anchors;
}

test('showFor: neznámý planetId → prázdné pole, žádný crash', () => {
  const anchors = makeAnchors(['earth']);
  const lines = showFor('nonexistent', anchors, MOONS_BY_PARENT);
  assert.deepEqual(lines, []);
});

test('showFor: earth (ephemeris moon Luna) → 1 LineLoop, body finite, closed loop', () => {
  const anchors = makeAnchors(['earth']);
  const lines = showFor('earth', anchors, MOONS_BY_PARENT);
  assert.equal(lines.length, 1);
  const [line] = lines;
  assert.ok(line instanceof THREE.LineLoop);
  const pos = line.geometry.attributes.position;
  assert.ok(pos.count >= 2);
  for (let i = 0; i < pos.count; i++) {
    assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i)));
  }
});

test('showFor: mars (kepler moons Phobos+Deimos, mají elements) → 2 LineLoop, body finite', () => {
  const anchors = makeAnchors(['mars']);
  const lines = showFor('mars', anchors, MOONS_BY_PARENT);
  assert.equal(lines.length, 2);
  for (const line of lines) {
    const pos = line.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getZ(i)));
    }
  }
});

test('showFor: linie jsou children planet anchoru', () => {
  const anchors = makeAnchors(['earth']);
  const lines = showFor('earth', anchors, MOONS_BY_PARENT);
  assert.equal(anchors.earth.children.length, lines.length);
  assert.equal(lines[0].parent, anchors.earth);
});

test('disposeAll: odebere linie z rodiče', () => {
  const anchors = makeAnchors(['earth']);
  const lines = showFor('earth', anchors, MOONS_BY_PARENT);
  disposeAll(lines);
  assert.equal(anchors.earth.children.length, 0);
});
