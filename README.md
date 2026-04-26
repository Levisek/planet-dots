# Dots

Edukativně-hravá vizualizace sluneční soustavy z 1500 teček.

## Roadmap

- **V1** (hotová): Slunce + 8 planet, animace sesypání z teček, labely česky, reálné axial tilts a rotace kolem os.
- **V2** (hotová): 19 měsíců s Keplerovou orbitální mechanikou.
- **V3** (hotová): Click → detail view s info panelem, reálné měřítko toggle, drag-to-orbit kamera, živé Slunce (sunspoty + erupce).
- **V4.1** (forward-fix): vrácen V3 flat-triangle rendering, přidán Saturn ring jako `RingGeometry`, picker meshes na Layer 1, formation gating mesh skrytý dokud nedoletí ≥95 % teček.
- **V4.2** (hotová): 3D solar system — planety v kruhových orbitách kolem Slunce v origin, dva režimy **Pochopení** (vizuálně srozumitelný) / **Fyzikální** (real proporce 1:77 Mercury:Neptune + real periody + real eccentricity), real lighting toggle (Lambertian den/noc), formation intro Beat 1+2 (molekulární cloud + kolaps), orbit lines, klikatelný body list, planet labely, Triton retrograde, Neptune měsíce (Triton/Nereid/Proteus), pixel UI (Press Start 2P).
- V4.3: Asteroidový pás, Kuiperův pás, Oortův oblak, komety s ohony, trpasličí planety (Pluto/Ceres/Eris/...).
- V4.4: Beat 3-6 formation (Sun ignite/planetesimály/materializace), pixel UI polish.

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
- Hover nad tělem — tooltip.
- Klik na Slunce/planetu — detail view (ESC zavře).
- V detailu: drag myší = orbit kamera, scroll = zoom, checkbox = reálné měřítko.

## Testy

```bash
npm test
```

Spustí pure-JS unit testy (data, geometry, label sampling). Rendering se verifikuje vizuálně v prohlížeči.

## Licence

Code: MIT.

Všechny textury jsou **cylindrické equirectangular albedo mapy** (ne fotky sféry — `sphericalUV()` v `src/textureUtils.js` vyžaduje cylindrickou projekci).

**Textury planet (Sun + 9 planet + Luna + Saturn ring):** CC BY 4.0 — [Solar System Scope](https://www.solarsystemscope.com/textures/).

**Textury měsíců — albedo cylindric maps:**
- Galileovy (Io, Europa, Ganymede, Callisto) + Rhea: [Björn Jónsson](http://bjj.mmedia.is/data/planetary_maps.html), free non-commercial s attribution.
- Saturn (Titan, Iapetus, Dione, Tethys, Enceladus, Mimas), Uran (Miranda, Ariel, Umbriel, Titania, Oberon), Neptun (Triton), Mars (Phobos, Deimos): [Wikimedia Commons](https://commons.wikimedia.org/) — Public Domain (NASA/JPL/USGS Voyager+Cassini mise) nebo CC BY-SA per file. Atribuce: navštiv Wikipedia článek daného měsíce → infobox image → licence.
- Nereid, Proteus: malá tělíska bez globálního cylindrického mapu (Voyager 2 jen flyby) — fallback Voyager photo, viz `scripts/download-textures.mjs`.

**Stažení textur:** `npm run textures` (auto-install `sharp` přes npm + spuštění Node.js skriptu).
