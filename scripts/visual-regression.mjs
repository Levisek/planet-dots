// Vizuální regrese — strukturální invarianty místo pixel-diffu.
//
// Pixel-diff je pro tuhle scénu nepoužitelný (orbitální pozice závisí na čase,
// sunspoty jsou náhodné). Místo toho assertujeme invarianty přes window.__debug
// (camera, controls, anchors — viz main.js debug API):
//
//   1. Žádné console/page errory, žádné externí requesty (offline soběstačnost).
//   2. Detail view klíčových těles: mesh viditelný, kamera cílí na anchor,
//      těleso má rozumnou úhlovou velikost, Slunce není ve frustu (photobomb).
//   3. Saturn detail: ring mesh viditelný.
//
// Tyhle invarianty by chytily VISUAL-AUDIT nálezy C1, C2 i I2 (2026-07-16).
// Screenshoty se ukládají do .levis-tmp/visual-regression/ pro ruční kontrolu.
//
// Usage: node scripts/visual-regression.mjs            # spustí vlastní server :3003
//        node scripts/visual-regression.mjs --all      # audit VŠECH těles × oba módy
//        VR_CHANNEL=chrome node scripts/...            # systémový Chrome místo bundled

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ALL = process.argv.includes('--all');
const SHOT_DIR = path.join(ROOT, '.levis-tmp', ALL ? 'visual-audit-all' : 'visual-regression');
await fs.mkdir(SHOT_DIR, { recursive: true });

const PORT = 3003;
const SUN_RADIUS = 995; // scene units, radius Slunce v Pochopení
const FOV_DEG = 45;

// Tělesa pokrývající rizikové třídy: velká planeta s ringem, plynný obr,
// terestrická planeta, fallback moon (bez textury), asteroid.
const DETAIL_BODIES = ['saturn', 'jupiter', 'earth', 'hyperion', 'ceres'];

const failures = [];
const check = (cond, label) => {
  console.log(`  ${cond ? 'ok' : 'FAIL'} — ${label}`);
  if (!cond) failures.push(label);
};

