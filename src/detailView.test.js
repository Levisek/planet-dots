import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDetailView, STATE } from './detailView.js';

function makeMockDeps() {
  const calls = [];
  return {
    calls,
    cameraFlyTo: (toPos, toTarget, duration) => { calls.push(['fly', toPos, toTarget, duration]); },
    getCameraState: () => ({ pos: { x: 0, y: 40, z: 2000 }, target: { x: 0, y: 0, z: 0 } }),
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

test('enter() během TRANSITION_IN přesměruje let, stejné těleso ignoruje', () => {
  const deps = makeMockDeps();
  const dv = createDetailView(deps);
  dv.enter('jupiter');
  const flies = () => deps.calls.filter((c) => c[0] === 'fly').length;
  dv.enter('jupiter');
  assert.equal(flies(), 1, 'stejné těleso — žádný nový let');
  dv.enter('saturn');
  assert.equal(dv.focusId(), 'saturn');
  assert.equal(dv.state(), STATE.TRANSITION_IN);
  assert.equal(flies(), 2);
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

test('setReturnPose: exit letí na nově nastavenou pozici', async () => {
  const { createDetailView } = await import('./detailView.js');
  const calls = [];
  const dv = createDetailView({
    cameraFlyTo: (p, t, d, f) => { calls.push(['fly', p, t, d, f]); },
    getCameraState: () => ({ pos: { x: 0, y: 5000, z: 9000 }, target: { x: 0, y: 0, z: 0 } }),
    fadeOthers: () => {}, showPanel: () => {}, hidePanel: () => {},
    enableOrbit: () => {}, getBodyPosition: () => ({ x: 100, y: 0, z: 0 }), getBodyRadius: () => 5,
  });
  dv.enter('mars');
  dv.tick(1);
  dv.setReturnPose({ x: 0, y: 90000, z: 160000 }, { x: 0, y: 0, z: 0 });
  dv.exit();
  const last = calls[calls.length - 1];
  assert.deepEqual(last[1], { x: 0, y: 90000, z: 160000 });
  assert.equal(last[4] ?? null, null, 'návrat do MAIN není relativní k tělesu');
});

test('délka přechodu se řídí délkou letu, kterou vrátí cameraFlyTo', async () => {
  const { createDetailView, STATE } = await import('./detailView.js');
  const dv = createDetailView({
    cameraFlyTo: () => 2.5,
    getCameraState: () => ({ pos: { x: 0, y: 5000, z: 9000 }, target: { x: 0, y: 0, z: 0 } }),
    fadeOthers: () => {}, showPanel: () => {}, hidePanel: () => {},
    enableOrbit: () => {}, getBodyPosition: () => ({ x: 100, y: 0, z: 0 }), getBodyRadius: () => 5,
  });
  dv.enter('mars');
  dv.tick(2.4);
  assert.equal(dv.state(), STATE.TRANSITION_IN, 'let ještě běží');
  dv.tick(0.2);
  assert.equal(dv.state(), STATE.DETAIL);
});

test('přelet startuje z aktuálního cíle: cameraFlyTo před enableOrbit(false) (re-focus i návrat)', async () => {
  const { createDetailView } = await import('./detailView.js');
  const order = [];
  const dv = createDetailView({
    cameraFlyTo: () => { order.push('fly'); },
    getCameraState: () => ({ pos: { x: 0, y: 5000, z: 9000 }, target: { x: 0, y: 0, z: 0 } }),
    fadeOthers: () => {}, showPanel: () => {}, hidePanel: () => {},
    enableOrbit: (on) => { order.push(on ? 'orbit-on' : 'orbit-off'); },
    getBodyPosition: () => ({ x: 100, y: 0, z: 0 }), getBodyRadius: () => 5,
  });
  dv.enter('mars');
  dv.tick(1);
  order.length = 0;
  dv.enter('earth');
  assert.deepEqual(order, ['fly', 'orbit-off']);
  dv.tick(1);
  order.length = 0;
  dv.exit();
  assert.deepEqual(order, ['fly', 'orbit-off']);
});
