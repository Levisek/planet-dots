# Dots — V2: Moons

**Datum:** 2026-04-24
**Fáze:** V2 (z pětifázové roadmapy)
**Cíl:** Přidat 19 významných měsíců okolo 5 planet (Earth, Mars, Jupiter, Saturn, Uranus). Měsíce jsou vykreslené jako mini-planety z teček, obíhají mateřskou planetu po **eliptické Keplerovské dráze** se zveličenou eccentricitou, v rovině **planetárního ekvátoru** (dědí axial tilt), **tidally-locked** (stejná strana vždy k planetě). Emise probíhá **z povrchu mateřské planety** ven na orbitu, v sekvenčních sub-fázích per rodina po Neptunu.

---

## Kontext

- Navazuje na **V1** (dokončeno 2026-04-24) — Slunce + 8 planet, solar wind ze Slunce, dots-only rendering, realistická rotace kolem vlastní osy.
- V3 (hover/click detail) staví na proporcích definovaných ve V2 — všechny velikosti i orbit radii jsou vyjádřené jako **poměry k radius mateřské planety**, takže při zoomu ve V3 se zachovají.
- V2 je samostatně spustitelné rozšíření V1, běží ve stejném `index.html`.

---

## Scope měsíců (19)

| Planeta | Měsíce | Počet |
|---|---|---|
| Earth | Luna | 1 |
| Mars | Phobos, Deimos | 2 |
| Jupiter | Io, Europa, Ganymede, Callisto (Galilejští) | 4 |
| Saturn | Titan, Rhea, Iapetus, Dione, Tethys, Enceladus, Mimas | 7 |
| Uranus | Miranda, Ariel, Umbriel, Titania, Oberon | 5 |
| **Total** |  | **19** |

Mercury, Venus a Neptune v V2 scope nemají měsíce. Triton (Neptun) je záměrně vynechán ve prospěch kompletních rodin Saturnu a Uranu — vizuální „family" efekt je edukačně cennější než pokrývat všechny planety se základním měsícem.

---

## Architektura

### Anchor hierarchie (Three.js)

```
scene
├── sunAnchor                 (V1)
├── mercuryAnchor             (V1)
├── venusAnchor               (V1)
├── earthAnchor               (V1)
│   └── lunaAnchor            (V2 — child)
├── marsAnchor                (V1)
│   ├── phobosAnchor          (V2)
│   └── deimosAnchor          (V2)
├── jupiterAnchor             (V1)
│   ├── ioAnchor              (V2)
│   ├── europaAnchor          (V2)
│   ├── ganymedeAnchor        (V2)
│   └── callistoAnchor        (V2)
├── saturnAnchor              (V1)
│   ├── titanAnchor           (V2)
│   ├── rheaAnchor            (V2)
│   ├── iapetusAnchor         (V2)
│   ├── dioneAnchor           (V2)
│   ├── tethysAnchor          (V2)
│   ├── enceladusAnchor       (V2)
│   └── mimasAnchor           (V2)
├── uranusAnchor              (V1)
│   ├── mirandaAnchor         (V2)
│   ├── arielAnchor           (V2)
│   ├── umbrielAnchor         (V2)
│   ├── titaniaAnchor         (V2)
│   └── oberonAnchor          (V2)
└── neptuneAnchor             (V1)
```

Každý `moonAnchor` je **child** mateřského `planetAnchoru`. Důsledky:
- `matrixWorld` chain: moon pozice v world space = planet position × planet tilt × planet rotation × moon orbit position × moon tilt × moon rotation
- **Axial tilt** mateřské planety se automaticky dědí — orbit v lokálním X-Z frame = rovina ekvátoru planety
- Jupiter (tilt 3°) → měsíce téměř horizontálně
- Saturn (tilt 27°) → měsíce v rovině prstenců
- **Uranus (tilt 97°) → měsíce orbitují vertikálně** (hlavní edukační highlight)
- Venuše (tilt 177°) by měsíce měla vzhůru nohama, ale Venuše v scope měsíce nemá

### Orbit v lokálním frame

Orbit každého měsíce je počítán v **lokálním frame mateřské planety**. Parent anchor má už `rotation.z = axialTilt` (z V1), takže jeho lokální X-Z rovina = ekvator planety. Orbit solver vrací `(x, 0, z)` v tomto lokálním frame, což po transformaci přes `planetAnchor.matrixWorld × moonOrbitPos` dá world position.

### Moon rotation (tidal lock)