// --- server ---
const srv = spawn('npx', ['--yes', 'serve', '-l', String(PORT), '.'], {
  shell: process.platform === 'win32', stdio: 'ignore', cwd: ROOT,
});
// Poll dokud server neodpovídá (npx cold start umí trvat >4s).
for (let i = 0; ; i++) {
  try {
    await fetch(`http://localhost:${PORT}/`, { method: 'HEAD' });
    break;
  } catch {
    if (i >= 30) { console.error(`serve na :${PORT} nenastartoval do 30s`); process.exit(1); }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const launchOpts = { headless: true };
if (process.env.VR_CHANNEL) launchOpts.channel = process.env.VR_CHANNEL;
const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const errors = [];
const externalHosts = new Set();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push(`PAGE: ${String(e).slice(0, 200)}`));
page.on('request', (r) => {
  const u = new URL(r.url());
  if (u.hostname !== 'localhost') externalHosts.add(u.hostname);
});

console.log(`Loading http://localhost:${PORT} ...`);
await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(8000); // app boot + začátek formace (detail force-settluje mesh)

console.log('\n[global]');
check(errors.length === 0, `žádné console errory (${errors.length}: ${errors[0] || ''})`);
check(externalHosts.size === 0, `žádné externí requesty (${[...externalHosts].join(',') || 'none'})`);
check(await page.evaluate(() => {
  const c = document.getElementById('canvas');
  return !!c && c.width > 0;
}), 'canvas renderuje');
check(await page.evaluate(() => document.fonts.check('9px "Press Start 2P"')), 'font načten lokálně');
await page.screenshot({ path: path.join(SHOT_DIR, 'overview.png') });

// --- plán: (id, mode) dvojice ---
let currentMode = 'pochopeni';
async function setMode(mode) {
  if (mode === currentMode) return;
  await page.evaluate((m) => document.querySelector(`#topToggles button[data-mode="${m}"]`)?.click(), mode);
  await page.waitForTimeout(1500);
  currentMode = mode;
}

let plan;
if (ALL) {
  const ids = await page.evaluate(() => ({
    planets: Object.keys(window.__debug.anchors),
    moons: Object.keys(window.__debug.moonAnchors),
    asteroids: Object.keys(window.__debug.asteroidAnchors || {}),
  }));
  const bodies = [...ids.planets, ...ids.moons, ...ids.asteroids];
  plan = ['pochopeni', 'fyzikalni'].flatMap((mode) => bodies.map((id) => ({ id, mode })));
  console.log(`\n--all: ${bodies.length} těles × 2 módy (${ids.planets.length} planet, ${ids.moons.length} měsíců, ${ids.asteroids.length} asteroidů)`);
} else {
  plan = DETAIL_BODIES.map((id) => ({ id, mode: 'pochopeni' }));
}

const report = [];

// --- detail view invarianty ---
for (const { id, mode } of plan) {
  const tag = ALL ? `${id} (${mode})` : id;
  console.log(`\n[detail: ${tag}]`);
  await setMode(mode);
  const d = await page.evaluate(async (bodyId) => {
    window.__dotsAudit.enter(bodyId);
    // Poll na DETAIL místo fixního čekání — tween je 0.8s, ale headless frame
    // občas zaškobrtne a enter() je během TRANSITION_IN ignorován.
    const t0 = performance.now();
    while (window.__dotsAudit.state() !== 'DETAIL' && performance.now() - t0 < 6000) {
      await new Promise((r) => setTimeout(r, 150));
    }
    await new Promise((r) => setTimeout(r, 300)); // dojezd kamery/labelů
    const dbg = window.__debug;
    const anchor = dbg.anchors[bodyId] || dbg.moonAnchors[bodyId] || dbg.asteroidAnchors?.[bodyId];
    if (!anchor) return { error: 'anchor nenalezen' };
    const cam = dbg.camera, tgt = dbg.controls.target;
    // World position — moon/asteroid anchory mají position lokální vůči rodiči.
    const p = anchor.getWorldPosition(new anchor.position.constructor());
    const dist = cam.position.distanceTo(p);
    const meshes = anchor.children.filter((c) => c.isMesh);
    const visMesh = meshes.find((m) => m.visible && m.geometry?.type !== 'RingGeometry');
    if (visMesh && !visMesh.geometry.boundingSphere) visMesh.geometry.computeBoundingSphere();
    const ring = meshes.find((m) => m.geometry?.type === 'RingGeometry');
    const r = visMesh?.geometry?.boundingSphere
      ? visMesh.geometry.boundingSphere.radius * visMesh.scale.x
      : 0;
    // Slunce ve frustu? Úhel mezi view osou a směrem ke Slunci (origin)
    // vs. půl-diagonála FOV + úhlový poloměr Slunce.
    const vx = tgt.x - cam.position.x, vy = tgt.y - cam.position.y, vz = tgt.z - cam.position.z;
    const vl = Math.hypot(vx, vy, vz);
    const sl = Math.hypot(cam.position.x, cam.position.y, cam.position.z);
    const cosA = (-cam.position.x * vx - cam.position.y * vy - cam.position.z * vz) / (vl * sl);
    return {
      state: window.__dotsAudit.state(),
      targetDist: Math.hypot(tgt.x - p.x, tgt.y - p.y, tgt.z - p.z),
      camDist: dist,
      meshVisible: !!visMesh,
      angularDeg: r > 0 ? 2 * Math.atan(r / dist) * 180 / Math.PI : 0,
      ringVisible: ring ? ring.visible : null,
      sunAngleDeg: Math.acos(Math.max(-1, Math.min(1, cosA))) * 180 / Math.PI,
      sunDist: sl,
    };
  }, id);

  const c = (cond, label) => check(cond, ALL ? `${tag}: ${label}` : label);
  if (d.error) { c(false, d.error); report.push({ id, mode, error: d.error }); continue; }
  c(d.state === 'DETAIL', `state DETAIL (${d.state})`);
  c(d.targetDist < 5, `kamera cílí na anchor (offset ${d.targetDist.toFixed(1)})`);
  c(d.meshVisible, 'mesh tělesa viditelný');
  c(d.angularDeg >= 2 && d.angularDeg <= 60,
    `úhlová velikost 2–60° (${d.angularDeg.toFixed(1)}°)`);
  // Slunce mimo frame: úhel k Slunci > půl-diagonála FOV (~34° @ 1280×800) + úhlový poloměr.
  const sunHalfAngle = Math.asin(Math.min(1, SUN_RADIUS / d.sunDist)) * 180 / Math.PI;
  const halfDiag = FOV_DEG / 2 * 1.5; // aproximace diagonálního FOV
  c(id === 'sun' || d.sunAngleDeg > halfDiag + sunHalfAngle || d.sunDist > 20000,
    `Slunce mimo frustum (úhel ${d.sunAngleDeg.toFixed(0)}°, potřeba >${(halfDiag + sunHalfAngle).toFixed(0)}°)`);
  if (id === 'saturn') c(d.ringVisible === true, 'Saturn ring viditelný');
  report.push({ id, mode, ...d });

  await page.screenshot({ path: path.join(SHOT_DIR, ALL ? `${id}-${mode}.png` : `${id}-detail.png`) });
  await page.keyboard.press('Escape');
  // Počkej na návrat do MAIN — exit() funguje jen z DETAIL a enter() dalšího
  // tělesa by byl během TRANSITION_IN tiše ignorován.
  await page.evaluate(async () => {
    const t0 = performance.now();
    while (window.__dotsAudit.state() !== 'MAIN' && performance.now() - t0 < 5000) {
      await new Promise((r) => setTimeout(r, 150));
    }
  });
}

await browser.close();
srv.kill();
// serve přes npx shell na Windows přežije srv.kill() — dočisti podle portu
if (process.platform === 'win32') {
  const { execSync } = await import('node:child_process');
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    const line = out.split('\n').find((l) => l.includes(`:${PORT}`) && l.includes('LISTENING'));
    if (line) execSync(`taskkill /PID ${line.trim().split(/\s+/).pop()} /F`, { stdio: 'ignore' });
  } catch { /* server už neběží */ }
}

if (ALL) {
  await fs.writeFile(
    path.join(SHOT_DIR, 'report.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), entries: report }, null, 2),
  );
}

console.log(`\nScreenshoty: ${SHOT_DIR}`);
if (failures.length) {
  console.error(`\n${failures.length} FAILED:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('Vizuální regrese OK.');
