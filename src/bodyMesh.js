import * as THREE from 'three';
import { icosphereRaw } from './geometry.js';
import { sampleColorPoleSafe, sphericalUV } from './textureUtils.js';

/**
 * Vytvoří mesh pro tělo: icosphere trojúhelníky s per-face barvou sampled
 * z textury ve středu trojúhelníku. Flat shading (non-shared verts) =
 * pravé minecraft plochy, žádné mezery ani překryv.
 *
 * @param {ImageData} imageData
 * @param {number} radius
 * @param {number} minVertices — (10242 = level 5 = 20480 tri) typicky pro planety
 * @returns {THREE.Mesh}
 */
export function buildBodyMesh(imageData, radius, minVertices) {
  const { vertices, faces } = icosphereRaw(minVertices);

  const numTris = faces.length;
  const posArray = new Float32Array(numTris * 3 * 3);
  const colorArray = new Float32Array(numTris * 3 * 3);
  const normalArray = new Float32Array(numTris * 3 * 3);

  for (let i = 0; i < numTris; i++) {
    const [a, b, c] = faces[i];
    const va = vertices[a];
    const vb = vertices[b];
    const vc = vertices[c];

    // Centroid pro UV sampling + face normal (radial = normalized centroid).
    const cx = (va[0] + vb[0] + vc[0]) / 3;
    const cy = (va[1] + vb[1] + vc[1]) / 3;
    const cz = (va[2] + vb[2] + vc[2]) / 3;
    const clen = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
    const nx = cx / clen;
    const ny = cy / clen;
    const nz = cz / clen;

    const [u, v] = sphericalUV(nx, ny, nz, 1);
    const [cr, cg, cb] = sampleColorPoleSafe(imageData, u, v);

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

    for (let k = 0; k < 3; k++) {
      colorArray[base + k * 3 + 0] = cr;
      colorArray[base + k * 3 + 1] = cg;
      colorArray[base + k * 3 + 2] = cb;
      // Flat shading: všechny 3 vrcholy trojúhelníku sdílí stejnou face normal.
      normalArray[base + k * 3 + 0] = nx;
      normalArray[base + k * 3 + 1] = ny;
      normalArray[base + k * 3 + 2] = nz;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normalArray, 3));
  geometry.computeBoundingSphere();

  // Default = flat MeshBasicMaterial (ignoruje světlo, plné barvy vždy).
  // Lighting toggle ON přepne material na MeshLambertMaterial v main.js.
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 1.0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  // Ulož cached lambert pro toggle (lazy init: vytvoří se při prvním ON).
  mesh.userData._flatMaterial = material;
  return mesh;
}
