import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTween, easeInOutCubic } from './cameraTween.js';

test('easeInOutCubic: t=0 → 0, t=1 → 1, t=0.5 → 0.5', () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.equal(easeInOutCubic(0.5), 0.5);
});

test('easeInOutCubic: monotonní (rostoucí) v [0,1]', () => {
  let prev = easeInOutCubic(0);
  for (let i = 1; i <= 20; i++) {
    const cur = easeInOutCubic(i / 20);
    assert.ok(cur >= prev, `i=${i}: ${cur} < ${prev}`);
    prev = cur;
  }
});

test('createTween: začíná ve fromPos, končí v toPos', () => {
  const tween = createTween({
    fromPos: { x: 0, y: 0, z: 0 },
    fromTarget: { x: 0, y: 0, z: 0 },
    toPos: { x: 10, y: 5, z: 2 },
    toTarget: { x: 1, y: 2, z: 3 },
    duration: 1.0,
  });
  const s0 = tween.sample(0);
  assert.deepEqual(s0.pos, { x: 0, y: 0, z: 0 });
  assert.deepEqual(s0.target, { x: 0, y: 0, z: 0 });
  const s1 = tween.sample(1.0);
  assert.deepEqual(s1.pos, { x: 10, y: 5, z: 2 });
  assert.deepEqual(s1.target, { x: 1, y: 2, z: 3 });
});

test('createTween: sample(t > duration) = end hodnota (clamp)', () => {
  const tween = createTween({
    fromPos: { x: 0, y: 0, z: 0 },
    fromTarget: { x: 0, y: 0, z: 0 },
    toPos: { x: 100, y: 0, z: 0 },
    toTarget: { x: 0, y: 0, z: 0 },
    duration: 0.5,
  });
  assert.equal(tween.sample(10).pos.x, 100);
  assert.equal(tween.isComplete(10), true);
});

test('createTween: isComplete je false pro t < duration', () => {
  const tween = createTween({
    fromPos: { x: 0, y: 0, z: 0 },
    fromTarget: { x: 0, y: 0, z: 0 },
    toPos: { x: 1, y: 0, z: 0 },
    toTarget: { x: 0, y: 0, z: 0 },
    duration: 1.0,
  });
  assert.equal(tween.isComplete(0.5), false);
  assert.equal(tween.isComplete(1.0), true);
});
