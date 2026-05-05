// Generuje procedurální cylindrické equirectangular textury pro tělesa bez fotografických map.
// Aktuálně: Pallas (žádná cylindrická mapa neexistuje — pouze Hubble orthographic).
//
// Algoritmus: multi-oktávový simplex 2D noise → plynulý moonscape terén.
// Výstup: JPEG 2048×1024, quality 88.
//
// Usage: node scripts/build-procedural-textures.mjs

import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEXDIR = path.join(ROOT, 'textures');

// --- Inline Simplex 2D ---
// Klasická implementace (Stefan Gustavson, public domain)
// Ref: https://weber.itn.liu.se/~stegu/simplexnoise/simplexnoise.pdf

function buildSimplex2D(seed = 0) {
  // Permutation table seeded deterministicky
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  // Shuffle s LCG seeded
  let s = (seed * 2654435761) >>> 0;
  for (let i = 255; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [base[i], base[j]] = [base[j], base[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];

  const grad2 = [
    [1,1],[-1,1],[1,-1],[-1,-1],
    [1,0],[-1,0],[0,1],[0,-1],
  ];

  function dot(g, x, y) { return g[0]*x + g[1]*y; }

  function noise(xin, yin) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t, Y0 = j - t;
    const x0 = xin - X0, y0 = yin - Y0;
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2*G2, y2 = y0 - 1 + 2*G2;
    const ii = i & 255, jj = j & 255;
    const gi0 = perm[ii + perm[jj]] % 8;
    const gi1 = perm[ii + i1 + perm[jj + j1]] % 8;
    const gi2 = perm[ii + 1 + perm[jj + 1]] % 8;
    let t0 = 0.5 - x0*x0 - y0*y0;
    let n0 = t0 < 0 ? 0 : (t0 *= t0, t0 * t0 * dot(grad2[gi0], x0, y0));
    let t1 = 0.5 - x1*x1 - y1*y1;
    let n1 = t1 < 0 ? 0 : (t1 *= t1, t1 * t1 * dot(grad2[gi1], x1, y1));
    let t2 = 0.5 - x2*x2 - y2*y2;
    let n2 = t2 < 0 ? 0 : (t2 *= t2, t2 * t2 * dot(grad2[gi2], x2, y2));
    // Výstup v rozsahu [-1, 1]
    return 70.1464 * (n0 + n1 + n2);
  }

  return noise;
}

// Clamp pomocník
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// Deterministický seed ze stringu
function strSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0;
  return h;
}

async function buildProceduralTexture({
  width = 2048,
  height = 1024,
  baseColor = [154, 141, 122],   // RGB 0-255 — základní barva povrchu
  variation = 28,                  // ±px intenzita tmavých/světlých oblastí
  octaves = [                      // [freq_scale, amplitude_weight]
    [0.004,  0.55],                // velké kontinentální vzory
    [0.015,  0.28],                // střední terén
    [0.060,  0.12],                // drobné skály/krátery hrany
    [0.240,  0.05],                // jemný šum (zrnitost)
  ],
  seed = 'planet',
  outputPath,
}) {
  const noise = buildSimplex2D(strSeed(seed));
  const buf = new Uint8Array(width * height * 3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Cylindrická kontinuita (seam na x=0 == x=width): použij wraparound
      // Mapuj x → úhel 0..2π, pak noise ve 3D (cos,sin,y) → bez švů
      const theta = (x / width) * 2 * Math.PI;
      const nx = Math.cos(theta);
      const nz = Math.sin(theta);
      const ny = y / height;

      // Multi-oktávový noise — v 2D aproximaci (nx+nz, ny) — dost dobré pro moonscape
      let n = 0;
      for (const [freq, amp] of octaves) {
        n += noise((nx + nz) * freq * width * 0.5, ny * freq * height) * amp;
      }
      // n ∈ přibližně [-1, 1]
      const offset = n * variation;
      const idx = (y * width + x) * 3;
      buf[idx]     = clamp(baseColor[0] + offset, 0, 255);
      buf[idx + 1] = clamp(baseColor[1] + offset, 0, 255);
      buf[idx + 2] = clamp(baseColor[2] + offset, 0, 255);
    }
  }

  await sharp(buf, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(outputPath);

  const stat = await fs.stat(outputPath);
  console.log(`[ok] ${path.basename(outputPath)} (${(stat.size / 1024).toFixed(0)}KB) — seed="${seed}"`);
}

await fs.mkdir(TEXDIR, { recursive: true });

// Pallas — šedohnědý moonscape, karbonaceous chondrite
await buildProceduralTexture({
  baseColor: [130, 127, 122],   // neutrální tmavě šedá (C-typ asteroid)
  variation: 45,
  octaves: [
    [0.004, 0.52],
    [0.016, 0.30],
    [0.065, 0.13],
    [0.260, 0.05],
  ],
  seed: 'pallas-2b-v1',
  outputPath: path.join(TEXDIR, 'pallas.jpg'),
});

// Sinope — Jupiter outer irregular, dark D-type asteroid (carbonaceous)
await buildProceduralTexture({
  baseColor: [96, 80, 64],   // tmavě hnědá (D-typ, captured outer asteroid)
  variation: 22,
  octaves: [
    [0.005, 0.55],
    [0.020, 0.27],
    [0.080, 0.13],
    [0.300, 0.05],
  ],
  seed: 'sinope-jupiter',
  outputPath: path.join(TEXDIR, 'sinope.jpg'),
});

// Pasiphae — Jupiter outer irregular, dark D-type (lehce odlišný)
await buildProceduralTexture({
  baseColor: [85, 70, 56],   // ještě tmavší hnědá
  variation: 24,
  octaves: [
    [0.006, 0.50],
    [0.022, 0.30],
    [0.085, 0.14],
    [0.290, 0.06],
  ],
  seed: 'pasiphae-jupiter',
  outputPath: path.join(TEXDIR, 'pasiphae.jpg'),
});

console.log('\nProcedurální textury OK.');
