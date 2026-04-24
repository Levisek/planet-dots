import * as THREE from 'three';

/**
 * Raw icosphere BEZ shuffle — potřebujeme topologii (vertices + faces).
 * Stejná matematika jako v geometry.js, ale vrací i indexy trojúhelníků.
 */
function rawIcosphere(minVertices) {
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
 * Vytvoří mesh pro tělo: icosphere trojúhelníky se per-face barvou sampled z textury
 * ve středu trojúhelníku. Flat shading (non-shared verts) = pravé minecraft plochy.
 *
 * @param {ImageData} imageData
 * @param {number} radius
 * @param {number} minVertices — (10242 = level 5 = 20480 tri) typicky pro planety
 * @returns {THREE.Mesh}
 */
export function buildBodyMesh(imageData, radius, minVertices) {
  const { vertices, faces } = rawIcosphere(minVertices);
  const { data, width, height } = imageData;

  const numTris = faces.length;
  const posArray = new Float32Array(numTris * 3 * 3);
  const colorArray = new Float32Array(numTris * 3 * 3);

  for (let i = 0; i < numTris; i++) {
    const [a, b, c] = faces[i];
    const va = vertices[a];
    const vb = vertices[b];
    const vc = vertices[c];

    // Centroid pro UV sampling
    const cx = (va[0] + vb[0] + vc[0]) / 3;
    const cy = (va[1] + vb[1] + vc[1]) / 3;
    const cz = (va[2] + vb[2] + vc[2]) / 3;
    const clen = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
    const nx = cx / clen;
    const ny = cy / clen;
    const nz = cz / clen;

    // Spherical UV s pole-safety (vyhnout se extrémním pólům textury)
    const u = Math.atan2(nz, nx) / (Math.PI * 2) + 0.5;
    const vRaw = Math.asin(ny) / Math.PI + 0.5;
    const vSafe = Math.max(0.02, Math.min(0.98, vRaw));
    const px = Math.min(width - 1, Math.max(0, Math.floor(u * width)));
    const py = Math.min(height - 1, Math.max(0, Math.floor((1 - vSafe) * height)));
    const idx = (py * width + px) * 4;
    const cr = data[idx] / 255;
    const cg = data[idx + 1] / 255;
    const cb = data[idx + 2] / 255;

    // 3 verts × 3 souřadnice (non-shared pro flat shading)
    const base = i * 9;
    posArray[base + 0] = va[0] * radius;
    posArray[base + 1] = va[1] * radius;
    posArray[base + 2] = va[2] * radius;
    posArray[base + 3] = vb[0] * radius;
    posArray[base + 4] = vb[1] * radius;
    posArray[base + 5] = vb[2] * radius;
    posArray[base + 6] = vc[0] * radius;
    posArray[base + 7] = vc[1] * radius;
    posArray[base + 8] = vc[2] * radius;

    // Stejná barva na všech 3 verts trojúhelníku → flat shading
    for (let k = 0; k < 3; k++) {
      colorArray[base + k * 3 + 0] = cr;
      colorArray[base + k * 3 + 1] = cg;
      colorArray[base + k * 3 + 2] = cb;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 1.0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}
