# V4 — Full Pointillist Solar System (Minecraft Voxel Pivot)

**Datum:** 2026-04-25
**Autor:** Martas + Claude
**Status:** Draft → Approval
**Nahrazuje:** V1 (solar wind), V2 (moons), V3 (detail view, částečně) — rendering pivot.

## Cíl

Přepnout projekt z hybridního pointillist-mesh renderingu na **plný pointillist 3D solar system s minecraft/voxel estetikou**. Vznikne epic edukačně-hravá vizualizace sluneční soustavy která:

1. **Začíná intro narativem vzniku soustavy** (protoplanetární disk → Slunce se zažehne → planety se formují z planetesimálů), skippable
2. **Tělesa = 3D voxel tiles** (InstancedMesh malých kostiček v tangent frame sféry) se skutečným osvětlením (den/noc side)
3. **Zahrnuje asteroid pás, Kuiperův pás, Oortův oblak, komety** — vše z teček (pointillist-native)
4. **Detail view rotuje planety** kolem své osy, s real-sim režimem (space + time real)
5. **Celé UI v minecraft stylu** — pixel font, blocky borders, chunk panely

Hlavní hodnota: **vše z teček** (duch projektu zachován), **nic neleakuje artefakty** (real rendering), **edukační story o vzniku**, **expandovaný katalog těles** (Neptune moony, trpasličí planety, komety).

## User-facing chování

### FORMATION intro (skippable ~20s)

