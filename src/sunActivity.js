// sunActivity — stateful controller pro vitalní chování Slunce.
// T10: sunspoty. T11 přidá prominence/CME.

const SUNSPOT_FADE_IN = 3;
const SUNSPOT_STABLE = 20;
const SUNSPOT_FADE_OUT = 8;
const SUNSPOT_LIFETIME = SUNSPOT_FADE_IN + SUNSPOT_STABLE + SUNSPOT_FADE_OUT;
const SUNSPOT_CLUSTER_MIN = 30;
const SUNSPOT_CLUSTER_MAX = 50;
const SUNSPOT_COLOR = [40/255, 20/255, 0/255];

function makeRng(seed = 1) {
  let s = seed >>> 0;
  return function() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createSunActivity({ sunOwner = 0, sunRadius = 1, seed = Date.now() & 0xffff } = {}) {
  const rng = makeRng(seed);
  const activeSpots = [];
  let lastSpawnAt = -Infinity;

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

  function update(pool, time, dt, opts = {}) {
    const intensity = opts.intensity || 'low';
    const spawnInterval = intensity === 'high' ? 12 : 25;
    const maxSpots = intensity === 'high' ? 3 : 1;

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
  }

  return {
    update,
    _spawnSunspot: spawnSunspot,
    _intensityAt: intensityAt,
    _activeSpots: () => activeSpots,
  };
}
