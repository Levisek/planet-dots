# V3 — Detail View + Sun Vitality

**Datum:** 2026-04-24
**Autor:** Martas + Claude
**Status:** Draft → Approval

## Cíl

Přidat **edukační detail view** pro 28 nebeských těles (Slunce, 8 planet, 19 měsíců): uživatel klikne na tělo v hlavní scéně, animace se pauzne, kamera odletí k tělesu, objeví se info panel s reálnými daty a zapne se drag-to-orbit. Primární edukační moment je **toggle "Reálné měřítko"** uvnitř detail view, který přepne orbitální vzdálenosti měsíců z komprimované reprezentace (hlavní scéna) na proporčně věrnou — vizualizuje škálu sluneční soustavy.

Zároveň přidat **vitální chování Slunce** — sluneční skvrny (sunspots) a prominence/erupce — aby Slunce nebylo statická koule teček, ale živé.

## User-facing chování

### Hover (non-touch)
- Najetím myši nad libovolné tělo (Slunce, planetu, měsíc) se objeví **tooltip** se jménem těla.
- Tooltip následuje mírně nad pozicí těla (world-to-screen projekce).
- Na touch zařízeních tooltip neexistuje (detekce `pointerType === 'touch'`).

### Click
- Kliknutím na tělo spustí **TRANSITION_IN** (0.8s):
  - Hlavní animace se pauzne (solar wind emise, orbity se zastaví).
  - Rotace kolem osy těl pokračuje (aby v detail view bylo vidět spin).
  - Kamera fly-to animace: tween pozice + target na cílové tělo.
  - Ostatní tělesa se během transition fade-out (owner alpha multiplier → 0).
  - Cílové těleso si zachová plnou alpha (případně u Jupiter/Saturn postArrivalAlpha z V2.5).
- Po transition: stav **DETAIL**:
  - `OrbitControls` aktivní, target = body center, drag rotuje kameru okolo.
  - **Info panel** najede zprava (CSS transform, 0.3s).
  - Pokud má těleso měsíce (planeta), orbity měsíců dále animují (Kepler), lze je klikat.
  - Rotace těla + orbity měsíců běží s real-ratio časovou škálou jako hlavní scéna (Země = 10s).

### Detail view — drill-down
- V **main scéně** jsou klikatelné pouze Slunce a 8 planet (moons tam jsou příliš malé na rozumný raycast hit).
- V **planet-detail** jsou **měsíce dané planety** také klikatelné → TRANSITION_IN do moon-detail (raycast sféry měsíců se aktivují při vstupu do planet-detail).
- Z **moon-detail ESC (nebo zavření) vede rovnou do MAIN**, ne zpět do planet-detail. Žádný navigation stack — plochý mental model, jediné "hlubší" zanoření je planeta → měsíc, zpět vždy MAIN.

### Exit
- ESC key
- Křížek v rohu info panelu
- Klik mimo těla (na pozadí)
- Všechny tři triggery spustí **TRANSITION_OUT** (0.8s) zpět do MAIN:
  - Kamera se plynule vrátí na pozici z před entry.
  - Ostatní tělesa fade-in zpět na plnou alpha.
  - Hlavní animace se resume (solar wind, orbity).

### Toggle "Reálné měřítko" (v info panelu detail view)
- Default: komprimované měřítko (jako hlavní scéna, `moon.a * parentRadius`).
- ON: přepne orbitální poloosu měsíců na reálně proporční, podle `moon.a_realKm / parent.realDiameterKm × parent.radiusPx × 2` (proporční ke skutečné vzdálenosti).
- Tween mezi hodnotami 0.5s (plynulé roztažení/stažení orbit).
- **Důsledek:** při ON real scale některé měsíce zmizí mimo viewport (např. Iapetus ~60× Saturn radius). Toggle má k tomu hint text "Některé měsíce uletí daleko — zoom out myší".
- V Sun detail view (bez měsíců) toggle skrytý.

