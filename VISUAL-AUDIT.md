# Visual Audit V4.3 — všechny planetky a měsíce

**Datum:** 2026-05-05
**Cíl:** http://localhost:3000/ (Chromium 1440×900 headless)
**Auditovaná tělesa:** 37 (8 planet + 26 měsíců + 3 asteroidy)
**Console errors:** 0

Screenshoty: `.audit/screenshots/<id>-<mode>.png` (74 souborů + 2 overview)

---

## 🔴 Critical (blokuje user feedback "vše dotáhnout")

### C1. Hyperion / Phoebe / Sinope / Pasiphae mesh — NEVIDITELNÉ v detail view

- **Symptom:** klik na Hyperion / Phoebe → prázdná scéna, jen info panel. Sinope/Pasiphae stejně.
- **Soubor:** `src/moons.js:138,150,62,74` — všechny mají `radiusPx: 0.5`
- **Příčina:** fallback color sphere má radius 0.5 (sub-pixel z výchozí detail-view distance). Žádné chyby v kódu, ale veličina je tak malá že mesh je nepostřehnutelný i v close-zoom.
- **Fix:** zvedt `radiusPx` pro malé tělíska s `texture: null` na minimum vizuální velikosti — např. 1.5–2.0 (analogicky velkým moonům s texturou). Diameter ratio už nebude přesný, ale objekt bude viditelný. Alternativa: speciální "flat marker" mesh (světlejší color, lehce větší disc) pro objekty bez textury.

### C2. Velké planety v Fyzikálním detail view — mesh chybí

- **Symptom:** klik na Saturn / Jupiter v Fyzikálním → vidíme moon orbit lines a labels, ale **žádný planet mesh ani Saturn ring**. V Pochopení mode tatáž planeta vidět normálně.
- **Screenshoty:** `saturn-fyzikalni.png`, `jupiter-fyzikalni.png`
- **Možné příčiny:**
  - a) Kamera near-plane clip — v Fyzikálním pozice planet jsou 10× dál, camera tween může strčit kameru blíž k planetě než near-plane (~10 jednotek)
  - b) Far plane (2M) je možná nedostatečné pro Fyzikální mode pohled z dálky
  - c) Camera tween v Fyzikálním nedotweenuje na planet position v 2.5s window auditu (ale uživatel hlásí stejný problém manuálně, takže ne audit timing)
- **Fix:** investigovat camera config v `detailView.js` při `_focusId === planet`. Možná zvýšit minDistance v controls a rozšířit far plane na 5M+. Nebo upravit camera tween distance scaling pro Fyzikální (relativně k orbital radius).

### C3. Triton a další Voyager-only moony — dark hemisféra stále viditelná

- **Symptom:** Triton jako srpek (crescent), tmavá strana viditelně chybí
- **Soubor:** `textures/triton.jpg` — darkRatio 38.7% (těsně pod 40% threshold completion)
- **Příčina:** F2.T22 mirror+blur completion má threshold 40% — Triton spadl pod, completion neproběhla. Threshold byl nastaven empiricky pro Uran moony (54-62% dark) — Triton je hraniční.
- **Fix:** snížit threshold v `scripts/download-textures.mjs:maybeCompleteHemisphere` z 0.40 na 0.30. Re-process Triton (a Vesta 39%, hraniční).

---

## 🟡 Important (UX zhoršení)

### I1. Asteroidy = uniform color spheres bez detailů

