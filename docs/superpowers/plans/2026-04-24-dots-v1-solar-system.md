# Dots V1 — Solar System View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Postavit edukativně-hravou vizualizaci sluneční soustavy — 1500 teček se z noise roje postupně formují do Slunce a 8 planet (každá uvedená názvem z teček), s reálnými axial tilts a rotačními poměry.

**Architecture:** Jeden `index.html` → `src/main.js` boot → ES moduly (`scene.js`, `planets.js`, `particles.js`, `label.js`, `animation.js`). Three.js přes ESM importmap z CDN. Particle pool (`THREE.Points` + custom shader) řídí fáze animace postavené na timeline. Statické 3D koule s NASA/SSC texturami reprezentují finální planety. Vše běží v jednom render loopu, žádný bundler.

**Tech Stack:** HTML + vanilla ES Modules, Three.js r170, Canvas 2D (label pixel sampling), Node 20+ built-in `node --test` pro unit testy pure-JS logiky (data, timeline, sampling). Textury lokálně v `textures/` (CC BY 4.0 Solar System Scope). Spouštění přes libovolný live server (LevisIDE preview, `npx serve`, `python -m http.server`).

**Spec:** `docs/superpowers/specs/2026-04-24-dots-v1-solar-system-design.md`

---

## File Structure

```
Dots/
├── index.html                        # entry: canvas + CSS + importmap + main.js
├── package.json                      # jen pro node --test a serve skript
├── src/
│   ├── main.js                       # bootstrap, render loop, input hooks
│   ├── scene.js                      # WebGLRenderer, PerspectiveCamera, lights, resize, starfield
│   ├── planets.js                    # konst PLANETS array (data všech 9 těles)
│   ├── planets.test.js               # unit test datové integrity
│   ├── particles.js                  # ParticlePool (1500 bodů, shader, phases, update)
│   ├── label.js                      # textToPoints() — Canvas 2D sampling
│   ├── label.test.js                 # unit test label sampling
│   ├── geometry.js                   # fibonacciSphere() + ringPoints() pure helpers
│   ├── geometry.test.js              # unit test helpers
│   └── animation.js                  # Timeline, PHASES const, phaseAt(t), update orchestrace
├── textures/
│   ├── sun.jpg
│   ├── mercury.jpg
│   ├── venus.jpg
│   ├── earth.jpg
│   ├── mars.jpg
│   ├── jupiter.jpg
│   ├── saturn.jpg
│   ├── saturn_ring.png
│   ├── uranus.jpg
│   └── neptune.jpg
├── scripts/
│   └── download-textures.sh          # curl stažení 10 textur ze SSC
├── docs/superpowers/
│   ├── specs/2026-04-24-dots-v1-solar-system-design.md
│   └── plans/2026-04-24-dots-v1-solar-system.md     # tento dokument
├── README.md
└── .gitignore
```

**Zodpovědnosti modulů:**
- `scene.js` — pouze Three.js setup (renderer/camera/lights/starfield), žádná business logika. Exportuje `createScene()`.
- `planets.js` — čistá data, žádný Three.js. Exportuje `PLANETS` a `PLANET_BY_ID`.
- `geometry.js` — pure matematické helpery (Fibonacci sphere, ring point distribution). Bez závislostí. Testovatelné v Node.
- `label.js` — pure function `textToPoints(text, count)`. Závisí na DOM Canvas (OffscreenCanvas fallback v testech).
- `particles.js` — `ParticlePool` třída. Drží 1500 bodů v `Three.Points` s custom shaderem, stav (position, target, color, targetColor, phase) v typed arrays.
- `animation.js` — `Timeline` objekt + konstanta `PHASES[]`. Funkce `phaseAt(tSeconds)`, `update(tSeconds, pool, planetsMeshes)`.
- `main.js` — tenký bootstrap: load scene, load planets, load particles, start render loop, keyboard handler.

Žádný soubor > 300 řádků.

---

## Fáze A — Foundation (Tasks 1–6)

### Task 1: Projekt setup

**Files:**
- Create: `index.html`
- Create: `package.json`
- Modify: `.gitignore`
- Create: `src/main.js`

- [ ] **Step 1: Napsat `index.html`**

```html
<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dots — Solar System</title>
  <style>
    html, body { margin: 0; padding: 0; overflow: hidden; background: #000; height: 100%; }
    #canvas { display: block; width: 100vw; height: 100vh; }
    #hud { position: fixed; bottom: 8px; left: 12px; color: #888; font: 11px/1.4 system-ui, sans-serif; user-select: none; pointer-events: none; }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <div id="hud">R restart · Space pauza</div>
  <script type="importmap">
    {
      "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js"
      }
    }
  </script>
  <script type="module" src="./src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Napsat `package.json`**

```json
{
  "name": "dots",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Edukativně-hravá vizualizace sluneční soustavy z 1500 teček",
  "scripts": {
    "test": "node --test src/",
    "serve": "npx --yes serve -l 3000 ."
  }
}
```

- [ ] **Step 3: Doplnit `.gitignore`**

Přepsat stávající obsah (`.levis-tmp/`) na:

```
.levis-tmp/
node_modules/
.DS_Store
*.log
```

- [ ] **Step 4: Prázdný `src/main.js`**

```js
// Bootstrap — zatím stub, naplníme v Task 5.
console.log('Dots main.js loaded');
```

- [ ] **Step 5: Commit**

```bash
git add index.html package.json .gitignore src/main.js
git commit -m "setup: projekt scaffold (index.html, package.json, main.js stub)"
```

---

### Task 2: README stub

**Files:**
- Create: `README.md`

- [ ] **Step 1: Napsat `README.md`**

```markdown
# Dots

Edukativně-hravá vizualizace sluneční soustavy z 1500 teček.

## Roadmap

- **V1** (aktuální): Slunce + 8 planet, animace sesypání z teček, labely česky, reálné axial tilts a rotace kolem os.
- V2: 19 měsíců s Keplerovou orbitální mechanikou.
- V3: Hover/click detail view s reálnou mechanikou a info panelem.
- V4: Asteroidový pás, Kuiperův pás, Oortův oblak.
- V5: Komety s ohony z teček.

## Spuštění

Projekt používá ES moduly — **nelze otevřít přes `file://`**. Potřebuje HTTP server:

- **LevisIDE**: built-in preview.
- **CLI**: `npm run serve` (spustí `npx serve` na portu 3000).
- **Alternativa**: `python -m http.server 8000`.

Pak v prohlížeči otevřít `http://localhost:3000/` (resp. `:8000`).

## Struktura

- `index.html` — entry.
- `src/` — ES moduly (scene, planets, particles, label, animation, main).
- `textures/` — NASA / Solar System Scope textury (CC BY 4.0).
- `docs/superpowers/` — spec a plán.

## Ovládání

- `R` — restart animace.
- `Space` — pauza / resume.

## Testy

```bash
npm test
```

Spustí pure-JS unit testy (data, geometry, label sampling). Rendering se verifikuje vizuálně v prohlížeči.

## Licence

Code: MIT.
Textury: CC BY 4.0 — [Solar System Scope](https://www.solarsystemscope.com/textures/).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README s roadmapou a instrukcemi spuštění"
```

---

### Task 3: Planets data module

**Files:**
- Create: `src/planets.js`
- Test: `src/planets.test.js`

- [ ] **Step 1: Napsat failing test `src/planets.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANETS, PLANET_BY_ID } from './planets.js';

test('PLANETS má přesně 9 těles (Slunce + 8 planet)', () => {
  assert.equal(PLANETS.length, 9);
});

