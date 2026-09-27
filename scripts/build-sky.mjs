// build-sky — z dat d3-celestial (Olaf Frohn, BSD-3, viz vendor/d3-celestial/LICENSE)
// vyrobí src/skyData.js: jasné hvězdy (mag ≤ 6) a tečky Mléčné dráhy.
//
//   node scripts/build-sky.mjs <adresář se stars.6.json a mw.json> [--png out.png]
//
// Data se stáhnou z github.com/ofrohn/d3-celestial (data/stars.6.json,
// data/mw.json). --png vykreslí kontrolní mapu (ekvidistantní RA/Dec).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.argv[2];
if (!dir) { console.error('použití: node scripts/build-sky.mjs <adresář s daty> [--png out.png]'); process.exit(1); }
const pngOut = process.argv.includes('--png') ? process.argv[process.argv.indexOf('--png') + 1] : null;

const stars = JSON.parse(fs.readFileSync(path.join(dir, 'stars.6.json'), 'utf8')).features;
const mw = JSON.parse(fs.readFileSync(path.join(dir, 'mw.json'), 'utf8')).features;

// Deterministický generátor (mulberry32) — build dává pokaždé stejný soubor.
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260927);

const wrap = (d) => ((d + 540) % 360) - 180; // → (-180, 180]

// Bod uvnitř oblasti (sudo-lichá parita): paprsek od bodu k severnímu pólu
// po poledníku, počítají se hrany, které ho kříží severně od bodu. Hrany jdou
// přes ±180° po kratším oblouku, takže pás kolem celé oblohy (dva okraje,
// každý obtočí sféru) vychází správně: mezi okraji 1 průsečík, mimo 0 nebo 2.
function insideRings(lon, lat, rings) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, n = ring.length; i < n; i++) {
      const [l1, p1] = ring[i];
      const [l2, p2] = ring[(i + 1) % n];
      const d = wrap(l2 - l1);
      if (d === 0) continue;
      const t = wrap(lon - l1) / d;
      if (t < 0 || t >= 1) continue;
      if (p1 + (p2 - p1) * t > lat) inside = !inside;
    }
  }
  return inside;
}

// Hvězdy: RA/Dec ve stupních, mag, B–V (u pár hvězd chybí → 0,6 ≈ Slunce).
const starRows = [];
for (const f of stars) {
  const [lon, dec] = f.geometry.coordinates;
  const ra = lon < 0 ? lon + 360 : lon;
  const bv = parseFloat(f.properties.bv);
  starRows.push([ra, dec, f.properties.mag, Number.isFinite(bv) ? bv : 0.6]);
}
starRows.sort((a, b) => a[2] - b[2]); // jasné první

// Mléčná dráha: ol1 (nejslabší, největší) … ol5 (jádro). Každá úroveň
// dostane tečky rovnoměrně po své ploše; úrovně se překrývají, takže jas
// se v jádru sčítá.
const PER_LEVEL = [5000, 4000, 3000, 2000, 1200];
const mwRows = [];
mw.forEach((f, li) => {
  const rings = f.geometry.coordinates.flat(1); // MultiPolygon → všechny prstence
  let got = 0, tries = 0;
  while (got < PER_LEVEL[li] && tries < 5e6) {
    tries++;
    // rovnoměrně po sféře
    const lon = rand() * 360 - 180;
    const lat = (Math.asin(rand() * 2 - 1) * 180) / Math.PI;
    if (!insideRings(lon, lat, rings)) continue;
    mwRows.push([lon < 0 ? lon + 360 : lon, lat, li]);
    got++;
  }
  console.log(`${f.id}: ${got} teček z ${tries} pokusů (${((got / tries) * 100).toFixed(1)} % oblohy)`);
});

// Kódování: Uint16 pro RA (0–360°) a Dec (−90–90°), Int16 pro mag×1000
// a B–V×1000, Uint8 pro úroveň — base64, ať je modul malý a bez fetch.
const q = (v, lo, hi) => Math.round(((v - lo) / (hi - lo)) * 65535);
const sb = Buffer.alloc(starRows.length * 8);
starRows.forEach(([ra, dec, mag, bv], i) => {
  sb.writeUInt16LE(q(ra, 0, 360), i * 8);
  sb.writeUInt16LE(q(dec, -90, 90), i * 8 + 2);
  sb.writeInt16LE(Math.round(mag * 1000), i * 8 + 4);
  sb.writeInt16LE(Math.round(bv * 1000), i * 8 + 6);
});
const mb = Buffer.alloc(mwRows.length * 5);
mwRows.forEach(([ra, dec, lvl], i) => {
  mb.writeUInt16LE(q(ra, 0, 360), i * 5);
  mb.writeUInt16LE(q(dec, -90, 90), i * 5 + 2);
  mb.writeUInt8(lvl, i * 5 + 4);
});

const out = `// VYGENEROVÁNO scripts/build-sky.mjs — needitovat ručně.
// Data: d3-celestial, Copyright (c) 2015, Olaf Frohn, BSD-3-Clause
// (vendor/d3-celestial/LICENSE). Hvězdy do mag 6 (Hipparcos/Yale BSC),
// obrys Mléčné dráhy (5 úrovní jasu) vzorkovaný na tečky.
//
// STARS: ${starRows.length} × [u16 RA, u16 Dec, i16 mag×1000, i16 B–V×1000], LE
// MILKY_WAY: ${mwRows.length} × [u16 RA, u16 Dec, u8 úroveň 0–4], LE
// RA 0–360° a Dec −90–90° lineárně na 0–65535.

export const STAR_COUNT = ${starRows.length};
export const STARS_B64 = '${sb.toString('base64')}';
export const MILKY_WAY_COUNT = ${mwRows.length};
export const MILKY_WAY_B64 = '${mb.toString('base64')}';
`;
fs.writeFileSync(path.join(ROOT, 'src', 'skyData.js'), out);
console.log(`src/skyData.js: ${starRows.length} hvězd, ${mwRows.length} teček Mléčné dráhy, ${(out.length / 1024).toFixed(0)} kB`);

if (pngOut) {
  // Kontrolní mapa 1440×720: RA zprava doleva (jako na obloze), Mléčná dráha šedě, hvězdy bíle.
  const W = 1440, H = 720, img = Buffer.alloc(W * H);
  const px = (ra, dec) => [Math.floor(((360 - ra) / 360) * (W - 1)), Math.floor(((90 - dec) / 180) * (H - 1))];
  for (const [ra, dec, l] of mwRows) { const [x, y] = px(ra, dec); img[y * W + x] = Math.min(255, img[y * W + x] + 40 + l * 20); }
  for (const [ra, dec, mag] of starRows) { const [x, y] = px(ra, dec); img[y * W + x] = 255; if (mag < 2) { img[y * W + x + 1] = 255; img[(y + 1) * W + x] = 255; } }
  const raw = Buffer.alloc((W + 1) * H);
  for (let y = 0; y < H; y++) img.copy(raw, y * (W + 1) + 1, y * W, (y + 1) * W);
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 0;
  fs.writeFileSync(pngOut, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  console.log('mapa:', pngOut);
}
