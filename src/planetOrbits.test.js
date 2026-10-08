import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auToDisplayRadius, orbitalPosition, updatePlanetOrbits } from './planetOrbits.js';
import { setMode, MODES } from './simMode.js';

test('auToDisplayRadius: Mercury (0.39 AU) → ~1076', () => {
  const r = auToDisplayRadius(0.39);
  assert.ok(Math.abs(r - 1076) < 5, `r=${r}`);
});

test('auToDisplayRadius: vnitřní planety mají od sebe odstup (čitelné dráhy)', () => {
  const r = [0.39, 0.72, 1.0, 1.52].map(auToDisplayRadius);
  for (let i = 1; i < r.length; i++) assert.ok(r[i] - r[i - 1] >= 120, `r=${r}`);
});

test('auToDisplayRadius: perihel Merkuru neleze do Slunce (r = 400)', () => {
  assert.ok(auToDisplayRadius(0.307) >= 800);
});

test('auToDisplayRadius: Earth (1.0) → 1500', () => {
  assert.equal(auToDisplayRadius(1.0), 1500);
});

test('auToDisplayRadius: Neptune (30.05) → ~3030', () => {
  const r = auToDisplayRadius(30.05);
  assert.ok(Math.abs(r - 3030) < 5);
});

const D = new Date('2005-03-21T00:00:00Z');

test('orbitalPosition: Sun → vždy origin', () => {
  const p = orbitalPosition({ id: 'sun' }, D);
  assert.equal(p.x, 0);
  assert.equal(p.y, 0);
  assert.equal(p.z, 0);
});

test('orbitalPosition earth: Fyzikální ≫ Pochopení (poloměr)', () => {
  setMode(MODES.FYZIKALNI);
  const f = orbitalPosition({ id: 'earth' }, D);
  setMode(MODES.POCHOPENI);
  const p = orbitalPosition({ id: 'earth' }, D);
  const rf = Math.hypot(f.x, f.y, f.z), rp = Math.hypot(p.x, p.y, p.z);
  assert.ok(rf > rp, `rf=${rf} rp=${rp}`);
});

test('směr stejný v obou módech (normalizované vektory ~rovné)', () => {
  setMode(MODES.FYZIKALNI);
  const f = orbitalPosition({ id: 'mars' }, D);
  setMode(MODES.POCHOPENI);
  const p = orbitalPosition({ id: 'mars' }, D);
  const nf = norm(f), np = norm(p);
  assert.ok(dot(nf, np) > 0.999, `dot=${dot(nf, np)}`);
});

test('updatePlanetOrbits: nastaví anchor position podle orbitalPosition', () => {
  setMode(MODES.POCHOPENI);
  const anchors = { earth: { position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } } } };
  const planets = [{ id: 'earth' }];
  updatePlanetOrbits(anchors, planets, D);
  const expected = orbitalPosition({ id: 'earth' }, D);
  assert.equal(anchors.earth.position.x, expected.x);
  assert.equal(anchors.earth.position.y, expected.y);
  assert.equal(anchors.earth.position.z, expected.z);
});

function norm(v) { const r = Math.hypot(v.x, v.y, v.z); return { x: v.x / r, y: v.y / r, z: v.z / r }; }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
