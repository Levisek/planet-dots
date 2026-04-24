# V2 Moons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Přidat 19 měsíců okolo 5 planet (Earth, Mars, Jupiter, Saturn, Uranus), orbitujících po Keplerovsky eliptických drahách s tidal lock, v sekvenčních sub-fázích po Neptunu.

**Architecture:** Nové moduly `orbit.js`, `moons.js`, `moonAnchors.js`, `moonWind.js`. Moon anchors jsou **children** parent planet anchoru → dědí axial tilt přes matrixWorld chain. Emise ze spawn-from-planet helperu v `particles.js`. Jednotný `anchorsByIndex` array (planets 0–8, moons 9–27) pro `applyClusterRotation`.

**Tech Stack:** Vanilla JS ESM, Three.js r170 z CDN, Node.js `--test` pro unit testy. Žádný bundler, žádný framework.

---

## File Structure

**Nové soubory:**
- `src/orbit.js` — Kepler solver
- `src/orbit.test.js` — solver tests
- `src/moons.js` — data 19 měsíců
- `src/moons.test.js` — data tests
- `src/moonAnchors.js` — parent-child anchor factory + texture preload
- `src/moonWind.js` — per-family emission controller
- `scripts/download_moon_textures.sh` — texture download (nebo manuální fallback)
- `textures/<moonId>.jpg` × 19 — NASA/SSC textures

**Modifikované soubory:**
- `src/phase.js` — + `PHASE.ON_MOON`
- `src/particles.js` — + `spawnFromPlanet`, + moon arrival/rotation dispatch
- `src/animation.js` — + 5 moon sub-fází, live shift na 13.0 s
- `src/animation.test.js` — test updates
- `src/planets.js` — `POOL_SIZE` 33 000 → 36 000
- `src/planets.test.js` — budget assert update
- `src/main.js` — bootstrap moons, orbit + tidal lock update, unified anchors array
- `README.md` — moon texture licence atribuce

---

### Task 1: Kepler Orbit Solver

**Files:**
- Create: `src/orbit.js`
- Test: `src/orbit.test.js`

- [ ] **Step 1: Write failing test**

Create `src/orbit.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveKepler, orbitPosition, trueAnomaly } from './orbit.js';

test('solveKepler(0, e) = 0', () => {
  for (const e of [0, 0.1, 0.3]) {
    assert.ok(Math.abs(solveKepler(0, e)) < 1e-9, `e=${e}`);
  }
});

test('solveKepler(M, 0) = M (zero eccentricity)', () => {
  for (const M of [0.1, 1.5, Math.PI, 2 * Math.PI]) {
    assert.ok(Math.abs(solveKepler(M, 0) - M) < 1e-9, `M=${M}`);
  }
});

test('Kepler identity: E - e·sin(E) ≈ M after 5 iterations', () => {
  for (const M of [0.1, 0.5, 1.0, 2.0, 3.0]) {
    for (const e of [0.01, 0.1, 0.2, 0.3]) {
      const E = solveKepler(M, e);
      const residual = E - e * Math.sin(E) - M;
      assert.ok(Math.abs(residual) < 1e-6, `M=${M}, e=${e}, resid=${residual}`);
    }
  }
});

test('orbitPosition at t=0 with phaseOffset=0 is periapsis', () => {
  const { x, z } = orbitPosition(0, 0, 10, 100, 0.2);
  // periapsis: E=0 → x = a(1-e), z = 0
  assert.ok(Math.abs(x - 100 * (1 - 0.2)) < 1e-6);
  assert.ok(Math.abs(z) < 1e-6);
});

test('orbitPosition half-period is apoapsis', () => {
  const { x, z } = orbitPosition(5, 0, 10, 100, 0.2);
  // apoapsis: E=π → x = a(-1-e), z ≈ 0
  assert.ok(Math.abs(x - 100 * (-1 - 0.2)) < 1e-5);
  assert.ok(Math.abs(z) < 1e-5);
});

test('trueAnomaly(0, e) = 0', () => {
  for (const e of [0, 0.1, 0.3]) {
    assert.ok(Math.abs(trueAnomaly(0, e)) < 1e-9);
  }
});

test('trueAnomaly(π, e) = π', () => {
  for (const e of [0.01, 0.1, 0.3]) {
    assert.ok(Math.abs(trueAnomaly(Math.PI, e) - Math.PI) < 1e-6);
  }
});

test('orbitPosition returns E for downstream use', () => {
  const { E } = orbitPosition(2.5, 0, 10, 100, 0.1);
  assert.ok(typeof E === 'number' && E > 0 && E < Math.PI);
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `node --test src/orbit.test.js`
Expected: FAIL ("Cannot find module './orbit.js'").

- [ ] **Step 3: Implement orbit.js**

Create `src/orbit.js`:
```js
/**
 * Newton-Raphson solver pro Keplerovu rovnici E - e·sin(E) = M.
 * @param {number} M — mean anomaly (rad)
 * @param {number} e — eccentricity (0..1)
 * @param {number} [iterations=5]
 * @returns {number} E — eccentric anomaly
 */
export function solveKepler(M, e, iterations = 5) {
  let E = M;
  for (let i = 0; i < iterations; i++) {
    E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

/**
 * Pozice na eliptické orbitě v lokálním frame (X-Z rovina, Y=0).
 * Focus v originu, periapsis na +X ose.
 * @param {number} t — absolutní čas (sec)
 * @param {number} phaseOffset — fázový offset (rad)
 * @param {number} period — perioda oběhu (sec)
 * @param {number} a — semi-major axis (px)
 * @param {number} e — eccentricity
 * @returns {{x:number, y:number, z:number, E:number}}
 */
export function orbitPosition(t, phaseOffset, period, a, e) {
  const M = (2 * Math.PI * t) / period + phaseOffset;
  const E = solveKepler(M, e);
  const x = a * (Math.cos(E) - e);
  const z = a * Math.sqrt(1 - e * e) * Math.sin(E);
  return { x, y: 0, z, E };
}

/**
 * True anomaly ν z eccentric anomaly E (pro tidal lock spin angle).
 */
export function trueAnomaly(E, e) {
  return 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2),
  );
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `node --test src/orbit.test.js`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/orbit.js src/orbit.test.js
git commit -m "feat: orbit.js — Kepler solver (solveKepler, orbitPosition, trueAnomaly) + testy"
```

---

### Task 2: Moon Data + POOL_SIZE Bump

**Files:**
- Create: `src/moons.js`
- Create: `src/moons.test.js`
- Modify: `src/planets.js` (POOL_SIZE)
- Modify: `src/planets.test.js` (budget assert)

- [ ] **Step 1: Write failing test for moons data**

Create `src/moons.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOONS, MOON_BY_ID, MOONS_BY_PARENT } from './moons.js';
import { PLANET_BY_ID, POOL_SIZE } from './planets.js';

