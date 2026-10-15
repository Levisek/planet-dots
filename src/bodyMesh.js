import * as THREE from 'three';
import { icosphereRaw } from './geometry.js';
import { sampleColorPoleSafe, sphericalUV, srgbToLinear } from './textureUtils.js';
import { applySimplexDisplacement, makeSeededSimplex } from './displacement.js';

// Barycentrické body vzorkování: těžiště 4 pod-trojúhelníků (dělení 2×).
// Texturu předem zmenšíme průměrem bloků 4×4 (downsample4), takže 4 vzorky
// pokryjí ~64 px originálu — skoro celý trojúhelník (~100 px) za zlomek
// ceny 16 vzorků z plné textury (~45 ms na těleso, na telefonu násobky).
const FACE_SAMPLES = (() => {
  const n = 2, out = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; i + j < n; j++) {
      out.push([(i + 1 / 3) / n, (j + 1 / 3) / n]);
      if (i + j < n - 1) out.push([(i + 2 / 3) / n, (j + 2 / 3) / n]);
    }
  }
  return out;
})();

const _small = new WeakMap();
/** ImageData zmenšená průměrem bloků 4×4 (sRGB průměr, cache per textura). */
export function downsample4(imageData) {
  const hit = _small.get(imageData);
  if (hit) return hit;
  const { data, width, height } = imageData;
  const w = Math.max(1, width >> 2), h = Math.max(1, height >> 2);
  const out = new Uint8ClampedArray(w * h * 4);
  // Jeden průchod po řádcích originálu, součty do řádku výstupu. Okrajové
  // sloupce/řádky za násobkem 4 se zahodí (textury jsou 2048×1024 ap.).
  // Čtení po celých pixelech (RGBA v jednom Uint32, little-endian) je
  // ~3× rychlejší než po bajtech.
  const px = new Uint32Array(data.buffer, data.byteOffset, width * height);
  const acc = new Uint32Array(w * 3);
  for (let y = 0; y < h * 4; y++) {
    let i = y * width;
    for (let x = 0; x < w; x++) {
      const o = x * 3;
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < 4; k++, i++) {
        const v = px[i];
        r += v & 255; g += (v >>> 8) & 255; b += (v >>> 16) & 255;
      }
      acc[o] += r; acc[o + 1] += g; acc[o + 2] += b;
    }
    if ((y & 3) === 3) {
      const row = (y >> 2) * w * 4;
      for (let x = 0; x < w; x++) {
        out[row + x * 4] = acc[x * 3] / 16;
        out[row + x * 4 + 1] = acc[x * 3 + 1] / 16;
        out[row + x * 4 + 2] = acc[x * 3 + 2] / 16;
        out[row + x * 4 + 3] = 255;
      }
      acc.fill(0);
    }
  }
  const small = { data: out, width: w, height: h };
  _small.set(imageData, small);
  return small;
}

/** Průměrná lineární barva textury přes trojúhelník (vrcholy na jednotkové sféře). */
export function averageFaceColor(imageData, va, vb, vc) {
  let r = 0, g = 0, b = 0;
  for (const [s, t] of FACE_SAMPLES) {
    const w = 1 - s - t;
    const x = va[0] * s + vb[0] * t + vc[0] * w;
    const y = va[1] * s + vb[1] * t + vc[1] * w;
    const z = va[2] * s + vb[2] * t + vc[2] * w;
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    const [u, v] = sphericalUV(x / len, y / len, z / len, 1);
    const [sr, sg, sb] = sampleColorPoleSafe(imageData, u, v);
    r += srgbToLinear(sr); g += srgbToLinear(sg); b += srgbToLinear(sb);
  }
  const k = 1 / FACE_SAMPLES.length;
  return [r * k, g * k, b * k];
}

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
  const small = downsample4(imageData);

  const numTris = faces.length;
  const posArray = new Float32Array(numTris * 3 * 3);
  const colorArray = new Float32Array(numTris * 3 * 3);
  const normalArray = new Float32Array(numTris * 3 * 3);

  for (let i = 0; i < numTris; i++) {
    const [a, b, c] = faces[i];
    const va = vertices[a];
    const vb = vertices[b];
    const vc = vertices[c];

    // Jedna barva per face (vintage flat-triangle look) = průměr plochy
    // trojúhelníku. Trojúhelník kryje ~100 px textury; jeden vzorek ze
    // středu dával zrnitý šum (Jupiterovy pásy, pevnina Země).
    const [cr, cg, cb] = averageFaceColor(small, va, vb, vc);

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