- **Tělesa:** Ceres (#9a8d7a tan), Pallas (#8a8a8a gray)
- **Stav:** žádné cylindrické textury neexistují (Ceres má orthographic Dawn snímky, Pallas jen Hubble blur). Fallback color sphere = jednolitá barva.
- **Zhodnocení:** funguje technicky, vizuálně nudné. **V4.3 teaser** to akceptuje, ale uživatel poznamenává "nejsou dotažené".
- **Návrh fixu:** procedurální texture pro Ceres/Pallas — Hubble image stretch + Perlin noise + radial gradient. Nebo importovat tyto z Solar System Scope (Vesta tam je, Ceres asi taky).

### I2. Saturn ring nevidět ve většině detail screenshots

- **Screenshot:** `saturn-pochopeni.png` — Saturn vpravo (mimo střed), ring chybí
- **Příčina:** audit screenshot kamera je trochu offset (camera tween in 2.5s window), ale i v normální use cases ring bývá invisible — pravděpodobně child-of-anchor správně, ale gated/visibility issue
- **Fix:** verify v running app manually — pokud ring viditelný v real interaction OK, audit timing je viník. Pokud chybí i manuálně → debug saturnRing.js gated mesh.

### I3. Sub-pixel moony rendered jako tečky bez detailu

- **Tělesa:** Phobos, Deimos, Sinope, Pasiphae, Mimas, Enceladus, Hyperion, Phoebe (radiusPx 0.5)
- **Symptom:** v detail view jsou viditelné jen jako bodové dots, žádný surface
- **Tradeoff:** real diameter ratio Phobos:Mars je 27:6779 ≈ 1:250 — pokud Mars = 50px, Phobos je 0.2px (sub-pixel). Současný 0.5 je už zveličený.
- **Návrh:** v detail view (close-zoom) renderovat bigger placeholder — např. když camera distance < 100, force minimum mesh visible diameter = 2px. UI hint by pomohlo (label "měřítko nepřesné pro malá tělíska v detail view").

### I4. Pochopení mode camera default je velmi blízko Slunce

- **Screenshot:** `_overview-pochopeni.png` — Slunce dominuje frame, planety v cluster vlevo, většina viditelná jen jako labels
- **Příčina:** camera (0, 3500, 6000) — Slunce má radius 995, takže Slunce je 1/3 frame
- **Fix:** zvýšit default camera distance v Pochopení na (0, 5000, 9000) nebo dál, aby user viděl celé inner planety + asteroid pás bez zoom-out.

---

## 🟢 Working well

- **Body list:** Title Case (Slunce, Merkur, Venuše, ...), Asteroidy section, klikatelné, group hierarchy
- **Info panely:** rich content, coverageNote ✻ pro Voyager-only moony správně viditelné
- **Vesta texture:** Dawn mission map renders well s krátery
- **Earth texture po Fix-10:** kontinenty správně orientovány (X-tilt místo Z-tilt)
- **Speed slider + datum:** funkční, J2000 + days/hours format
- **Asteroid orbit lines:** Ceres/Vesta/Pallas viditelné v overview, Pallas s viditelným náklonem
- **Mode toggle:** Pochopení/Fyzikální buttons funkční, vizuální feedback aktivního
- **Lighting OFF default:** flat illumination jasná, krátery viditelné na osvětlených moonech (Vesta, Miranda)
- **Mars detail Fyzikální:** Mars + Phobos + Deimos s viditelnými orbit lines
- **Asteroid pás:** 300 částic gaussian distribuce mezi Mars-Jupiter, viditelný v obou módech, **správně se rozšiřuje v Fyzikálním**

---

## Doporučený fix order

1. **C2** (camera Fyzikální detail) — kritický, ovlivňuje 4 outer planety
2. **C1** (sub-pixel mesh visibility) — kritický, jinak Hyperion/Phoebe/Sinope/Pasiphae jsou neviditelní
3. **C3** (Triton dark hemisphere) — drobný code fix (threshold)
4. **I3** (sub-pixel placeholder) — provázáno s C1
5. **I4** (Pochopení camera default) — quality of life
6. **I1** (asteroid texture quality) — V4.3 teaser nice-to-have, mohlo by jít do V4.5+
7. **I2** (Saturn ring) — verifikovat manuálně, fixnout pokud reproducible

---

## Audit script + screenshoty

- Script: `.audit/visual-audit-all.mjs` (Playwright headless)
- Report data: `.audit/visual-audit-report.json` (per-body screenshot paths)
- Screenshoty: `.audit/screenshots/*.png` (74 souborů, 1440×900)
- Overview: `_overview-pochopeni.png`, `_overview-fyzikalni.png`

Spuštění: `npm install --no-save playwright && node .audit/visual-audit-all.mjs`. Vyžaduje běžící `npm run serve`.
