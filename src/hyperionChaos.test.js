import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tickHyperion, resetHyperion } from './hyperionChaos.js';

test('tickHyperion deterministic pro stejný simElapsed', () => {
  resetHyperion();
  const mockMesh1 = { rotation: { set: function(x,y,z) { this.x=x; this.y=y; this.z=z; } } };
  for (let t = 0; t <= 1.0; t += 0.05) tickHyperion(t, mockMesh1);
  const final1 = { x: mockMesh1.rotation.x, y: mockMesh1.rotation.y, z: mockMesh1.rotation.z };

  resetHyperion();
  const mockMesh2 = { rotation: { set: function(x,y,z) { this.x=x; this.y=y; this.z=z; } } };
  for (let t = 0; t <= 1.0; t += 0.05) tickHyperion(t, mockMesh2);
  const final2 = { x: mockMesh2.rotation.x, y: mockMesh2.rotation.y, z: mockMesh2.rotation.z };

  assert.equal(final1.x, final2.x);
  assert.equal(final1.y, final2.y);
  assert.equal(final1.z, final2.z);
});

test('tickHyperion freeze on reverse playback (negativní dt)', () => {
  resetHyperion();
  const mesh = { rotation: { set: function(x,y,z) { this.x=x; this.y=y; this.z=z; } } };
  tickHyperion(1.0, mesh);
  const before = { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z };
  tickHyperion(0.5, mesh); // negative dt = reverse
  // State zamrzne, rotation se nezmění
  assert.equal(mesh.rotation.x, before.x);
  assert.equal(mesh.rotation.y, before.y);
  assert.equal(mesh.rotation.z, before.z);
});

test('tickHyperion no NaN přes 1000 frames', () => {
  resetHyperion();
  const mesh = { rotation: { set: function(x,y,z) { this.x=x; this.y=y; this.z=z; } } };
  for (let i = 0; i < 1000; i++) {
    tickHyperion(i * 0.05, mesh);
    assert.ok(!isNaN(mesh.rotation.x));
    assert.ok(!isNaN(mesh.rotation.y));
    assert.ok(!isNaN(mesh.rotation.z));
  }
});