`moonAnchor.rotation.y = trueAnomaly + π`. Y je moon's "north pole axis" (ne planetary). Tidal lock = stejná strana (near side) vždy směrem k parent planetě. V Kepleru s eccentricitou > 0 se true anomaly mění non-linearně → moon spin rate se v průběhu orbity mění. To je fyzikálně korektní (real tidal locking je synchronní s průměrnou orbital angular velocity, ne instantní).

---

## Timeline

Animation PHASES rozšířeny:

| T | Fáze | Nová? |
|---|---|---|
| 0 – 1.0 s | `init` | V1 |
| 1.0 – 2.0 s | `sun` reveal | V1 |
| 2.0 – 2.5 s | `mercury` | V1 |
| 2.5 – 3.1 s | `venus` | V1 |
| 3.1 – 3.8 s | `earth` | V1 |
| 3.8 – 4.3 s | `mars` | V1 |
| 4.3 – 5.7 s | `jupiter` | V1 |
| 5.7 – 7.0 s | `saturn` | V1 |
| 7.0 – 7.8 s | `uranus` | V1 |
| 7.8 – 8.6 s | `neptune` | V1 |
| **8.6 – 9.0 s** | **`earth_moons`** (Luna) | **V2** |
| **9.0 – 9.4 s** | **`mars_moons`** (Phobos + Deimos) | **V2** |
| **9.4 – 10.4 s** | **`jupiter_moons`** (4 Galilejské) | **V2** |
| **10.4 – 12.0 s** | **`saturn_moons`** (7 měsíců) | **V2** |
| **12.0 – 13.0 s** | **`uranus_moons`** (5 měsíců) | **V2** |
| 13.0 s + | `live` (posunuto z 8.6 s) | V1 + V2 |

**Sekvenční per-family drama** zachovává V1 estetiku — oko diváka pokračuje zleva doprava od planet na měsíce. Moon fáze trvá **4.4 s** total.

### Moon emission uvnitř sub-fáze

Každá sub-fáze:
1. **Progress ramp** — `progress = (t - phase.start) / phase.duration` jde 0 → 1.
2. **Expected emit count** — `expected = Math.floor(progress × totalMoonTargets)` kde `totalMoonTargets = součet teček všech měsíců této rodiny`.
3. **Emission** — vybrat `expected - emittedSoFar` IDLE teček, `spawnFromPlanet` s pozicí startu na povrchu rodičovské planety, cílem na orbit surface daného měsíce.
4. **Flight** — lineární let ~0.25–0.35 s (krátký, protože moon orbit je blízko planety).
5. **Settle** — po arrival tečka získá `owner = moonIdx`, `phase = ON_MOON` (nová PHASE enum hodnota), localOffset v **moonAnchor** frame.

Během sub-fáze je sousední moon rodina neaktivní (ph.id guard v `moonWind.js`).

---

## Orbital mechanika

### Kepler solver

```js
// solveKepler: M → E (mean → eccentric anomaly)
function solveKepler(M, e, iterations = 5) {
  let E = M; // initial guess
  for (let i = 0; i < iterations; i++) {
    E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

// orbitPosition: (t, phaseOffset, period, a, e) → local (x, 0, z)
function orbitPosition(t, phaseOffset, period, a, e) {
  const M = (2 * Math.PI * t) / period + phaseOffset;
  const E = solveKepler(M, e);
  const x = a * (Math.cos(E) - e);
  const z = a * Math.sqrt(1 - e * e) * Math.sin(E);
  return { x, y: 0, z };
}

// trueAnomaly: E → ν (pro tidal lock)
function trueAnomaly(E, e) {
  return 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2),
  );
}
```

Newton-Raphson 5 iterací → chyba < 1e-6 rad pro e ≤ 0.3.

### Proporce (per-family normalization)

Orbit semi-major axis `a` vyjádřen jako **násobek parent radius**:

| Moon | a (× parent radius) | e (exaggerated) | period (s) |
|---|---|---|---|
| Luna | 2.0 | 0.275 | 20 |
| Phobos | 1.3 | 0.10 | 2 |
| Deimos | 2.0 | 0.05 | 8 |
| Io | 1.33 | 0.04 | 5 |
| Europa | 1.56 | 0.09 | 10 |
| Ganymede | 1.78 | 0.02 | 20 |
| Callisto | 2.0 | 0.07 | 47 |
| Mimas | 2.4 | 0.20 | 3 |
| Enceladus | 2.55 | 0.05 | 4.3 |
| Tethys | 2.7 | 0.02 | 6 |
| Dione | 2.9 | 0.02 | 8.7 |
| Rhea | 3.1 | 0.02 | 14.3 |
| Titan | 3.8 | 0.20 | 50 |
| Iapetus | 4.4 | 0.20 | **60** (clamp) |
| Miranda | 1.7 | 0.02 | 4 |
| Ariel | 1.9 | 0.02 | 7 |
| Umbriel | 2.15 | 0.04 | 12 |
| Titania | 2.5 | 0.02 | 25 |
| Oberon | 2.8 | 0.02 | 38 |

