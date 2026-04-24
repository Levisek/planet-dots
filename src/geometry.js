// Pure helpers (bez Three.js) pro rozmístění bodů.

/**
 * Icosphere — začne ikosaedronem (12 vrcholů) a každou stěnu rozdělí na 4.
 * Po k děleních: V_k = 12 + 10*(4^k - 1)/3 vrcholů.
 *   k=0 → 12, k=1 → 42, k=2 → 162, k=3 → 642, k=4 → 2562,
 *   k=5 → 10242, k=6 → 40962, k=7 → 163842.
 *
 * Každý vrchol má 5 nebo 6 sousedů ve STEJNÉ vzdálenosti → perfektní hexagonální
 * tiling na sféře. Žádný pól, žádná viditelná spirála (Fibonacci artifact), žádné
 * náhodné clumps. Je to nejhezčí dostupné rozložení bodů na kouli.
 *
 * @param {number} count — minimální požadovaný počet; vrátí vrcholy nejbližší
 *   vyšší subdivision level (tedy obvykle o něco víc, ale perfektně uniformní).
 * @param {number} radius
 * @returns {number[][]} pole [x,y,z] bodů na povrchu koule
 */
export function fibonacciSphere(count, radius) {
  return icosphere(count, radius);
}

export function icosphere(minCount, radius) {
  // Base icosahedron — 12 vrcholů
  const t = (1 + Math.sqrt(5)) / 2;
  const rawVerts = [
    [-1,  t,  0], [ 1,  t,  0], [-1, -t,  0], [ 1, -t,  0],
    [ 0, -1,  t], [ 0,  1,  t], [ 0, -1, -t], [ 0,  1, -t],
    [ t,  0, -1], [ t,  0,  1], [-t,  0, -1], [-t,  0,  1],
  ];
  // Normalize na jednotkovou kouli
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

  // Dělej subdivision dokud nemáme dost vrcholů
  while (vertices.length < minCount) {
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
    // Pokud by base 12 ani po 10 subdivisionech nestačilo (>10M verts), bail out.
    if (faces.length > 1000000) break;
  }

  return vertices.map(([x, y, z]) => [x * radius, y * radius, z * radius]);
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
