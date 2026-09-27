import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vwPath, flightProgress, flightDuration, slerpDir, createFlight } from './flightPath.js';

const close = (a, b, rel = 1e-6) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));
const v = (x, y, z) => ({ x, y, z });
const len = (a) => Math.hypot(a.x, a.y, a.z);

test('vwPath: dráha začíná na (0, w0) a končí na (u1, w1) — od skoku v soustavě po Neptun ve Fyzikálním', () => {
  for (const [u1, w0, w1] of [[16, 50, 20], [1600, 50, 190], [110000, 50, 800], [1450, 10300, 50], [3, 3, 3]]) {
    const p = vwPath(u1, w0, w1);
    assert.ok(p.S > 0 && Number.isFinite(p.S), `S ${p.S}`);
    assert.ok(close(p.u(0), 0), 'u(0)');
    assert.ok(close(p.w(0), w0), 'w(0)');
    assert.ok(close(p.u(p.S), u1, 1e-5), `u(S)=${p.u(p.S)} vs ${u1}`);
    assert.ok(close(p.w(p.S), w1, 1e-5), `w(S)=${p.w(p.S)} vs ${w1}`);
  }
});

test('vwPath: dlouhý přelet se cestou oddálí (jsou vidět oba konce), krátký ne', () => {
  const long = vwPath(1600, 50, 190);
  let wMax = 0;
  for (let i = 0; i <= 100; i++) wMax = Math.max(wMax, long.w((long.S * i) / 100));
  assert.ok(wMax > 1600 * 0.5, `wMax ${wMax.toFixed(0)} — kamera musí odjet aspoň na půl vzdálenosti`);

  const short = vwPath(16, 50, 20);
  let sMax = 0;
  for (let i = 0; i <= 100; i++) sMax = Math.max(sMax, short.w((short.S * i) / 100));
  assert.ok(sMax <= 50 * 1.05, `krátký skok se nemá oddalovat (${sMax.toFixed(1)})`);
  assert.ok(short.S < long.S);
});

test('vwPath: bez posunu cíle je to čistý zoom', () => {
  const p = vwPath(0, 100, 10);
  assert.equal(p.u(p.S / 2), 0);
  assert.ok(close(p.w(p.S), 10));
  assert.ok(close(p.w(p.S / 2), Math.sqrt(1000)), 'exponenciální zoom — v půlce geometrický průměr');
});

test('flightProgress: 0 → 0, 1 → 1, monotónní, v cíli pomalejší než na startu', () => {
  assert.equal(flightProgress(0), 0);
  assert.ok(close(flightProgress(1), 1));
  let prev = -1;
  for (let i = 0; i <= 100; i++) {
    const p = flightProgress(i / 100);
    assert.ok(p > prev);
    prev = p;
  }
  const startSpeed = flightProgress(0.01) / 0.01;
  const endSpeed = (1 - flightProgress(0.99)) / 0.01;
  assert.ok(endSpeed < startSpeed, 'kamera dosedá pomaleji, než vyráží');
});

test('flightDuration: krátký skok ~0,8 s, strop drží', () => {
  assert.equal(flightDuration(0), 0.8);
  assert.ok(flightDuration(10) > 3);
  assert.equal(flightDuration(100), 4);
  assert.equal(flightDuration(100, 0.8), 0.8);
});

test('slerpDir: jednotkový vektor, konce sedí, protilehlé směry nedají NaN', () => {
  const a = v(1, 0, 0), b = v(0, 0, 1);
  assert.ok(close(slerpDir(a, b, 0).x, 1));
  assert.ok(close(slerpDir(a, b, 1).z, 1));
  assert.ok(close(len(slerpDir(a, b, 0.37)), 1));
  const m = slerpDir(v(0, 0, 1), v(0, 0, -1), 0.5);
  assert.ok(close(len(m), 1) && Number.isFinite(m.x));
});

test('createFlight: start a konec přesně, cestou kamera míří na cíl ve vzdálenosti w', () => {
  const f = createFlight({ fromPos: v(0, 5000, 9000), fromTarget: v(0, 0, 0), toPos: v(1450, 30, -50), toTarget: v(1450, 0, 0) });
  const s0 = f.sample(0);
  assert.ok(close(s0.pos.y, 5000) && close(s0.pos.z, 9000));
  assert.equal(s0.frac, 0);
  const s1 = f.sample(f.duration);
  assert.deepEqual(s1.pos, v(1450, 30, -50));
  assert.deepEqual(s1.target, v(1450, 0, 0));
  assert.equal(s1.frac, 1);
  for (let i = 1; i < 20; i++) {
    const s = f.sample((f.duration * i) / 20);
    for (const k of ['x', 'y', 'z']) assert.ok(Number.isFinite(s.pos[k]) && Number.isFinite(s.target[k]));
    assert.ok(s.frac >= 0 && s.frac <= 1);
  }
});

test('createFlight: explicitní duration má přednost, kamera v cíli nedá NaN', () => {
  const f = createFlight({ fromPos: v(0, 0, 0), fromTarget: v(0, 0, 0), toPos: v(10, 20, 30), toTarget: v(1, 2, 3), duration: 1 });
  assert.equal(f.duration, 1);
  const s = f.sample(0.5);
  for (const k of ['x', 'y', 'z']) assert.ok(Number.isFinite(s.pos[k]));
});
