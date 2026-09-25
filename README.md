# Dots

Edukativně-hravá vizualizace sluneční soustavy z 1500 teček.

## Roadmap

- **V1** (hotová): Slunce + 8 planet, animace sesypání z teček, labely česky, reálné axial tilts a rotace kolem os.
- **V2** (hotová): 19 měsíců s Keplerovou orbitální mechanikou.
- **V3** (hotová): Click → detail view s info panelem, reálné měřítko toggle, drag-to-orbit kamera, živé Slunce (sunspoty + erupce).
- **V4.1** (forward-fix): vrácen V3 flat-triangle rendering, přidán Saturn ring jako `RingGeometry`, picker meshes na Layer 1, formation gating mesh skrytý dokud nedoletí ≥95 % teček.
- **V4.2** (hotová): 3D solar system — planety v kruhových orbitách kolem Slunce v origin, dva režimy **Pochopení** (vizuálně srozumitelný) / **Fyzikální** (real proporce 1:77 Mercury:Neptune + real periody + real eccentricity), real lighting toggle (Lambertian den/noc), formation intro Beat 1+2 (molekulární cloud + kolaps), orbit lines, klikatelný body list, planet labely, Triton retrograde, Neptune měsíce (Triton/Nereid/Proteus), pixel UI (Press Start 2P).
- **V4.3** (hotová): Realismus orbit a tvarů — Kepler pro planety (eccentricity), inclination pro vše, suplementární clamp logika (planet 5°, moon 15°, irregular 30° s wrap-around pro retrograde), sjednocení retrograde mechaniky (přes inc>90° místo period×-1). Nové měsíce: Hyperion (chaotic tumbling + simplex displacement), Phoebe (Saturn retrograde), Sinope/Pasiphae (Jupiter Pasiphae group). Non-uniform tvary moonů přes shape.scale + simplex displacement. Texture completion kaskáda (mirror+blur fill chybějících hemisfér) + edu coverageNote ✻. Speed slider 0.1×–5× v dolním HUD (logaritmický piecewise) + simulační datum (J2000.0 epoch). Asteroid teaser: Ceres/Vesta/Pallas s vlastními orbit lines + 300-particle gaussian ring. Moon orbit lines v detail view (refresh při mode change). 121 testů. Spec: `docs/superpowers/specs/2026-05-05-dots-v4.3-realismus-design.md`, plán: `docs/superpowers/plans/2026-05-05-dots-v4.3-realismus.md`.
- **V4.4** (hotová): pozice z efemerid (astronomy-engine: planety, Luna, Galileovy měsíce) a reálných JPL elementů (ostatní), datum picker v rozsahu −4000 až 8000 (VSOP87), edu presety, formace jako akrece (disk → zážeh Slunce → hustnutí planet → měsíce) s geologickou osou.
- **Audit 2026-09-25** (`docs/project-audit-2026-09-25.md`): soustavy měsíců v obou módech (měřítko, rovina prstence, nerotují s planetou), póly planet podle IAU, detail view se zpomaleným časem a kamerou jedoucí s tělesem, barvy textur bez dvojité gama korekce, prstenec Saturnu per-pixel, viditelné sluneční skvrny, výkon po formaci; Slunce v Pochopení r = 400, popisky bez překryvu a za Sluncem skryté, reálný poměr velikostí malých těles, výkonový HUD jen s `?debug`, rotace planet podle simulačních hodin (pauza/reverz).
- V4.5+: Plný asteroid systém (Kirkwoodovy mezery, Trojané, NEO, named asteroidy s sample-return mission texturami). Kuiperův pás, Oortův oblak, komety s ohony (eliptické orbity e>0.9 — Halley, Hale-Bopp, NEOWISE). Trpasličí planety (Pluto+Charon, Eris, Makemake, Haumea).

## Spuštění

Projekt používá ES moduly — **nelze otevřít přes `file://`**. Potřebuje HTTP server:

- **LevisIDE**: built-in preview.
- **CLI**: `npm run serve` (spustí `npx serve` na portu 3000).
- **Alternativa**: `python -m http.server 8000`.

Pak v prohlížeči otevřít `http://localhost:3000/` (resp. `:8000`).

## Nasazení na domácí server

Běží na `http://192.168.100.250:8093` (LAN + tailnet, ven nevystaveno).

`nginx:alpine` nad bind-mountnutým git klonem v `/opt/stacks/planet-dots/app`.
Bez buildu — textury i `vendor/three` jsou verzované, `node_modules` je jen
na testy a stahování textur.

**Aktualizace:** `git -C /opt/stacks/planet-dots/app pull` — nginx servíruje
ze souborového systému, restart kontejneru netřeba.

Klon se stahuje read-only deploy klíčem, takže ze serveru nejde pushnout.

Provozní detaily (monitoring, porty) jsou v repu `Domaci server`,
spec nasazení: `docs/superpowers/specs/2026-07-26-sp3-vlastni-aplikace-design.md`.

## Struktura

- `index.html` — entry.
- `src/` — ES moduly (scene, planets, particles, label, animation, main).
- `textures/` — NASA / Solar System Scope textury (CC BY 4.0).
- `docs/superpowers/` — spec a plán.

## Ovládání

- `Space` — pauza / přehrávání (po skončení formace).
- `[` / `]` — zpomalit / zrychlit, `\` — obrátit směr času, `0` — reset rychlosti na 1×.
- Hover nad tělem — tooltip.
- Klik na těleso (scéna, popisek nebo seznam vlevo) — detail view (ESC nebo × zavře).
- V detailu: drag = orbit kamera, scroll = zoom. Čas se v detailu zpomalí tak,
  aby nejrychlejší měsíc oběhl zhruba za 8 s; kamera jede s tělesem.
- Nahoře: **Pochopení** / **Fyzikální** (měřítko vzdáleností a soustav měsíců), **Stíny** (den/noc).

## Testy

```bash
npm test
```

Spustí pure-JS unit testy (data, geometrie, poziční pipeline, částice). Rendering hlídá
`npm run test:visual` (strukturální invarianty přes Playwright, běží v CI); proti už
běžícímu serveru bez `npx`: `VR_BASE_URL=http://127.0.0.1:8765 node scripts/visual-regression.mjs`.

## Licence

Code: MIT.

Všechny textury jsou **cylindrické equirectangular albedo mapy** (ne fotky sféry — `sphericalUV()` v `src/textureUtils.js` vyžaduje cylindrickou projekci).

**Textury planet (Sun + 9 planet + Luna + Saturn ring):** CC BY 4.0 — [Solar System Scope](https://www.solarsystemscope.com/textures/).

**Textury měsíců — albedo cylindric maps:**
- Galileovy (Io, Europa, Ganymede, Callisto) + Rhea: [Björn Jónsson](http://bjj.mmedia.is/data/planetary_maps.html), free non-commercial s attribution.
- Saturn (Titan, Iapetus, Dione, Tethys, Enceladus, Mimas), Uran (Miranda, Ariel, Umbriel, Titania, Oberon), Neptun (Triton), Mars (Phobos, Deimos): [Wikimedia Commons](https://commons.wikimedia.org/) — Public Domain (NASA/JPL/USGS Voyager+Cassini mise) nebo CC BY-SA per file. Atribuce: navštiv Wikipedia článek daného měsíce → infobox image → licence.
- Nereid, Proteus: malá tělíska bez globálního cylindrického mapu (Voyager 2 jen flyby) — fallback Voyager photo, viz `scripts/download-textures.mjs`.

**Stažení textur:** `npm run textures` (auto-install `sharp` přes npm + spuštění Node.js skriptu).
