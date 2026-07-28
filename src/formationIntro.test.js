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
    takeIdleIndices(count) {
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