test('MOONS má přesně 19 měsíců', () => {
  assert.equal(MOONS.length, 19);
});

test('každý měsíc má povinné atributy', () => {
  const required = ['id', 'name', 'parent', 'diameterKm', 'radiusPx', 'tickCount', 'texture', 'a', 'e', 'period', 'phaseOffset'];
  for (const m of MOONS) {
    for (const key of required) {
      assert.ok(key in m, `${m.id} postrádá ${key}`);
    }
  }
});

test('každý parent existuje v PLANETS', () => {
  for (const m of MOONS) {
    assert.ok(PLANET_BY_ID[m.parent], `${m.id} má neznámý parent ${m.parent}`);
  }
});

test('eccentricity v rozsahu (0, 0.3]', () => {
  for (const m of MOONS) {
    assert.ok(m.e > 0 && m.e <= 0.3, `${m.id} e=${m.e} mimo rozsah`);
  }
});

test('period, a, tickCount, radiusPx jsou kladné', () => {
  for (const m of MOONS) {
    assert.ok(m.period > 0, `${m.id} period`);
    assert.ok(m.a > 0, `${m.id} a`);
    assert.ok(m.tickCount > 0, `${m.id} tickCount`);
    assert.ok(m.radiusPx >= 0.5, `${m.id} radiusPx ${m.radiusPx} < 0.5`);
  }
});

test('rozložení rodin: Earth 1, Mars 2, Jupiter 4, Saturn 7, Uranus 5', () => {
  const byParent = MOONS.reduce((acc, m) => {
    acc[m.parent] = (acc[m.parent] || 0) + 1;
    return acc;
  }, {});
  assert.equal(byParent.earth, 1);
  assert.equal(byParent.mars, 2);
  assert.equal(byParent.jupiter, 4);
  assert.equal(byParent.saturn, 7);
  assert.equal(byParent.uranus, 5);
});

test('MOONS_BY_PARENT je správně seskupený', () => {
  assert.equal(MOONS_BY_PARENT.earth.length, 1);
  assert.equal(MOONS_BY_PARENT.jupiter.length, 4);
  assert.equal(MOONS_BY_PARENT.saturn.length, 7);
});

test('MOON_BY_ID obsahuje všech 19', () => {
  for (const m of MOONS) {
    assert.equal(MOON_BY_ID[m.id], m);
  }
});

