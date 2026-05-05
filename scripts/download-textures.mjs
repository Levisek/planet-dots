// Stáhne kompletní sadu textur (Sun + 9 planet + 19 měsíců + ring).
//
// Princip: textura MUSÍ být cylindrická equirectangular projekce (ne fotka sféry),
// jinak sphericalUV() v textureUtils.js dá špatné mapování → kontinenty / povrch
// na špatných místech, viditelný UV seam.
//
// Zdroje:
// - Solar System Scope (CC BY 4.0): Sun, Mercury, Venus, Earth, Moon, Mars,
//   Jupiter, Saturn, Uranus, Neptune. Definitivní cylindrické.
// - Björn Jónsson (bjj.mmedia.is, free non-commercial s attribution): Galileovy
//   měsíce + Rhea.
// - Wikimedia Commons: cylindrické mapy ostatních měsíců (NASA/JPL/USGS PD nebo
//   CC BY-SA per file).
//
// Usage:
//   node scripts/download-textures.mjs            # jen chybějící
//   node scripts/download-textures.mjs --force    # přepiš existující
//   node scripts/download-textures.mjs --only=earth,io   # jen vybrané

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEXDIR = path.join(ROOT, 'textures');
await fs.mkdir(TEXDIR, { recursive: true });

// Wikimedia vyžaduje identifying UA s contact info (jinak rate-limit 429).
// https://meta.wikimedia.org/wiki/User-Agent_policy
const UA = 'dots-edu/1.0 (https://github.com/anthropics/claude-code; education project)';
const MAX_DIM = 2048;

