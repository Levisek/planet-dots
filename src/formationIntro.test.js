import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateFormationIntro, resetFormationIntro, assignZone } from './formationIntro.js';
import { ACCRETION_WINDOWS } from './animation.js';
import { PHASE } from './phase.js';

// Fake pool — plain objekt s poli místo Three.js BufferAttribute. Dost velký,
// aby unesl 12k prachu (formationIntro disk) + desítky tisíc emitovaných teček
// (mercury.tickCount = 40962) při testu emisního tempa (~50 %).
function makeFakePool(size = 50000) {
  return {
    count: size,
    position: new Float32Array(size * 3),
    color: new Float32Array(size * 3),
    alpha: new Float32Array(size),
    size: new Float32Array(size),
    phase: new Array(size).fill(PHASE.IDLE),
    owner: new Array(size).fill(-1),
    posAttr: { needsUpdate: false },
    colorAttr: { needsUpdate: false },
    alphaAttr: { needsUpdate: false },
    sizeAttr: { needsUpdate: false },
    _spawnCalls: [],
    _takeIdleCallCount: 0,
    takeIdleIndices(count) {
      this._takeIdleCallCount++;
      const out = [];
      for (let i = 0; i < this.count && out.length < count; i++) {
        if (this.phase[i] === PHASE.IDLE) out.push(i);
      }
      return out;
    },
    spawnFromDisk(sourceIdx, sourcePos, finalTarget, finalTargetLocal, finalColor,
                  ownerIdx, finalPhase, currentTime, travelTime, finalAlpha, finalSize) {
      this.phase[sourceIdx] = PHASE.FLYING; // spotřebováno — takeIdleIndices ho už nevrátí
      this.owner[sourceIdx] = ownerIdx;
      this._spawnCalls.push({
        sourceIdx,
        sourcePos: { ...sourcePos },
        finalTarget: { ...finalTarget },
        finalTargetLocal: { ...finalTargetLocal },
        finalColor: [...finalColor],
        ownerIdx, finalPhase, currentTime, travelTime, finalAlpha, finalSize,
      });
    },
    flushAll() {},
  };
}

const fakeTex = { width: 1, height: 1, data: new Uint8ClampedArray([120, 130, 140, 255]) };

const fakeAnchors = {
  sun: { position: { x: 0, y: 0, z: 0 } },
  mercury: { position: { x: 1318, y: 0, z: 0 } },
  venus: { position: { x: 1397, y: 0, z: 0 } },
  earth: { position: { x: 1450, y: 0, z: 0 } },
};
const fakeImageData = {
  mercury: fakeTex,
  venus: fakeTex,
  earth: fakeTex,
};

function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

test('assignZone: deterministické přiřazení nejbližší zóny podle poloměru', () => {
  const zoneRadii = [1318, 1450, 3019];
  assert.equal(assignZone(1300, zoneRadii), 0);
  assert.equal(assignZone(2900, zoneRadii), 2);
  // Hranice mezi zónami 0 a 1 půlí — přesně uprostřed jde k nižšímu indexu,
  // těsně za půlkou k vyššímu.
  const mid = (zoneRadii[0] + zoneRadii[1]) / 2;
  assert.equal(assignZone(mid, zoneRadii), 0);
  assert.equal(assignZone(mid + 1, zoneRadii), 1);
});

test('assignZone: stejný poloměr → stejná zóna (deterministické, ne náhodné)', () => {
  const zoneRadii = [1318, 1450, 3019];
  const a = assignZone(1400, zoneRadii);
  const b = assignZone(1400, zoneRadii);
  assert.equal(a, b);
});

test('akrece emituje z lokálního disku planety, ne ze Slunce', () => {
  const pool = makeFakePool();
  resetFormationIntro(pool);
  const w = ACCRETION_WINDOWS.find((x) => x.planetId === 'mercury');
  const t = w.start + 0.1;
  updateFormationIntro(pool, t, 1 / 60, fakeAnchors, fakeImageData);

  assert.ok(pool._spawnCalls.length > 0, 'žádná tečka nebyla emitována');
  assert.equal(typeof pool.spawnFromSun, 'undefined', 'spawnFromSun by se neměl volat (fake pool ho nemá)');
  for (const call of pool._spawnCalls) {
    const d = dist(call.sourcePos, fakeAnchors.mercury.position);
    assert.ok(d < 500, `sourcePos příliš daleko od Merkuru (${d})`);
    assert.ok(call.travelTime >= 0.6 && call.travelTime <= 1.2, `travelTime mimo rozsah: ${call.travelTime}`);
  }
});

test('cíl emitované tečky = anchor.position + finalTargetLocal', () => {
  const pool = makeFakePool();
  resetFormationIntro(pool);
  const w = ACCRETION_WINDOWS.find((x) => x.planetId === 'mercury');
  const t = w.start + 0.1;
  updateFormationIntro(pool, t, 1 / 60, fakeAnchors, fakeImageData);

  assert.ok(pool._spawnCalls.length > 0);
  const anchor = fakeAnchors.mercury.position;
  for (const call of pool._spawnCalls) {
    assert.ok(Math.abs(call.finalTarget.x - (anchor.x + call.finalTargetLocal.x)) < 1e-6);
    assert.ok(Math.abs(call.finalTarget.y - (anchor.y + call.finalTargetLocal.y)) < 1e-6);
    assert.ok(Math.abs(call.finalTarget.z - (anchor.z + call.finalTargetLocal.z)) < 1e-6);
  }
});