**Mimas @ 2.4× Saturn radius** = 180 px, **těsně za vnějším okrajem prstence** (ring outer = 2.33× = 175 px). Zbytek Saturn rodiny orbituje ještě dál.

**e clamp:** žádný měsíc nepřekračuje e = 0.3 (nad to elipsa vypadá jako nerealistická vejcovitá dráha).

**period clamp:** Iapetus má real period 79.3 d → po škálování by bylo 250+ s. Clamp na 60 s aby animace byla vidět v rozumném čase.

### phaseOffset

Každý měsíc dostane **náhodný phase offset** v rozmezí [0, 2π) — zabrání tomu aby všechny měsíce startovaly na stejné pozici ve své elipse. Offset je deterministický (seeded), aby restart animace vypadal stejně.

---

## Vizuální specifikace

### Velikosti měsíců

`radiusPx` vyjádřen v absolutních px (odvozeno z real diameter v poměru k parent):

| Moon | Real diameter (km) | radiusPx | Pozn. |
|---|---|---|---|
| Luna | 3 474 | 2.2 | Earth r=8.2 |
| Phobos | 22 | 0.5 (**clamp**) | Mars r=4.35, real ratio → 0.03 |
| Deimos | 12 | 0.4 (**clamp**) | real ratio → 0.02 |
| Io | 3 643 | 2.3 | Jupiter r=90 |
| Europa | 3 122 | 2.0 |  |
| Ganymede | 5 268 | 3.4 | **největší měsíc SS** |
| Callisto | 4 820 | 3.1 |  |
| Titan | 5 150 | 3.3 | 2nd největší |
| Rhea | 1 527 | 1.0 | Saturn r=75 |
| Iapetus | 1 470 | 0.95 |  |
| Dione | 1 123 | 0.72 |  |
| Tethys | 1 062 | 0.68 |  |
| Enceladus | 504 | 0.32 → **0.5 clamp** |  |
| Mimas | 396 | 0.25 → **0.5 clamp** |  |
| Miranda | 471 | 0.30 → **0.5 clamp** | Uranus r=32.5 |
| Ariel | 1 158 | 0.74 |  |
| Umbriel | 1 169 | 0.75 |  |
| Titania | 1 577 | 1.01 |  |
| Oberon | 1 523 | 0.98 |  |

**radiusPx clamp na 0.5** pro měsíce menší než 0.5 (Phobos, Deimos, Enceladus, Mimas, Miranda). Na obrazovce to odpovídá 1–2 px teček, jinak by byly neviditelné. Proporce rodiny se pokřiví v nejmenších položkách, akceptováno.

### tickCount per moon

Úměrně `radiusPx²` (ploše povrchu), clamp na min 15, max 300.

| Moon | tickCount |
|---|---|
| Luna | 120 |
| Phobos | 20 |
| Deimos | 20 |
| Io | 130 |
| Europa | 100 |
| Ganymede | **300** |
| Callisto | 250 |
| Titan | **300** |
| Rhea | 60 |
| Iapetus | 60 |
| Dione | 45 |
| Tethys | 45 |
| Enceladus | 25 |
| Mimas | 20 |
| Miranda | 25 |
| Ariel | 50 |
| Umbriel | 50 |
| Titania | 80 |
| Oberon | 80 |

**Total moon ticks: 1 800** (konzervativně, ladíme při implementaci).

### Textury

Všech 19 moon textures stažených do `textures/` jako `<moonId>.jpg`. Zdroje:
- **Solar System Scope** (CC BY 4.0): luna, io, europa, ganymede, callisto, titan
- **NASA** (public domain): phobos, deimos, enceladus, mimas, rhea, iapetus, dione, tethys, miranda, ariel, umbriel, titania, oberon
- Fallback: Wikipedia Commons (CC licenses vary, preferovat PD/CC0)

**Resolution:**
- 2048 px: Luna, Io, Europa, Ganymede, Titan (ikonické, edukační detail)
- 1024 px: ostatní

**Download script** rozšířit existující (nebo vytvořit `scripts/download_moon_textures.sh`). License atribuce v README.

**CPU-side ImageData:** preload jako V1 (`loadImageData` v `moonAnchors.js`), color-sample per Fibonacci point.