const sss = (name) => `https://www.solarsystemscope.com/textures/download/2k_${name}.jpg`;
const wm = (filename, width = 2048) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=${width}`;

const URLS = {
  // SUN + PLANETS — Solar System Scope (definitivní cylindric albedo)
  sun:     [sss('sun')],
  mercury: [sss('mercury')],
  venus:   [sss('venus_surface')],
  earth:   [sss('earth_daymap')],
  mars:    [sss('mars')],
  jupiter: [sss('jupiter')],
  saturn:  [sss('saturn')],
  uranus:  [sss('uranus')],
  neptune: [sss('neptune')],

  // MOON
  luna: [sss('moon')],

  // GALILEOVY + RHEA — Björn Jónsson
  io:       ['http://bjj.mmedia.is/data/io/io.jpg', wm('Io_map_projection_PIA00319.jpg')],
  europa:   ['http://bjj.mmedia.is/data/europa/europa.jpg'],
  ganymede: ['http://bjj.mmedia.is/data/ganymede/ganymede.jpg', wm('Map_of_Ganymede_by_Bj%C3%B6rn_J%C3%B3nsson.jpg')],
  callisto: ['http://bjj.mmedia.is/data/callisto/callisto.jpg', wm('Callisto_map_NASA_JPL_Voyager.jpg')],
  rhea:     ['http://bjj.mmedia.is/data/rhea/rhea_a.jpg'],

  // SATURN MOONS (kromě Rhea) — Wikimedia cylindrical
  titan:     [wm('Titan_map_April_2011_full.png')],
  iapetus:   [wm('Iapetus_May_2008_PIA11116_moon_only.jpg'), wm('Iapetus_May_2008_PIA11116.jpg')],
  dione:     [wm('Dione_map_2010_PIA12814.jpg')],
  tethys:    [wm('Tethys_map_June_2008_PIA08416_moon_only.jpg'), wm('Tethys_map_June_2008_PIA08416.jpg')],
  enceladus: [wm('Map_of_Enceladus_December_2008_PIA11145.jpg'), wm('Map_of_Enceladus_October_2009_PIA11680.jpg')],
  mimas:     [wm('Map_of_Mimas_2017-01_PIA17214.jpg'), wm('Map_of_Mimas_2010-02_PIA12780.jpg')],
  hyperion:  [wm('PIA07740_Hyperion_Cassini.jpg')],
  phoebe:    [wm('Phoebe_cassini.jpg'), wm('Phoebe_image.jpg')],

  // URANUS MOONS — Wikimedia (USGS Voyager)
  miranda: [wm('Miranda_map_JPL_USGS.jpg'), wm('Miranda_map.jpg')],
  ariel:   [wm('Ariel_map_JPL_USGS.jpg')],
  umbriel: [wm('Umbriel_map_JPL_USGS.jpg')],
  titania: [wm('Titania_map_JPL_USGS.jpg')],
  oberon:  [wm('Oberon_map_JPL_USGS.jpg')],

  // MARS MOONS
  phobos: [wm('Phobos_map_by_Askaniy.png')],
  deimos: [wm('Deimos_map_by_Askaniy.png')],

  // NEPTUNE MOON — Voyager 2 cylindrical
  triton: [wm('Triton_map_no_grid.jpg'), wm('Triton_map1987.png')],

  // ASTEROIDS — V4.3 teaser
  ceres:  [wm('Ceres_-_RC3_-_Haulani_Crater_(22381131691).jpg'), wm('PIA19310-Ceres-DwarfPlanet-Dawn-RC3-image19-20150506.jpg')],
  vesta:  [wm('Vesta_full_mosaic.jpg')],
  pallas: [wm('Pallas-HST-2007-2010.png')],
};

const RING = ['saturn_ring', 'https://www.solarsystemscope.com/textures/download/2k_saturn_ring_alpha.png', 'png'];

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Detekuj HTML response (404 page)
  const head = buf.slice(0, 16).toString('utf8').toLowerCase();
  if (head.startsWith('<!doctype') || head.startsWith('<html')) {
    throw new Error('HTML response (404)');
  }
  return buf;
}

/**
 * Pokud texture má >40 % dark pixelů (RGB sum < 120), vyplní chybějící část
 * mirror + Gaussian blur z existing hemisféry.
 *
 * @param {Buffer} buf — original image buffer
 * @returns {Promise<{buf: Buffer, completed: boolean, darkRatio: number}>}
 */
async function maybeCompleteHemisphere(buf) {
  const img = sharp(buf, { failOn: 'none' });
  const { width, height } = await img.metadata();
  const raw = await img.raw().toBuffer();

  // Detekuj dark pixely (RGB sum < 120)
  let darkCount = 0;
  for (let i = 0; i < raw.length; i += 3) {
    if (raw[i] + raw[i+1] + raw[i+2] < 120) darkCount++;
  }
  const darkRatio = darkCount / (width * height);

  if (darkRatio < 0.40) {
    return { buf, completed: false, darkRatio };
  }

  // Mirror flip horizontally + Gaussian blur 20px
  const mirrored = await sharp(buf, { failOn: 'none' })
    .flop()
    .blur(20)
    .toBuffer();

  // Alpha blend mirror over original (overlays into dark areas)
  const blended = await sharp(buf, { failOn: 'none' })
    .composite([{
      input: mirrored,
      blend: 'over',
      tile: false,
    }])
    .toBuffer();

  return { buf: blended, completed: true, darkRatio };
}

async function saveImage(buf, out, keepAlpha) {
  // sharp dekóduje + resize + saves
  let img = sharp(buf, { failOn: 'none' });
  const meta = await img.metadata();
  const max = Math.max(meta.width || 0, meta.height || 0);
  if (max > MAX_DIM) {
    img = img.resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', kernel: 'lanczos3' });
  }
  if (keepAlpha) {
    await img.png({ compressionLevel: 9 }).toFile(out);
  } else {
    await img.flatten({ background: '#000' }).jpeg({ quality: 88, mozjpeg: true }).toFile(out);
  }
  return (await fs.stat(out)).size;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function downloadOne(name, urls, force, ext) {
  const out = path.join(TEXDIR, `${name}.${ext}`);
  try {
    const stat = await fs.stat(out);
    if (!force && stat.size > 5000) {
      console.log(`[skip] ${name}.${ext} (${stat.size}b)`);
      return true;
    }
  } catch {}
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    // Wikimedia rate-limits unauthenticated requests — buď slušný a čekej.
    if (url.includes('commons.wikimedia.org')) await sleep(4000);
    try {
      const rawBuf = await fetchBuffer(url);
      let buf, completed = false, darkRatio = 0;
      if (ext === 'jpg') {
        ({ buf, completed, darkRatio } = await maybeCompleteHemisphere(rawBuf));
      } else {
        buf = rawBuf;
      }
      const size = await saveImage(buf, out, ext === 'png');
      const tag = completed ? `[ok+complete (${(darkRatio*100).toFixed(0)}% dark)]` : '[ok]';
      console.log(`${tag} ${name}.${ext} (${size}b) <- ${url.slice(0, 80)}`);
      return true;
    } catch (e) {
      const tag = i < urls.length - 1 ? 'fallback' : 'FAIL';
      console.log(`[${tag}] ${name}: ${e.message.slice(0, 60)} <- ${url.slice(0, 60)}`);
    }
  }
  return false;
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyArg = args.find((a) => a.startsWith('--only='));
const only = onlyArg ? new Set(onlyArg.slice(7).split(',')) : null;

const failed = [];
for (const [name, urls] of Object.entries(URLS)) {
  if (only && !only.has(name)) continue;
  const ok = await downloadOne(name, urls, force, 'jpg');
  if (!ok) failed.push(name);
}
if (!only || only.has(RING[0])) {
  const ok = await downloadOne(RING[0], [RING[1]], force, RING[2]);
  if (!ok) failed.push(RING[0]);
}

if (failed.length) {
  console.log(`\nSelhalo: ${failed.join(', ')} (${failed.length})`);
  process.exit(1);
}
console.log(`\nVšechny textury OK.`);
