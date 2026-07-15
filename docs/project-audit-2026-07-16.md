# Project Audit — směr a zdraví projektu (2026-07-16)

Kompletní audit: bezpečnost + supply chain + runtime verifikace (Playwright/Chrome)
+ zhodnocení směru. Navazuje na `docs/moon-audit-2026-04-25.md` a VISUAL-AUDIT V4.3.

---

## Kde na roadmapě jsme

```
V1 ──── V2 ──── V3 ──── V4.1 ── V4.2 ── V4.3 ─── V4.4 ─────── V4.5+
 ●        ●       ●       ●       ●       ●         ○             ○
planety  měsíce  detail  fix    3D+2    realismus  ephemeris    Kuiper/Oort
 +intro  Kepler  view    render módy    orbit+tvar scrubber     komety, Pluto
                                                   formace 3-6
```

## Zdraví projektu po dimenzích

```
Datová poctivost      █████████░  9/10  NASA/USGS zdroje, licence u každé textury
Testy                 ████████░░  8/10  121 testů na matiku; vizuál jen ruční audit
Architektura          ███████░░░  7/10  40 čistých modulů, ale main.js ~800 ř. roste
Bezpečnost/hygiena    ██████████ 10/10  CSP, plně offline, 0 vulns, CI workflow
Vizuální dotaženost   ████████░░  8/10  I2+I4 fixnuty 2026-07-16, zbývá I1/I3
Dokumentace procesu   █████████░  9/10  specs+plans per verze, audity s datem
```

## Co bylo opraveno 2026-07-16

**Bezpečnost / hygiena:**
- Three.js vendored (`vendor/three/`, 0.184.0) — dřív CDN 0.170.0, zatímco testy
  běžely proti 0.184.0 (tichý verzní drift). Appka je teď **plně offline**,
  nulové externí requesty.
- CSP meta tag (`default-src 'none'`, importmap přes sha256 hash — pozor,
  HTML parser normalizuje CRLF→LF před hashováním, regen příkaz v index.html).
- Press Start 2P self-hosted (`fonts/`, latin + latin-ext) — žádný IP leak na Google.
- `escapeHtml` sjednocen do `src/escapeHtml.js` (moonLabels neescapoval).
- sharp přesunut do devDependencies, bjj.mmedia.is na HTTPS, Wikimedia UA
  s reálným kontaktem, favicon.svg, GitHub Actions CI (`.github/workflows/test.yml`).

**VISUAL-AUDIT resty:**
- **I4** — default kamera (0,3500,6000) → (0,5000,9000), Slunce už nežere ⅓ framu.
- **I2** — Saturn detail view: tři nezávislé příčiny, všechny opraveny:
  1. `getCameraDistance` počítal irregular měsíce (Phoebe a=13.5) i v Pochopení
     → dist 2910 místo ~873, kamera skončila u Slunce (r=995) a to photobombilo view.
  2. Kamera ustupovala vždy po světové +z — teď ustupuje směrem ke Slunci,
     takže Slunce je za kamerou (`detailView.js: zSign`).
  3. Formation gating nechal mesh skrytý, když uživatel klikl dřív, než doletěly
     tečky → force-settle focus meshe při vstupu do detailu (`fadeOthers`).

**Korekce starého auditu:** `moon-audit-2026-04-25.md` doporučoval real eccentricity
a opravu period (Iapetus, Nereid) — **vyřešeno už ve V4.3** přes `eReal`/`periodReal`
+ gettery v `simMode.js`. Audit dokument to nereflektoval.

## Co zbývá (priorita shora)

1. ~~**Vizuální regrese CI**~~ — HOTOVO 2026-07-16: `scripts/visual-regression.mjs`
   (`npm run test:visual`) assertuje strukturální invarianty přes `__debug` API
   (mesh viditelný, kamera cílí na anchor, úhlová velikost, Slunce mimo frustum,
   Saturn ring) — pixel-diff by u orbitální scény generoval falešné poplachy.
   Běží v CI jako samostatný job, screenshoty jdou do artifacts.
2. **I1/I3** — asteroidy jako uniform koule (procedurální textury částečně hotové),
   sub-pixel moony bez povrchu v detailu. Nice-to-have, může jít s V4.5.
3. **main.js (~800 ř.)** — kompoziční kořen bobtná; před V4.4 vytáhnout
   setup fáze (mesh build, detailView deps, debug API) do modulů.
4. **V4.4 ephemeris** — pozor na konzistenci: přesnostní feature (±10 000 let)
   stavět až na srovnaném datovém základě. eReal/periodReal je hotové, dobrý stav.
5. **V4.5+ zvážit rozsekat** — Kirkwood + Trojané + Kuiper + Oort + komety +
   trpasličí planety je větší objem než vše dosud. Komety samostatně mají
   největší edu hodnotu; Oortův oblak je vizuálně „nic".

## Hodnocení směru (TL;DR)

Vize **Pochopení vs. Fyzikální** je nosná a odlišuje projekt od běžných solar-system
dem. Proces spec → plán → implementace → audit je disciplinovaný. Hlavní riziko je
**útěk dopředu**: audit najde resty, opraví se kritické, zbytek se tiše odsune pod
novou feature. Tento dokument je pokus to zastavit — resty I2/I4 jsou tímto splaceny,
zbývá vizuální regrese jako pojistka.
