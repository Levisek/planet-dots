import * as THREE from 'three';
import { icosphereRaw } from './geometry.js';
import { sampleColorPoleSafe, sphericalUV, srgbToLinear } from './textureUtils.js';
import { applySimplexDisplacement, makeSeededSimplex } from './displacement.js';

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
    const [sr, sg, sb] = sampleColorPoleSafe(imageData, u, v);
    const cr = srgbToLinear(sr), cg = srgbToLinear(sg), cb = srgbToLinear(sb);

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
 * Fallback sféra pro tělesa bez cylindrické mapy (texture: null — Hyperion,
 * Phoebe). Stejná icosphere jako buildBodyMesh, barva z body.color jemně
 * skvrněná šumem (±15 %) — s jednolitou barvou a vypnutými stíny byl tvar
 * nečitelný, jen plochá silueta.
 */
export function buildFallbackMesh(radius, hexColor, minVertices, seed = 'fallback') {
  const { vertices, faces } = icosphereRaw(minVertices);
  const noise = makeSeededSimplex(`${seed}-albedo`);
  const numTris = faces.length;
  const posArray = new Float32Array(numTris * 9);
  const colorArray = new Float32Array(numTris * 9);
  const normalArray = new Float32Array(numTris * 9);
  const c = new THREE.Color(hexColor); // z hex → lineární (ColorManagement)
  for (let i = 0; i < numTris; i++) {
    const [a, b, cc] = faces[i];
    const va = vertices[a], vb = vertices[b], vc = vertices[cc];
    const cx = (va[0] + vb[0] + vc[0]) / 3;
    const cy = (va[1] + vb[1] + vc[1]) / 3;
    const cz = (va[2] + vb[2] + vc[2]) / 3;
    const k = 1 + 0.15 * (0.7 * noise(cx * 3, cy * 3, cz * 3) + 0.3 * noise(cx * 9, cy * 9, cz * 9));
    const base = i * 9;
    const verts = [va, vb, vc];
    for (let v = 0; v < 3; v++) {
      const p = verts[v];
      posArray[base + v * 3] = p[0] * radius;
      posArray[base + v * 3 + 1] = p[1] * radius;
      posArray[base + v * 3 + 2] = p[2] * radius;
      normalArray[base + v * 3] = p[0];
      normalArray[base + v * 3 + 1] = p[1];
      normalArray[base + v * 3 + 2] = p[2];
      colorArray[base + v * 3] = c.r * k;
      colorArray[base + v * 3 + 1] = c.g * k;
      colorArray[base + v * 3 + 2] = c.b * k;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normalArray, 3));
  geo.computeBoundingSphere();
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: false, opacity: 1.0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData._flatMaterial = mat;
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
