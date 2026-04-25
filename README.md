# Dots

Edukativně-hravá vizualizace sluneční soustavy z 1500 teček.

## Roadmap

- **V1** (hotová): Slunce + 8 planet, animace sesypání z teček, labely česky, reálné axial tilts a rotace kolem os.
- **V2** (hotová): 19 měsíců s Keplerovou orbitální mechanikou.
- **V3** (hotová): Click → detail view s info panelem, reálné měřítko toggle, drag-to-orbit kamera, živé Slunce (sunspoty + erupce).
- **V4.1** (hotová): Voxel tile rendering — `InstancedMesh` hexagonů s Lambertian per-tile lighting (`DirectionalLight` od Slunce), Saturnův prsten jako real `RingGeometry` v ekvatoriální rovině, picker meshes na Layer 1.
- V4.2: Asteroidový pás, Kuiperův pás, Oortův oblak, komety s ohony.
- V4.3: Formation intro, pixel UI, 4-mode sim switcher.

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

**Textury planet:** CC BY 4.0 — [Solar System Scope](https://www.solarsystemscope.com/textures/).

**Textury měsíců:**
- Luna: CC BY 4.0 — Solar System Scope.
- Ostatní (Phobos, Deimos, Io, Europa, Ganymede, Callisto, Titan, Rhea, Iapetus, Dione, Tethys, Enceladus, Mimas, Miranda, Ariel, Umbriel, Titania, Oberon): [Wikimedia Commons](https://commons.wikimedia.org/) — licence se liší per soubor (převážně Public Domain — NASA / JPL / Cassini / Voyager mise, některé CC BY-SA). Pro přesnou atribuci konkrétního souboru navštiv Wikipedia článek daného měsíce → infobox image → licence.
- Download: `python3 scripts/download_moon_textures.py` (vyžaduje Pillow).