test('emisní tempo: v polovině okna je emitováno ~50 % cílů (floor logika)', () => {
  const pool = makeFakePool();
  resetFormationIntro(pool);
  const w = ACCRETION_WINDOWS.find((x) => x.planetId === 'mercury');
  const mid = w.start + (w.end - w.start) * 0.5;
  updateFormationIntro(pool, mid, 1 / 60, fakeAnchors, fakeImageData);

  const mercuryIdx = 1; // PLANETS: [sun, mercury, ...] — mercury owner index
  const emitted = pool._spawnCalls.filter((c) => c.ownerIdx === mercuryIdx).length;
  const total = 40962; // planet.tickCount (mercury) — viz planets.js
  const ratio = emitted / total;
  assert.ok(Math.abs(ratio - 0.5) < 0.02, `emitováno ${emitted}/${total} = ${ratio}, čekáno ~0.5`);
});

function countDust(pool) {
  let n = 0;
  for (let i = 0; i < pool.count; i++) if (pool.phase[i] === 99) n++;
  return n;
}

function spread(pool) {
  let maxR = 0, maxY = 0;
  for (let i = 0; i < pool.count; i++) {
    if (pool.phase[i] !== 99 || pool.alpha[i] === 0) continue;
    maxR = Math.max(maxR, Math.hypot(pool.position[3 * i], pool.position[3 * i + 2]));
    maxY = Math.max(maxY, Math.abs(pool.position[3 * i + 1]));
  }
  return { maxR, maxY };
}

test('mrak je trojrozměrný, po kolapsu placka; sluneční zásoba spadne do Slunce', () => {
  const pool = makeFakePool();
  resetFormationIntro(pool);
  updateFormationIntro(pool, 1.0, 1 / 30, fakeAnchors, fakeImageData);
  const cloud = spread(pool);
  assert.ok(cloud.maxY > 0.4 * cloud.maxR, `mrak plochý už na začátku: ${cloud.maxY} / ${cloud.maxR}`);
  const before = countDust(pool);
  for (let t = 1; t <= 21; t += 1 / 30) updateFormationIntro(pool, t, 1 / 30, fakeAnchors, fakeImageData);
  const disk = spread(pool);
  assert.ok(disk.maxY < 0.25 * disk.maxR, `disk není placka: ${disk.maxY} / ${disk.maxR}`);
  assert.ok(disk.maxR < cloud.maxR, 'mrak se zmenšil');
  const fallen = (before - countDust(pool)) / before;
  assert.ok(Math.abs(fallen - 0.15) < 0.02, `do Slunce spadlo ${fallen}, čekáno ~15 %`);
});

test('keplerovský disk: vnitřek obíhá rychleji, ω ~ r^(-3/2)', async () => {
  const { keplerOmega } = await import('./formationIntro.js');
  const w1 = keplerOmega(1000, 2000), w4 = keplerOmega(4000, 2000);
  assert.ok(Math.abs(w1 / w4 - 8) < 1e-9);
});

test('kolaps zevnitř ven: vnitřek mraku dosedne dřív než okraj', async () => {
  const { collapseProgress } = await import('./formationIntro.js');
  assert.equal(collapseProgress(11.9, 0), 0);
  assert.ok(collapseProgress(15, 0.1) > collapseProgress(15, 0.9));
  assert.equal(collapseProgress(20, 1), 1);
});

test('emise = jedno takeIdleIndices volání za frame (>=2 aktivní akreční okna)', () => {
  const pool = makeFakePool();
  resetFormationIntro(pool);

  const anchorsWithMars = {
    ...fakeAnchors,
    mars: { position: { x: 2279, y: 0, z: 0 } },
  };
  const imageDataWithMars = { ...fakeImageData, mars: fakeTex };

  // Init disku (beat_disk) — samostatné volání takeIdleIndices, nepočítáme ho.
  updateFormationIntro(pool, 0.01, 1 / 60, anchorsWithMars, imageDataWithMars);
  pool._takeIdleCallCount = 0;

  // t=47 → Merkur, Venuše a Země rostou současně (≥2 okna).
  updateFormationIntro(pool, 47.0, 1 / 60, anchorsWithMars, imageDataWithMars);

  assert.equal(pool._takeIdleCallCount, 1, `očekáváno přesně 1 volání takeIdleIndices za frame, bylo ${pool._takeIdleCallCount}`);
});

test('dustColor: u Slunce teplý, za sněžnou čarou studený, složky v 0..1', async () => {
  const { dustColor } = await import('./formationIntro.js');
  const inner = dustColor(1318, 1714, 0.5);
  const outer = dustColor(3018, 1714, 0.5);
  assert.ok(inner[0] > inner[2], 'uvnitř víc červené než modré');
  assert.ok(outer[2] > outer[0], 'venku víc modré než červené');
  for (const c of [...inner, ...outer, ...dustColor(0, 1714, 1), ...dustColor(9999, 1714, 1)]) assert.ok(c >= 0 && c <= 1);
});
