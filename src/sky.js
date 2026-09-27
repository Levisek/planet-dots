// sky — skutečná obloha za soustavou: 5 044 hvězd do mag 6 a tečky Mléčné
// dráhy (data d3-celestial, src/skyData.js, build scripts/build-sky.mjs).
//
// Hvězdy leží v nekonečnu: koule jede s kamerou (update), takže nemají
// paralaxu, ať kamera letí kamkoli. Směr z RA/Dec J2000 přes poleToScene
// (EQJ → ekliptika → scéna) — souhvězdí jsou tam, kde je vidí planety.
// Barva z B–V (teplota → černé těleso, zjemněná k bílé, jak ji vidí oko),
// velikost a jas z magnitudy.

import * as THREE from 'three';
import { poleToScene } from './coordinateFrame.js';
import { STAR_COUNT, STARS_B64, MILKY_WAY_COUNT, MILKY_WAY_B64 } from './skyData.js';

const SKY_RADIUS = 900000; // uvnitř far plane (2M) i s kamerou kdekoli

/** B–V → efektivní teplota (Ballesteros 2012). */
export function bvToKelvin(bv) {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

/** Teplota → barva černého tělesa, sRGB 0..1 (aproximace T. Hellanda). */
export function kelvinToRgb(k) {
  const t = Math.min(40000, Math.max(1000, k)) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (v) => Math.min(1, Math.max(0, v / 255));
  return [c(r), c(g), c(b)];
}

/** Barva hvězdy: černé těleso napůl smíchané s bílou (oko barvy tlumí). */
export function starColor(bv) {
  const [r, g, b] = kelvinToRgb(bvToKelvin(bv));
  const w = 0.45;
  return [r * (1 - w) + w, g * (1 - w) + w, b * (1 - w) + w];
}

/** Magnituda → velikost (CSS px) a jas. Sirius (−1,5) ~4 px, mag 6 ~1 px slabě. */
export function starStyle(mag) {
  const t = Math.min(1, Math.max(0, (6 - mag) / 7.5));
  return { size: 1 + 3 * Math.pow(t, 1.6), alpha: 0.25 + 0.75 * Math.pow(t, 0.6) };
}

function b64ToView(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new DataView(bytes.buffer);
}
const deq = (u, lo, hi) => lo + (u / 65535) * (hi - lo);

/** Dekóduje hvězdy → [{ ra, dec, mag, bv }] (stupně). */
export function decodeStars(b64 = STARS_B64, count = STAR_COUNT) {
  const v = b64ToView(b64);
  const out = new Array(count);
  for (let i = 0; i < count; i++) {
    const o = i * 8;
    out[i] = {
      ra: deq(v.getUint16(o, true), 0, 360),
      dec: deq(v.getUint16(o + 2, true), -90, 90),
      mag: v.getInt16(o + 4, true) / 1000,
      bv: v.getInt16(o + 6, true) / 1000,
    };
  }
  return out;
}

/** Dekóduje tečky Mléčné dráhy → [{ ra, dec, level }] (level 0 = okraj … 4 = jádro). */
export function decodeMilkyWay(b64 = MILKY_WAY_B64, count = MILKY_WAY_COUNT) {
  const v = b64ToView(b64);
  const out = new Array(count);
  for (let i = 0; i < count; i++) {
    const o = i * 5;
    out[i] = {
      ra: deq(v.getUint16(o, true), 0, 360),
      dec: deq(v.getUint16(o + 2, true), -90, 90),
      level: v.getUint8(o + 4),
    };
  }
  return out;
}

// Mléčná dráha: okraj namodralý a slabý, jádro teplejší; úrovně se překrývají,
// takže se jas v jádru sčítá.
const MW_ALPHA = [0.2, 0.22, 0.24, 0.26, 0.3];
const MW_COLOR = [[0.78, 0.83, 1.0], [0.84, 0.86, 1.0], [0.92, 0.9, 0.95], [1.0, 0.93, 0.85], [1.0, 0.9, 0.78]];

const VERT = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute vec3 tint;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vAlpha = alpha;
    vTint = tint;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * uPixelRatio;
  }
`;
const FRAG = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = vAlpha * uOpacity * (1.0 - smoothstep(0.45, 1.0, d));
    if (a <= 0.002) discard;
    gl_FragColor = vec4(vTint, a); // AdditiveBlending = SrcAlpha, One
  }
`;

/**
 * @param {THREE.Scene} scene
 * @param {{ pixelRatio?: number }} [opts]
 * @returns {{ object: THREE.Points, update(camera: THREE.Camera): void, setOpacity(a: number): void }}
 */
export function createSky(scene, { pixelRatio = 1 } = {}) {
  const stars = decodeStars();
  const mw = decodeMilkyWay();
  const n = stars.length + mw.length;
  const pos = new Float32Array(n * 3);
  const tint = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const alpha = new Float32Array(n);

  let i = 0;
  // Mléčná dráha první — hvězdy se kreslí přes ni.
  for (const p of mw) {
    const d = poleToScene(p.ra, p.dec);
    pos.set([d.x * SKY_RADIUS, d.y * SKY_RADIUS, d.z * SKY_RADIUS], i * 3);
    tint.set(MW_COLOR[p.level], i * 3);
    // Deterministický rozptyl jasu, ať pás není rovnoměrná mlha.
    const h = Math.sin(i * 12.9898) * 43758.5453;
    const jitter = 0.5 + (h - Math.floor(h));
    size[i] = 2.2;
    alpha[i] = MW_ALPHA[p.level] * jitter;
    i++;
  }
  for (const s of stars) {
    const d = poleToScene(s.ra, s.dec);
    pos.set([d.x * SKY_RADIUS, d.y * SKY_RADIUS, d.z * SKY_RADIUS], i * 3);
    tint.set(starColor(s.bv), i * 3);
    const st = starStyle(s.mag);
    size[i] = st.size;
    alpha[i] = st.alpha;
    i++;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
  geom.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geom.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  // Koule jede s kamerou — bounding sphere přes celou oblohu, frustum culling
  // by ji jinak mohl zahodit.
  geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), SKY_RADIUS * 1.01);

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uPixelRatio: { value: pixelRatio }, uOpacity: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geom, material);
  points.frustumCulled = false;
  points.renderOrder = -10; // první — tělesa i tečky přes ni
  points.name = 'sky';
  scene.add(points);

  return {
    object: points,
    update(camera) {
      points.position.copy(camera.position);
    },
    setOpacity(a) {
      material.uniforms.uOpacity.value = a;
    },
  };
}
