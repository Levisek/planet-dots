# Dots

Edukativně-hravá vizualizace sluneční soustavy z 1500 teček.

## Roadmap

- **V1** (aktuální): Slunce + 8 planet, animace sesypání z teček, labely česky, reálné axial tilts a rotace kolem os.
- V2: 19 měsíců s Keplerovou orbitální mechanikou.
- V3: Hover/click detail view s reálnou mechanikou a info panelem.
- V4: Asteroidový pás, Kuiperův pás, Oortův oblak.
- V5: Komety s ohony z teček.

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

## Testy

```bash
npm test
```

Spustí pure-JS unit testy (data, geometry, label sampling). Rendering se verifikuje vizuálně v prohlížeči.

## Licence

Code: MIT.
Textury: CC BY 4.0 — [Solar System Scope](https://www.solarsystemscope.com/textures/).
