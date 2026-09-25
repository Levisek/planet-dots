# Project Audit — celý projekt po V4.4 (2026-09-25)

Kompletní průchod kódem (všech ~45 modulů), testy, runtime ověření v headless
Chromiu (Playwright + SwiftShader) s číselnými sondami přes `window.__debug`
a screenshoty obou módů. Navazuje na `project-audit-2026-07-16.md`.

Větev: `audit/opus55-graficke-opravy`.

---

## TL;DR

V4.4 (efemeridy) rozbil soustavy měsíců: kalibrace měřítka ze specu
(„Task 10") se nikdy nestala a měsíce zůstaly zavěšené pod rotujícím anchorem
planety. Výsledek: v Pochopení obíhala Luna 3 000 j. od Země (Země je 1 450 j.
od Slunce), ve Fyzikálním byly všechny měsíce **uvnitř** planet. K tomu
několik tichých chyb, které testy nevidí (NaN průhlednost u 7 měsíců, prstenec
kreslený neprůhledně, dvojitá gama korekce textur, neviditelné sluneční skvrny)
a ~576k mrtvých teček zpracovávaných každý frame.

Všechno níže v sekci *Opraveno* je ověřené v prohlížeči (čísla + screenshoty),
testy 185 → 197, `test:visual` i `--all` (38 těles × 2 módy) zelené.

---

## Opraveno

### Soustavy měsíců (nejviditelnější chyba)

| | před | po |
|---|---|---|
| Luna od Země, Pochopení | 3 037 j. (370 R⊕) | 17 j. (2 R⊕, jako V4.3) |
| Io od Jupiteru, Pochopení | 3 184 j. | 119 j. |
| Luna od Země, Fyzikální | 9,9 j. (pod povrchem, R = 8,2) | 515 j. (věrný poměr k R⊕) |
| Phobos od Marsu, Fyzikální | 0,24 j. (uvnitř Marsu) | 12 j. |

- **Měřítko** — `moonScale.js`: lineární konstanta per měsíc, takže tvar dráhy,
  sklon i fáze z efemerid zůstávají reálné. Pochopení = ručně laděné `m.a` z V4.3,
  Fyzikální = věrný poměr k *zobrazené* velikosti rodiče (planety jsou ~50×
  zvětšené, jejich soustavy musí být taky). `getCameraDistance` počítá ze stejné
  funkce, takže kamera a dráhy nemůžou utéct od sebe.
- **Měsíce už nerotují s planetou** — anchor planety se rozdělil na poziční node
  (měsíce, jejich dráhy) a `spin` node (mesh, prstenec, tečky povrchu). Dřív se
  dráhy točily s vlastní rotací planety (u Jupiteru jednou za 4 s) a sklon osy
  se k reálnému sklonu drah přičítal podruhé.
- **Póly planet podle IAU** (`pole` v `planets.js`, `poleToScene`) — jeden
  `axialTilt` kolem osy X neznal uzel, takže Saturnův prstenec neležel v rovině
  drah jeho měsíců. Teď leží (test: odchylka normály Titanovy dráhy < 1,5°).
  Vedlejší efekt: Venuše a Uran se točí retrográdně — dřív `axialTilt > 90`
  **a** `direction: -1` se vyrušily a točily se prográdně.
- Iapetus `a` 4,4 → 5,2 (byl blíž než Hyperion, reálně je 2,4× dál).

### Detail view

- **Simulace běží i v detailu, kamera jede s tělesem.** Dřív se planety v detailu
  zmrazily, ale datum běželo dál — po ESC všechny planety naráz skočily o roky.
- **Zpomalený čas v detailu** (`simClock.setRateMultiplier`) — nejrychlejší
  regulární měsíc oběhne za ~8 s. Při 1× (36,5 dne/s) Io obíhalo 20× za sekundu.
  V HUD poznámka „detail: čas N× pomaleji".
- Tweeny kamery jsou relativní k tělesu → přílet sedí i na pohybující se cíl,
  přepnutí módu v detailu doletí na novou polohu.
- ESC po přepnutí módu v detailu vede na přehled **nového** módu (dřív
  Fyzikální → kamera Pochopení, z Neptunu zbyl jen vnitřek soustavy).
- Malé měsíce a asteroidy: kamera `r × 6` místo pevných 12/40 j., `minDistance`
  bez +10 (u r = 0,5 nešlo přiblížit pod 21 poloměrů).
- Hyperion ukazuje chaotickou rotaci i ve vlastním detailu (dřív tam jel
  pravidelný `rotateOne`).

### Vykreslování

- **Saturnův prstenec** — `fadeOthers` přepínal `material.transparent = false`
  i na prstenec → vypnutý blending, tmavý vnitřní prstenec C jako neprůhledný
  pás přes spodek planety. Teď vždy průhledný, ztlumení přes uniform. Profil se
  vzorkuje per-pixel z 1D textury (dřív 9 vzorků z 8 radiálních segmentů →
  zmizelé Cassiniho dělení, modrý lem na okraji).
- **Barvy textur** — vertex colors z `ImageData` (sRGB) šly do meshů jako
  lineární a renderer je gama-korigoval podruhé: vybledlý oceán, mdlý Jupiter,
  skok jasu při odkrytí meshe po formaci (tečky převod nepotřebují). `srgbToLinear`
  v `bodyMesh`.
- **Sluneční skvrny** — barvily tečky ON_SUN, které mají alpha 0 (povrch kreslí
  mesh) → skvrny nebyly nikdy vidět. Teď tmavnou trojúhelníky meshe (skupiny
  1–3, pás ±30°, penumbra).
- Erupce se vyklenovaly vždy do světového +Y (na spodní polokouli do Slunce) —
  teď radiálně; konce oblouku deterministicky (dřív ~16 % pokusů selhalo).
- Fallback tělesa (Hyperion, Phoebe) mají jemné skvrnění šumem — jednolitá
  barva bez stínů byla jen plochá silueta.
- Ikony ⏸ ▶ ◀ ✕ ✻ a indexy `⁰ ⁴–⁹ ₂` nejsou v Press Start 2P → bez systémového
  fallbacku prázdné čtverečky (ověřeno měřením šířky glyfů). SVG / `<sup>` `<sub>`.

### Formace

- `ownerAlphaMul` měl natvrdo 28 míst, vlastníků je 35 → Ariel…Proteus četli
  `undefined` a jejich tečky měly `ownerAlpha = NaN` (ověřeno: 7 měsíců, 56k teček).
- Emise měsíců po krocích ztrácela zbytek fáze, když poslední frame nedosáhl
  progressu 1: při ~5 fps Sinope i Pasiphae **0 teček** (mesh se nikdy
  neodkryl), Oberon 691 z 10 242. Teď doemituje; ověřeno plné počty při 5 fps.
- Po formaci se odkryje vše, co gating nestihl, a usazené tečky se uvolní.
- Během formace („před 4,6 mld let") se neukazují popisky planet, dnešní dráhy,
  pás ani pojmenované asteroidy — objeví se s „Dnes".

### Výkon

Usazené tečky mají alpha 0 (povrch kreslí mesh), přesto se všech ~576k každý
frame transformovalo (`applyClusterRotation`) a nahrávalo na GPU (~19 MB/frame).

| (VM, SwiftShader — relativně) | před | po |
|---|---|---|
| `rot` (transformace teček) | 11–14 ms | 0,8 ms formace, 0 po ní |
| `tick` CPU v detailu | ~13 ms | 0,5–1,8 ms |
| živé tečky po formaci | 576 131 | ~100 (vítr, erupce) |

`activeEnd` + `addUpdateRange` + `setDrawRange` — loopy i upload jen přes živý
rozsah. `THREE.Clock` (deprecated) → `THREE.Timer` s Page Visibility, strop dt.

### Ostatní

- Pás asteroidů obíhá Keplerovou rychlostí z data (dřív tuhý disk s periodou
  30 s, ignoroval scrub; Ceres oběhla za 17 s).
- Picker na pointer eventech (myš/dotyk/pero jednotně).
- `scripts/visual-regression.mjs` hledá mesh pod spin nodem; `VR_BASE_URL` pro
  běh bez `npx`.
- README: klávesa `R` neexistuje, rozsah dat −4000…8000 (ne ±10 000 let).

---

## Rozhodnuto a doděláno (druhé kolo)

- **Slunce v Pochopení r = 400** (bylo 995, skoro k dráze Merkuru 1 318 —
  vnitřní planety z výchozí kamery za ním). Škáluje se `spin` node Slunce,
  mesh i tečky se zmenší samy; vítr, erupce, picker a kamera detailu berou
  `getSunRadius()`. Fyzikální drží věrný poměr 109 R⊕.
- **Popisky** (`labelDeclutter.js`) — popisek tělesa za kotoučem Slunce se
  nekreslí (3D test úsečky kamera → těleso proti kouli). Při překryvu vyhrává
  větší těleso, další se posune o řádek nahoru (max 2), jinak se skryje.
  Planety a planetky se rozmisťují společně.
- **Velikosti** — Ceres 10 → 0,6, Vesta a Pallas 7 → 0,5, Hyperion, Phoebe,
  Sinope, Pasiphae 1,5 → 0,5. Test hlídá reálný poměr k Zemi (min 0,5).
- **Preset Halley** nahrazen konjunkcí Jupiter–Saturn (21. 12. 2020), která
  v simulaci vidět je. Halley se vrátí s kometou ve V4.5.
- **Výkonový HUD** jen s `?debug` v URL.

## K rozhodnutí (návrhy, neimplementováno)

1. **Rotace planet je v reálném čase** (Země 10 s/den bez ohledu na rychlost
   simulace). V detailu se zpomaleným časem je pak „měsíc" (8 s) kratší než
   „den" (10 s). Spojit rotaci se simulačním časem v detailu?
2. Počty měsíců v `bodyData` jsou nejspíš zastaralé (Saturn 146 — v březnu 2025
   ohlášeno 128 nových; Jupiter 95; Uran 28). Ověřit proti aktuálnímu zdroji.

## Technický dluh (beze změny)

- `simMode.js` drží legacy gettery (`getOrbitRadius`, `getInclination`, …)
  a vlastní `timeScale`, které už nic mimo testy nevolá (autorita je `simClock`);
  `simulationDate.getSimulationDate/formatRelative`, `reset*` funkce pro
  neexistující restart, `setPaused` placeholder, `detailDotSize`/`setOwnerSize`
  (tečky jsou po příletu neviditelné, nemá to efekt).
- `main.js` ~1 000 řádků — kompoziční kořen dál bobtná.
- `timeControls` sahá na DOM každý frame (datum + `picker.value` přes
  `onDateChange` při přehrávání).
- Layout na telefonu: seznam těles, info panel a časový HUD se překrývají.
- Klik do detailu během formace: tečky, které k tělesu teprve letí, mají velikost
  z přehledu (`dotSize`), ne `detailDotSize` — `setOwnerSize` se volá jen při
  vstupu. Existovalo i před auditem (formace v detailu běžela už od F3).
