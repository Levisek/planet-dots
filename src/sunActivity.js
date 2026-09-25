// sunActivity — stateful controller pro vitalní chování Slunce.
// Sunspoty (barvy meshe Slunce) + prominence/CME (částice z poolu).
import { srgbToLinear } from './textureUtils.js';

const SUNSPOT_FADE_IN = 3;
const SUNSPOT_STABLE = 20;
const SUNSPOT_FADE_OUT = 8;
const SUNSPOT_LIFETIME = SUNSPOT_FADE_IN + SUNSPOT_STABLE + SUNSPOT_FADE_OUT;
const SUNSPOT_CLUSTER_MIN = 6;
const SUNSPOT_CLUSTER_MAX = 18;
// Lineární (mesh vertex colors jsou lineární, viz textureUtils.srgbToLinear)
// — odpovídá sRGB #281400. Bez převodu se tmavá hnědá zobrazila jako olivová.
const SUNSPOT_COLOR = [40/255, 20/255, 0/255].map(srgbToLinear);

function makeRng(seed = 1) {
  let s = seed >>> 0;
  return function() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Bod na oblouku A→B vyklenutém ve směru `n` (jednotkový). Default +Y kvůli
 * zpětné kompatibilitě; erupce předávají radiální normálu středu oblouku —
 * s pevným +Y se oblouky na spodní polokouli Slunce nořily dovnitř.
 */
export function parabolicArcPos(A, B, peak, t, n = { x: 0, y: 1, z: 0 }) {
  const h = Math.sin(Math.PI * t) * peak;
  return {
    x: A.x + (B.x - A.x) * t + n.x * h,
    y: A.y + (B.y - A.y) * t + n.y * h,
    z: A.z + (B.z - A.z) * t + n.z * h,
  };
}

export function createSunActivity({ sunOwner = 0, sunRadius: sunRadius0 = 1, seed = Date.now() & 0xffff, sunMesh = null } = {}) {
  const rng = makeRng(seed);
  const activeSpots = [];
  // Poloměr se mění s módem (Slunce v Pochopení zmenšené) — viz setSunRadius.
  let sunRadius = sunRadius0;

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

  // ——— Sunspoty: tmavnou barvy trojúhelníků meshe Slunce ———
  // Dřív se barvily tečky ON_SUN, jenže ty mají alpha 0 (povrch kreslí mesh)
  // → skvrny nebyly nikdy vidět. Mesh je non-indexed icosphere, 3 vrcholy
  // na face se stejnou barvou; pracuje se v lokálním frame meshe, takže
  // skvrna rotuje se Sluncem.
  let _faceDirs = null; // Float32Array faces×3 — jednotkové směry těžišť

  function faceDirs() {
    if (_faceDirs) return _faceDirs;
    const pos = sunMesh.geometry.attributes.position;
    const faces = pos.count / 3;
    _faceDirs = new Float32Array(faces * 3);
    for (let f = 0; f < faces; f++) {
      let x = 0, y = 0, z = 0;
      for (let k = 0; k < 3; k++) {
        x += pos.getX(3 * f + k); y += pos.getY(3 * f + k); z += pos.getZ(3 * f + k);
      }
      const len = Math.hypot(x, y, z) || 1;
      _faceDirs[3 * f] = x / len; _faceDirs[3 * f + 1] = y / len; _faceDirs[3 * f + 2] = z / len;
    }
    return _faceDirs;
  }

  /**
   * Skupina 1–3 skvrn v pásu ±30° šířky (jako reálné sunspoty). Umbra =
   * plné ztmavení, penumbra do 1,8× poloměru s poloviční silou.
   */
  function spawnSunspot(time) {
    if (!sunMesh) return null;
    const dirs = faceDirs();
    const colorAttr = sunMesh.geometry.attributes.color;
    const lat = (rng() - 0.5) * (Math.PI / 3);
    const lon = rng() * Math.PI * 2;
    const groupSize = 1 + Math.floor(rng() * 3);
    const centers = [];
    for (let g = 0; g < groupSize; g++) {
      const la = lat + (rng() - 0.5) * 0.08;
      const lo = lon + g * 0.07 + (rng() - 0.5) * 0.03;
      centers.push({
        x: Math.cos(la) * Math.cos(lo), y: Math.sin(la), z: Math.cos(la) * Math.sin(lo),
        rho: 0.018 + rng() * 0.03, // rad; Slunce r≈995 → umbra ~18–48 j. (Pochopení r 400 → 7–19)
      });
    }
    const faces = [];
    const weights = [];
    const nFaces = dirs.length / 3;
    for (let f = 0; f < nFaces; f++) {
      let w = 0;
      for (const c of centers) {
        const dot = dirs[3 * f] * c.x + dirs[3 * f + 1] * c.y + dirs[3 * f + 2] * c.z;
        const theta = Math.acos(Math.min(1, dot));
        if (theta < c.rho) w = Math.max(w, 1);
        else if (theta < c.rho * 1.8) w = Math.max(w, 0.5 * (1 - (theta - c.rho) / (c.rho * 0.8)));
      }
      if (w > 0) { faces.push(f); weights.push(w); }
    }
    if (faces.length === 0) return null;
    const origColors = new Float32Array(faces.length * 3);
    for (let j = 0; j < faces.length; j++) {
      const v = 3 * faces[j];
      origColors[3 * j] = colorAttr.getX(v);
      origColors[3 * j + 1] = colorAttr.getY(v);
      origColors[3 * j + 2] = colorAttr.getZ(v);
    }
    const spot = {
      faces,
      weights,
      origColors,
      bornAt: time,
      stableAt: time + SUNSPOT_FADE_IN,
      deathAt: time + SUNSPOT_LIFETIME,
    };
    activeSpots.push(spot);
    return spot;
  }

  function paintSpot(spot, k) {
    const arr = sunMesh.geometry.attributes.color.array;
    for (let j = 0; j < spot.faces.length; j++) {
      const kk = k * spot.weights[j];
      const r = spot.origColors[3 * j] + (SUNSPOT_COLOR[0] - spot.origColors[3 * j]) * kk;
      const g = spot.origColors[3 * j + 1] + (SUNSPOT_COLOR[1] - spot.origColors[3 * j + 1]) * kk;
      const b = spot.origColors[3 * j + 2] + (SUNSPOT_COLOR[2] - spot.origColors[3 * j + 2]) * kk;
      const base = 9 * spot.faces[j];
      for (let v = 0; v < 3; v++) {
        arr[base + 3 * v] = r; arr[base + 3 * v + 1] = g; arr[base + 3 * v + 2] = b;
      }
    }
  }

  /** Bod A posunutý po povrchu o úhel theta náhodným tečným směrem. */
  function rotateOnSurface(A, theta) {
    const ax = A.x / sunRadius, ay = A.y / sunRadius, az = A.z / sunRadius;
    // Tečný vektor: náhodný směr minus jeho složka podél A, normalizovat.
    let tx = rng() - 0.5, ty = rng() - 0.5, tz = rng() - 0.5;
    const d = tx * ax + ty * ay + tz * az;
    tx -= d * ax; ty -= d * ay; tz -= d * az;
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    const c = Math.cos(theta), sn = Math.sin(theta);
    return {
      x: (ax * c + tx * sn) * sunRadius,
      y: (ay * c + ty * sn) * sunRadius,
      z: (az * c + tz * sn) * sunRadius,
    };
  }

  /** Náhodný bod na povrchu Slunce (world, Slunce v origin). */
  function randomSurfacePoint() {
    const u = rng() * 2 - 1;
    const phi = rng() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    return { x: r * Math.cos(phi) * sunRadius, y: u * sunRadius, z: r * Math.sin(phi) * sunRadius };
  }

  function spawnProminence(pool, time) {
    // Patky oblouku = náhodné body povrchu (dřív pozice teček ON_SUN — ty se
    // po formaci uvolňují, povrch kreslí mesh).
    const A = randomSurfacePoint();

    if (rng() < 0.75) {
      // Arch prominence
      // B = A pootočené po povrchu o úhel, jehož tětiva je 0,35–0,55 R
      // (deterministicky — dřív 40 náhodných pokusů, ~16 % selhalo).
      const chord = PROMINENCE_SPAN_MIN + rng() * (PROMINENCE_SPAN_MAX - PROMINENCE_SPAN_MIN);
      const theta = 2 * Math.asin(chord / 2);
      const B = rotateOnSurface(A, theta);
      const idle = takeIdleIndices(pool, PROMINENCE_DOTS);
      if (idle.length === 0) return null;
      // Per-dot phase offsets vytvoří "stream" efekt — tečky se rozprostřou po oblouku
      // místo letění v jedné kouli.
      const phaseOffsets = idle.map((_, k) => (k / idle.length) * 0.45);
      const mx = A.x + B.x, my = A.y + B.y, mz = A.z + B.z;
      const ml = Math.hypot(mx, my, mz) || 1;
      const flare = {
        kind: 'arch',
        A, B,
        normal: { x: mx / ml, y: my / ml, z: mz / ml },
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
          const pos = parabolicArcPos(flare.A, flare.B, flare.peak, pt, flare.normal);
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

    if (sunMesh && time - lastSpawnAt >= spawnInterval && activeSpots.length < maxSpots) {
      spawnSunspot(time);
      lastSpawnAt = time;
    }

    const spotsDirty = activeSpots.length > 0;
    for (let s = activeSpots.length - 1; s >= 0; s--) {
      const spot = activeSpots[s];
      if (time > spot.deathAt) {
        paintSpot(spot, 0); // vrátit původní barvy
        activeSpots.splice(s, 1);
      } else {
        paintSpot(spot, intensityAt(spot, time));
      }
    }
    if (spotsDirty) sunMesh.geometry.attributes.color.needsUpdate = true;
    pool.colorAttr.needsUpdate = true;
    if (pool.posAttr) pool.posAttr.needsUpdate = true;
    if (pool.alphaAttr) pool.alphaAttr.needsUpdate = true;
    if (pool.ownerAlphaAttr) pool.ownerAlphaAttr.needsUpdate = true;
  }

  return {
    update,
    setSunRadius(r) { sunRadius = r; },
    _spawnSunspot: spawnSunspot,
    _randomSurfacePoint: randomSurfacePoint,
    _intensityAt: intensityAt,
    _activeSpots: () => activeSpots,
    _spawnProminence: spawnProminence,
    _activeFlares: () => activeFlares,
  };
}