### Emise z planety (spawnFromPlanet)

Nový helper v `particles.js`:

```js
/**
 * Spawn tečky z povrchu mateřské planety ven na orbitu měsíce.
 * Podobné spawnFromSun, ale zdroj = planet surface, cíl = moon orbit position.
 */
spawnFromPlanet(
  sourceIdx,         // IDLE index z poolu
  planetCenter,      // world pos planety (= planetAnchor.position v world space)
  planetRadius,      // radiusPx planety
  moonOrbitWorldPos, // world pos moon orbit point (moonAnchor.localToWorld v době emise)
  moonLocalOffset,   // local offset v moonAnchor frame (pro cluster rotaci)
  planetColor,       // barva startu (sampled z planet texture)
  moonColor,         // cílová barva (sampled z moon texture)
  moonIdx,           // owner v moon frame
  currentTime,
  travelTime,        // 0.25–0.35 s
)
```

Trajektorie: lineární, position += velocity × dt. Travel time je krátký (moon orbit je blízko planety).

### Žádné labely, žádné trails v V2

- Labely: reservováno pro V3 detail view
- Orbit rings (dotted): reservováno pro V3
- Moon name text: reservováno pro V3

---

## Budget a pool

**V1 stav:** POOL_SIZE = 33 000, použito 32 100.

**V2 delta:** +1 800 moon ticks.

**Nový POOL_SIZE: 36 000** (rezerva 2 100).

**`planets.test.js` assert:**
```js
assert.ok(sum <= 35_500, `součet ticks = ${sum}, musí ≤ 35 500 (pool 36 000 s rezervou)`);
```

Součet planet ticks + moon ticks = 32 100 + 1 800 = **33 900** ≤ 35 500. ✓

---

## Implementace

### Nové moduly

```
src/
├── moons.js              # data všech 19 měsíců
├── moonAnchors.js        # anchor hierarchie, textures preload
├── orbit.js              # Kepler solver (solveKepler, orbitPosition, trueAnomaly)
└── moonWind.js           # sub-fáze emise per rodina
```

### Edit existing

```
src/
├── particles.js          # + spawnFromPlanet helper, + PHASE.ON_MOON
├── phase.js              # + ON_MOON enum value (6)
├── animation.js          # + 5 moon sub-phases, live start 13.0 s
├── main.js               # bootstrap moonAnchors, update loop: moonWind + moon orbit tick
├── planets.js            # POOL_SIZE 33 000 → 36 000
└── planets.test.js       # assert update
```

### Data source `moons.js`

```js
export const MOONS = [
  {
    id: 'luna', name: 'LUNA', parent: 'earth',
    diameterKm: 3474, radiusPx: 2.2, tickCount: 120,
    texture: 'textures/luna.jpg',
    a: 2.0, e: 0.275, period: 20, phaseOffset: 0.3,
  },
  // … 19 total
];
export const MOON_BY_ID = Object.fromEntries(MOONS.map(m => [m.id, m]));
export const MOONS_BY_PARENT = MOONS.reduce((acc, m) => {
  (acc[m.parent] ??= []).push(m);
  return acc;
}, {});
```

### Testy

**`orbit.test.js`:**
- `solveKepler(0, e)` = 0
- `solveKepler(M, 0)` = M (zero eccentricity = circular)
- `E - e × sin(E) - M` < 1e-6 after 5 iterations for various (M, e)
- `orbitPosition(0, 0, T, a, e)` = periapsis point `(a(1-e), 0, 0)`
- `trueAnomaly(0, e)` = 0
- `trueAnomaly(π, e)` = π (apoapsis)

**`moons.test.js`:**
- Počet = 19
- Každý moon má povinné atributy: id, name, parent, diameterKm, radiusPx, tickCount, texture, a, e, period, phaseOffset
- Každý parent id existuje v PLANETS
- `0 < e ≤ 0.3` pro všechny
- `period > 0`
- `a > 0`
- `radiusPx ≥ 0.5`
- Součet tickCount + V1 planet ticks ≤ 35 500
- Earth má 1 měsíc, Mars 2, Jupiter 4, Saturn 7, Uranus 5

**`animation.test.js` (extend):**
- 5 nových sub-fází pokrývá 8.6 – 13.0 s bez děr
- `phaseAt(8.7)` = `earth_moons`
- `phaseAt(11)` = `saturn_moons`
- `phaseAt(13)` = `live`

### Pořadí commitů (suggested)