### Info panel
- Pozice: **fixní v pravém dolním rohu**, ~360×480 px, transparentní tmavé pozadí, tenký světlý border.
- Sekce:
  1. **Header** — Jméno těla (velký font, česky), close button ✕.
  2. **Krátký popis** (1 věta, např. „Plynný obr, největší planeta soustavy.").
  3. **Tabulka fakt** (10 klíčových údajů — viz níže per-body-type).
  4. **Fun fact** — 1-2 věty, citace v uvozovkách.
  5. **Scale toggle** (pouze u planet s měsíci) — řádek s labelem „Reálné měřítko" a slider/switch.
- Texty plně česky.

#### Per-body-type pole
**Slunce:**
- Průměr · Hmota · Povrchová teplota · Teplota jádra · Stáří · Rotační perioda (rovník) · Složení · Vzdálenost od Země (pro kontext) · Sluneční cyklus

**Planety:**
- Průměr · Hmota · Den (rotační perioda) · Rok (orbitální perioda) · Počet měsíců · Atmosféra · Povrchová teplota · Gravitace · Vzdálenost od Slunce

**Měsíce:**
- Průměr · Hmota · Den · Vzdálenost od mateřské planety · Atmosféra (nebo „bez atmosféry") · Povrchová teplota · Gravitace · Mateřská planeta · Objevitel (rok)

## Scope

### V scope (V3)
- Hover tooltip pro 28 těles.
- Click → detail view s fly-to kamerou, OrbitControls, info panelem, reálným měřítkem toggle.
- Drill-down z planety do jejího měsíce.
- `bodyData.js` — 28 objektů s českými fakty (psáno ručně, zdroje: Wikipedia CZ + NASA, bez externí validace).
- Sun vitality: sunspots + prominence/erupce (viditelné v main i detail, s rozdílnou intenzitou).
- Testy: bodyData schema, picking math, detail view state machine, sunActivity controller.

### Mimo scope
- Asteroidové pásy, Kuiperův pás, Oortův oblak (V4).
- Komety (V5).
- Mobilní touch gestures pro orbit camera (V1 scope: desktop-first; detail view funkční na touch jen přes tap, orbit přes drag podporován OrbitControls default gestures).
- Vícejazyčnost (pouze čeština).
- Historické orbit/rotation accuracy — držíme se `a`, `e`, `period` z `moons.js` / `planets.js`.
- Deep-link URL (např. `?body=jupiter`) — odloženo.

## Architektura

### Nové soubory
- **`src/bodyData.js`** — 28 objektů s `{id, name, tagline, fields: {...}, funFact, discoverer?}`. Jeden zdroj pravdy pro UI text.
- **`src/picking.js`** — spravuje pole `THREE.Mesh` sfér (invisible material) na pozicích těl, poskytuje `raycaster` wrapper. API: `setup(bodies, camera, renderer)`, event-driven `onHover(id|null)`, `onClick(id)`.
- **`src/detailView.js`** — state machine + controller:
  ```
  state ∈ { MAIN, TRANSITION_IN, DETAIL, TRANSITION_OUT }
  focusId: string | null
  scaleMode: 'compressed' | 'real'
  ```
  API: `enter(id)`, `exit()`, `toggleScale()`, `update(dt)` — volá se z main loop.
- **`src/infoPanel.js`** — injektuje/renderuje HTML panel podle `bodyData[id]`. API: `show(id, { hasScaleToggle })`, `hide()`, `onClose(cb)`, `onScaleToggle(cb)`.
- **`src/tooltip.js`** — HTML element, metody `show(id, screenPos)`, `hide()`. Pozice = world-to-screen projekce z anchor position.
- **`src/cameraTween.js`** — `tween({ fromPos, fromTarget, toPos, toTarget, duration, onUpdate, onComplete })`. Cubic-ease. Samostatně testovatelný.
- **`src/sunActivity.js`** — controller pro sunspots + prominences. API: `update(pool, anchors, time, dt, { intensity })`. `intensity: 'low' | 'high'` (main vs detail).

### Upravené soubory
- **`src/main.js`** — integrovat picking/detailView/infoPanel/tooltip; při DETAIL state skipnout `updateSolarWind`/`updateMoonWind` ale nechat rotaci + moon orbit update; volat `detailView.update(dt)`.
- **`src/particles.js`** — přidat `ownerAlphaMul` Float32Array (per-owner, 28 slotů); shader násobí `vAlpha × ownerAlphaMul[owner]`. Fade logic při TRANSITION_IN/OUT.
- **`src/scene.js`** — přidat `OrbitControls` instance (disabled by default), exportovat.
- **`src/moonAnchors.js`** / moon position updater — `scaleFactor` parametr pro distance override (real scale).
- **`src/planets.js`** — `realDistanceFromSunKm` pole (pro info panel; u moons doplníme `realSemiMajorAxisKm`).

### Data flow
```
renderer canvas ── mousemove ──▶ picking.raycast
                                    │
                                    ├── onHover(id)  ──▶ tooltip.show
                                    └── onClick(id)  ──▶ detailView.enter
                                                            │
                                                            ├── cameraTween start
                                                            ├── particles.ownerAlphaMul fade
                                                            └── infoPanel.show (after tween)

ESC / ✕ / click outside ──▶ detailView.exit
                                    │
                                    ├── infoPanel.hide
                                    ├── cameraTween reverse
                                    └── fade-in ostatních
```

## State machine

```
         ┌────── click body ──────┐
         │                        ▼
     ┌── MAIN ◀── (0.8s) ── TRANSITION_OUT
     │                             ▲
     │                         ESC / ✕ / outside
     │                             │
     └── (0.8s) ──▶ TRANSITION_IN ─┴──▶ DETAIL
                                          │
                                          └── click moon (only v planet-detail)
                                                  │
                                                  └──▶ TRANSITION_IN (moon)
                                                          │
                                                          └──▶ DETAIL (moon)
                                                                  │
                                                                  └── ESC ──▶ MAIN
```

## Sun vitality

### Sluneční skvrny (sunspots)
- **Frequency & count:**
  - Main scene: 1 aktivní skvrna, nová každých ~25s.
  - Detail view: 2-3 aktivní, nová každých ~10-15s.
- **Lifecycle:** fade-in 3s → stable 20s → fade-out 8s (celkem ~31s).
- **Pozice:** cluster 30-50 sousedních Fibonacci Sun dots (vybraných jako k-nearest k random seed bodu). Seed s preferencí pro ±30° latitude (real sunspot zone).
- **Vizualizace:** barva teček se lerpne na `rgb(40,20,0)` (tmavě hnědá) s lifecycle intenzitou.
- **Rotace:** skvrny jsou stejné tečky pool[i] se změněnou barvou — rotují se Sun anchorem zdarma (no extra logic).
- **State:** `sunActivity.js` drží pole `activeSpots: [{ seedIdx, indices: number[], bornAt, stableAt, deathAt }]`.

### Prominence / erupce
- **Typy:**
  - **Arch prominence** (75 %): cluster ~40 teček startuje z povrchového bodu A, letí parabolickou trajektorií (max výška ~0.18× sunRadius), přistane na bodě B ~0.35-0.55× sunRadius vzdáleném. Lifetime 3s.
  - **CME** (25 %): ~25 teček letí radiálně od povrchu, zrychlují, fade-out za 2.2s (neletí zpět).
- **Frequency:**
  - Main scene: každých ~12s.
  - Detail view: každých ~6s.
- **Barva:** start `rgb(255, 180, 60)` → lerp na sunsurface color při přistání (arch) / na 0 alpha (CME).
- **Implementace:** reuse `FLYING` phase + nový `postArrivalPhase` → `ON_SUN` (arch) nebo `IDLE` (CME, ale fade alpha→0 pak recycle). Velocity pre-computed podle curve: position(t) = lerp(A, B, t) + up × sin(πt) × peak.
- **Pool budget:** ~60 teček v letu naráz worst case → unter 4000 rezerva.

## Edge cases

- **Click mimo těla během TRANSITION_IN** — ignorovat, transition musí dokončit.
- **Rychlé kliknutí na jinou planetu během DETAIL** — spustí TRANSITION_OUT → TRANSITION_IN na novou planetu (bez návratu do MAIN mezikrok). Fly-to přímo z A na B.
- **Resize okna během DETAIL** — `OrbitControls` si to zvládne, tooltip se reposicuje, info panel je CSS-positioned takže také OK.
- **Real scale toggle vyhodí měsíce mimo viewport** — hint v panelu informuje; uživatel může ručně zoom-out.
- **Touch tap** — jako click, ale tooltip se neukazuje. Drag = OrbitControls (ten zvládá touch).
- **Click na Slunce v main scene** — detail view se otevře; měsíc klikání v Sun detail N/A (Slunce nemá měsíce v naší datové sadě).
- **FLARE tečka v letu když user otevře detail** — nechá je doletět, pak se spawn rate upraví podle `intensity`.

## Testy

- **`bodyData.test.js`** — všech 28 těles ma povinná pole; hmota/průměr/gravitace > 0; fun fact není prázdný; jméno v Czech má diacritics (u ≥5 těles, spoiler check).
- **`picking.test.js`** — pure raycast math (sfér-ray intersection). Three-independent.
- **`detailView.test.js`** — state transitions: MAIN→enter(jupiter)→TRANSITION_IN→DETAIL. enter(io) v DETAIL planet → drill-down. exit() → TRANSITION_OUT → MAIN. Nepoužívá reálnou kameru, mock tween.
- **`cameraTween.test.js`** — start/end matching, progress monotonic, easing bounds [0,1], completion callback fires.
- **`sunActivity.test.js`** — over T=60s simulation, count of spawned spots ≈ expected (deterministic seed). Prominence trajectory is parabolic (max y at t=0.5). Pool invariant: no spawns when insufficient IDLE.
- **Vizuální verifikace** (manual): hover tooltip, fly-to smoothness, OrbitControls drag, real-scale toggle animation, sunspots lifecycle viditelný, prominence arch + CME.

## Technické poznámky

- **Raycasting na point cloud je drahé** → proto invisible `THREE.Mesh` sfér (1 per body) → standard THREE raycast, žádný custom shader hit test.
- **Fly-to kamera** vyžaduje znát "return" pozici (pozice kamery v MAIN). Uložíme do `detailView.state.returnCameraPos/Target` při entry.
- **Double-click / rapid clicks** — debounce: pokud je stav ≠ MAIN a ≠ DETAIL, ignoruj input.
- **ESC handler** registrovat globálně (window keydown), ale aktivovat jen v DETAIL/TRANSITION_IN.
- **Performance target**: 60 fps v detail view včetně sunspots + 2-3 prominence concurrent. Pool update už je O(N), přidáme O(sunspot_cluster_size) per spot update = zanedbatelné.

## Open questions

*žádné — všechny rozhodnutí zafixovány v brainstormingu.*