6 beats animace vzniku sluneční soustavy, podle [Nice model](https://en.wikipedia.org/wiki/Nice_model) + [protoplanetary disk research](https://en.wikipedia.org/wiki/Protoplanetary_disk):

**Beat 1 (0-3s): Molekulární oblak**
- ~20 000 šedomodré dots rotují v oblaku kolem středu
- Žádná struktura, jen rotující cloud

**Beat 2 (3-6s): Gravitační kolaps + protosun**
- Dots kondenzují ke středu
- Tmavý protosun (dust blob) tvoří se uprostřed
- Okolní dust tvoří plošší disk (3D → 2D plane)

**Beat 3 (6-9s): Zažehnutí Slunce**
- Protosun se rozsvítí žluto-bílým glow (nuclear fusion core)
- Silný "solar wind" event: dots blízko jsou sfouknuty ven
- Zbytky utvoří rovinný planární disk

**Beat 4 (9-13s): Planetesimály**
- V disku se dots ve svých orbitách shlukují do malých kůží
- Shluky srážejí a rostou (několik frames mergovacích událostí)
- Inner disk: rocky embrya (Merkur/Venuše/Země/Mars zárodky)
- Outer disk: gas giant cores (Jupiter/Saturn/Uran/Neptun)

**Beat 5 (13-17s): Materializace planet**
- Každé embryo expanduje na finální velikost
- Texture fade-in per body (voxel tiles objevují se s barvami)
- Axial tilts + počáteční rotace
- Moony se oddělí z kolizí s giant bodies a usedají do orbit

**Beat 6 (17-20s): Pásy + final state**
- Residualní dust settles do **asteroidového pásu** (Mars↔Jupiter)
- Vnější residua tvoří **Kuiperův pás** (za Neptunem)
- **Oortův oblak** se objeví jako vzdálená slupka (fade-in)
- **Komety** začínají své excentrické orbity
- Final state: plně zformovaná soustava

**Beat 7 — Late Heavy Bombardment** (bonus, spustitelný přes menu po dokončení intra):
- ~3.9B let v minulosti, Jupiter/Saturn 2:1 resonance
- Uranus/Neptun scatter → komety bombardují inner planety
- Vizuální "meteorický déšť" na Zemi/Mars/Luna
- ~10s separátní playback

**Skip**: `[SKIP ▸]` tlačítko levý dolní roh, vždy viditelné během intra. Klik/klávesa mezera → skočí do Beat 6 final state. Skippnutí nespustí Beat 7.

### LIVE state (free exploration)

Po intru (nebo skip):
- Všechna tělesa viditelná v canonical pozicích
- Orbity měsíců, asteroid/Kuiper belt animace
- Slunce s vlastními sunspoty + občasnou prominence/CME
- Hover → tooltip, click → detail
- **Space** pauza, **R** restart intra, `Shift+L` spustí Beat 7 LHB replay

### DETAIL view (planet/moon/dwarf/comet clicked)

- Camera fly-to (0.8s) + other bodies fade-out
- Focused body **rotuje** kolem své osy (axial tilt viditelný)
  - Default mode: rotace zrychlená (Jupiter ~3s/revoluce)
  - SIMULACE mode: real time ratios (Jupiter ~9 h compressed to scene seconds per Kepler)
- Moony fokusované planety dál obíhají (Kepler)
- Drag kamery = OrbitControls (free look kolem fokusu)
- Info panel (bottom-right) v pixel stylu
- Moon labels jako pixel tagy nad každým viditelným měsícem
- ESC / ✕ / klik mimo → exit zpět do LIVE

### Real-sim UI (4-mode switch)

Panel vpravo nahoře, 4 blocky tlačítka:

| Mode | Space (vzdálenosti) | Time (orbity, rotace) |
|------|---------------------|------------------------|
| **VÝCHOZÍ** | Compressed | Compressed | (default, čitelné)
| **PROPORČNÍ** | Real proportional | Compressed | (vidíš škálu soustavy, Iapetus daleko ale rychlý)
| **REÁLNÝ ČAS** | Compressed | Real Kepler | (vidíš poměry period, Iapetus 52× pomalejší než kompresní)
| **SIMULACE** | Real proportional | Real Kepler | (fyzikálně přesné, edukačně top)

Pod tlačítky: **time speed slider** (0.1× — 1000×) — multiplikátor k základnímu compressed/real timescale.

### Skip / Pause / Restart / LHB hotkeys

- `ESC` — exit detail
- `Space` — pause/resume simulation
- `R` — restart intro (spustí Formation Beat 1)
- `L` nebo `Shift+L` — spustí LHB Beat 7 playback (jen v LIVE, 10s)
- `[SKIP ▸]` tlačítko — jen viditelné během FORMATION

## Scope

### V scope (V4)

**Rendering pivot**:
- `InstancedMesh` voxel tiles pro všechna povrchová tělesa (planety, Sun, měsíce, trpasličí planety)
- Shader s real-time diffuse lighting (sunDir vs tile normal)
- Saturn + Uran prstence jako `RingGeometry` v rovině ekvátoru
- Asteroid/Kuiper/Oort jako `THREE.Points` clouds s per-particle orbity
- Komety = malý core (point sprite) + trail particles

**Data expansion**:
- Neptune moony: Triton, Nereid, Proteus
- Trpasličí planety: Pluto + Charon, Ceres, Eris, Makemake, Haumea (+ info panely)
- 3 named asteroidy: Vesta, Pallas, Juno (clickable, info panel)
- 15-20 named komet: Halley, Hale-Bopp, Encke, McNaught, Swift-Tuttle, Shoemaker-Levy 9, Tempel-Tuttle, Wirtanen... (info panely)
- Asteroid pás: 8k generic dots (2.2-3.2 AU)
- Kuiper pás: 5k generic dots (30-50 AU)
- Oort oblak: 3k static dots (decorativní slupka)

**UI minecraft overhaul**:
- Pixel font globálně (`Press Start 2P` via Google Fonts)
- Pixel borders, blocky panely, stone-pattern backgrounds
- Info panel, tooltip, moon labels, HUD — všechno pixel styl
- Real-sim 4-mode switcher (nahrazuje V3 checkbox)
- Time speed slider

**Formation narrative**:
- 6-beat intro s beat transitions
- Beat 7 LHB jako bonus replay feature
- Skippable kdykoli

**Detail view vylepšení** (nad V3):
- Planety v detailu rotují (axial tilt + visible spin)
- Real-sim mode ovlivní rotační rychlosti (per Kepler)
- Picker spheres move to Layer 1 (neviditelné v hlavním rendereru)

**Specific bugfixy z user complaints**:
- Neptun moony doplněny
- Saturn ring v rovině planetárního ekvátoru (ring mesh v tangent frame)
- Žádné "middle of Earth" artefakty (voxel tiles nemají pentagon cluster — tile placement je generičtější)
- Solar wind labels naming → replaced by formation narrative
- Planety nejsou viditelné než se zformují (mesh opacity 0 do Beat 5)

### Out of scope (odloženo)

- **Více trpasličích planet** než 5 hlavních (Sedna, Quaoar, atd. — V5)
- **Spojité orbit trails** za planetami (decorativní, V5)
- **Historický playback** kromě LHB (V5 — např. future state, Pluto mission)
- **Orbital resonance visualization** (V5)
- **Galaxies/stars context** (V5 — možná Milky Way background)
- **Mobilní touch gestures** (current OrbitControls default ok)
- **Vícejazyčnost** (jen čeština)
- **PWA / offline** (V5)
- **Sound effects** (V5)
- **Kamera preset views** ("cinematic mode", V5)

## Architektura

### Nové moduly

| Soubor | Odpovědnost |
|--------|-------------|
| `src/formationIntro.js` | 6-beat intro controller, vlastní particle cloud pro dust, fáze beaty, skippable |
| `src/voxelTile.js` | `InstancedMesh` builder per tělo. Per-instance: position (sphere surface + tangent frame), normal, color z textury |
| `src/beltSwarm.js` | Asteroid/Kuiper/Oort belt generator + per-frame Kepler orbit update (GPU preferovaně) |
| `src/comet.js` | Comet body + trail particle system. 1 comet = 1 core sprite + 30-50 trail dots |
| `src/simMode.js` | 4-mode state controller + time speed slider, exposes `getTimeScale()`, `getSpaceScale()` |
| `src/pixelUI.js` | Pixel font CSS injector, shared minecraft styling helpers |
| `src/dwarfPlanets.js` | Data pro Pluto, Ceres, Eris, Makemake, Haumea (analogie `planets.js`) |
| `src/comets.js` | Data pro named komety (Halley atd.) — orbital params + names |
| `src/bodyRenderer.js` | High-level API: vytvoří mesh + particle combo per tělo, spravuje LOD pro belts |

### Přepsané / smazané moduly

| Soubor | Akce | Důvod |
|--------|------|-------|
| `src/bodyMesh.js` | **smazat** | Nahradit `voxelTile.js` (InstancedMesh + lighting) |
| `src/solarWind.js` | **smazat** | Nahradit `formationIntro.js` |
| `src/moonWind.js` | **smazat** | Nahradit `formationIntro.js` |
| `src/animation.js` | **smazat** | `simMode` + `formationIntro` řídí timeline |
| `src/particles.js` | **refaktor** | Zjednoduší se — jen pool pro belt particles, comets, flares, intro dust. ParticlePool interface přepsat. |
| `src/sunActivity.js` | **refaktor** | Sunspoty přepsat na per-tile color override (voxel tiles). Prominences/CME zůstanou particle overlay. |
| `src/scene.js` | **úprava** | `PointLight` nahradit `DirectionalLight` od Sun pozice (pro stíny per-tile). Ambient 0.1. |
| `src/picking.js` | **úprava** | Picker sphere meshes → Layer 1 (neviditelné v main camera). Přidat asteroid + comet picking. |
| `src/main.js` | **velký refactor** | Integrace všech nových modulů, nová state machine (Formation/Live/Detail) |
| `src/detailView.js` | **úprava** | Přidat planet rotation v DETAIL, sim-mode aware |
| `src/infoPanel.js` + `tooltip.js` + `moonLabels.js` | **styling pivot** | Pixel font + minecraft look |
| `src/planetAnchors.js` + `moonAnchors.js` | **minor** | Registrovat nové anchory (dwarfs, Neptune moons) |
| `src/moons.js` | **update** | Přidat Triton, Nereid, Proteus |
| `src/bodyData.js` | **update** | Přidat záznamy pro nové body (Triton, Nereid, Pluto, Charon, Ceres, Eris, Makemake, Haumea, Vesta, Pallas, Juno + 15-20 komet) |
| `src/planets.js` | **úprava** | Odstranit dotSize/detailDotSize/tickCount (voxel tiles řeší jinak), přidat field `visualBuildOrder` pro Beat 5 fade-in order |

### Rendering pipeline (nová)

```
Scene
├── DirectionalLight (od Sun pozice, generuje shadow)
├── AmbientLight (slabá, 0.08)
├── Sun InstancedMesh (voxel tiles, self-emissive shader — ignoruje Lights)
│   └── Sun activity overlay (Points — sunspoty jsou color override na tiles, prominences jsou separate Points)
├── Planet Anchors (8 + 5 dwarfs)
│   ├── Planet InstancedMesh (voxel tiles, Lambertian shader)
│   └── Moon anchors (children) → Moon InstancedMesh each
├── Saturn + Uran Ring meshes (RingGeometry, per-face color, child planet anchor)
├── Belt Points
│   ├── Asteroid belt (8k particles)
│   ├── Kuiper belt (5k particles)
│   └── Oort cloud (3k static)
├── Comets (15-20)
│   ├── Comet core (Point sprite)
│   └── Comet trail (20-50 particles per comet)
└── Formation intro particles (reusable, 20k, v LIVE state skryté)
```

### Voxel tile shader (core)

```glsl
// Per-tile vertex shader
attribute vec3 aPosition;        // instance position na sféře
attribute vec3 aNormal;          // tile normal (= radiální vektor ze středu)
attribute vec3 aColor;           // per-tile color z textury
attribute vec2 aTangent;         // rotace tile v tangent frame (orientation na sféře)

uniform vec3 uSunPosition;       // world space
uniform float uAmbient;
uniform mat4 uModelMatrix;       // body anchor transform

varying vec3 vColor;
varying float vLight;

void main() {
  vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
  vec3 lightDir = normalize(uSunPosition - worldPos.xyz);
  vec3 worldNormal = normalize((uModelMatrix * vec4(aNormal, 0.0)).xyz);
  float diffuse = max(0.0, dot(worldNormal, lightDir));
  vLight = uAmbient + (1.0 - uAmbient) * diffuse;
  vColor = aColor;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}

// Fragment
varying vec3 vColor;
varying float vLight;
void main() {
  gl_FragColor = vec4(vColor * vLight, 1.0);
}
```

Každý tile = 6-triangle hexagon mesh (nebo quad pro jednodušší implementaci), oriented v tangent frame vrcholu icosphere. Velikost = ~ neighbor-distance (žádné mezery ani překryv).

### Sun shader (self-emissive)

Sun ignoruje DirectionalLight (je zdroj světla). Vlastní shader:
```glsl
// pseudocode
vec3 color = vColor; // from texture, yellow-orange
// Možná subtle corona glow na edges (based on view dot normal)
float edge = 1.0 - abs(dot(viewDir, normal));
color = mix(color, vec3(1.0, 0.9, 0.6), pow(edge, 3.0) * 0.3);
gl_FragColor = vec4(color, 1.0);
```

### State machine

```
┌──────────────────────┐
│  FORMATION           │  (intro animation, 0-20s or skipped)
│  ┌────────────────┐  │
│  │ Beat 1-6 lineage│  │
│  └────────────────┘  │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  LIVE                │  (free exploration)
│  - bodies render     │
│  - belts animate     │
│  - orbits update     │
│  - sun activity      │
└──────────┬───────────┘
  click    │  ESC from DETAIL
 body      │
     ┌─────▼─────┐
     │ TRANSITION│ (0.8s fly-to)
     │    _IN    │
     └─────┬─────┘
           ▼
┌──────────────────────┐
│  DETAIL              │  (focused body, rotating)
│  - planet rotates    │
│  - moons orbit       │
│  - orbit controls    │
│  - info panel        │
└──────────┬───────────┘
           ▼ ESC
     ┌─────▼─────┐
     │ TRANSITION│
     │   _OUT    │
     └─────┬─────┘
           └────────▶ LIVE

Separate:
R key in LIVE → FORMATION Beat 1 (restart intro)
L key in LIVE → LHB overlay (10s) → back to LIVE
```

## Konkrétní řešení user complaints

| Complaint | Řešení v V4 |
|-----------|-------------|
| Mesh gaps / nesouhlasí s texturou | Voxel tiles perfektně tilují sféru (neighbor-distance size, tangent frame) |
| Žádné stíny | Real-time DirectionalLight + per-tile Lambertian shader |
| Invisible picker spheres viditelné | Layer 1 placement, neviditelné v default camera layer |
| "Efekt středu Země" (pentagon cluster) | Voxel tiles jsou orientované v tangent frame = no pentagonal defect acumulation — Minecraft hexagons vypadají konzistentně |
| Neptune chybí měsíce | Triton + Nereid + Proteus přidány do `moons.js` |
| Info o počtu měsíců chybí | Ověřeno: v `bodyData.js` field "Počet měsíců" je u všech 8 planet. Pokud chybí, doplníme. |
| Slunce + planety "jsou tam" od začátku | Voxel meshes mají opacity 0 do Formation Beat 5 materializace. Intro dots postupně utvoří tělesa. |
| Proud divný / rychlý / nezajímavý | Formation narrative nahrazuje solar wind. 6 beatů, edukativní, 20s, skippable. |
| Planety s bílými tečkami (Neptun/Uran), Jupiter artefakty | Voxel tile color sampling na per-instance centroid = žádné artefakty z pole clamp. Plus lighting přidá depth. |
| Saturn prsten mimo rovinu pruhů | `RingGeometry` v ekvátoriální rovině planety (v body anchor local frame, rotuje s planetou). |
| Planety v detailu nerotují | `DetailView` refactored — focus planet rotuje podle `rotationPeriod` * `simMode.getTimeScale()` |
| Checkbox scale toggle nudný | 4-mode switcher (Výchozí / Proporční / Reálný čas / Simulace) + time speed slider |

## Data expansion detail

### Neptune moony (nové v `moons.js`)

```js
{ id: 'triton', name: 'TRITON', parent: 'neptune',
  diameterKm: 2707, radiusPx: 1.8, realSemiMajorAxisKm: 354_800,
  texture: 'textures/triton.jpg',
  a: 1.5, e: 0.0, period: 5.9, phaseOffset: 0.2,
  retrograde: true /* Triton je retrograde! */
},
{ id: 'nereid', name: 'NEREID', parent: 'neptune',
  diameterKm: 340, radiusPx: 0.4, realSemiMajorAxisKm: 5_513_400,
  texture: 'textures/nereid.jpg', /* OR generic */
  a: 5.0, e: 0.75 /* high eccentricity */, period: 360, phaseOffset: 1.5
},
{ id: 'proteus', name: 'PROTEUS', parent: 'neptune',
  diameterKm: 420, radiusPx: 0.45, realSemiMajorAxisKm: 117_647,
  texture: 'textures/proteus.jpg', /* OR generic */
  a: 1.2, e: 0.0005, period: 1.1, phaseOffset: 0.8
}
```

### Dwarf planets (nové v `dwarfPlanets.js`)

```js
export const DWARFS = [
  { id: 'pluto', name: 'PLUTO', realDiameterKm: 2377, radiusPx: 1.5,
    realDistanceFromSunKm: 5_906_440_000, texture: 'textures/pluto.jpg',
    tiltDeg: 119.6, rotationPeriod: 153, /* retrograde */
    // Pluto-Charon barycentric
  },
  { id: 'charon', parent: 'pluto', /* orbit Pluto */ ... },
  { id: 'ceres', name: 'CERES', realDiameterKm: 939, radiusPx: 0.6,
    realDistanceFromSunKm: 413_700_000 /* asteroid belt */, ...
  },
  { id: 'eris', ... }, { id: 'makemake', ... }, { id: 'haumea', ... }
];
```

### Comets (nové v `comets.js`)

```js
export const COMETS = [
  { id: 'halley', name: 'HALLEY', period: 76,
    perihelionAU: 0.586, aphelionAU: 35.08, /* AU = astronomical units */
    eccentricity: 0.9674, inclination: 162.3,
    nextPerihelion: '2061-07-28', discovered: 1705,
    famousFor: 'pravidelně se vrací každých 76 let — poslední návštěva 1986'
  },
  { id: 'hale-bopp', name: 'HALE-BOPP', period: 2533,
    // nejjasnější kometa 20. stol, viditelná 18 měsíců v 1996-97
  },
  { id: 'mcnaught', ... }, { id: 'encke', ... }, ...
];
```

Pozn: Komety mají jen **schematické** trajectory (Kepler elipsa s high eccentricity). Ne real ephemeris.

### Asteroid pás (generic)

```js
// beltSwarm.js config
ASTEROID_BELT = {
  count: 8000,
  aRange: [2.2, 3.2] /* AU */,
  inclinationRange: [-0.2, 0.2] /* rad */,
  color: '#8c7853'  /* brown-gray average */
};
```

3 "named" asteroidy (Vesta, Pallas, Juno) jsou **zvláštní** entities navíc nad swarmem: mají pozici trackable, jsou clickable, s info panelem.

## Testy

**Zachovat** (63 prošlých):
- `cameraTween.test.js`, `orbit.test.js`, `detailView.test.js`, `geometry.test.js` — stále relevantní
- `bodyData.test.js` — rozšířit schema o dwarfs + comets

**Upravit**:
- `planets.test.js` — adjust expected tickCount range (voxel tile count není stejný metric)
- `moons.test.js` — update `MOONS.length` (19 → 22 with Neptune moons), family distribution
- `sunActivity.test.js` — udržet interface, ale test mock pool změní strukturu (už ne color array direct)

**Nové**:
- `formationIntro.test.js` — beat state machine, timing
- `voxelTile.test.js` — tile geometry validity, per-instance matrix math
- `beltSwarm.test.js` — orbit update math
- `simMode.test.js` — 4-mode transitions, time/space scale getters
- `comet.test.js` — orbital elements → position math

**Manuální verifikace**:
- Intro full run
- Skip button functionality
- Každé tělo: click → detail → rotate verify
- 4 sim modes
- LHB replay
- Pixel UI consistency

## Tech požadavky

**Pool size** (new breakdown):
- Body tiles: (Sun + 8 planet + 22 moons + 5 dwarfs + 3 named asteroids) = **39 těles s meshy**
  - Sun + planety level 6 (40 962 tiles) = ~360k
  - Moony + malá tělesa level 5 (10 242 tiles) = ~300k
  - Total: ~**660k** InstancedMesh instances
- Belt particles: asteroid 8k + Kuiper 5k + Oort 3k = **16k** point particles
- Comet particles: 20 × ~50 tail = **1k**
- Sun activity buffer: **1k**
- Formation intro dust: **20k** reusable

**Memory estimate**: InstancedMatrix 64 bytes × 660k = 42 MB, per-instance attrs 12 bytes × 660k = 8 MB, total ~50 MB. Points: 38k × 40 bytes = 1.5 MB. Trivial.

**Perf target**: 60 FPS desktop, 30 FPS mid-range device. Belt particles CPU Kepler update acceptable (16k iterations/frame).

**Textury** (nové, asset load):
- `textures/triton.jpg`, `nereid.jpg`, `proteus.jpg`
- `textures/pluto.jpg`, `charon.jpg`, `ceres.jpg`, `eris.jpg`, `makemake.jpg`, `haumea.jpg`
- `textures/vesta.jpg`, `pallas.jpg`, `juno.jpg`
- `textures/comet-core.jpg` (generic, 1 shared)

Textury stáhnout z NASA / Solar System Scope v dalším kroku (plan).

**Font**: `"Press Start 2P"` via Google Fonts CDN.

## Edge cases

- **Rychlé opuštění intra** (skip v Beat 2): body meshes musí být v correct final state okamžitě
- **Resize okna během intra**: resize handler + camera aspect update fungují nezávisle
- **Scale mode switch během detail view**: scale změna + camera re-fly-to (respect new dist) + rotation speed update
- **Pause během intra**: pauzne beat timing (lze resume)
- **Restart (R) v detail view**: exit detail first, then reset formation
- **Belt click**: asteroidy (swarm) nejsou clickable individually (jen named 3). Komety jsou clickable.
- **Neptune → Triton click**: Triton je retrograde, visualization musí ukazovat opačný smysl rotace v detail
- **LHB replay**: nemění final state (zachová aktuální solar system), jen overlay animace. Po 10s skončí, user pokračuje kde byl.

## Open questions

*žádné — všechny rozhodnutí zafixována v brainstormingu.*

---

**Souvisejicí research**:
- [Nice model (Wikipedia)](https://en.wikipedia.org/wiki/Nice_model)
- [Protoplanetary disk](https://en.wikipedia.org/wiki/Protoplanetary_disk)
- [Planetary formation & migration (Scholarpedia)](http://www.scholarpedia.org/article/Planetary_formation_and_migration)
- [Late Heavy Bombardment](https://en.wikipedia.org/wiki/Late_Heavy_Bombardment)
- [Planet formation theory overview (arXiv 2024)](https://arxiv.org/html/2412.11064v1)
- [Grand tack hypothesis](https://en.wikipedia.org/wiki/Grand_tack_hypothesis)