test('PLANETS obsahují všechna očekávaná tělesa v pořadí od Slunce', () => {
  const ids = PLANETS.map(p => p.id);
  assert.deepEqual(ids, ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
});

test('každá planeta má povinné atributy', () => {
  const required = ['id', 'name', 'realDiameterKm', 'radiusPx', 'texture', 'tickCount', 'axialTilt', 'rotationPeriod', 'direction', 'xPosition', 'color'];
  for (const p of PLANETS) {
    for (const key of required) {
      assert.ok(key in p, `${p.id} postrádá atribut ${key}`);
    }
  }
});

test('součet tickCount planet je ≤ 1500', () => {
  const sum = PLANETS.reduce((s, p) => s + p.tickCount, 0);
  assert.ok(sum <= 1500, `součet ticks = ${sum}, musí ≤ 1500`);
  assert.ok(sum >= 800, `součet ticks = ${sum}, musí ≥ 800 (ať zbyde pool)`);
});

test('proporce radiusPx vůči Jupiteru = 180 px referenční', () => {
  const jupiter = PLANET_BY_ID.jupiter;
  assert.equal(jupiter.radiusPx * 2, 180, 'Jupiter musí mít 180 px průměr');
});

test('Venuše má axialTilt > 90 (retrográdně)', () => {
  assert.ok(PLANET_BY_ID.venus.axialTilt > 90);
});

test('Uran má axialTilt ≈ 97 (leží na boku)', () => {
  const tilt = PLANET_BY_ID.uranus.axialTilt;
  assert.ok(tilt > 90 && tilt < 110, `Uran tilt = ${tilt}`);
});

test('Jupiter má nejkratší rotationPeriod mezi plynnými obry', () => {
  const gas = ['jupiter', 'saturn', 'uranus', 'neptune'];
  const periods = gas.map(id => ({ id, p: PLANET_BY_ID[id].rotationPeriod }));
  periods.sort((a, b) => a.p - b.p);
  assert.equal(periods[0].id, 'jupiter');
});

test('PLANET_BY_ID obsahuje všechny ids', () => {
  for (const p of PLANETS) {
    assert.equal(PLANET_BY_ID[p.id], p);
  }
});
```

- [ ] **Step 2: Verifikovat že test selže**

Run: `npm test`
Expected: FAIL — "Cannot find module './planets.js'".

- [ ] **Step 3: Napsat `src/planets.js`**

```js
// PLANETS — data všech 9 těles V1.
// Referenční měřítko: Jupiter = 180 px průměr.
// rotationPeriod v sekundách (reálné poměry, Země = 10 s).
// direction: 1 = prograde, -1 = retrograde.
// xPosition = horizontální pozice středu v scene units (1 unit = 1 px na referenční vzdálenosti kamery).

export const PLANETS = [
  {
    id: 'sun',
    name: 'SLUNCE',
    realDiameterKm: 1392700,
    radiusPx: 995.5,               // 1991 / 2, ale vidět bude jen pravý okraj
    texture: 'textures/sun.jpg',
    emissive: true,
    tickCount: 250,
    axialTilt: 7.25,
    rotationPeriod: 250,
    direction: 1,
    xPosition: -1500,              // střed daleko vlevo mimo canvas
    color: 0xffd966,
  },
  {
    id: 'mercury',
    name: 'MERKUR',
    realDiameterKm: 4879,
    radiusPx: 3.15,
    texture: 'textures/mercury.jpg',
    emissive: false,
    tickCount: 35,
    axialTilt: 0.03,
    rotationPeriod: 586,
    direction: 1,
    xPosition: -390,
    color: 0x8c7853,
  },
  {
    id: 'venus',
    name: 'VENUŠE',
    realDiameterKm: 12104,
    radiusPx: 7.8,
    texture: 'textures/venus.jpg',
    emissive: false,
    tickCount: 55,
    axialTilt: 177.4,              // vzhůru nohama
    rotationPeriod: 2430,
    direction: -1,                 // retrograde
    xPosition: -340,
    color: 0xe7c98f,
  },
  {
    id: 'earth',
    name: 'ZEMĚ',
    realDiameterKm: 12742,
    radiusPx: 8.2,
    texture: 'textures/earth.jpg',
    emissive: false,
    tickCount: 55,
    axialTilt: 23.44,
    rotationPeriod: 10,            // reference
    direction: 1,
    xPosition: -290,
    color: 0x3a84d4,
  },
  {
    id: 'mars',
    name: 'MARS',
    realDiameterKm: 6779,
    radiusPx: 4.35,
    texture: 'textures/mars.jpg',
    emissive: false,
    tickCount: 40,
    axialTilt: 25.19,
    rotationPeriod: 10.25,
    direction: 1,
    xPosition: -245,
    color: 0xc1440e,
  },
  {
    id: 'jupiter',
    name: 'JUPITER',
    realDiameterKm: 139820,
    radiusPx: 90,                  // 180 / 2 — reference
    texture: 'textures/jupiter.jpg',
    emissive: false,
    tickCount: 160,
    axialTilt: 3.13,
    rotationPeriod: 4.1,
    direction: 1,
    xPosition: -100,
    color: 0xd8c185,
  },
  {
    id: 'saturn',
    name: 'SATURN',
    realDiameterKm: 116460,
    radiusPx: 75,
    texture: 'textures/saturn.jpg',
    ringTexture: 'textures/saturn_ring.png',
    ringInnerRadius: 90,
    ringOuterRadius: 175,          // pod úhlem 27° vizuálně ~350 px š.
    emissive: false,
    tickCount: 130,
    axialTilt: 26.73,
    rotationPeriod: 4.5,
    direction: 1,
    xPosition: 180,
    color: 0xe3c07a,
  },
  {
    id: 'uranus',
    name: 'URAN',
    realDiameterKm: 50724,
    radiusPx: 32.5,
    texture: 'textures/uranus.jpg',
    emissive: false,
    tickCount: 70,
    axialTilt: 97.77,              // leží na boku
    rotationPeriod: 7.2,
    direction: -1,                 // retrograde
    xPosition: 470,
    color: 0x9fd8e3,
  },
  {
    id: 'neptune',
    name: 'NEPTUN',
    realDiameterKm: 49244,
    radiusPx: 31.5,
    texture: 'textures/neptune.jpg',
    emissive: false,
    tickCount: 70,
    axialTilt: 28.32,
    rotationPeriod: 6.7,
    direction: 1,
    xPosition: 570,
    color: 0x3b5ff7,
  },
];

export const PLANET_BY_ID = Object.fromEntries(PLANETS.map(p => [p.id, p]));
```

- [ ] **Step 4: Verifikovat že testy prochází**

Run: `npm test`
Expected: PASS — všech 9 testů projde.

- [ ] **Step 5: Commit**

```bash
git add src/planets.js src/planets.test.js
git commit -m "feat: planets.js — data všech 9 těles s unit testy"
```

---

### Task 4: Textures — download script

**Files:**
- Create: `scripts/download-textures.sh`
- Create (via script): `textures/*.jpg|png` (10 souborů)

- [ ] **Step 1: Napsat `scripts/download-textures.sh`**

```bash
#!/usr/bin/env bash
# Stáhne NASA/SSC textury (CC BY 4.0) do textures/.
# Spouštěj z rootu projektu: bash scripts/download-textures.sh
set -euo pipefail

mkdir -p textures
cd textures

BASE="https://www.solarsystemscope.com/textures/download"

declare -A FILES=(
  [sun.jpg]="2k_sun.jpg"
  [mercury.jpg]="2k_mercury.jpg"
  [venus.jpg]="2k_venus_surface.jpg"
  [earth.jpg]="2k_earth_daymap.jpg"
  [mars.jpg]="2k_mars.jpg"
  [jupiter.jpg]="2k_jupiter.jpg"
  [saturn.jpg]="2k_saturn.jpg"
  [saturn_ring.png]="2k_saturn_ring_alpha.png"
  [uranus.jpg]="2k_uranus.jpg"
  [neptune.jpg]="2k_neptune.jpg"
)

for local_name in "${!FILES[@]}"; do
  remote="${FILES[$local_name]}"
  if [[ -f "$local_name" ]]; then
    echo "✓ $local_name (cached)"
    continue
  fi
  echo "↓ $local_name ← $remote"
  curl -fSL --retry 3 -o "$local_name" "$BASE/$remote"
done

echo "Hotovo. Textury v textures/."
ls -la
```

- [ ] **Step 2: Nastavit executable a spustit**

Run:
```bash
chmod +x scripts/download-textures.sh
bash scripts/download-textures.sh
```

Expected: 10 souborů v `textures/`, celková velikost ~15 MB. Pokud některá URL vrátí 404 (SSC občas mění jména), otevři <https://www.solarsystemscope.com/textures/> v prohlížeči, najdi aktuální link a aktualizuj script.

- [ ] **Step 3: Verifikovat přítomnost všech 10 souborů**

Run:
```bash
ls textures/ | wc -l
```
Expected: `10`.

- [ ] **Step 4: Přidat `textures/` do `.gitignore`? NE**

Textury commitnout do repa — jsou to fixní artefakty, CC BY 4.0, celkem ~15 MB. Commit jednou, neřeší.

- [ ] **Step 5: Commit**

```bash
git add scripts/download-textures.sh textures/
git commit -m "assets: NASA/SSC textury + download script"
```

---

### Task 5: Scene scaffold

**Files:**
- Create: `src/scene.js`
- Modify: `src/main.js`

- [ ] **Step 1: Napsat `src/scene.js`**

```js
import * as THREE from 'three';

export function createScene() {
  const canvas = document.getElementById('canvas');
  if (!canvas) throw new Error('canvas #canvas not found');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    0.1,
    10000,
  );
  camera.position.set(0, 50, 1400);
  camera.lookAt(0, 0, 0);

  // světla
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));
  const sunLight = new THREE.PointLight(0xffffff, 2.2, 4000);
  sunLight.position.set(-1500, 0, 0); // pozice Slunce
  scene.add(sunLight);

  // resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera };
}
```

- [ ] **Step 2: Přepsat `src/main.js`**

```js
import * as THREE from 'three';
import { createScene } from './scene.js';

const { renderer, scene, camera } = createScene();

function tick() {
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
```

- [ ] **Step 3: Spustit live server a ověřit**

Run: `npm run serve` (v jiném terminálu).
Otevřít <http://localhost:3000/> v prohlížeči.

Expected: Černý fullscreen canvas, DevTools konzole bez errorů. HUD v rohu ("R restart · Space pauza").

- [ ] **Step 4: Commit**

```bash
git add src/scene.js src/main.js
git commit -m "feat: scene scaffold (renderer, camera, lights, resize)"
```

---

### Task 6: Starfield pozadí

**Files:**
- Modify: `src/scene.js`

- [ ] **Step 1: Přidat funkci `createStarfield()` do `src/scene.js`**

Na konec souboru (před závěrečný prázdný řádek) přidat:

```js
export function createStarfield(scene, count = 500) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // rozprostřené v kouli poloměru 3000 kolem (0,0,0)
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 2000 + Math.random() * 1000;
    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi) - 500; // lehce za scénu
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.2,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.7,
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  return points;
}
```

- [ ] **Step 2: Zavolat `createStarfield()` z `main.js`**

Přepsat `src/main.js`:

```js
import { createScene, createStarfield } from './scene.js';

const { renderer, scene, camera } = createScene();
createStarfield(scene);

function tick() {
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
```

- [ ] **Step 3: Reload prohlížeč a ověřit**

Expected: Černé pozadí + rozesetý star field (malé bílé body). Konzole clean.

- [ ] **Step 4: Commit**

```bash
git add src/scene.js src/main.js
git commit -m "feat: starfield (500 statických bodů v pozadí)"
```

---

## Fáze B — Static Render (Tasks 7–10)

### Task 7: Render planetárních meshů

**Files:**
- Create: `src/planetMeshes.js`
- Modify: `src/main.js`

- [ ] **Step 1: Napsat `src/planetMeshes.js`**

```js
import * as THREE from 'three';
import { PLANETS } from './planets.js';

const loader = new THREE.TextureLoader();

export function createPlanetMeshes(scene) {
  const meshes = {};
  for (const p of PLANETS) {
    const geometry = new THREE.SphereGeometry(p.radiusPx, 64, 64);
    const texture = loader.load(p.texture);
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = p.emissive
      ? new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0 })
      : new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 1,
          metalness: 0,
          transparent: true,
          opacity: 0,
        });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(p.xPosition, 0, 0);
    mesh.userData.planet = p;
    scene.add(mesh);
    meshes[p.id] = mesh;
  }
  return meshes;
}
```

**Poznámka:** `opacity: 0` — planety začínají neviditelné a fade-in je řízený animací. Pro tento task dočasně nastavíme opacity 1 pro vizuální verifikaci.

- [ ] **Step 2: Přepsat `src/main.js` pro debug render (všechny planety viditelné)**

```js
import { createScene, createStarfield } from './scene.js';
import { createPlanetMeshes } from './planetMeshes.js';

const { renderer, scene, camera } = createScene();
createStarfield(scene);
const planetMeshes = createPlanetMeshes(scene);

// DEBUG — zobrazit všechny okamžitě (odstraníme v Task 17).
for (const mesh of Object.values(planetMeshes)) {
  mesh.material.opacity = 1;
  mesh.material.transparent = false;
}

function tick() {
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
```

- [ ] **Step 3: Reload a ověřit**

Expected v prohlížeči:
- Slunce jako obří disk vlevo (vidět jen pravý okraj, střed mimo canvas).
- Merkur, Venuše, Země, Mars malé body blíž ke středu-vlevo.
- Jupiter dominantní žlutavě-hnědý s pásy.
- Saturn světle žlutavý (prstence zatím chybí, Task 8).
- Uran modrozelený, Neptun modrý.
- Planety ve správném pořadí zleva doprava.
- DevTools konzole bez errorů (pokud chybí textura → 404, oprav download-textures.sh).

- [ ] **Step 4: Commit**

```bash
git add src/planetMeshes.js src/main.js
git commit -m "feat: render 9 planetárních meshů s texturami"
```

---

### Task 8: Saturn prstence

**Files:**
- Modify: `src/planetMeshes.js`

- [ ] **Step 1: Přidat helper `createSaturnRings()` do `src/planetMeshes.js`**

Upravit `createPlanetMeshes` aby volal ring creator pro Saturn:

```js
import * as THREE from 'three';
import { PLANETS, PLANET_BY_ID } from './planets.js';

const loader = new THREE.TextureLoader();

function createRingMesh(planet) {
  const geometry = new THREE.RingGeometry(planet.ringInnerRadius, planet.ringOuterRadius, 128);
  // remap UV aby textura byla radiální (vnitřní okraj = u=0, vnější = u=1)
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.sqrt(x * x + y * y);
    const t = (r - planet.ringInnerRadius) / (planet.ringOuterRadius - planet.ringInnerRadius);
    uv.setXY(i, t, 0.5);
  }
  const texture = loader.load(planet.ringTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = Math.PI / 2; // ležet horizontálně
  return mesh;
}

export function createPlanetMeshes(scene) {
  const meshes = {};
  const rings = {};
  for (const p of PLANETS) {
    const geometry = new THREE.SphereGeometry(p.radiusPx, 64, 64);
    const texture = loader.load(p.texture);
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = p.emissive
      ? new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0 })
      : new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 1,
          metalness: 0,
          transparent: true,
          opacity: 0,
        });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(p.xPosition, 0, 0);
    mesh.userData.planet = p;
    scene.add(mesh);
    meshes[p.id] = mesh;

    if (p.ringTexture) {
      const ring = createRingMesh(p);
      ring.position.copy(mesh.position);
      scene.add(ring);
      rings[p.id] = ring;
    }
  }
  return { meshes, rings };
}
```

- [ ] **Step 2: Upravit `src/main.js` — destructure `{ meshes, rings }`**

```js
import { createScene, createStarfield } from './scene.js';
import { createPlanetMeshes } from './planetMeshes.js';

const { renderer, scene, camera } = createScene();
createStarfield(scene);
const { meshes, rings } = createPlanetMeshes(scene);

// DEBUG — zobrazit všechny okamžitě.
for (const m of Object.values(meshes)) { m.material.opacity = 1; m.material.transparent = false; }
for (const r of Object.values(rings)) { r.material.opacity = 0.9; }

function tick() {
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
```

- [ ] **Step 3: Reload a ověřit**

Expected: Saturn má vodorovně ležící prstence. Prstence využívají alpha texturu (uvnitř mezera, Cassini Division viditelná).

- [ ] **Step 4: Commit**

```bash
git add src/planetMeshes.js src/main.js
git commit -m "feat: Saturn prstence (RingGeometry + alpha texture)"
```

---

### Task 9: Axial tilts

**Files:**
- Modify: `src/planetMeshes.js`

- [ ] **Step 1: Přidat `applyAxialTilt()` — aplikovat tilt při vzniku meshe**

V `createPlanetMeshes`, po přidání mesh do scény a před prstenec, přidat:

```js
// axial tilt — rotujeme kolem Z osy (sklon k orbitální rovině)
mesh.rotation.z = THREE.MathUtils.degToRad(p.axialTilt);
```

Kompletní upravená smyčka v `createPlanetMeshes`:

```js
for (const p of PLANETS) {
  const geometry = new THREE.SphereGeometry(p.radiusPx, 64, 64);
  const texture = loader.load(p.texture);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = p.emissive
    ? new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0 })
    : new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 1,
        metalness: 0,
        transparent: true,
        opacity: 0,
      });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(p.xPosition, 0, 0);
  mesh.rotation.z = THREE.MathUtils.degToRad(p.axialTilt);
  mesh.userData.planet = p;
  scene.add(mesh);
  meshes[p.id] = mesh;

  if (p.ringTexture) {
    const ring = createRingMesh(p);
    ring.position.copy(mesh.position);
    // prstence sdílí tilt planety (jsou v rovníku)
    ring.rotation.x = Math.PI / 2 + THREE.MathUtils.degToRad(p.axialTilt);
    scene.add(ring);
    rings[p.id] = ring;
  }
}
```

- [ ] **Step 2: Reload a ověřit**

Expected:
- Uran viditelně leží na boku (póly vlevo/vpravo místo nahoře/dole).
- Saturn má prstence nakloněné (ne vodorovné).
- Venuše je otočená (severní pól dole).
- Ostatní planety mají jemný sklon (Země 23°, Mars 25°).

- [ ] **Step 3: Commit**

```bash
git add src/planetMeshes.js
git commit -m "feat: axial tilts (Uran leží, Venuše vzhůru nohama)"
```

---

### Task 10: Rotace kolem vlastní osy

**Files:**
- Create: `src/rotation.js`
- Modify: `src/main.js`

- [ ] **Step 1: Napsat `src/rotation.js`**

```js
import * as THREE from 'three';
import { PLANETS } from './planets.js';

// Rotace kolem lokální Y osy (severní pól = +Y po aplikaci tilt).
// Používáme Object3D.rotateOnAxis s vektorem (0,1,0) v LOCAL prostoru,
// aby rotace respektovala axial tilt aplikovaný přes mesh.rotation.z.
const LOCAL_Y = new THREE.Vector3(0, 1, 0);

export function updateRotations(meshes, dtSeconds) {
  for (const p of PLANETS) {
    const mesh = meshes[p.id];
    if (!mesh) continue;
    const omega = (Math.PI * 2) / p.rotationPeriod; // rad/s
    mesh.rotateOnAxis(LOCAL_Y, omega * p.direction * dtSeconds);
  }
}
```

- [ ] **Step 2: Zapojit do `src/main.js`**

```js
import { createScene, createStarfield } from './scene.js';
import { createPlanetMeshes } from './planetMeshes.js';
import { updateRotations } from './rotation.js';

const { renderer, scene, camera } = createScene();
createStarfield(scene);
const { meshes, rings } = createPlanetMeshes(scene);

// DEBUG — zobrazit všechny okamžitě.
for (const m of Object.values(meshes)) { m.material.opacity = 1; m.material.transparent = false; }
for (const r of Object.values(rings)) { r.material.opacity = 0.9; }

const clock = new THREE.Clock();

function tick() {
  const dt = clock.getDelta();
  updateRotations(meshes, dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
```

`THREE` musí být importován v `main.js` pro `Clock`. Přidej na vrch:

```js
import * as THREE from 'three';
```

- [ ] **Step 3: Reload a sledovat několik sekund**

Expected:
- Jupiter viditelně rotuje (nejrychlejší, cca 1 otočka za 4 s).
- Saturn rotuje o něco pomaleji.
- Země rotuje plynule (10 s).
- Venuše rotuje **extrémně pomalu opačným směrem** (prakticky stojí, ale při sledování 30s je pohyb viditelný v subtilních detailech textury, jde opačně než Země).
- Uran rotuje retrográdně.
- Prstence Saturnu nerotují s planetou (správně — prstence jsou samostatný systém; pokud bys chtěl tuto úroveň detailu, komplikace nad scope V1).

- [ ] **Step 4: Commit**

```bash
git add src/rotation.js src/main.js
git commit -m "feat: realistická rotace kolem vlastní osy (poměry, směr, tilt)"
```

---

## Fáze C — Particles (Tasks 11–14)

### Task 11: Particle pool + shader

**Files:**
- Create: `src/particles.js`

- [ ] **Step 1: Napsat `src/particles.js`**

```js
import * as THREE from 'three';

export const PHASE = Object.freeze({
  IDLE: 0,           // rezerva
  FREE: 1,           // vznáší se v Perlin noise
  FORMING_LABEL: 2,  // letí k label pozici
  HOLDING_LABEL: 3,  // drží v label pozici
  FLYING_TO_PLANET: 4,
  ON_PLANET: 5,
  ON_RING: 6,
});

const VERTEX_SHADER = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * (320.0 / -mv.z);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c);
  if (d > 0.5) discard;
  float g = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor, g * vAlpha);
}
`;

export class ParticlePool {
  constructor(count = 1500) {
    this.count = count;
    this.position = new Float32Array(count * 3);
    this.target   = new Float32Array(count * 3);
    this.velocity = new Float32Array(count * 3);
    this.color    = new Float32Array(count * 3);
    this.targetColor = new Float32Array(count * 3);
    this.size     = new Float32Array(count);
    this.alpha    = new Float32Array(count);
    this.phase    = new Uint8Array(count);
    this.owner    = new Int16Array(count); // planet index or -1

    const geometry = new THREE.BufferGeometry();
    this.posAttr   = new THREE.BufferAttribute(this.position, 3);
    this.colorAttr = new THREE.BufferAttribute(this.color, 3);
    this.sizeAttr  = new THREE.BufferAttribute(this.size, 1);
    this.alphaAttr = new THREE.BufferAttribute(this.alpha, 1);
    geometry.setAttribute('position', this.posAttr);
    geometry.setAttribute('aColor',   this.colorAttr);
    geometry.setAttribute('aSize',    this.sizeAttr);
    geometry.setAttribute('aAlpha',   this.alphaAttr);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.mesh = new THREE.Points(geometry, this.material);

    // init: všechny FREE, na random pozicích (naplníme v animation fázi Init).
    for (let i = 0; i < count; i++) {
      this.position[3 * i]     = 0;
      this.position[3 * i + 1] = 0;
      this.position[3 * i + 2] = 0;
      this.color[3 * i]     = 1;
      this.color[3 * i + 1] = 1;
      this.color[3 * i + 2] = 1;
      this.size[i] = 2.2;
      this.alpha[i] = 0;
      this.phase[i] = PHASE.IDLE;
      this.owner[i] = -1;
    }

    this.posAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
  }

  setPosition(i, x, y, z) {
    this.position[3*i] = x; this.position[3*i+1] = y; this.position[3*i+2] = z;
  }
  setTarget(i, x, y, z) {
    this.target[3*i] = x; this.target[3*i+1] = y; this.target[3*i+2] = z;
  }
  setColor(i, r, g, b) {
    this.color[3*i] = r; this.color[3*i+1] = g; this.color[3*i+2] = b;
  }
  setTargetColor(i, r, g, b) {
    this.targetColor[3*i] = r; this.targetColor[3*i+1] = g; this.targetColor[3*i+2] = b;
  }

  flushDirty() {
    this.posAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
  }
}
```

- [ ] **Step 2: Přidat do scény v `main.js`**

```js
import * as THREE from 'three';
import { createScene, createStarfield } from './scene.js';
import { createPlanetMeshes } from './planetMeshes.js';
import { updateRotations } from './rotation.js';
import { ParticlePool, PHASE } from './particles.js';

const { renderer, scene, camera } = createScene();
createStarfield(scene);
const { meshes, rings } = createPlanetMeshes(scene);

// DEBUG planet visible.
for (const m of Object.values(meshes)) { m.material.opacity = 1; m.material.transparent = false; }
for (const r of Object.values(rings)) { r.material.opacity = 0.9; }

const pool = new ParticlePool(1500);
scene.add(pool.mesh);

// DEBUG: rozmístit tečky náhodně a ukázat je.
for (let i = 0; i < pool.count; i++) {
  pool.setPosition(i,
    (Math.random() - 0.5) * 1600,
    (Math.random() - 0.5) * 700,
    (Math.random() - 0.5) * 400,
  );
  pool.alpha[i] = 0.7;
}
pool.flushDirty();

const clock = new THREE.Clock();
function tick() {
  const dt = clock.getDelta();
  updateRotations(meshes, dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
```

- [ ] **Step 3: Reload a ověřit**

Expected: 1500 bílých kruhových teček rozhozených po scéně nad/mimo planety. Každá tečka je jemně rozostřená (gradient) díky shaderu.

- [ ] **Step 4: Commit**

```bash
git add src/particles.js src/main.js
git commit -m "feat: ParticlePool + shader (1500 bodů, additive blending)"
```

---

### Task 12: Geometrie — Fibonacci sphere a ring points

**Files:**
- Create: `src/geometry.js`
- Test: `src/geometry.test.js`

- [ ] **Step 1: Napsat failing test `src/geometry.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fibonacciSphere, ringPoints } from './geometry.js';

test('fibonacciSphere vrací správný počet bodů', () => {
  const pts = fibonacciSphere(100, 10);
  assert.equal(pts.length, 100);
});

test('fibonacciSphere body leží na povrchu koule o zadaném poloměru', () => {
  const r = 12;
  for (const [x, y, z] of fibonacciSphere(50, r)) {
    const d = Math.sqrt(x*x + y*y + z*z);
    assert.ok(Math.abs(d - r) < 1e-6, `bod ve vzdálenosti ${d}, očekáváno ${r}`);
  }
});

test('ringPoints vrací počet bodů rovnoměrně mezi inner a outer', () => {
  const pts = ringPoints(200, 10, 20);
  assert.equal(pts.length, 200);
  for (const [x, y, z] of pts) {
    const r = Math.sqrt(x*x + y*y);
    assert.ok(r >= 10 && r <= 20, `bod na poloměru ${r}`);
    assert.equal(z, 0);
  }
});
```

- [ ] **Step 2: Verifikovat že test selže**

Run: `npm test`
Expected: FAIL — "Cannot find module './geometry.js'".

- [ ] **Step 3: Napsat `src/geometry.js`**

```js
// Pure helpers (bez Three.js) pro rozmístění bodů.

export function fibonacciSphere(count, radius) {
  const points = [];
  const phi = Math.PI * (Math.sqrt(5) - 1); // golden angle
  for (let i = 0; i < count; i++) {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    points.push([x * radius, y * radius, z * radius]);
  }
  return points;
}

export function ringPoints(count, innerRadius, outerRadius) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const t = Math.random();
    const r = Math.sqrt(innerRadius * innerRadius + t * (outerRadius * outerRadius - innerRadius * innerRadius));
    const theta = Math.random() * Math.PI * 2;
    points.push([Math.cos(theta) * r, Math.sin(theta) * r, 0]);
  }
  return points;
}
```

- [ ] **Step 4: Spustit testy**

Run: `npm test`
Expected: PASS — geometry testy projdou, planets testy stále procházejí.

- [ ] **Step 5: Commit**

```bash
git add src/geometry.js src/geometry.test.js
git commit -m "feat: geometry helpers (fibonacciSphere, ringPoints) + testy"
```

---

### Task 13: Label engine — text → dots

**Files:**
- Create: `src/label.js`
- Test: `src/label.test.js`

- [ ] **Step 1: Napsat failing test `src/label.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { samplePoints } from './label.js';

// Pure helper samplePoints bere mock ImageData-like objekt a vrací pozice.
test('samplePoints vybere alpha>threshold pixely', () => {
  const w = 6, h = 4;
  // Řádek 2, pixely 1..3 mají alpha 255.
  const data = new Uint8ClampedArray(w * h * 4);
  for (let x = 1; x <= 3; x++) {
    const idx = (2 * w + x) * 4 + 3;
    data[idx] = 255;
  }
  const points = samplePoints({ data, width: w, height: h }, { step: 1, alphaThreshold: 128 });
  assert.equal(points.length, 3);
  // y osa invertovaná (screen y roste dolů, scene y roste nahoru)
  for (const [x, y] of points) {
    assert.ok(x >= 1 - w/2 && x <= 3 - w/2);
    assert.equal(y, -(2 - h/2));
  }
});

test('samplePoints respektuje step', () => {
  const w = 10, h = 10;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 3; i < w * h * 4; i += 4) data[i] = 255; // všechny pixely
  const dense = samplePoints({ data, width: w, height: h }, { step: 1, alphaThreshold: 128 });
  const sparse = samplePoints({ data, width: w, height: h }, { step: 2, alphaThreshold: 128 });
  assert.equal(dense.length, w * h);
  assert.equal(sparse.length, Math.ceil(w / 2) * Math.ceil(h / 2));
});
```

- [ ] **Step 2: Verifikovat že test selže**

Run: `npm test`
Expected: FAIL — "Cannot find module './label.js'".

- [ ] **Step 3: Napsat `src/label.js`**

```js
// Label engine — převede text na sadu 3D cílových pozic v rovině z=LABEL_Z.
// samplePoints je pure helper (testovatelné), textToPoints obaluje Canvas 2D.

export const LABEL_Z = 100;        // lehce před planetami
export const LABEL_SCALE = 0.45;   // px → scene units

export function samplePoints(imageData, { step = 4, alphaThreshold = 128 } = {}) {
  const { data, width, height } = imageData;
  const points = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4 + 3;
      if (data[idx] > alphaThreshold) {
        points.push([x - width / 2, -(y - height / 2)]);
      }
    }
  }
  return points;
}

function pickEvenly(points, count) {
  if (points.length <= count) return points.slice();
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(points[Math.floor((i * points.length) / count)]);
  }
  return out;
}

export function textToPoints(text, count, { font = 'bold 90px system-ui, sans-serif' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '6px';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const all = samplePoints(imageData, { step: 3, alphaThreshold: 150 });
  const picked = pickEvenly(all, count);
  // převést 2D pixel pozice na 3D scene coords
  return picked.map(([x, y]) => [x * LABEL_SCALE, y * LABEL_SCALE, LABEL_Z]);
}
```

- [ ] **Step 4: Spustit testy**

Run: `npm test`
Expected: PASS — label, geometry, planets testy všechny projdou.

- [ ] **Step 5: Commit**

```bash
git add src/label.js src/label.test.js
git commit -m "feat: label engine — textToPoints + samplePoints s testy"
```

---

### Task 14: Smoke test labelu v prohlížeči

**Files:**
- Modify: `src/main.js` (dočasně, pro ověření)

- [ ] **Step 1: Upravit `main.js` — přesunout 1500 teček do labelu „SLUNCE"**

```js
import * as THREE from 'three';
import { createScene, createStarfield } from './scene.js';
import { createPlanetMeshes } from './planetMeshes.js';
import { updateRotations } from './rotation.js';
import { ParticlePool } from './particles.js';
import { textToPoints } from './label.js';

const { renderer, scene, camera } = createScene();
createStarfield(scene);
const { meshes, rings } = createPlanetMeshes(scene);
for (const m of Object.values(meshes)) { m.material.opacity = 1; m.material.transparent = false; }
for (const r of Object.values(rings)) { r.material.opacity = 0.9; }

const pool = new ParticlePool(1500);
scene.add(pool.mesh);

// DEBUG Task 14 — naplnit tečky do labelu SLUNCE.
const labelPoints = textToPoints('SLUNCE', 300);
for (let i = 0; i < pool.count; i++) {
  const target = labelPoints[i % labelPoints.length] ?? [0, 0, 0];
  pool.setPosition(i, target[0], target[1], target[2]);
  pool.alpha[i] = 0.9;
}
pool.flushDirty();

const clock = new THREE.Clock();
function tick() {
  const dt = clock.getDelta();
  updateRotations(meshes, dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
```

- [ ] **Step 2: Reload a ověřit**

Expected: Uprostřed scény se objeví bílý text „SLUNCE" složený z teček, čitelný, s diakritikou (žádná — toto slovo nemá). Testovat i s labelem `'VENUŠE'` a `'ZEMĚ'` — diakritika se musí zobrazit.

- [ ] **Step 3: Commit (bez DEBUG kódu — nechat pro test, příští task ho nahradí)**

Task 14 nemá commit — je to čistě smoke test. DEBUG kód zůstane v `main.js` do Task 16, kde ho nahradí animation orchestrator.

---

## Fáze D — Animation (Tasks 15–21)

### Task 15: Animation timeline + phase lookup

**Files:**
- Create: `src/animation.js`
- Test: `src/animation.test.js`

- [ ] **Step 1: Napsat failing test `src/animation.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASES, phaseAt, phaseProgress } from './animation.js';

test('PHASES pokrývají čas 0..7 s bez děr', () => {
  let t = 0;
  for (const ph of PHASES) {
    assert.equal(ph.start, t, `díra před ${ph.id}`);
    t = ph.end;
  }
});

test('PHASES končí fází live s end=Infinity', () => {
  const last = PHASES[PHASES.length - 1];
  assert.equal(last.id, 'live');
  assert.equal(last.end, Infinity);
});

test('phaseAt vrátí správnou fázi pro čas', () => {
  assert.equal(phaseAt(0).id, 'init');
  assert.equal(phaseAt(0.5).id, 'init');
  assert.equal(phaseAt(1.5).id, 'sun');
  assert.equal(phaseAt(2.2).id, 'mercury');
  assert.equal(phaseAt(3.0).id, 'earth');
  assert.equal(phaseAt(5.5).id, 'saturn');
  assert.equal(phaseAt(7.0).id, 'live');
  assert.equal(phaseAt(100).id, 'live');
});

test('phaseProgress vrací 0..1 napříč fází', () => {
  assert.equal(phaseProgress(1.0), 0);       // start of sun phase
  assert.equal(phaseProgress(2.0), 1);       // end of sun phase (== start of mercury)
  assert.ok(Math.abs(phaseProgress(1.5) - 0.5) < 1e-9);
});

test('každá non-live fáze má planet id pokud není init', () => {
  for (const ph of PHASES) {
    if (ph.id === 'init' || ph.id === 'live') continue;
    assert.ok(ph.planetId, `${ph.id} postrádá planetId`);
    assert.ok(ph.label, `${ph.id} postrádá label`);
  }
});
```

- [ ] **Step 2: Verifikovat že test selže**

Run: `npm test`
Expected: FAIL — "Cannot find module './animation.js'".

- [ ] **Step 3: Napsat `src/animation.js` (jen timeline — update orchestraci přidáme v dalších taskech)**

```js
// Animation timeline — fáze V1.

export const PHASES = [
  { start: 0,   end: 1,   id: 'init' },
  { start: 1,   end: 2,   id: 'sun',     planetId: 'sun',     label: 'SLUNCE' },
  { start: 2,   end: 2.4, id: 'mercury', planetId: 'mercury', label: 'MERKUR' },
  { start: 2.4, end: 2.9, id: 'venus',   planetId: 'venus',   label: 'VENUŠE' },
  { start: 2.9, end: 3.4, id: 'earth',   planetId: 'earth',   label: 'ZEMĚ' },
  { start: 3.4, end: 3.9, id: 'mars',    planetId: 'mars',    label: 'MARS' },
  { start: 3.9, end: 5,   id: 'jupiter', planetId: 'jupiter', label: 'JUPITER' },
  { start: 5,   end: 6,   id: 'saturn',  planetId: 'saturn',  label: 'SATURN' },
  { start: 6,   end: 6.5, id: 'uranus',  planetId: 'uranus',  label: 'URAN' },
  { start: 6.5, end: 7,   id: 'neptune', planetId: 'neptune', label: 'NEPTUN' },
  { start: 7,   end: Infinity, id: 'live' },
];

export function phaseAt(t) {
  for (const ph of PHASES) {
    if (t >= ph.start && t < ph.end) return ph;
  }
  return PHASES[PHASES.length - 1];
}

export function phaseProgress(t) {
  const ph = phaseAt(t);
  if (!isFinite(ph.end)) return 0;
  return (t - ph.start) / (ph.end - ph.start);
}

// Sub-fáze uvnitř každého planet slotu:
//   0.0 – 0.25  : label forming
//   0.25 – 0.55 : label holding
//   0.55 – 0.85 : flying to planet
//   0.85 – 1.0  : fade-in textury
export const SUB = Object.freeze({
  LABEL_FORM_END: 0.25,
  LABEL_HOLD_END: 0.55,
  FLY_END: 0.85,
});
```

- [ ] **Step 4: Spustit testy**

Run: `npm test`
Expected: PASS — všechny testy (animation + geometry + label + planets) projdou.

- [ ] **Step 5: Commit**

```bash
git add src/animation.js src/animation.test.js
git commit -m "feat: animation timeline (PHASES, phaseAt, phaseProgress) + testy"
```

---

### Task 16: Animation orchestrator — Phase Init (0–1 s)

**Files:**
- Modify: `src/animation.js`
- Modify: `src/particles.js`
- Modify: `src/main.js`

- [ ] **Step 1: Přidat `resetPool` do `particles.js`**

Na konec třídy `ParticlePool` přidat:

```js
  resetAllToFree() {
    for (let i = 0; i < this.count; i++) {
      this.phase[i] = PHASE.FREE;
      this.owner[i] = -1;
      // random start position ve viewportu
      this.position[3*i]     = (Math.random() - 0.5) * 1800;
      this.position[3*i + 1] = (Math.random() - 0.5) * 800;
      this.position[3*i + 2] = (Math.random() - 0.5) * 400;
      this.target[3*i]     = this.position[3*i];
      this.target[3*i + 1] = this.position[3*i + 1];
      this.target[3*i + 2] = this.position[3*i + 2];
      this.color[3*i]     = 1; this.color[3*i + 1] = 1; this.color[3*i + 2] = 1;
      this.size[i] = 2.2;
      this.alpha[i] = 0;
    }
    this.flushDirty();
  }

  noiseDriftAll(time, dt, magnitude = 6) {
    for (let i = 0; i < this.count; i++) {
      if (this.phase[i] !== PHASE.FREE) continue;
      const seed = i * 0.13;
      this.position[3*i]     += Math.sin(time * 0.5 + seed) * magnitude * dt;
      this.position[3*i + 1] += Math.cos(time * 0.4 + seed * 2) * magnitude * dt;
      this.position[3*i + 2] += Math.sin(time * 0.3 + seed * 3) * magnitude * 0.5 * dt;
    }
    this.posAttr.needsUpdate = true;
  }

  fadeInAll(rate, dt) {
    let dirty = false;
    for (let i = 0; i < this.count; i++) {
      if (this.alpha[i] < 0.7) {
        this.alpha[i] = Math.min(0.7, this.alpha[i] + rate * dt);
        dirty = true;
      }
    }
    if (dirty) this.alphaAttr.needsUpdate = true;
  }
```

- [ ] **Step 2: Přidat `updatePhaseInit` do `animation.js`**

Na konec `animation.js` přidat:

```js
export function updatePhaseInit(pool, tSeconds, dt) {
  // 0..1s — materializace (fade-in alpha) + noise drift
  pool.fadeInAll(1.2, dt);
  pool.noiseDriftAll(tSeconds, dt, 8);
}
```

- [ ] **Step 3: Přepsat `main.js` do orchestrator pattern**

```js
import * as THREE from 'three';
import { createScene, createStarfield } from './scene.js';
import { createPlanetMeshes } from './planetMeshes.js';
import { updateRotations } from './rotation.js';
import { ParticlePool } from './particles.js';
import { phaseAt, updatePhaseInit } from './animation.js';

const { renderer, scene, camera } = createScene();
createStarfield(scene);
const { meshes, rings } = createPlanetMeshes(scene);

const pool = new ParticlePool(1500);
scene.add(pool.mesh);
pool.resetAllToFree();

const clock = new THREE.Clock();
let elapsed = 0;
let paused = false;

function tick() {
  const dt = paused ? 0 : clock.getDelta();
  elapsed += dt;

  const ph = phaseAt(elapsed);
  if (ph.id === 'init') updatePhaseInit(pool, elapsed, dt);
  // ostatní fáze doplníme v dalších taskech

  // po 7s se roztočí rotace
  if (elapsed >= 7) updateRotations(meshes, dt);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
```

- [ ] **Step 4: Reload a ověřit Phase Init**

Expected v prohlížeči prvních 1 sekundu:
- Planety nejsou vidět (opacity 0 — pro bod v čase).
- Tečky se rychle objeví (fade-in z 0 na 0.7 alpha).
- Tečky se jemně vznášejí (noise motion).
- Po 1 s planety stále neviditelné (přidáme je v dalších taskech).

Pozorování je krátké (1 s). Pro ověření můžeš dočasně rozšířit phase init end na 5 v PHASES (a pak vrátit).

- [ ] **Step 5: Commit**

```bash
git add src/particles.js src/animation.js src/main.js
git commit -m "feat: Phase Init (0-1s) — particles materialize + noise drift"
```

---

### Task 17: Phase Sun (1–2 s) — label, sesyp, fade-in textury

**Files:**
- Modify: `src/particles.js`
- Modify: `src/animation.js`
- Modify: `src/main.js`

- [ ] **Step 1: Přidat metody `assignLabel`, `flyToTargets`, `lerpToTargets` do `particles.js`**

Přidat na konec třídy `ParticlePool`:

```js
  /** Alokuje prvních `count` FREE particle indexů. Vrací pole indexů. */
  takeFreeIndices(count) {
    const out = [];
    for (let i = 0; i < this.count && out.length < count; i++) {
      if (this.phase[i] === PHASE.FREE) out.push(i);
    }
    return out;
  }

  /** Nastaví target pozice pro indexy + phase FORMING_LABEL. */
  assignLabelTargets(indices, labelPoints) {
    for (let k = 0; k < indices.length; k++) {
      const i = indices[k];
      const p = labelPoints[k % labelPoints.length];
      this.target[3*i]     = p[0];
      this.target[3*i + 1] = p[1];
      this.target[3*i + 2] = p[2];
      this.phase[i] = PHASE.FORMING_LABEL;
    }
  }

  /** Nastaví target pozice k povrchu planety + phase FLYING_TO_PLANET. */
  assignPlanetTargets(indices, planetPosition, fibonacciPts, planetColor) {
    for (let k = 0; k < indices.length; k++) {
      const i = indices[k];
      const off = fibonacciPts[k % fibonacciPts.length];
      this.target[3*i]     = planetPosition.x + off[0];
      this.target[3*i + 1] = planetPosition.y + off[1];
      this.target[3*i + 2] = planetPosition.z + off[2];
      this.phase[i] = PHASE.FLYING_TO_PLANET;
      this.targetColor[3*i]     = planetColor.r;
      this.targetColor[3*i + 1] = planetColor.g;
      this.targetColor[3*i + 2] = planetColor.b;
    }
  }

  /** Lerp position→target a color→targetColor s daným koeficientem (0..1). */
  lerpToTargets(k) {
    for (let i = 0; i < this.count; i++) {
      if (this.phase[i] === PHASE.FREE || this.phase[i] === PHASE.IDLE) continue;
      this.position[3*i]     += (this.target[3*i]     - this.position[3*i])     * k;
      this.position[3*i + 1] += (this.target[3*i + 1] - this.position[3*i + 1]) * k;
      this.position[3*i + 2] += (this.target[3*i + 2] - this.position[3*i + 2]) * k;
      this.color[3*i]     += (this.targetColor[3*i]     - this.color[3*i])     * k * 0.5;
      this.color[3*i + 1] += (this.targetColor[3*i + 1] - this.color[3*i + 1]) * k * 0.5;
      this.color[3*i + 2] += (this.targetColor[3*i + 2] - this.color[3*i + 2]) * k * 0.5;
    }
    this.posAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
  }
```

- [ ] **Step 2: Přidat `updatePhasePlanet` do `animation.js`**

Přidat do `animation.js` (imports + funkce):

```js
import * as THREE from 'three';
import { PLANET_BY_ID } from './planets.js';
import { textToPoints } from './label.js';
import { fibonacciSphere } from './geometry.js';
import { PHASE } from './particles.js';

// cache pro label points a fibonacci body (nezávislé na čase)
const _cache = new Map();

function getPlanetSlotData(planetId, tickCount) {
  const key = `${planetId}:${tickCount}`;
  if (_cache.has(key)) return _cache.get(key);
  const p = PLANET_BY_ID[planetId];
  const labelPts = textToPoints(p.name, Math.min(tickCount, 240));
  const fibPts = fibonacciSphere(tickCount, p.radiusPx * 1.02);
  const color = new THREE.Color(p.color);
  const data = { planet: p, labelPts, fibPts, color };
  _cache.set(key, data);
  return data;
}

/** Invokováno pro fázi planetárního slotu (sun, mercury, ... neptune). */
export function updatePhasePlanet(pool, ph, phaseT, dt, planetMeshes) {
  const planet = PLANET_BY_ID[ph.planetId];
  const slot = getPlanetSlotData(ph.planetId, planet.tickCount);

  // první frame fáze: rezervovat indexy z FREE pool, přiřadit label targets
  if (!ph._allocated) {
    ph._allocated = pool.takeFreeIndices(planet.tickCount);
    pool.assignLabelTargets(ph._allocated, slot.labelPts);
  }

  // sub-fáze dle phaseT:
  if (phaseT < SUB.LABEL_FORM_END) {
    // forming label — lerp k label pozici
    pool.lerpToTargets(0.18);
  } else if (phaseT < SUB.LABEL_HOLD_END) {
    // holding — drží
    pool.lerpToTargets(0.25);
  } else if (phaseT < SUB.FLY_END) {
    // flying to planet — přepnout targets pokud ještě ne
    if (!ph._retargeted) {
      pool.assignPlanetTargets(ph._allocated, planetMeshes[planet.id].position, slot.fibPts, slot.color);
      ph._retargeted = true;
    }
    pool.lerpToTargets(0.12);
  } else {
    // fade-in textury
    pool.lerpToTargets(0.08);
    const mesh = planetMeshes[planet.id];
    const targetOp = (phaseT - SUB.FLY_END) / (1 - SUB.FLY_END);
    mesh.material.opacity = Math.min(1, targetOp);
    if (mesh.material.opacity >= 1) mesh.material.transparent = false;
  }
}

```

**Poznámka:** `SUB` je exportován z `animation.js` výše. Re-use import v rámci modulu netřeba. Funkci pro reset alokací přidáme v Task 22 (jako `resetTimeline`).

- [ ] **Step 3: Upravit `main.js` — zapojit `updatePhasePlanet`**

```js
import * as THREE from 'three';
import { createScene, createStarfield } from './scene.js';
import { createPlanetMeshes } from './planetMeshes.js';
import { updateRotations } from './rotation.js';
import { ParticlePool } from './particles.js';
import { phaseAt, phaseProgress, updatePhaseInit, updatePhasePlanet, clearPhaseAllocations } from './animation.js';

const { renderer, scene, camera } = createScene();
createStarfield(scene);
const { meshes, rings } = createPlanetMeshes(scene);

const pool = new ParticlePool(1500);
scene.add(pool.mesh);
pool.resetAllToFree();

const clock = new THREE.Clock();
let elapsed = 0;
let paused = false;

function tick() {
  const dt = paused ? 0 : clock.getDelta();
  elapsed += dt;

  const ph = phaseAt(elapsed);
  const pt = phaseProgress(elapsed);

  if (ph.id === 'init') {
    updatePhaseInit(pool, elapsed, dt);
  } else if (ph.id === 'sun') {
    updatePhasePlanet(pool, ph, pt, dt, meshes);
  }

  if (elapsed >= 7) updateRotations(meshes, dt);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
```

- [ ] **Step 4: Reload a ověřit Phase Sun (0–2 s)**

Expected:
- 0–1s: tečky se materializují, vznáší se.
- 1–1.25s: 250 teček se sesype do labelu „SLUNCE" uprostřed.
- 1.25–1.55s: label drží.
- 1.55–1.85s: tečky letí doleva k Slunci, obalí ho (na povrch).
- 1.85–2s: Slunce fade-in (textura se objeví).
- Zbytek teček (1250) se stále vznáší.

- [ ] **Step 5: Commit**

```bash
git add src/particles.js src/animation.js src/main.js
git commit -m "feat: Phase Sun — label → sesyp → fade-in textury"
```

---

### Task 18: Phases kamenné planety (2–3.9 s) + plynní obři

**Files:**
- Modify: `src/main.js`

Všechny planety 2–3.9s (Merkur, Venuše, Země, Mars) + Jupiter 3.9–5s + Uran 6–6.5s + Neptun 6.5–7s používají stejnou `updatePhasePlanet` funkci. Stačí ji volat pro všechny planet slots.

- [ ] **Step 1: Upravit dispatcher v `main.js`**

```js
function tick() {
  const dt = paused ? 0 : clock.getDelta();
  elapsed += dt;

  const ph = phaseAt(elapsed);
  const pt = phaseProgress(elapsed);

  if (ph.id === 'init') {
    updatePhaseInit(pool, elapsed, dt);
  } else if (ph.planetId && ph.planetId !== 'saturn') {
    updatePhasePlanet(pool, ph, pt, dt, meshes);
  } else if (ph.id === 'saturn') {
    // speciální handling v Task 19
    updatePhasePlanet(pool, ph, pt, dt, meshes);
  } else if (ph.id === 'live') {
    // Task 20
  }

  if (elapsed >= 7) updateRotations(meshes, dt);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
```

- [ ] **Step 2: Reload a ověřit animaci 0–7 s**

Expected sekvence:
- 0–1s: init, tečky materializují.
- 1–2s: SLUNCE sesyp.
- 2–2.4s: MERKUR sesyp.
- 2.4–2.9s: VENUŠE (s diakritikou!).
- 2.9–3.4s: ZEMĚ (s diakritikou!).
- 3.4–3.9s: MARS.
- 3.9–5s: JUPITER (delší, 160 teček).
- 5–6s: SATURN (prstence zatím chybí, Task 19).
- 6–6.5s: URAN.
- 6.5–7s: NEPTUN.
- 7s+: všechno stojí (zatím bez live fáze, Task 20).

Diakritika musí být čitelná ve všech labelech.

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: všechny planetární fáze (Merkur..Neptun) přes generickou updatePhasePlanet"
```

---

### Task 19: Saturn prstence — formation

**Files:**
- Modify: `src/animation.js`

Saturn má standardní sesyp (kulová skořápka z teček), plus zvlášť se objeví prstence: z **dodatečných** teček se vytvoří prstencový disk, pak fade-in alpha textury.

- [ ] **Step 1: Rozšířit `updatePhasePlanet` pro Saturn ring formation**

V `animation.js` upravit funkci:

```js
export function updatePhasePlanet(pool, ph, phaseT, dt, planetMeshes, ringMeshes = {}) {
  const planet = PLANET_BY_ID[ph.planetId];
  const slot = getPlanetSlotData(ph.planetId, planet.tickCount);

  if (!ph._allocated) {
    ph._allocated = pool.takeFreeIndices(planet.tickCount);
    pool.assignLabelTargets(ph._allocated, slot.labelPts);
  }

  if (phaseT < SUB.LABEL_FORM_END) {
    pool.lerpToTargets(0.18);
  } else if (phaseT < SUB.LABEL_HOLD_END) {
    pool.lerpToTargets(0.25);
  } else if (phaseT < SUB.FLY_END) {
    if (!ph._retargeted) {
      pool.assignPlanetTargets(ph._allocated, planetMeshes[planet.id].position, slot.fibPts, slot.color);
      ph._retargeted = true;
    }
    pool.lerpToTargets(0.12);
  } else {
    pool.lerpToTargets(0.08);
    const mesh = planetMeshes[planet.id];
    const targetOp = (phaseT - SUB.FLY_END) / (1 - SUB.FLY_END);
    mesh.material.opacity = Math.min(1, targetOp);
    if (mesh.material.opacity >= 1) mesh.material.transparent = false;

    // Saturn — fade-in prstenců
    if (planet.ringTexture && ringMeshes[planet.id]) {
      ringMeshes[planet.id].material.opacity = Math.min(0.9, targetOp * 0.9);
    }
  }
}
```

**Poznámka:** Pro V1 **prstence neobalujeme tečkami** (nechceme utratit dalších ~80 teček z poolu). Prstence přicházejí čistě jako textura fade-in. Zjednodušení akceptovatelné — vizuálně dominantní je tělo Saturnu z teček, prstence vedle jsou doplněk.

- [ ] **Step 2: Předávat `rings` do dispatcheru v `main.js`**

```js
} else if (ph.planetId) {
  updatePhasePlanet(pool, ph, pt, dt, meshes, rings);
}
```

Celý dispatcher:

```js
if (ph.id === 'init') {
  updatePhaseInit(pool, elapsed, dt);
} else if (ph.planetId) {
  updatePhasePlanet(pool, ph, pt, dt, meshes, rings);
}
```

- [ ] **Step 3: Reload a ověřit Saturn (5–6 s)**

Expected:
- Label „SATURN" se vytvoří.
- Tečky se sesypou na Saturn.
- Fade-in textury Saturnu + současně fade-in prstenců.
- Prstence mají správný tilt (26.73°) a alpha texturu (Cassini Division viditelná).

- [ ] **Step 4: Commit**

```bash
git add src/animation.js src/main.js
git commit -m "feat: Saturn prstence fade-in (textura synchronní s planetou)"
```

---

### Task 20: Live phase (7 s+) — rotace + surface oscillation

**Files:**
- Modify: `src/particles.js`
- Modify: `src/animation.js`
- Modify: `src/main.js`

- [ ] **Step 1: Přidat `surfaceOscillation()` do `particles.js`**

Přidat jako metodu třídy `ParticlePool`:

```js
  /** Tečky v phase ON_PLANET lehce oscilují v normále povrchu (dýchavé). */
  surfaceOscillate(time, dt, amplitude = 0.4) {
    for (let i = 0; i < this.count; i++) {
      if (this.phase[i] !== PHASE.ON_PLANET) continue;
      // posun po paprsku z cíle (planet center + offset) — pro zjednodušení jen lerp k target s drobným noise
      const seed = i * 0.07;
      const osc = Math.sin(time * 1.2 + seed) * amplitude * dt;
      this.position[3*i]     += (this.target[3*i]     - this.position[3*i])     * 0.05 + osc;
      this.position[3*i + 1] += (this.target[3*i + 1] - this.position[3*i + 1]) * 0.05;
      this.position[3*i + 2] += (this.target[3*i + 2] - this.position[3*i + 2]) * 0.05;
    }
    this.posAttr.needsUpdate = true;
  }
```

- [ ] **Step 2: Přidat `updatePhaseLive` do `animation.js`**

```js
export function updatePhaseLive(pool, tSeconds, dt, planetMeshes) {
  // Tečky které měly fázi FLYING_TO_PLANET → přepni na ON_PLANET (first frame live only)
  for (let i = 0; i < pool.count; i++) {
    if (pool.phase[i] === PHASE.FLYING_TO_PLANET) pool.phase[i] = PHASE.ON_PLANET;
  }
  // Free tečky pokračují v noise driftu
  pool.noiseDriftAll(tSeconds, dt, 3);
  // Povrchová oscilace
  pool.surfaceOscillate(tSeconds, dt, 0.3);
}
```

- [ ] **Step 3: Zapojit do `main.js`**

```js
} else if (ph.id === 'live') {
  updatePhaseLive(pool, elapsed, dt, meshes);
}
```

A rotace planet poběží od 7 s (zachováno, stávající kód).

Kompletní `tick()`:

```js
function tick() {
  const dt = paused ? 0 : clock.getDelta();
  elapsed += dt;

  const ph = phaseAt(elapsed);
  const pt = phaseProgress(elapsed);

  if (ph.id === 'init') {
    updatePhaseInit(pool, elapsed, dt);
  } else if (ph.id === 'live') {
    updatePhaseLive(pool, elapsed, dt, meshes);
  } else if (ph.planetId) {
    updatePhasePlanet(pool, ph, pt, dt, meshes, rings);
  }

  if (elapsed >= 7) updateRotations(meshes, dt);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
```

- [ ] **Step 4: Reload a sledovat 10+ sekund**

Expected:
- Celá animace 0–7s proběhne.
- Od 7s dál všechny planety rotují (Jupiter nejrychlejší, Země plynule, Venuše retrográdně pomalu, Uran na boku).
- Tečky na povrchu planet jemně dýchají.
- Free tečky kolem scény se vznáší.

- [ ] **Step 5: Commit**

```bash
git add src/particles.js src/animation.js src/main.js
git commit -m "feat: live phase (7s+) — rotace planet + surface oscilace teček"
```

---

### Task 21: Finální fade-out labelů + cleanup

**Files:**
- Modify: `src/animation.js`

Aktuální stav: label tečky při přepnutí na `assignPlanetTargets` se přepnou na `FLYING_TO_PLANET` a lerp je odvede z label pozice na planetu — label se tak přirozeně „rozpadne" pohybem. Ověříme, že to vizuálně funguje.

- [ ] **Step 1: Vizuální ověření přechodu label→planet**

Reload, sledovat každou planetu:
- Label drží 0.3 × fáze = (0.4s pro Merkur, 0.2s pro Uran atd.).
- Tečky se plynule rozplynou z labelu a letí na planetu.
- Žádné „teleportace" — vše hladce.

Pokud přechod vypadá trhaně, zvýšit easing koeficient v `lerpToTargets` z 0.12 na 0.10 (pomalejší = hladší).

- [ ] **Step 2: Pokud OK, commit nepotřeba. Pokud ladíš, drobné commit:**

```bash
git add src/animation.js
git commit -m "tune: label→planet přechod hladší"
```

(Volitelné — přeskočit pokud bez úprav.)

---

## Fáze E — Polish (Tasks 22–25)

### Task 22: Controls — R restart, Space pauza

**Files:**
- Create: `src/controls.js`
- Modify: `src/main.js`

- [ ] **Step 1: Napsat `src/controls.js`**

```js
export function bindControls({ onRestart, onTogglePause }) {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'KeyR') {
      onRestart();
    } else if (e.code === 'Space') {
      e.preventDefault();
      onTogglePause();
    }
  });
}
```

- [ ] **Step 2: Rozšířit `animation.js` o `resetTimeline`**

```js
export function resetTimeline() {
  for (const ph of PHASES) {
    delete ph._allocated;
    delete ph._retargeted;
  }
  _cache.clear();
}
```

(Exportuj pokud ještě není.)

- [ ] **Step 3: Zapojit controls v `main.js`**

```js
import { bindControls } from './controls.js';

// ...

function restart() {
  elapsed = 0;
  resetTimeline();
  pool.resetAllToFree();
  // reset planetárních meshů
  for (const m of Object.values(meshes)) {
    m.material.opacity = 0;
    m.material.transparent = true;
  }
  for (const r of Object.values(rings)) {
    r.material.opacity = 0;
  }
  clock.start();
}

bindControls({
  onRestart: restart,
  onTogglePause: () => { paused = !paused; },
});
```

Aby `resetTimeline` byl dostupný, přidat do importu:

```js
import { phaseAt, phaseProgress, updatePhaseInit, updatePhasePlanet, updatePhaseLive, resetTimeline } from './animation.js';
```

- [ ] **Step 4: Reload, testovat Space a R**

Expected:
- `Space` — animace zastaví; znovu `Space` — pokračuje.
- `R` — celá scéna restartuje, animace začne znovu od 0s.

- [ ] **Step 5: Commit**

```bash
git add src/controls.js src/animation.js src/main.js
git commit -m "feat: controls (R restart, Space pauza)"
```

---

### Task 23: Finální vizuální polish

**Files:**
- Modify: podle potřeby po vizuálním review

- [ ] **Step 1: Sledovat celou animaci 2–3× v řadě**

Kontrolní body:
- Proporce — Jupiter vs. Merkur vs. Slunce (Slunce dominuje vlevo, Merkur drobný, Jupiter velký).
- Axial tilts — Uran viditelně leží, Venuše vzhůru nohama, Saturn prstence nakloněny.
- Diakritika — VENUŠE a ZEMĚ čitelné v labelech.
- Pořadí — Merkur, Venuše, Země, Mars, Jupiter, Saturn, Uran, Neptun zleva doprava.
- Rotace — Jupiter nejrychlejší, Země plynulá, Uran retrograde, Venuše „prakticky stojí".
- Prstence — Saturn má Cassini Division.
- Tečky — free pool noise driftuje celou dobu, na povrchu planet dýchá.

- [ ] **Step 2: Ladit pokud potřeba**

Časté úpravy (pokud něco nesedí):
- `pool.resetAllToFree()` — `magnitude` v `noiseDriftAll` pro více/méně hýbání.
- `lerpToTargets(0.12)` — koeficient pro rychlost sesypu (vyšší = rychleji).
- `PointLight` intensity v `scene.js` — osvětlení planet.
- `LABEL_SCALE` v `label.js` — velikost labelu.

- [ ] **Step 3: Commit úprav (pokud jaké)**

```bash
git add -A
git commit -m "tune: vizuální polish (osvětlení, easing)"
```

---

### Task 24: Acceptance criteria check

**Files:** žádné. Čistě test pass/fail.

- [ ] **Step 1: Projet všechny acceptance criteria ze spec**

Reference: `docs/superpowers/specs/2026-04-24-dots-v1-solar-system-design.md` sekce „Acceptance criteria".

- [ ] 1. Spuštění přes live server → canvas fullscreen ✓/✗
- [ ] 2. Animace proběhne 0–7s přesně podle timeline ✓/✗
- [ ] 3. Proporce odpovídají scale tabulce ✓/✗
- [ ] 4. Saturn prstence pod úhlem, Uran leží, Venuše retrográdně ✓/✗
- [ ] 5. Labely česky s diakritikou z teček ✓/✗
- [ ] 6. R restart, Space pauza fungují ✓/✗
- [ ] 7. 60 fps na referenčním HW ✓/✗ (DevTools → Performance)
- [ ] 8. Žádné JS errory ✓/✗ (Console)
- [ ] 9. NASA/SSC kvalita textur — Great Red Spot viditelný ✓/✗
- [ ] 10. Žádný soubor v `src/` > 300 řádků ✓/✗

Spustit:
```bash
wc -l src/*.js
```
Všechny pod 300.

Unit testy:
```bash
npm test
```
Všechny PASS.

- [ ] **Step 2: Pokud něco ✗, vrátit se na relevantní task a opravit**

- [ ] **Step 3: Commit stavu**

```bash
git add -A
git commit -m "test: V1 acceptance criteria passed" --allow-empty
```

---

### Task 25: Final README + licence

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Doplnit README.md o screenshoty/GIF sekci a final poznámky**

Přidat na konec `README.md`:

```markdown
## Jak to funguje

1. 1500 teček se zhmotní v random pozicích.
2. Postupně (SLUNCE → MERKUR → VENUŠE → ZEMĚ → MARS → JUPITER → SATURN → URAN → NEPTUN) se tečky z volného poolu přeskupí do labelu české názvu planety, drží 0.3 s, a pak odletí na povrch planety formované do Fibonacci-sphere distribuce.
3. Souběžně fade-in 2k NASA textury (Slunce + 8 planet + alpha prstenec Saturnu).
4. Po 7 s začnou planety rotovat kolem vlastních os s realistickými poměry (Země = 10 s/otočka, Jupiter ~4 s, Venuše retrográdně + vzhůru nohama, Uran leží na boku).
5. Tečky na povrchu planet lehce dýchají, free pool v pozadí jemně drifftuje.

## Acceptance criteria (V1)

Viz [spec V1](docs/superpowers/specs/2026-04-24-dots-v1-solar-system-design.md).

## Licence

Code: MIT.
Textury: CC BY 4.0 — [Solar System Scope](https://www.solarsystemscope.com/textures/) (zdroje SDO / Hubble / Cassini / Voyager).
Three.js: MIT.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: finální README s popisem funkčnosti a licencemi"
```

---

## Self-Review Checklist

- [ ] **Spec coverage:** V1 pokrývá: 9 těles render ✓ (Task 7), proporce ✓ (Task 3 data), Saturn prstence ✓ (Task 8), axial tilts ✓ (Task 9), realistická rotace ✓ (Task 10), 1500 teček pool ✓ (Task 11), Perlin noise init ✓ (Task 16), label z teček ✓ (Tasks 13–14), všech 9 fází animace ✓ (Tasks 16–19), live rotace + oscillation ✓ (Task 20), controls ✓ (Task 22), acceptance ✓ (Task 24).
- [ ] **Placeholder scan:** Žádné TBD/TODO. Každá úprava souboru má kompletní kód. Jediné „implementátor rozhodne" je SSC URL aktualizace (pokud 404) — akceptovatelné.
- [ ] **Type consistency:** `PHASE` enum konzistentní napříč `particles.js` a `animation.js`. `planetMeshes` = `{ meshes, rings }` konzistentně destructurováno. `updatePhasePlanet(pool, ph, phaseT, dt, planetMeshes, ringMeshes = {})` signature matching ve všech voláních.
- [ ] **Scope check:** Každý task produkuje commit a inkrementálně funkční build. V1 out-of-scope (měsíce, detail view, pásy, komety) není v plánu.

---

## Execution Handoff

Plán hotový. Máš dvě cesty:

**1. Subagent-Driven (doporučeno)** — dispatchuji čerstvý subagent na každý task, mezi tascích review, rychlé iterace.

**2. Inline Execution** — jedu tasky v této session přes executing-plans, dávkové provedení s checkpointy.

Který přístup?
