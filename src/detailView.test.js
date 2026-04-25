import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDetailView, STATE } from './detailView.js';

function makeMockDeps() {
  const calls = [];
  return {
    calls,
    cameraFlyTo: (toPos, toTarget, duration) => { calls.push(['fly', toPos, toTarget, duration]); },
    getCameraState: () => ({ pos: { x: 0, y: 40, z: 2000 }, target: { x: 0, y: 0, z: 0 } }),
    setPaused: (v) => { calls.push(['paused', v]); },
    fadeOthers: (focusId, alpha) => { calls.push(['fade', focusId, alpha]); },
    showPanel: (id, opts) => { calls.push(['panel', id, opts]); },
    hidePanel: () => { calls.push(['hidePanel']); },
    enableOrbit: (enabled, target) => { calls.push(['orbit', enabled, target]); },
    getBodyPosition: (id) => ({ x: 100, y: 0, z: 0 }),
    getBodyRadius: (id) => 10,
    getBodyKind: (id) => (id === 'jupiter' ? 'planet' : 'moon'),
  };
}

test('initial state = MAIN', () => {
  const deps = makeMockDeps();
  const dv = createDetailView(deps);
  assert.equal(dv.state(), STATE.MAIN);
});

test('enter() transition MAIN → TRANSITION_IN → DETAIL', () => {
  const deps = makeMockDeps();
  const dv = createDetailView(deps);
  dv.enter('jupiter');
  assert.equal(dv.state(), STATE.TRANSITION_IN);
  dv.tick(0.9);
  assert.equal(dv.state(), STATE.DETAIL);
});

test('exit() transition DETAIL → TRANSITION_OUT → MAIN', () => {
  const deps = makeMockDeps();
  const dv = createDetailView(deps);
  dv.enter('jupiter');
  dv.tick(0.9);
  dv.exit();
  assert.equal(dv.state(), STATE.TRANSITION_OUT);
  dv.tick(0.9);
  assert.equal(dv.state(), STATE.MAIN);
});

test('enter(newId) v DETAIL → přepne fokus bez průchodu MAIN', () => {
  const deps = makeMockDeps();
  const dv = createDetailView(deps);
  dv.enter('jupiter');
  dv.tick(0.9);
  dv.enter('io');
  assert.equal(dv.state(), STATE.TRANSITION_IN);
  assert.equal(dv.focusId(), 'io');
});

test('enter() ignorován během TRANSITION_IN', () => {
  const deps = makeMockDeps();
  const dv = createDetailView(deps);
  dv.enter('jupiter');
  dv.enter('saturn');
  assert.equal(dv.focusId(), 'jupiter');
});

test('panel se zobrazí až po TRANSITION_IN dokončí', () => {
  const deps = makeMockDeps();
  const dv = createDetailView(deps);
  dv.enter('jupiter');
  const panelCallsDuringTransition = deps.calls.filter((c) => c[0] === 'panel').length;
  assert.equal(panelCallsDuringTransition, 0);
  dv.tick(0.9);
  const panelCallsAfter = deps.calls.filter((c) => c[0] === 'panel').length;
  assert.equal(panelCallsAfter, 1);
});

test('showPanel je voláno s id po vstupu do detailu', () => {
  const deps = makeMockDeps();
  const dv = createDetailView(deps);
  dv.enter('earth');
  dv.tick(0.9);
  const panelCall = deps.calls.find((c) => c[0] === 'panel');
  assert.equal(panelCall[1], 'earth');
});
