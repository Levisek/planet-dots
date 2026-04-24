// sunActivity — stateful controller pro vitalní chování Slunce.
// T10: sunspoty. T11 přidá prominence/CME.

const SUNSPOT_FADE_IN = 3;
const SUNSPOT_STABLE = 20;
const SUNSPOT_FADE_OUT = 8;
const SUNSPOT_LIFETIME = SUNSPOT_FADE_IN + SUNSPOT_STABLE + SUNSPOT_FADE_OUT;
const SUNSPOT_CLUSTER_MIN = 6;
const SUNSPOT_CLUSTER_MAX = 18;
const SUNSPOT_COLOR = [40/255, 20/255, 0/255];

function makeRng(seed = 1) {
  let s = seed >>> 0;
  return function() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function parabolicArcPos(A, B, peak, t) {
  return {
    x: A.x + (B.x - A.x) * t,
    y: A.y + (B.y - A.y) * t + Math.sin(Math.PI * t) * peak,
    z: A.z + (B.z - A.z) * t,
  };
}

export function createSunActivity({ sunOwner = 0, sunRadius = 1, seed = Date.now() & 0xffff } = {}) {
  const rng = makeRng(seed);
  const activeSpots = [];

  const PROMINENCE_LIFETIME = 3.0;
  const CME_LIFETIME = 2.2;
  const PROMINENCE_DOTS = 40;
  const CME_DOTS = 25;
  const PROMINENCE_PEAK_FACTOR = 0.18;
  const PROMINENCE_SPAN_MIN = 0.35;
  const PROMINENCE_SPAN_MAX = 0.55;

  let lastFlareAt = -Infinity;
  const activeFlares = [];

  let lastSpawnAt = -Infinity;

  function takeIdleIndices(pool, n) {
    if (typeof pool.takeIdleIndices === 'function') return pool.takeIdleIndices(n);
    const out = [];
    for (let i = 0; i < pool.count && out.length < n; i++) {
      if (pool.phase && pool.phase[i] === 0) out.push(i);
    }
    return out;
  }

  function intensityAt(spot, time) {
    const age = time - spot.bornAt;
    if (age < 0 || age > (spot.deathAt - spot.bornAt)) return 0;
    if (age < SUNSPOT_FADE_IN) return age / SUNSPOT_FADE_IN;
    if (age < SUNSPOT_FADE_IN + SUNSPOT_STABLE) return 1;
    const fadeAge = age - SUNSPOT_FADE_IN - SUNSPOT_STABLE;
    return Math.max(0, 1 - fadeAge / SUNSPOT_FADE_OUT);
  }

  function spawnSunspot(pool, time) {
    const seedIdx = findSunSeed(pool);
    if (seedIdx === -1) return null;
    const clusterSize = SUNSPOT_CLUSTER_MIN + Math.floor(rng() * (SUNSPOT_CLUSTER_MAX - SUNSPOT_CLUSTER_MIN));
    const indices = findKNearest(pool, seedIdx, clusterSize);
    const origColors = indices.map((i) => [pool.color[3*i], pool.color[3*i+1], pool.color[3*i+2]]);
    const spot = {
      indices,
      origColors,
      bornAt: time,
      stableAt: time + SUNSPOT_FADE_IN,
      deathAt: time + SUNSPOT_LIFETIME,
    };
    activeSpots.push(spot);
    return spot;
  }

  function findSunSeed(pool) {
    const candidates = [];
    for (let i = 0; i < pool.count; i++) {
      if (pool.owner[i] !== sunOwner) continue;
      const ly = pool.localOffset[3*i + 1];
      if (Math.abs(ly) < 0.5 * sunRadius) candidates.push(i);
    }
    if (candidates.length === 0) {
      for (let i = 0; i < pool.count; i++) {
        if (pool.owner[i] === sunOwner) candidates.push(i);
        if (candidates.length >= 100) break;
      }
    }
    if (candidates.length === 0) return -1;
    return candidates[Math.floor(rng() * candidates.length)];
  }

  function findKNearest(pool, seedIdx, k) {
    const sx = pool.localOffset[3*seedIdx];
    const sy = pool.localOffset[3*seedIdx + 1];
    const sz = pool.localOffset[3*seedIdx + 2];
    const dists = [];
    for (let i = 0; i < pool.count; i++) {
      if (pool.owner[i] !== sunOwner) continue;
      const dx = pool.localOffset[3*i] - sx;
      const dy = pool.localOffset[3*i + 1] - sy;
      const dz = pool.localOffset[3*i + 2] - sz;
      dists.push([dx*dx + dy*dy + dz*dz, i]);
    }
    dists.sort((a, b) => a[0] - b[0]);
    return dists.slice(0, k).map((d) => d[1]);
  }

  function spawnProminence(pool, time) {
    const sunDots = [];
    for (let i = 0; i < pool.count && sunDots.length < 200; i++) {
      if (pool.owner[i] === sunOwner) sunDots.push(i);
    }
    if (sunDots.length < 2) return null;
    const aIdx = sunDots[Math.floor(rng() * sunDots.length)];
    const A = {
      x: pool.position[3*aIdx],
      y: pool.position[3*aIdx + 1],
      z: pool.position[3*aIdx + 2],
    };

    if (rng() < 0.75) {
      // Arch prominence
      let bIdx = -1;
      for (let tries = 0; tries < 40; tries++) {
        const candidate = sunDots[Math.floor(rng() * sunDots.length)];
        const B = {
          x: pool.position[3*candidate],
          y: pool.position[3*candidate + 1],
          z: pool.position[3*candidate + 2],
        };
        const d = Math.hypot(B.x - A.x, B.y - A.y, B.z - A.z);
        if (d >= sunRadius * PROMINENCE_SPAN_MIN && d <= sunRadius * PROMINENCE_SPAN_MAX) {
          bIdx = candidate;
          break;
        }
      }
      if (bIdx === -1) return null;
      const B = {
        x: pool.position[3*bIdx],
        y: pool.position[3*bIdx + 1],
        z: pool.position[3*bIdx + 2],
      };
      const idle = takeIdleIndices(pool, PROMINENCE_DOTS);
      if (idle.length === 0) return null;
      // Per-dot phase offsets vytvoří "stream" efekt — tečky se rozprostřou po oblouku
      // místo letění v jedné kouli.
      const phaseOffsets = idle.map((_, k) => (k / idle.length) * 0.45);
      const flare = {
        kind: 'arch',
        A, B,
        peak: sunRadius * PROMINENCE_PEAK_FACTOR,
        bornAt: time,
        dieAt: time + PROMINENCE_LIFETIME,
        indices: idle,
        phaseOffsets,
      };
      const jitter = sunRadius * 0.03;
      for (const i of idle) {
        pool.position[3*i] = A.x + (rng() - 0.5) * jitter;
        pool.position[3*i+1] = A.y + (rng() - 0.5) * jitter;
        pool.position[3*i+2] = A.z + (rng() - 0.5) * jitter;
        pool.color[3*i] = 1.0;
        pool.color[3*i+1] = 0.65;
        pool.color[3*i+2] = 0.15;
        pool.alpha[i] = 1.0;
        if (pool.size) pool.size[i] = 8.0;
        if (pool.phase) pool.phase[i] = 99;
        if (pool.owner) pool.owner[i] = sunOwner;
        if (pool.ownerAlpha) pool.ownerAlpha[i] = pool.ownerAlphaMul ? pool.ownerAlphaMul[sunOwner] : 1;
      }
      activeFlares.push(flare);
      return flare;
    } else {
      // CME — radial ejection
      const idle = takeIdleIndices(pool, CME_DOTS);
      if (idle.length === 0) return null;
      const nx = A.x, ny = A.y, nz = A.z;
      const len = Math.hypot(nx, ny, nz) || 1;
      const dx = nx / len, dy = ny / len, dz = nz / len;
      const flare = {
        kind: 'cme',
        A, dir: { x: dx, y: dy, z: dz },
        bornAt: time,
        dieAt: time + CME_LIFETIME,
        indices: idle,
      };
      const jitter = sunRadius * 0.04;
      for (const i of idle) {
        pool.position[3*i] = A.x + (rng() - 0.5) * jitter;
        pool.position[3*i+1] = A.y + (rng() - 0.5) * jitter;
        pool.position[3*i+2] = A.z + (rng() - 0.5) * jitter;
        pool.color[3*i] = 1.0;
        pool.color[3*i+1] = 0.75;
        pool.color[3*i+2] = 0.25;
        pool.alpha[i] = 1.0;
        if (pool.size) pool.size[i] = 7.0;
        if (pool.phase) pool.phase[i] = 99;
        if (pool.owner) pool.owner[i] = sunOwner;
        if (pool.ownerAlpha) pool.ownerAlpha[i] = pool.ownerAlphaMul ? pool.ownerAlphaMul[sunOwner] : 1;
      }
      activeFlares.push(flare);
      return flare;
    }
  }

  function updateFlares(pool, time, dt) {
    for (let f = activeFlares.length - 1; f >= 0; f--) {
      const flare = activeFlares[f];
      const age = time - flare.bornAt;
      const lifetime = flare.dieAt - flare.bornAt;
      const t = Math.min(1, age / lifetime);
      if (flare.kind === 'arch') {
        for (let k = 0; k < flare.indices.length; k++) {
          const i = flare.indices[k];
          const offset = flare.phaseOffsets ? flare.phaseOffsets[k] : 0;
          const pt = Math.max(0, Math.min(1, t - offset));
          const pos = parabolicArcPos(flare.A, flare.B, flare.peak, pt);
          pool.position[3*i] = pos.x;
          pool.position[3*i+1] = pos.y;
          pool.position[3*i+2] = pos.z;
          pool.alpha[i] = t < 0.9 ? 1 : (1 - (t - 0.9) / 0.1);
        }
      } else {
        const dist = 0.8 * sunRadius * t + 1.2 * sunRadius * t * t;
        for (const i of flare.indices) {
          pool.position[3*i] = flare.A.x + flare.dir.x * dist;
          pool.position[3*i+1] = flare.A.y + flare.dir.y * dist;
          pool.position[3*i+2] = flare.A.z + flare.dir.z * dist;
          pool.alpha[i] = 1 - t;
        }
      }
      if (time >= flare.dieAt) {
        for (const i of flare.indices) {
          pool.alpha[i] = 0;
          if (pool.phase) pool.phase[i] = 0;
          if (pool.owner) pool.owner[i] = -1;
        }
        activeFlares.splice(f, 1);
      }
    }
  }

  function update(pool, time, dt, opts = {}) {
    const intensity = opts.intensity || 'low';
    const spawnInterval = intensity === 'high' ? 10 : 18;
    const maxSpots = intensity === 'high' ? 3 : 2;

    const flareInterval = intensity === 'high' ? 4 : 7;
    if (time - lastFlareAt >= flareInterval) {
      if (spawnProminence(pool, time)) lastFlareAt = time;
    }
    updateFlares(pool, time, dt);

    if (time - lastSpawnAt >= spawnInterval && activeSpots.length < maxSpots) {
      spawnSunspot(pool, time);
      lastSpawnAt = time;
    }

    for (let s = activeSpots.length - 1; s >= 0; s--) {
      const spot = activeSpots[s];
      const k = intensityAt(spot, time);
      for (let j = 0; j < spot.indices.length; j++) {
        const i = spot.indices[j];
        const oc = spot.origColors[j];
        pool.color[3*i]     = oc[0] + (SUNSPOT_COLOR[0] - oc[0]) * k;
        pool.color[3*i + 1] = oc[1] + (SUNSPOT_COLOR[1] - oc[1]) * k;
        pool.color[3*i + 2] = oc[2] + (SUNSPOT_COLOR[2] - oc[2]) * k;
      }
      if (time > spot.deathAt) {
        for (let j = 0; j < spot.indices.length; j++) {
          const i = spot.indices[j];
          const oc = spot.origColors[j];
          pool.color[3*i]     = oc[0];
          pool.color[3*i + 1] = oc[1];
          pool.color[3*i + 2] = oc[2];
        }
        activeSpots.splice(s, 1);
      }
    }
    pool.colorAttr.needsUpdate = true;
    if (pool.posAttr) pool.posAttr.needsUpdate = true;
    if (pool.alphaAttr) pool.alphaAttr.needsUpdate = true;
    if (pool.ownerAlphaAttr) pool.ownerAlphaAttr.needsUpdate = true;
  }

  return {
    update,
    _spawnSunspot: spawnSunspot,
    _intensityAt: intensityAt,
    _activeSpots: () => activeSpots,
    _spawnProminence: spawnProminence,
    _activeFlares: () => activeFlares,
  };
}