test('součet moon tickCount + planet ticks se vejde do POOL_SIZE s rezervou', () => {
  // planet ticks jsou testované v planets.test.js — tady spočítáme moon ticks
  const moonSum = MOONS.reduce((s, m) => s + m.tickCount, 0);
  assert.ok(moonSum > 1000 && moonSum < 3000, `moon ticks = ${moonSum} mimo rozumný rozsah`);
  assert.ok(POOL_SIZE >= 36000, `POOL_SIZE = ${POOL_SIZE}, musí ≥ 36000`);
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `node --test src/moons.test.js`
Expected: FAIL ("Cannot find module './moons.js'").

- [ ] **Step 3: Implement moons.js**

Create `src/moons.js`:
```js
// MOONS — data 19 měsíců V2.
// `a` je semi-major axis jako násobek parent radius (dekorativně komprimované).
// `e` je eccentricity po zveličení (real × ~7, clamp ≤ 0.3).
// `period` v sekundách (per-family normalized).
// `phaseOffset` deterministický offset (rad) pro staggered start.

export const MOONS = [
  { id: 'luna', name: 'LUNA', parent: 'earth',
    diameterKm: 3474, radiusPx: 2.2, tickCount: 120,
    texture: 'textures/luna.jpg',
    a: 2.0, e: 0.275, period: 20, phaseOffset: 0.3 },

  { id: 'phobos', name: 'PHOBOS', parent: 'mars',
    diameterKm: 22, radiusPx: 0.5, tickCount: 20,
    texture: 'textures/phobos.jpg',
    a: 1.3, e: 0.1, period: 2, phaseOffset: 0.0 },
  { id: 'deimos', name: 'DEIMOS', parent: 'mars',
    diameterKm: 12, radiusPx: 0.5, tickCount: 20,
    texture: 'textures/deimos.jpg',
    a: 2.0, e: 0.05, period: 8, phaseOffset: 1.5 },

  { id: 'io', name: 'IO', parent: 'jupiter',
    diameterKm: 3643, radiusPx: 2.3, tickCount: 130,
    texture: 'textures/io.jpg',
    a: 1.33, e: 0.04, period: 5, phaseOffset: 0.5 },
  { id: 'europa', name: 'EUROPA', parent: 'jupiter',
    diameterKm: 3122, radiusPx: 2.0, tickCount: 100,
    texture: 'textures/europa.jpg',
    a: 1.56, e: 0.09, period: 10, phaseOffset: 1.2 },
  { id: 'ganymede', name: 'GANYMEDE', parent: 'jupiter',
    diameterKm: 5268, radiusPx: 3.4, tickCount: 300,
    texture: 'textures/ganymede.jpg',
    a: 1.78, e: 0.02, period: 20, phaseOffset: 2.0 },
  { id: 'callisto', name: 'CALLISTO', parent: 'jupiter',
    diameterKm: 4820, radiusPx: 3.1, tickCount: 250,
    texture: 'textures/callisto.jpg',
    a: 2.0, e: 0.07, period: 47, phaseOffset: 3.5 },

  { id: 'titan', name: 'TITAN', parent: 'saturn',
    diameterKm: 5150, radiusPx: 3.3, tickCount: 300,
    texture: 'textures/titan.jpg',
    a: 3.8, e: 0.2, period: 50, phaseOffset: 1.8 },
  { id: 'rhea', name: 'RHEA', parent: 'saturn',
    diameterKm: 1527, radiusPx: 1.0, tickCount: 60,
    texture: 'textures/rhea.jpg',
    a: 3.1, e: 0.02, period: 14.3, phaseOffset: 0.9 },
  { id: 'iapetus', name: 'IAPETUS', parent: 'saturn',
    diameterKm: 1470, radiusPx: 0.95, tickCount: 60,
    texture: 'textures/iapetus.jpg',
    a: 4.4, e: 0.2, period: 60, phaseOffset: 2.5 },
  { id: 'dione', name: 'DIONE', parent: 'saturn',
    diameterKm: 1123, radiusPx: 0.72, tickCount: 45,
    texture: 'textures/dione.jpg',
    a: 2.9, e: 0.02, period: 8.7, phaseOffset: 1.1 },
  { id: 'tethys', name: 'TETHYS', parent: 'saturn',
    diameterKm: 1062, radiusPx: 0.68, tickCount: 45,
    texture: 'textures/tethys.jpg',
    a: 2.7, e: 0.02, period: 6, phaseOffset: 0.4 },
  { id: 'enceladus', name: 'ENCELADUS', parent: 'saturn',
    diameterKm: 504, radiusPx: 0.5, tickCount: 25,
    texture: 'textures/enceladus.jpg',
    a: 2.55, e: 0.05, period: 4.3, phaseOffset: 2.2 },
  { id: 'mimas', name: 'MIMAS', parent: 'saturn',
    diameterKm: 396, radiusPx: 0.5, tickCount: 20,
    texture: 'textures/mimas.jpg',
    a: 2.4, e: 0.2, period: 3, phaseOffset: 0.1 },

  { id: 'miranda', name: 'MIRANDA', parent: 'uranus',
    diameterKm: 471, radiusPx: 0.5, tickCount: 25,
    texture: 'textures/miranda.jpg',
    a: 1.7, e: 0.02, period: 4, phaseOffset: 1.7 },
  { id: 'ariel', name: 'ARIEL', parent: 'uranus',
    diameterKm: 1158, radiusPx: 0.74, tickCount: 50,
    texture: 'textures/ariel.jpg',
    a: 1.9, e: 0.02, period: 7, phaseOffset: 0.8 },
  { id: 'umbriel', name: 'UMBRIEL', parent: 'uranus',
    diameterKm: 1169, radiusPx: 0.75, tickCount: 50,
    texture: 'textures/umbriel.jpg',
    a: 2.15, e: 0.04, period: 12, phaseOffset: 2.7 },
  { id: 'titania', name: 'TITANIA', parent: 'uranus',
    diameterKm: 1577, radiusPx: 1.01, tickCount: 80,
    texture: 'textures/titania.jpg',
    a: 2.5, e: 0.02, period: 25, phaseOffset: 3.0 },
  { id: 'oberon', name: 'OBERON', parent: 'uranus',
    diameterKm: 1523, radiusPx: 0.98, tickCount: 80,
    texture: 'textures/oberon.jpg',
    a: 2.8, e: 0.02, period: 38, phaseOffset: 0.6 },
];

export const MOON_BY_ID = Object.fromEntries(MOONS.map(m => [m.id, m]));

export const MOONS_BY_PARENT = MOONS.reduce((acc, m) => {
  (acc[m.parent] ??= []).push(m);
  return acc;
}, {});
```

- [ ] **Step 4: Bump POOL_SIZE v `planets.js`**

Edit `src/planets.js` — change `POOL_SIZE`:
```js
export const POOL_SIZE = 36000;
```

- [ ] **Step 5: Update `planets.test.js` budget assert**

Edit `src/planets.test.js` — line with budget assert:
```js
test('součet tickCount planet + prstence se vejde do POOL_SIZE s rezervou', () => {
  const sum = PLANETS.reduce((s, p) => s + p.tickCount + (p.ringTickCount || 0), 0);
  assert.ok(sum <= 35500, `součet ticks = ${sum}, musí ≤ 35500 (pool 36000 s rezervou)`);
  assert.ok(sum >= 20000, `součet ticks = ${sum}, musí ≥ 20000 pro hustotu`);
});
```

- [ ] **Step 6: Run all tests — expect pass**

Run: `node --test "src/**/*.test.js"`
Expected: všechny testy pass (V1 + nový moons).

- [ ] **Step 7: Commit**

```bash
git add src/moons.js src/moons.test.js src/planets.js src/planets.test.js
git commit -m "feat: moons.js data (19 měsíců) + POOL_SIZE 36k"
```

---

### Task 3: Moon Textures

**Files:**
- Create: `scripts/download_moon_textures.sh`
- Create: `textures/luna.jpg`, `io.jpg`, `europa.jpg`, ..., 19 souborů
- Modify: `README.md` (licence atribuce)

- [ ] **Step 1: Vytvoř download skript**

Create `scripts/download_moon_textures.sh`:
```bash
#!/usr/bin/env bash
# Stáhne 19 moon textures do ./textures/.
# Zdroje: Solar System Scope (CC BY 4.0), NASA (PD).
# Pokud URL selže, dostane .failed sufix — potřeba manuální fallback.

set -e
cd "$(dirname "$0")/.."
mkdir -p textures

declare -A URLS=(
  [luna]="https://www.solarsystemscope.com/textures/download/2k_moon.jpg"
  [io]="https://www.solarsystemscope.com/textures/download/2k_jupiter_io.jpg"
  [europa]="https://www.solarsystemscope.com/textures/download/2k_jupiter_europa.jpg"
  [ganymede]="https://www.solarsystemscope.com/textures/download/2k_jupiter_ganymede.jpg"
  [callisto]="https://www.solarsystemscope.com/textures/download/2k_jupiter_callisto.jpg"
  [titan]="https://www.solarsystemscope.com/textures/download/2k_saturn_titan.jpg"
  # NASA a Wikipedia zdroje — URL ověřit, pokud selže použij manuální
  [phobos]="https://photojournal.jpl.nasa.gov/jpeg/PIA10368.jpg"
  [deimos]="https://photojournal.jpl.nasa.gov/jpeg/PIA11826.jpg"
  [rhea]="https://photojournal.jpl.nasa.gov/jpeg/PIA07763.jpg"
  [iapetus]="https://photojournal.jpl.nasa.gov/jpeg/PIA08384.jpg"
  [dione]="https://photojournal.jpl.nasa.gov/jpeg/PIA07748.jpg"
  [tethys]="https://photojournal.jpl.nasa.gov/jpeg/PIA07738.jpg"
  [enceladus]="https://photojournal.jpl.nasa.gov/jpeg/PIA06254.jpg"
  [mimas]="https://photojournal.jpl.nasa.gov/jpeg/PIA12570.jpg"
  [miranda]="https://photojournal.jpl.nasa.gov/jpeg/PIA00044.jpg"
  [ariel]="https://photojournal.jpl.nasa.gov/jpeg/PIA01534.jpg"
  [umbriel]="https://photojournal.jpl.nasa.gov/jpeg/PIA00040.jpg"
  [titania]="https://photojournal.jpl.nasa.gov/jpeg/PIA00039.jpg"
  [oberon]="https://photojournal.jpl.nasa.gov/jpeg/PIA00034.jpg"
)

for moon in "${!URLS[@]}"; do
  out="textures/${moon}.jpg"
  if [ -f "$out" ]; then
    echo "✓ $out (skip, existuje)"
    continue
  fi
  echo "↓ $moon z ${URLS[$moon]}"
  if curl -fsSL -o "$out" "${URLS[$moon]}"; then
    echo "  ✓ $(du -h "$out" | cut -f1)"
  else
    echo "  ✗ selhalo — ${out}.failed vytvořen, manuálně stáhnout"
    touch "${out}.failed"
  fi
done
```

Make executable: `chmod +x scripts/download_moon_textures.sh`

- [ ] **Step 2: Spustit skript**

Run: `bash scripts/download_moon_textures.sh`

Expected: 19 souborů v `textures/` nebo část `.failed` markerů. Co selhalo, manuálně stáhnout ze zdroje (SSC, Wikipedia commons, NASA SVS) a uložit jako `textures/<moonId>.jpg`. Minimálně 512×256 resolution.

- [ ] **Step 3: Ověř, že všech 19 existuje**

Run: `ls textures/*.jpg | wc -l`
Expected: **29** (10 V1 planet textures + 19 moon textures).

Pokud < 29, doplň chybějící manuálně a znovu spusť.

- [ ] **Step 4: Update README.md licence sekce**

Edit `README.md`. Najdi sekci „Licence" na konci a rozšiř:
```markdown
## Licence

Code: MIT.

Textury planet: CC BY 4.0 — [Solar System Scope](https://www.solarsystemscope.com/textures/).

Textury měsíců:
- Luna, Io, Europa, Ganymede, Callisto, Titan: CC BY 4.0 — Solar System Scope.
- Phobos, Deimos, Rhea, Iapetus, Dione, Tethys, Enceladus, Mimas, Miranda, Ariel, Umbriel, Titania, Oberon: Public Domain — NASA / JPL / Cassini / Voyager 2 mise.
```

- [ ] **Step 5: Commit**

```bash
git add scripts/download_moon_textures.sh textures/luna.jpg textures/phobos.jpg textures/deimos.jpg textures/io.jpg textures/europa.jpg textures/ganymede.jpg textures/callisto.jpg textures/titan.jpg textures/rhea.jpg textures/iapetus.jpg textures/dione.jpg textures/tethys.jpg textures/enceladus.jpg textures/mimas.jpg textures/miranda.jpg textures/ariel.jpg textures/umbriel.jpg textures/titania.jpg textures/oberon.jpg README.md
git commit -m "chore: stáhnuté textury 19 měsíců + README licence atribuce"
```

---

### Task 4: PHASE.ON_MOON + spawnFromPlanet

**Files:**
- Modify: `src/phase.js`
- Modify: `src/particles.js`

- [ ] **Step 1: Přidat PHASE.ON_MOON do phase.js**

Edit `src/phase.js` — nahradit `Object.freeze({…})`:
```js
export const PHASE = Object.freeze({
  IDLE: 0,            // neemitovaná, čeká
  ON_SUN: 1,          // statická tečka na Slunci (initial fill)
  FLYING: 2,          // letí k cíli (ať už label nebo surface)
  HOLDING_LABEL: 3,   // dorazila k label pozici, drží
  ON_PLANET: 4,       // usazená na povrchu planety
  ON_RING: 5,         // usazená na prstenci
  ON_MOON: 6,         // usazená na povrchu měsíce
});
```

- [ ] **Step 2: Přidat spawnFromPlanet do particles.js**

Edit `src/particles.js` — přidat metodu do `ParticlePool` class (za `spawnFromSun`):
```js
/**
 * Spawn tečky z povrchu mateřské planety ven na orbitu měsíce.
 * Podobné spawnFromSun, ale zdroj = planet surface, cíl = moon orbit position.
 * Používá IDLE index, nastaví FLYING pak ON_MOON po arrival.
 *
 * @param {number} sourceIdx — volný IDLE index
 * @param {{x,y,z}} planetCenter — world pos planety
 * @param {number} planetRadius
 * @param {{x,y,z}} moonOrbitWorld — world pos cílové pozice (moonAnchor surface point)
 * @param {{x,y,z}} moonLocalOffset — offset v moonAnchor frame (pro cluster rotaci)
 * @param {[number,number,number]} planetColor — barva startu
 * @param {[number,number,number]} moonColor — barva po příletu
 * @param {number} moonOwnerIdx — unified anchor index (9 + moon array index)
 * @param {number} currentTime
 * @param {number} travelTime — 0.25–0.35 s
 */
spawnFromPlanet(sourceIdx, planetCenter, planetRadius, moonOrbitWorld, moonLocalOffset,
                planetColor, moonColor, moonOwnerIdx, currentTime, travelTime) {
  const i = sourceIdx;
  // start pozice = random bod na povrchu planety
  const rx = (Math.random() - 0.5) * 2;
  const ry = (Math.random() - 0.5) * 2;
  const rz = (Math.random() - 0.5) * 2;
  const len = Math.sqrt(rx*rx + ry*ry + rz*rz) || 1;
  const sx = planetCenter.x + (rx/len) * planetRadius;
  const sy = planetCenter.y + (ry/len) * planetRadius;
  const sz = planetCenter.z + (rz/len) * planetRadius;
  this.position[3*i]     = sx;
  this.position[3*i + 1] = sy;
  this.position[3*i + 2] = sz;
  // barva při emit = planet color (sampled)
  this.color[3*i]     = planetColor[0];
  this.color[3*i + 1] = planetColor[1];
  this.color[3*i + 2] = planetColor[2];
  this.alpha[i] = 1.0;

  const tx = moonOrbitWorld.x;
  const ty = moonOrbitWorld.y;
  const tz = moonOrbitWorld.z;
  this.target[3*i]     = tx;
  this.target[3*i + 1] = ty;
  this.target[3*i + 2] = tz;

  this.velocity[3*i]     = (tx - sx) / travelTime;
  this.velocity[3*i + 1] = (ty - sy) / travelTime;
  this.velocity[3*i + 2] = (tz - sz) / travelTime;

  this.postArrivalTarget[3*i]     = tx;
  this.postArrivalTarget[3*i + 1] = ty;
  this.postArrivalTarget[3*i + 2] = tz;
  this.postArrivalColor[3*i]     = moonColor[0];
  this.postArrivalColor[3*i + 1] = moonColor[1];
  this.postArrivalColor[3*i + 2] = moonColor[2];
  this.localOffset[3*i]     = moonLocalOffset.x;
  this.localOffset[3*i + 1] = moonLocalOffset.y;
  this.localOffset[3*i + 2] = moonLocalOffset.z;

  this.arrivalTime[i] = currentTime + travelTime;
  this.holdUntil[i] = 0; // no label hold
  this.owner[i] = moonOwnerIdx;
  this.phase[i] = PHASE.FLYING;
  this.size[i] = 5.0; // moon size — owner>=9 distinguuje od planety v updateFlight
}
```

- [ ] **Step 3: Rozšířit updateFlight arrival dispatch**

Edit `src/particles.js` — najít blok v `updateFlight()` kde po arrivalu nastavuje phase (hledej `this.phase[i] = (this.size[i] < 5.0) ? PHASE.ON_RING : PHASE.ON_PLANET;`). Nahraď:
```js
// settle to final phase — moon owner (>=9) vs planet (<9) + ring/planet dle size
if (this.owner[i] >= 9) {
  this.phase[i] = PHASE.ON_MOON;
} else if (this.size[i] < 5.0) {
  this.phase[i] = PHASE.ON_RING;
} else {
  this.phase[i] = PHASE.ON_PLANET;
}
```

- [ ] **Step 4: Rozšířit applyClusterRotation o ON_MOON**

Edit `src/particles.js` — najít v `applyClusterRotation`:
```js
if (ph !== PHASE.ON_PLANET && ph !== PHASE.ON_RING && ph !== PHASE.ON_SUN) continue;
```
Nahraď:
```js
if (ph !== PHASE.ON_PLANET && ph !== PHASE.ON_RING && ph !== PHASE.ON_SUN && ph !== PHASE.ON_MOON) continue;
```

(`anchorsByIndex` jsme už rozšířili v API — single flat array; planety 0–8, měsíce 9–27. `owner` už odpovídá.)

- [ ] **Step 5: Run testy**

Run: `node --test "src/**/*.test.js"`
Expected: všechny pass (žádné behaviorální změny pro V1, jen rozšíření API).

- [ ] **Step 6: Commit**

```bash
git add src/phase.js src/particles.js
git commit -m "feat: PHASE.ON_MOON + spawnFromPlanet helper, owner-based dispatch v updateFlight/applyClusterRotation"
```

---

### Task 5: Moon Anchors (parent-child)

**Files:**
- Create: `src/moonAnchors.js`

- [ ] **Step 1: Implement moonAnchors.js**

Create `src/moonAnchors.js`:
```js
import * as THREE from 'three';
import { MOONS } from './moons.js';

/**
 * Načte texturu jako HTMLImageElement → offscreen canvas → ImageData.
 * (Stejné jako v planetAnchors.js, duplikováno pro modularitu.)
 */
function loadImageData(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    img.onerror = (e) => reject(new Error(`Failed to load moon texture ${url}: ${e}`));
    img.src = url;
  });
}

/**
 * Vytvoří moon anchors jako children mateřských planet anchorů.
 * Každý moonAnchor je Object3D s pozicí v lokálním frame parenta,
 * rotovaný přes updateMatrixWorld. Textury se načtou paralelně.
 *
 * @param {THREE.Scene} scene — není přímo použita (anchors jsou childs planet, ne scene), ale parametr ponechán pro konzistenci API
 * @param {Object<string, THREE.Object3D>} planetAnchors — z createPlanetAnchors
 * @returns {{ anchors: Object, imageData: Object, loaded: Promise<void> }}
 */
export function createMoonAnchors(scene, planetAnchors) {
  const anchors = {};
  const imageData = {};
  const loadPromises = [];

  for (const m of MOONS) {
    const parent = planetAnchors[m.parent];
    if (!parent) {
      console.warn(`Moon ${m.id} má parent ${m.parent}, ten nebyl nalezen v planetAnchors`);
      continue;
    }
    const anchor = new THREE.Object3D();
    // pozice (x, 0, z) se updatuje per-frame v main.js z orbitPosition
    anchor.position.set(0, 0, 0);
    anchor.userData.moon = m;
    parent.add(anchor); // child of planet anchor → dědí axial tilt
    anchors[m.id] = anchor;

    loadPromises.push(
      loadImageData(m.texture).then((data) => {
        imageData[m.id] = data;
      })
    );
  }

  const loaded = Promise.all(loadPromises).then(() => {});
  return { anchors, imageData, loaded };
}
```

- [ ] **Step 2: Smoke test (pokud by se přidal)**

Pro moonAnchors.js není unit test — závisí na DOM (Image, canvas). Ověření bude v runtime při Task 8.

- [ ] **Step 3: Commit**

```bash
git add src/moonAnchors.js
git commit -m "feat: moonAnchors.js — parent-child hierarchie, texture preload"
```

---

### Task 6: Moon Wind Controller

**Files:**
- Create: `src/moonWind.js`

- [ ] **Step 1: Implement moonWind.js**

Create `src/moonWind.js`:
```js
import * as THREE from 'three';
import { MOONS, MOONS_BY_PARENT } from './moons.js';
import { PLANETS, PLANET_BY_ID } from './planets.js';
import { fibonacciSphere } from './geometry.js';
import { phaseAt } from './animation.js';
import { PHASE } from './phase.js';

export const MOON_TRAVEL_TIME = 0.3;

const MOON_INDEX_BY_ID = Object.fromEntries(MOONS.map((m, i) => [m.id, i]));

function sampleColor(imageData, u, v) {
  const { data, width, height } = imageData;
  const px = Math.min(width - 1, Math.max(0, Math.floor(u * width)));
  const py = Math.min(height - 1, Math.max(0, Math.floor((1 - v) * height)));
  const idx = (py * width + px) * 4;
  return [data[idx] / 255, data[idx + 1] / 255, data[idx + 2] / 255];
}

function sphericalUV(x, y, z, r) {
  const u = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
  const v = Math.asin(y / r) / Math.PI + 0.5;
  return [u, v];
}

/**
 * Per-moon: Fibonacci sphere surface points + sampled colors (cached — nezávisí na čase).
 */
function buildMoonTargetsLocal(moon, moonImageData) {
  const surfacePts = fibonacciSphere(moon.tickCount, moon.radiusPx);
  const out = [];
  for (let k = 0; k < surfacePts.length; k++) {
    const off = surfacePts[k];
    const [u, v] = sphericalUV(off[0], off[1], off[2], moon.radiusPx);
    const color = sampleColor(moonImageData, u, v);
    out.push({
      localOffset: { x: off[0], y: off[1], z: off[2] },
      color,
    });
  }
  return out;
}

const _targetCache = new Map();
function getMoonTargets(moon, moonImageData) {
  if (_targetCache.has(moon.id)) return _targetCache.get(moon.id);
  const t = buildMoonTargetsLocal(moon, moonImageData);
  _targetCache.set(moon.id, t);
  return t;
}

const _tmpVec = new THREE.Vector3();

/**
 * Sub-fáze emise: 'earth_moons' / 'mars_moons' / 'jupiter_moons' / 'saturn_moons' / 'uranus_moons'.
 * Aggreguje targets všech měsíců rodiny, emituje progressive-rate (stejný pattern jako solarWind).
 *
 * @param {ParticlePool} pool
 * @param {number} currentTime
 * @param {number} dt
 * @param {Object} planetAnchors
 * @param {Object} moonAnchors
 * @param {Object} planetImageData
 * @param {Object} moonImageData
 */
export function updateMoonWind(pool, currentTime, dt, planetAnchors, moonAnchors, planetImageData, moonImageData) {
  const ph = phaseAt(currentTime);
  if (!ph || !ph.id.endsWith('_moons')) return;

  const parentId = ph.parentId;
  if (!parentId) return;

  const parent = PLANET_BY_ID[parentId];
  const parentAnchor = planetAnchors[parentId];
  const parentTex = planetImageData[parentId];
  if (!parent || !parentAnchor || !parentTex) return;

  const moons = MOONS_BY_PARENT[parentId] || [];
  if (moons.length === 0) return;

  // Aggregate targets per rodina (pole se snapshotem indexu moon-in-family).
  const allTargets = [];
  for (const m of moons) {
    const moonAnchor = moonAnchors[m.id];
    const moonTex = moonImageData[m.id];
    if (!moonAnchor || !moonTex) continue;
    const tgts = getMoonTargets(m, moonTex);
    const moonIdx = MOON_INDEX_BY_ID[m.id];
    for (const t of tgts) {
      allTargets.push({
        localOffset: t.localOffset,
        color: t.color,
        moonAnchor,
        moonIdx,
      });
    }
  }
  if (allTargets.length === 0) return;

  const phaseDuration = ph.end - ph.start;
  const progress = Math.min(1, (currentTime - ph.start) / phaseDuration);
  const expected = Math.floor(progress * allTargets.length);

  if (ph._emittedCount === undefined) ph._emittedCount = 0;
  const emitCount = expected - ph._emittedCount;
  if (emitCount <= 0) return;

  // Planet center v world space (parentAnchor.position je lokální — pro scene-direct child je to OK,
  // V1 planetAnchors jsou direct children scene, takže position.x je world X)
  const planetCenter = {
    x: parentAnchor.position.x,
    y: parentAnchor.position.y,
    z: parentAnchor.position.z,
  };

  // Planet color = průměr / sample z texture (random bod pro variety)
  const pcU = Math.random();
  const pcV = Math.random();
  const planetColor = sampleColor(parentTex, pcU, pcV);

  const idleIndices = pool.takeIdleIndices(emitCount);
  for (let k = 0; k < idleIndices.length; k++) {
    const idx = idleIndices[k];
    const t = allTargets[ph._emittedCount + k];
    if (!t) break;

    // World pos cíle = moonAnchor.matrixWorld × localOffset
    _tmpVec.set(t.localOffset.x, t.localOffset.y, t.localOffset.z);
    _tmpVec.applyMatrix4(t.moonAnchor.matrixWorld);
    const moonOrbitWorld = { x: _tmpVec.x, y: _tmpVec.y, z: _tmpVec.z };

    pool.spawnFromPlanet(
      idx,
      planetCenter,
      parent.radiusPx,
      moonOrbitWorld,
      t.localOffset,
      planetColor,
      t.color,
      9 + t.moonIdx, // unified anchor index (planety 0–8, měsíce 9–27)
      currentTime,
      MOON_TRAVEL_TIME,
    );
  }
  ph._emittedCount += idleIndices.length;
}

/** Reset cache + per-phase emitted counts (volá se při restartu animace). */
export function resetMoonWind() {
  _targetCache.clear();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/moonWind.js
git commit -m "feat: moonWind.js — sub-fáze emise měsíců per rodina"
```

---

### Task 7: Animation Timeline Extension

**Files:**
- Modify: `src/animation.js`
- Modify: `src/animation.test.js`

- [ ] **Step 1: Update failing tests**

Edit `src/animation.test.js` — nahraď existující testy v souboru:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASES, phaseAt, phaseProgress } from './animation.js';

test('PHASES pokrývají čas 0..13.0 s bez děr', () => {
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
  assert.equal(phaseAt(2.7).id, 'venus');
  assert.equal(phaseAt(3.5).id, 'earth');
  assert.equal(phaseAt(6.5).id, 'saturn');
  // moon sub-fáze
  assert.equal(phaseAt(8.7).id, 'earth_moons');
  assert.equal(phaseAt(9.2).id, 'mars_moons');
  assert.equal(phaseAt(9.8).id, 'jupiter_moons');
  assert.equal(phaseAt(11.0).id, 'saturn_moons');
  assert.equal(phaseAt(12.5).id, 'uranus_moons');
  assert.equal(phaseAt(13.0).id, 'live');
  assert.equal(phaseAt(100).id, 'live');
});

test('phaseProgress vrací 0..1 napříč fází', () => {
  assert.equal(phaseProgress(1.0), 0);       // start of sun phase
  assert.equal(phaseProgress(2.0), 1);       // end of sun phase
  assert.ok(Math.abs(phaseProgress(1.5) - 0.5) < 1e-9);
});

test('každá non-live fáze má planet id (planety) nebo parentId (měsíce)', () => {
  for (const ph of PHASES) {
    if (ph.id === 'init' || ph.id === 'live') continue;
    if (ph.id.endsWith('_moons')) {
      assert.ok(ph.parentId, `${ph.id} postrádá parentId`);
    } else {
      assert.ok(ph.planetId, `${ph.id} postrádá planetId`);
      assert.ok(ph.label, `${ph.id} postrádá label`);
    }
  }
});

test('moon sub-fáze mají správné parentId', () => {
  const moonPhases = PHASES.filter(ph => ph.id.endsWith('_moons'));
  assert.equal(moonPhases.length, 5);
  assert.equal(moonPhases[0].parentId, 'earth');
  assert.equal(moonPhases[1].parentId, 'mars');
  assert.equal(moonPhases[2].parentId, 'jupiter');
  assert.equal(moonPhases[3].parentId, 'saturn');
  assert.equal(moonPhases[4].parentId, 'uranus');
});
```

- [ ] **Step 2: Run tests — expect some failures**

Run: `node --test src/animation.test.js`
Expected: failures pro moon_phase testy (chybí phase v PHASES array).

- [ ] **Step 3: Extend animation.js PHASES**

Edit `src/animation.js` — nahraď `PHASES` array:
```js
export const PHASES = [
  { start: 0,   end: 1,     id: 'init' },
  { start: 1,   end: 2,     id: 'sun',     planetId: 'sun',     label: 'SLUNCE' },
  { start: 2,   end: 2.5,   id: 'mercury', planetId: 'mercury', label: 'MERKUR' },
  { start: 2.5, end: 3.1,   id: 'venus',   planetId: 'venus',   label: 'VENUŠE' },
  { start: 3.1, end: 3.8,   id: 'earth',   planetId: 'earth',   label: 'ZEMĚ' },
  { start: 3.8, end: 4.3,   id: 'mars',    planetId: 'mars',    label: 'MARS' },
  { start: 4.3, end: 5.7,   id: 'jupiter', planetId: 'jupiter', label: 'JUPITER' },
  { start: 5.7, end: 7.0,   id: 'saturn',  planetId: 'saturn',  label: 'SATURN' },
  { start: 7.0, end: 7.8,   id: 'uranus',  planetId: 'uranus',  label: 'URAN' },
  { start: 7.8, end: 8.6,   id: 'neptune', planetId: 'neptune', label: 'NEPTUN' },
  { start: 8.6, end: 9.0,   id: 'earth_moons',   parentId: 'earth' },
  { start: 9.0, end: 9.4,   id: 'mars_moons',    parentId: 'mars' },
  { start: 9.4, end: 10.4,  id: 'jupiter_moons', parentId: 'jupiter' },
  { start: 10.4, end: 12.0, id: 'saturn_moons',  parentId: 'saturn' },
  { start: 12.0, end: 13.0, id: 'uranus_moons',  parentId: 'uranus' },
  { start: 13.0, end: Infinity, id: 'live' },
];
```

- [ ] **Step 4: Update resetPhaseEmissions (pokrýt moon phases)**

Edit `src/animation.js` — `resetPhaseEmissions` zůstává stejný (funguje přes všechny PHASES iteraci, včetně new moon ones). Ověř že v souboru je:
```js
export function resetPhaseEmissions() {
  for (const ph of PHASES) {
    delete ph._emittedCount;
  }
}
```

(Pokud `delete` nefunguje na non-configurable property, použij `ph._emittedCount = undefined` — ale má fungovat.)

- [ ] **Step 5: Run animation tests — expect pass**

Run: `node --test src/animation.test.js`
Expected: 6 passed.

- [ ] **Step 6: Run all tests**

Run: `node --test "src/**/*.test.js"`
Expected: všechny pass.

- [ ] **Step 7: Commit**

```bash
git add src/animation.js src/animation.test.js
git commit -m "feat: animation timeline extended — 5 moon sub-fází, live shift na 13 s"
```

---

### Task 8: Main.js Integration (bootstrap + orbit update + tidal lock)

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Replace main.js**

Edit `src/main.js` kompletně:
```js
import * as THREE from 'three';
import { PLANETS, POOL_SIZE } from './planets.js';
import { MOONS } from './moons.js';
import { createScene, createStarfield } from './scene.js';
import { createPlanetAnchors } from './planetAnchors.js';
import { createMoonAnchors } from './moonAnchors.js';
import { ParticlePool } from './particles.js';
import { rotateAnchors } from './rotation.js';
import { updateSolarWind } from './solarWind.js';
import { updateMoonWind } from './moonWind.js';
import { orbitPosition, trueAnomaly } from './orbit.js';
import { PLANET_BY_ID } from './planets.js';

const { renderer, scene, camera } = createScene();
createStarfield(scene);
const { anchors, imageData, loaded } = createPlanetAnchors(scene);
const { anchors: moonAnchors, imageData: moonImageData, loaded: moonsLoaded } = createMoonAnchors(scene, anchors);

// Unified anchor array — planety 0..8, měsíce 9..27. Používá applyClusterRotation.
const anchorsByIndex = [
  ...PLANETS.map(p => anchors[p.id]),
  ...MOONS.map(m => moonAnchors[m.id]),
];

const pool = new ParticlePool(POOL_SIZE);
scene.add(pool.mesh);

const clock = new THREE.Clock();
let elapsed = 0;
const paused = false;

function initAfterLoad() {
  const sun = PLANETS[0];
  const sunAnchor = anchors.sun;
  pool.initFullSun(
    sunAnchor.position,
    sun.radiusPx,
    imageData.sun,
    sun.tickCount,
  );
}

/**
 * Per-frame update moon orbitálních pozic + tidal lock spin angle.
 * Moon anchor je child parent anchoru, takže .position je v lokálním frame.
 * Po update voláme updateMatrixWorld aby matrixWorld byl fresh pro spawnFromPlanet target calc.
 */
function updateMoonOrbits(t) {
  for (const m of MOONS) {
    const parent = PLANET_BY_ID[m.parent];
    const parentRadius = parent.radiusPx;
    const aPx = m.a * parentRadius;
    const { x, z, E } = orbitPosition(t, m.phaseOffset, m.period, aPx, m.e);
    const moonAnchor = moonAnchors[m.id];
    if (!moonAnchor) continue;
    moonAnchor.position.set(x, 0, z);
    const nu = trueAnomaly(E, m.e);
    moonAnchor.rotation.y = nu + Math.PI; // tidal lock: near side vždy k parent
    moonAnchor.updateMatrixWorld(true);
  }
}

function tick() {
  const dt = paused ? 0 : clock.getDelta();
  elapsed += dt;

  // Rotace planet (stávající V1) — před orbit update, aby matrixWorld planet byl fresh.
  rotateAnchors(anchors, dt);
  // Moon orbit + tidal lock — updatuje moon anchors lokálně a propaguje matrixWorld.
  updateMoonOrbits(elapsed);

  // Emise ze Slunce (V1) — běží během planet fází.
  updateSolarWind(pool, elapsed, dt, anchors, imageData);
  // Emise z planet (V2) — běží během moon sub-fází.
  updateMoonWind(pool, elapsed, dt, anchors, moonAnchors, imageData, moonImageData);

  // Tečky v letu: position += velocity * dt, lerp color, arrival snap.
  pool.updateFlight(elapsed, dt);

  // Usazené tečky (ON_SUN / ON_PLANET / ON_RING / ON_MOON) sledují rotující anchor.
  pool.applyClusterRotation(anchorsByIndex);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

Promise.all([loaded, moonsLoaded]).then(() => {
  initAfterLoad();
  clock.start();
  requestAnimationFrame(tick);
}).catch((err) => {
  console.error('Texture preload failed:', err);
  clock.start();
  requestAnimationFrame(tick);
});
```

- [ ] **Step 2: Run all tests**

Run: `node --test "src/**/*.test.js"`
Expected: všechny pass (main.js není testováno unit testy).

- [ ] **Step 3: Spustit lokální server a vizuálně ověřit**

Run: `npm run serve`

Open v prohlížeči: http://localhost:3000/

Čekat ~13 sekund. Expected behaviors:
1. V1 fáze (0–8.6 s): Slunce reveal → planety sekvenčně.
2. Moon fáze (8.6–13.0 s):
   - **Earth (8.6–9.0 s)**: Luna emituje z povrchu Země, usadí se na eliptické orbitě ~16 px daleko.
   - **Mars (9.0–9.4 s)**: Phobos + Deimos emitují z Marsu, Phobos velmi blízko, Deimos dál.
   - **Jupiter (9.4–10.4 s)**: 4 Galilejské měsíce (Io, Europa, Ganymede, Callisto) emitují z Jupitera do svých orbit.
   - **Saturn (10.4–12.0 s)**: 7 měsíců, všechny **vně prstence** (Mimas nejblíže, Iapetus nejdál).
   - **Uranus (12.0–13.0 s)**: 5 měsíců **vertikálně** (tilt 97° inherits) — dramatický vizuál.
3. Live (13.0+): všechny měsíce obíhají po zveličených eliptických drahách, tidal lock (ve V2 overview špatně vidět, ale orbit visible).

0 JS errorů v DevTools konzoli.

Pokud nefunguje, debug podle symptomů. Typické:
- „Moon anchors are invisible" → zkontrolovat že `spawnFromPlanet` emituje (log `pool.takeIdleIndices`).
- „Moons all in one spot" → phaseOffset se nepoužívá nebo je 0 pro všechny.
- „Uranus moons horizontálně" → parent-child hierarchie není správně, moonAnchor není child uranusAnchoru.
- „Saturn ring překrývá moons" → Mimas má a < 2.4 (zkontrolovat `moons.js`).

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat: main.js integrace — bootstrap moons, orbit update + tidal lock, unified anchors array"
```

---

## Self-Review checklist (provedu po dokončení plánu)

- [ ] **Spec coverage:** každá sekce V2 specu má odpovídající task
  - Scope 19 měsíců → Task 2 ✓
  - Anchor hierarchie → Task 5 ✓
  - Timeline → Task 7 ✓
  - Kepler solver → Task 1 ✓
  - Tidal lock → Task 8 (updateMoonOrbits) ✓
  - Proporce → Task 2 (data) ✓
  - Textury → Task 3 ✓
  - spawnFromPlanet → Task 4 ✓
  - Moon wind controller → Task 6 ✓
  - POOL_SIZE bump → Task 2 ✓
  - No labels/trails → implicit (žádné přidání) ✓

- [ ] **Placeholder scan:** žádné TBD/TODO, všechny code bloky úplné.

- [ ] **Type consistency:**
  - `PHASE.ON_MOON = 6` — Task 4
  - `pool.spawnFromPlanet(...)` signature — Task 4, použito v Task 6
  - `createMoonAnchors(scene, planetAnchors)` — Task 5, použito v Task 8
  - `updateMoonWind(pool, currentTime, dt, planetAnchors, moonAnchors, planetImageData, moonImageData)` — Task 6, použito v Task 8
  - `orbitPosition(t, phaseOffset, period, a, e)` vrací `{x, y, z, E}` — Task 1, použito v Task 8
  - `trueAnomaly(E, e)` — Task 1, použito v Task 8
  - Owner index: planety 0..8, měsíce 9 + MOON_INDEX_BY_ID[m.id] — Task 4, Task 6, Task 8 ✓

---

## Acceptance criteria (z V2 specu)

1. 19 měsíců viditelně obíhá po zveličených eliptických drahách.
2. Uranovy měsíce vertikálně.
3. Saturnovy měsíce vně prstence.
4. Tidal lock (ověřitelné ve V3).
5. Moon fáze 8.6–13.0 s, sekvenčně per rodina.
6. Emise z planety (ne ze Slunce).
7. 60 fps.
8. 0 JS errorů.
9. Všechny testy pass (V1 + nové orbit + moons + animation).
10. Proporce jako poměry (invariant pro V3).