1. `feat: orbit.js Kepler solver + orbit.test.js`
2. `feat: moons.js data (19 měsíců) + moons.test.js`
3. `chore: download 19 moon textures + README license atribuce`
4. `feat: moonAnchors.js — parent-child hierarchie, texture preload`
5. `feat: particles.js spawnFromPlanet + PHASE.ON_MOON`
6. `feat: moonWind.js — sub-fáze emise per rodina`
7. `feat: animation.js — 5 moon sub-fází, live shift na 13 s`
8. `feat: main.js — bootstrap moons, update loop orbit + tidal lock`
9. `tune: POOL_SIZE 36 000, tickCount ladění`

---

## Controls (V2)

Stejné jako V1 (`R` restart, `Space` pauza). Žádné nové klávesy. Hover/click interactions reservované pro V3.

---

## Acceptance criteria

1. 19 měsíců viditelně obíhá svoje mateřské planety po **zveličených eliptických drahách**.
2. **Uranovy měsíce obíhají vertikálně** (tilt 97° inherits přes anchor hierarchii) — edukační highlight.
3. **Saturnovy měsíce orbitují vně prstence** (Mimas @ 2.4× Saturn radius = 180 px, ring outer = 175 px).
4. **Tidal lock:** stejná strana měsíce je vždy přivrácena k planetě (ověřitelné ve V3 při zoomu, v overview je to subtílní).
5. Moon fáze 8.6–13.0 s probíhá sekvenčně per rodina (Earth → Mars → Jupiter → Saturn → Uranus), bez visual glitches.
6. **Emise je z povrchu planety směrem ven**, ne ze Slunce — viditelná jako krátký proud z planetárního disku.
7. **60 fps** na ref HW (GTX 1060 ekvivalent, 1920×1080).
8. **0 JS errorů** v konzoli.
9. Všechny existing V1 testy pass + nové `orbit.test.js`, `moons.test.js` pass.
10. **Proporce zapsané jako poměry** k parent radius (invariant pro V3 zoom).
11. Každý měsíc má NASA/SSC texture, color-sampled na tečky.
12. Live fáze pokračuje indefinitely: planety rotují kolem os, měsíce obíhají, tidal lock aktivní.

---

## Out of scope V2 (→ V3+)

- Orbit rings (dotted) — V3
- Moon labely (individuální) — V3
- Hover/click detail view, info panel — V3
- Reálné inklinace orbit (odchylka od parent ekvátoru) — V3 nebo later
- Asteroidový pás, Kuiper belt — V4
- Komety — V5
- Mesh rendering měsíců (místo dots) — never, staying dots-only

---

## Rizika a mitigace

| Riziko | Mitigace |
|---|---|
| Mimas / Enceladus / Miranda vypadají zrnité (< 0.5 px) | clamp radiusPx na 0.5, min tickCount 15 |
| 19 moon textures přidá 10–20 MB do repa | akceptováno (V1 precedent), 1k default, 2k jen ikony |
| Kepler solver precision pro e = 0.3 | Newton-Raphson 5 iterací → err < 1e-6 rad |
| Pool recycling při animation reset | rozšířit `resetPhaseEmissions` o moon phases |
| Saturn Iapetus period clamp 60 s = outlier od rodiny | akceptace, v realitě je Iapetus outlier (79 d) |
| Anchor updateMatrixWorld propagation | volat `updateMatrixWorld(true)` na planet anchor → propaguje na moon |
| `spawnFromPlanet` recyklace IDLE indexů po V1 emise | `takeIdleIndices` scanuje celý pool, najde IDLE po V1 particles |
| Moon phase _emittedCount reset | stejný mechanismus jako V1 phases, `resetPhaseEmissions` |

---

## Licence zdrojů

- **Solar System Scope** textures: CC BY 4.0
- **NASA** (moon photos, rendered textures): Public Domain
- **Wikipedia Commons**: varies, preferovat PD/CC0, atribuce v README
- Three.js: MIT
- Code: MIT

---

## Otevřené otázky (nic neblokuje V2)

- **Textures některých menších měsíců** (Enceladus, Mimas, Miranda) — pokud PD/CC0 nejsou k dispozici v 1k resolution, použít 512 nebo fallback na procedurální noise.
- **phaseOffset seed** — náhodné, ale deterministické (per-moon constant). Rozhodne se v implementaci.
- **Travel time planet→moon** — 0.25 s vs 0.35 s — ladíme vizuálně.
- **Emission start position** — random point na planet surface (Fibonacci sample) nebo bias k cílovému směru (směrem k moonu)? Default random, ladíme.

---

## Další krok

Po review tohoto spec → invoke `superpowers:writing-plans` pro detailní implementační plán V2.
