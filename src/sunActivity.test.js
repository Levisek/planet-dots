import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSunActivity, parabolicArcPos } from './sunActivity.js';

function makeMockPool(count) {
  return {
    count,
    owner: new Int16Array(count).fill(-1),
    color: new Float32Array(count * 3).fill(1),
    alpha: new Float32Array(count),
    phase: new Uint8Array(count),
    position: new Float32Array(count * 3),
    localOffset: new Float32Array(count * 3),
    colorAttr: { needsUpdate: false },
  };
}

// Non-indexed icosphere-like mesh stub: faces rozprostřené po sféře,
// 3 vrcholy per face (stejně jako buildBodyMesh), barvy bílé.
function makeSunMesh(faces = 4000, radius = 1) {
  const pos = new Float32Array(faces * 9);
  const col = new Float32Array(faces * 9).fill(1);
  for (let f = 0; f < faces; f++) {
    const u = ((f + 0.5) / faces) * 2 - 1;
    const phi = f * 2.399963;
    const r = Math.sqrt(1 - u * u);
    for (let k = 0; k < 3; k++) {
      pos[9 * f + 3 * k] = r * Math.cos(phi) * radius;
      pos[9 * f + 3 * k + 1] = u * radius;
      pos[9 * f + 3 * k + 2] = r * Math.sin(phi) * radius;
    }
  }
  const attr = (array) => ({
    array, count: array.length / 3, needsUpdate: false,
    getX: (i) => array[3 * i], getY: (i) => array[3 * i + 1], getZ: (i) => array[3 * i + 2],
  });
  return { geometry: { attributes: { position: attr(pos), color: attr(col) } } };
}

test('spawnSunspot ztmaví malou skupinu trojúhelníků meshe v pásu ±30°', () => {
  const sunMesh = makeSunMesh();
  const act = createSunActivity({ sunOwner: 0, sunRadius: 1, seed: 7, sunMesh });
  const spot = act._spawnSunspot(0);
  assert.ok(spot, 'spot vznikl');
  assert.ok(spot.faces.length >= 1 && spot.faces.length < 200, `faces = ${spot.faces.length}`);
  const pos = sunMesh.geometry.attributes.position.array;
  for (const f of spot.faces) {
    const y = pos[9 * f + 1];
    assert.ok(Math.abs(y) < 0.6, `face mimo pás šířek (y=${y})`);
  }
});

test('update: skvrna mesh ztmaví a po zániku vrátí původní barvy', () => {
  const sunMesh = makeSunMesh();
  const pool = makeMockPool(200);
  const act = createSunActivity({ sunOwner: 0, sunRadius: 1, seed: 42, sunMesh });
  const col = sunMesh.geometry.attributes.color.array;
  act.update(pool, 0, 0.016, { intensity: 'low' }); // spawn v t=0
  act.update(pool, 10, 1, { intensity: 'low' });    // stabilní fáze
  assert.ok(Math.min(...col) < 0.5, 'skvrna ztmavila mesh');
  // t=32: první skvrna zanikla (lifetime 31 s); nová z t=18 je v t=32 ještě
  // na plné síle — zkontroluj jen trojúhelníky té první.
  const first = act._activeSpots()[0];
  act.update(pool, 18, 1, { intensity: 'low' });
  act.update(pool, 32, 1, { intensity: 'low' });
  assert.ok(!act._activeSpots().includes(first), 'první skvrna zanikla');
  const second = act._activeSpots()[0];
  const secondFaces = new Set(second ? second.faces : []);
  for (const f of first.faces) {
    if (secondFaces.has(f)) continue;
    assert.equal(col[9 * f], 1, `face ${f} nevrátil původní barvu`);
  }
});

test('bez sunMesh update nespadne a skvrny nevznikají', () => {
  const pool = makeMockPool(200);
  const act = createSunActivity({ sunOwner: 0, sunRadius: 1, seed: 3 });
  for (let t = 0; t < 40; t += 1) act.update(pool, t, 1, { intensity: 'high' });
  assert.equal(act._activeSpots().length, 0);
});

test('prominence nepotřebuje tečky Slunce — body oblouku leží na povrchu', () => {
  const act = createSunActivity({ sunOwner: 0, sunRadius: 995, seed: 5 });
  for (let k = 0; k < 20; k++) {
    const p = act._randomSurfacePoint();
    assert.ok(Math.abs(Math.hypot(p.x, p.y, p.z) - 995) < 1e-6);
  }
  const pool = makeMockPool(200);
  const flare = act._spawnProminence(pool, 0);
  assert.ok(flare && flare.indices.length > 0, 'erupce vznikla i bez teček ON_SUN');
});

test('lifecycle: fade-in → stable → fade-out → dead', () => {
  const act = createSunActivity({ sunOwner: 0, sunRadius: 1 });
  const spot = { bornAt: 0, stableAt: 3, deathAt: 31, indices: [1, 2, 3] };
  assert.equal(act._intensityAt(spot, 0), 0, 'at birth = 0');
  assert.ok(Math.abs(act._intensityAt(spot, 1.5) - 0.5) < 0.05, 'halfway fade-in ~0.5');
  assert.equal(act._intensityAt(spot, 15), 1, 'stable = 1');
  assert.ok(act._intensityAt(spot, 27) < 1, 'fading out');
  assert.equal(act._intensityAt(spot, 32), 0, 'dead = 0');
});

test('parabolicArcPos: t=0 = A, t=1 = B', () => {
  const A = { x: 0, y: 0, z: 0 };
  const B = { x: 10, y: 0, z: 0 };
  const peak = 2;
  const p0 = parabolicArcPos(A, B, peak, 0);
  const p1 = parabolicArcPos(A, B, peak, 1);
  assert.ok(Math.abs(p0.x - 0) < 0.001);
  assert.ok(Math.abs(p1.x - 10) < 0.001);
});

test('parabolicArcPos: max výška při t=0.5', () => {
  const A = { x: 0, y: 0, z: 0 };
  const B = { x: 10, y: 0, z: 0 };
  const peak = 2;
  const mid = parabolicArcPos(A, B, peak, 0.5);
  assert.ok(Math.abs(mid.y - peak) < 0.01, `y = ${mid.y}, expected ~${peak}`);
});

test('parabolicArcPos: vyklenutí ve směru normály (i dolů)', () => {
  const A = { x: -1, y: -10, z: 0 };
  const B = { x: 1, y: -10, z: 0 };
  const mid = parabolicArcPos(A, B, 2, 0.5, { x: 0, y: -1, z: 0 });
  assert.ok(Math.abs(mid.y + 12) < 1e-9, `y = ${mid.y}`);
});
