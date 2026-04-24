// Pure helpers (bez Three.js) pro rozmístění bodů.

/**
 * Vygeneruje raw icosphere topologii (jednotková koule) — vrcholy + trojúhelníky.
 * Každá subdivision rozdělí trojúhelník na 4 menší. Vrcholy mají 5 nebo 6 sousedů
 * ve stejné vzdálenosti → perfektní hex tiling. Počty per level:
 *   k=0 → 12, k=1 → 42, k=2 → 162, k=3 → 642, k=4 → 2562,
 *   k=5 → 10242, k=6 → 40962, k=7 → 163842.
 *
 * @param {number} minVertices — nejmenší akceptovatelný počet; vrátí dáe nejbližší vyšší level.
 * @returns {{ vertices: number[][], faces: number[][] }}
 */
export function icosphereRaw(minVertices) {
  const t = (1 + Math.sqrt(5)) / 2;
  const rawVerts = [
    [-1,  t,  0], [ 1,  t,  0], [-1, -t,  0], [ 1, -t,  0],
    [ 0, -1,  t], [ 0,  1,  t], [ 0, -1, -t], [ 0,  1, -t],
    [ t,  0, -1], [ t,  0,  1], [-t,  0, -1], [-t,  0,  1],
  ];
  const vertices = rawVerts.map(([x, y, z]) => {
    const d = Math.sqrt(x * x + y * y + z * z);
    return [x / d, y / d, z / d];
  });

  let faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  while (vertices.length < minVertices) {
    const midCache = new Map();
    const newFaces = [];

    const getMid = (a, b) => {
      const key = a < b ? a * 100000 + b : b * 100000 + a;
      const cached = midCache.get(key);
      if (cached !== undefined) return cached;
      const [ax, ay, az] = vertices[a];
      const [bx, by, bz] = vertices[b];
      let mx = (ax + bx) * 0.5;
      let my = (ay + by) * 0.5;
      let mz = (az + bz) * 0.5;
      const d = Math.sqrt(mx * mx + my * my + mz * mz) || 1;
      vertices.push([mx / d, my / d, mz / d]);
      const idx = vertices.length - 1;
      midCache.set(key, idx);
      return idx;
    };

    for (const [a, b, c] of faces) {
      const ab = getMid(a, b);
      const bc = getMid(b, c);
      const ca = getMid(c, a);
      newFaces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = newFaces;
    if (faces.length > 2000000) break;
  }

  return { vertices, faces };
}

/**
 * Icosphere vrcholy škálované na daný poloměr, shuffled deterministicky
 * (jinak první N vrcholů by byly lokální cluster původního ikosaedru → "flek"
 * při použití prvních N pro label-dots nebo sunspoty).
 *
 * Jméno `fibonacciSphere` zachováno pro zpětnou kompatibilitu s callery.
 */
export function fibonacciSphere(count, radius) {
  return icosphere(count, radius);
}

export function icosphere(minCount, radius) {
  const { vertices } = icosphereRaw(minCount);
  const out = vertices.map(([x, y, z]) => [x * radius, y * radius, z * radius]);
  // Deterministický Fisher-Yates s LCG seedem (stabilní pořadí per count).
  let seed = out.length | 0;
  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

export function ringPoints(count, innerRadius, outerRadius) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const t = Math.random();
    const r = Math.sqrt(innerRadius * innerRadius + t * (outerRadius * outerRadius - innerRadius * innerRadius));
    const theta = Math.random() * Math.PI * 2;
    points.push([Math.cos(theta) * r, Math.sin(theta) * r, 0]);
  }
  return points;
}
