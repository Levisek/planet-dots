import * as THREE from 'three';
import { icosphereRaw } from './geometry.js';
import { sampleColorPoleSafe, sphericalUV } from './textureUtils.js';
import { applySimplexDisplacement } from './displacement.js';

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

    // Centroid jen pro UV sampling (jedna barva per face → vintage flat-triangle look).
    const cx = (va[0] + vb[0] + vc[0]) / 3;
    const cy = (va[1] + vb[1] + vc[1]) / 3;
    const cz = (va[2] + vb[2] + vc[2]) / 3;
    const clen = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
    const [u, v] = sphericalUV(cx / clen, cy / clen, cz / clen, 1);
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

    // Per-face flat color (všechny 3 vrcholy stejná barva = vintage flat tri).
    // Per-vertex SMOOTH normals (radial = vrchol sám, už unit). Gouraud pak
    // interpoluje Lambertian přes face boundary → terminator je gradient,
    // ne ostrá černá čára (ta vznikala s per-face flat normals tam, kde
    // n·L překlopil znaménko mezi sousedními face — dříve viditelné jako
    // svislý černý pruh uprostřed sféry při bočním osvětlení).
    for (let k = 0; k < 3; k++) {
      colorArray[base + k * 3 + 0] = cr;
      colorArray[base + k * 3 + 1] = cg;
      colorArray[base + k * 3 + 2] = cb;
    }
    normalArray[base + 0] = va[0]; normalArray[base + 1] = va[1]; normalArray[base + 2] = va[2];
    normalArray[base + 3] = vb[0]; normalArray[base + 4] = vb[1]; normalArray[base + 5] = vb[2];
    normalArray[base + 6] = vc[0]; normalArray[base + 7] = vc[1]; normalArray[base + 8] = vc[2];
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normalArray, 3));
  geometry.computeBoundingSphere();

  // Default = flat MeshBasicMaterial (ignoruje světlo, plné barvy vždy).
  // Lighting toggle ON přepne material na MeshLambertMaterial v main.js.
  // transparent: false od začátku — fadeOthers dynamicky zapne přechodně
  // (jinak vznikají render-order artefakty / "stíny" v MAIN view).
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: false,
    opacity: 1.0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  // Ulož cached lambert pro toggle (lazy init: vytvoří se při prvním ON).
  mesh.userData._flatMaterial = material;
  return mesh;
}

/**
 * Aplikuje body.shape na mesh:
 *  - body.shape.scale: [x, y, z] non-uniform scale
 *  - body.shape.tilt: [rx, ry, rz] axial tilt (rad)
 *  - body.shape.displacement: { type, amplitude, seed } simplex noise
 *
 * @param {THREE.Mesh} mesh
 * @param {object} body — body data (planet/moon/asteroid)
 */
export function applyShape(mesh, body) {
  if (!body || !body.shape) return;
  if (body.shape.scale) {
    mesh.scale.set(...body.shape.scale);
  }
  if (body.shape.tilt) {
    mesh.rotation.set(...body.shape.tilt);
  }
  if (body.shape.displacement) {
    applySimplexDisplacement(mesh.geometry, body.shape.displacement);
  }
}
