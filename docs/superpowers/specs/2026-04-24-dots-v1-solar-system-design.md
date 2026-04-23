# Dots — V1: Solar System View

**Datum:** 2026-04-24
**Fáze:** V1 (z pětifázové roadmapy)
**Cíl:** Edukativně-hravá vizualizace sluneční soustavy. Z 1500 teček se postupně vybudují Slunce a 8 planet — každou uvede název složený z teček, každá rotuje kolem vlastní osy s reálným axial tilt a reálnými poměry period.

---

## Kontext

- Úplně nový projekt (`C:\dev\Dots`, prázdné repo).
- V1 je samostatně spustitelné MVP.
- Roadmap:
  - **V1** (tento spec): Slunce + 8 planet + animace sesypání + labely z teček + rotace kolem vlastní osy.
  - **V2**: 19 měsíců s Keplerovou orbitální mechanikou + tidally-locked rotací.
  - **V3**: Hover/click detail view — planeta se přiblíží na ~85 % výšky okna, **všechna mechanika realistická** (rotace kolem osy, měsíce obíhající Keplerovsky v rezonanci, prstence detailně, axial tilt zachován), info panel s reálnými daty.
  - **V4**: Asteroidový pás, Kuiperův pás, Oortův oblak naznačený.
  - **V5**: Komety s elliptickými orbitami a ohony z teček.

Každá další fáze dostane vlastní spec + plán + implementaci.

---

## Tech stack

- **Jedno `index.html`** jako entry. Ne otevíratelné dvojklikem — vyžaduje live server (viz „Spouštění").
- **Three.js r170+** přes ESM importmap z CDN (jsdelivr / unpkg).
- **NASA / Solar System Scope textury** (CC BY 4.0, origin SDO / Hubble / Cassini / Voyager) stažené lokálně do `textures/`. Žádné runtime fetche z cizích domén.
- **Vanilla JS**, ES modules. Žádný bundler, žádný framework.
- Žádné runtime závislosti mimo Three.js z CDN.

---

## Struktura souborů

```
Dots/
├── index.html              # entry, CSS inline, importmap, <script src=src/main.js>
├── src/
│   ├── main.js             # bootstrap, render loop, keyboard input
│   ├── scene.js            # renderer, camera, lights, starfield pozadí
│   ├── planets.js          # data (radius, texture, rotation, tilt, tick count, color)
│   ├── particles.js        # dot pool (1500), buffery pozice/barva/alpha, update
│   ├── label.js            # text → dots (Canvas offscreen → pixel sample → cílové pozice)
│   └── animation.js        # fáze, timeline, easing, allocation logic
├── textures/
│   ├── sun.jpg             # 2k
│   ├── mercury.jpg         # 2k
│   ├── venus.jpg           # 2k
│   ├── earth.jpg           # 2k
│   ├── mars.jpg            # 2k
│   ├── jupiter.jpg         # 4k (Great Red Spot viditelný)
│   ├── saturn.jpg          # 2k
│   ├── saturn_ring.png     # alpha PNG pro prstence
│   ├── uranus.jpg          # 2k
│   └── neptune.jpg         # 2k
├── docs/superpowers/specs/
│   └── 2026-04-24-dots-v1-solar-system-design.md   # tento dokument
├── README.md
└── .gitignore
```

---

## Scale a kompozice

**Reference:** Jupiter = **180 px průměr**. Lineární, total accuracy vůči této referenci.

| Těleso  | Real ⌀ (km) | Px ⌀             | Tečky | Pozn.                       |
|---------|-------------|-------------------|-------|-----------------------------|
| Slunce  | 1 392 700   | 1991 (jen výřez)  | 250   | vidět cca 15–25 % disku vlevo |
| Merkur  | 4 879       | 6.3               | 35    |                             |
| Venuše  | 12 104      | 15.6              | 55    |                             |
| Země    | 12 742      | 16.4              | 55    |                             |
| Mars    | 6 779       | 8.7               | 40    |                             |
| Jupiter | 139 820     | 180               | 160   | Great Red Spot v textuře    |
| Saturn  | 116 460     | 150 + prstence    | 130   | nakloněn 27°, prstence pod úhlem ≈ 350 px š. |
| Uran    | 50 724      | 65                | 70    | **leží na boku** (tilt 97°) |
| Neptun  | 49 244      | 63                | 70    |                             |
| **Součet** |          |                   | **865** | pevně alokované na planety |

**Zbytek 635 teček** je dynamický pool — používá se na labely (max ~250 pro nejdelší název) a „volné" částice, které se během animace realokují mezi fázemi.

**Total: 1500 teček.**

### Layout

- Slunce úplně vlevo, střed mimo canvas → vidět jen pravý okraj disku.
- Planety v pořadí doprava: Merkur, Venuše, Země, Mars, Jupiter, Saturn, Uran, Neptun.
- Rozestupy **dekorativní** (ne reálné vzdálenosti — ty jsou nemožné). Cíl: Saturnovy prstence nezasahují do sousedů, všechno čitelné na 1920×1080.
- **Nejde o 3D orbitální view**; planety jsou statické v horizontální lajně. Rotace jen kolem vlastní osy.

### Kamera

- Perspektivní, fov ~40°.
- Mírný tilt +5° na y ose pro dojem hloubky.
- Canvas fullscreen responsive, minimum 1280×720.

### Pozadí

- Star field: cca 500 statických drobných teček v black-space pozadí (**mimo počet 1500**).
- Subtle nebula texture volitelně (pokud se nepokazí kontrast).

---

## Fáze animace

Timeline (sekundy od startu):

| T          | Fáze                                                     |
|------------|----------------------------------------------------------|
| 0.0–1.0    | **Init** — 1500 teček materializace v random pozicích, jemný Perlin noise motion, šedivě-bílá barva, alpha 0.6. |
| 1.0–2.0    | **Slunce** — label „SLUNCE" (0.3s form → 0.4s drží → 0.3s rozpad) + simultánně teč Slunce letí doleva, pozicují se na Fibonacci-sphere distribuci na povrchu + fade-in textury Slunce. |
| 2.0–2.4    | **Merkur** — label „MERKUR" → sesyp → textura. |
| 2.4–2.9    | **Venuše** — label „VENUŠE". |
| 2.9–3.4    | **Země** — label „ZEMĚ". |
| 3.4–3.9    | **Mars** — label „MARS". |
| 3.9–5.0    | **Jupiter** — label „JUPITER", víc teček → delší sesyp, Great Red Spot viditelný po dokončení. |
| 5.0–6.0    | **Saturn** — label „SATURN", vznik tělesa + následně (v 5.7s) separátně prstence (z pool teček se zarovnají do diskového tvaru okolo Saturnu, pak fade-in alpha textury prstenců). |
| 6.0–6.5    | **Uran** — label „URAN", **naklonění 97°** se stane dramatickým „překlopením" během sesypu. |
| 6.5–7.0    | **Neptun** — label „NEPTUN". |
| 7.0s+      | **Live** — planety rotují kolem vlastní osy (viz níže), tečky „na povrchu" lehce oscilují v normále (1–2 px), Slunce emisivně pulzuje, Perlin noise pokračuje na free-pool tečkách. |

### Easing

- **Cubic in-out** pro sesyp teček (plavné dosednutí).
- **Linear** pro rotaci.
- **Smooth damping** pro noise motion.
- **Ease-out** pro fade-in textur.

### Přechod „label → planeta"

1. Label z teček drží 0.4 s uprostřed scény.
2. Písmena se rozpadnou (tečky získají mírný random outward velocity).
3. Tečky postupně získají cílovou pozici na povrchu cílové planety (Fibonacci sphere), barvu přechází z bílé na průměrnou barvu textury planety.
4. Současně fade-in textura planety (mesh) od alpha 0 na 1.

---

## Realistická rotace planet (V1)

### Axial tilt (přesný)

| Těleso  | Tilt    | Pozn.                          |
|---------|---------|--------------------------------|
| Slunce  | 7.25°   |                                |
| Merkur  | 0.03°   | prakticky kolmý                |
| Venuše  | 177.4°  | **vzhůru nohama** (retrográdní) |
| Země    | 23.44°  |                                |
| Mars    | 25.19°  |                                |
| Jupiter | 3.13°   |                                |
| Saturn  | 26.73°  | prstence v rovníku             |
| Uran    | 97.77°  | **leží na boku**               |
| Neptun  | 28.32°  |                                |

### Rotační perioda

Reálné **poměry** period. Reference: **Země = 10 s / otočka**. Ostatní přepočteno:

| Těleso  | Reálná perioda   | Anim perioda | Směr           |
|---------|------------------|--------------|----------------|
| Slunce  | 25 d (ekvátor)   | 250 s        | prograde       |
| Merkur  | 58.6 d           | 586 s        | prograde (pomalý) |
| Venuše  | 243 d            | 2430 s       | **retrograde** (prakticky neviditelné, ale opačným směrem) |
| Země    | 24 h             | 10 s         | prograde (reference) |
| Mars    | 24.6 h           | 10.25 s      | prograde       |
| Jupiter | 9.9 h            | 4.1 s        | prograde (nejrychlejší) |
| Saturn  | 10.7 h           | 4.5 s        | prograde       |
| Uran    | 17.2 h           | 7.2 s        | **retrograde** |
| Neptun  | 16.1 h           | 6.7 s        | prograde       |

**Poznámka k Venuši:** Anim perioda 2430 s (40 min) znamená, že uživatel neuvidí jednu celou otočku při normálním prohlížení. Záměrně — respektujeme reálné poměry. V3 info panel to vysvětlí („jeden den na Venuši trvá déle než venušinský rok").

**Alternativa** (implementační rozhodnutí): pokud vizuálně potřeba, zkomprimovat všechny periody 2× (Země = 5 s). Poměry se nezmění. Rozhodneme v implementaci podle pocitu; default je 10 s / Země.

---

## Labely z teček

### Princip

- **Offscreen Canvas 2D** vyrenderuje text velkým bold písmem (cca 80–100 px výška) s mírným letter-spacing.
- **Pixel sampling**: krok 4–6 px, pokud alpha > 0.5 → kandidát na pozici tečky.
- **Allocation**: vybere se podmnožina pozic (Poisson disk nebo random) podle počtu dostupných teček ve free-poolu.
- Tečky z poolu dostanou tyto cílové pozice (2D → přepočet na 3D pozici v plane rovnoběžné s kamerou, ve středu scény lehce před planetami).
- Formování: tečky letí ze svých aktuálních pozic (Perlin motion) k cílovým label-pozicím s cubic ease.

### Parametry

- **Počet teček na label**: počet písmen × 30 (~ max pro „NEPTUN" = 180, ideální čitelnost).
- **Velikost písma**: 90 px výška. Font: `bold sans-serif` (system-ui / Inter fallback).
- **Jazyk**: česky — **SLUNCE, MERKUR, VENUŠE, ZEMĚ, MARS, JUPITER, SATURN, URAN, NEPTUN**. Diakritika ověřena v Canvas 2D.
- **Pozice**: střed canvasu, lehce nad rovinou planet.
- **Recyklace**: stejné tečky, co tvořily label, pak letí na povrch planety (ne zvlášť alokace).

---

## Tečky — technická implementace

- **Three.Points** s custom `ShaderMaterial`:
  - Atributy per-particle: `position`, `targetPosition`, `velocity`, `color`, `targetColor`, `phase`, `lifetime`.
  - Fragment shader: kruhový point sprite s radial gradient alpha a lehkým glow.
  - Blending: `AdditiveBlending` nebo `NormalBlending` podle pocitu (test v impl).
- **Update loop**: každý frame lerp `position → targetPosition` a `color → targetColor` s koeficientem podle `phase`.
- **Phase enum**: `free` | `formingLabel` | `flyingToPlanet` | `onPlanet` | `onRing`.
- **Výkon cíl**: 60 fps na GTX 1060 / M1 / integrovaná Intel Iris Xe při 1920×1080.

---

## Controls (V1)

| Klávesa | Akce              |
|---------|-------------------|
| `R`     | Restart animace   |
| `Space` | Pauza / resume    |
| `Esc`   | (rezervováno pro V3) |

Kurzor: zatím bez interakce (hover/zoom = V3).

---

## Spouštění

**Ne dvojklikem.** Důvody: `<script type="module">` i fetch textur z `file://` blokuje CORS v Chrome/Edge/Firefox.

Doporučené způsoby (kterýkoli z nich):
1. **LevisIDE built-in preview** (primární — projekt je pro Martin a je v LevisIDE).
2. `npx serve` nebo `npx http-server` v rootu projektu.
3. `python -m http.server 8000`.
4. VS Code Live Server extension.

README.md obsahuje instrukce.

---

## Acceptance criteria (V1)

1. Projekt otevřen přes live server → canvas se rozprostře fullscreen.
2. Animace proběhne: 1500 teček → postupně 9 těles s labely → finální solar system view s rotacemi.
3. **Proporce** viditelně odpovídají tabulce scale (Jupiter dominantní, Merkur drobný, Slunce obří výřez vlevo).
4. **Saturn** má prstence pod úhlem, **Uran leží na boku**, **Venuše** rotuje retrográdně a vzhůru nohama.
5. Labely jsou česky s diakritikou, čitelné, složené z teček.
6. `R` restartuje animaci, `Space` pauzuje/resume.
7. **60 fps** na referenčním HW (1920×1080, GTX 1060 ekvivalent).
8. Nula JS errorů v devtools konzoli.
9. Textury jsou viditelné NASA/SSC kvality (Great Red Spot u Jupitera, povrchové detaily na Marsu, oblačné pásy atd.).
10. Code v `src/` rozdělen do modulů podle struktury, žádný soubor > 300 řádků.

---

## Out of scope V1

- Měsíce (→ V2).
- Hover/click detail view, info panely, tooltipy (→ V3).
- Asteroidový pás, Kuiperův pás, Oortův oblak (→ V4).
- Komety (→ V5).
- Orbitální oběhy planet kolem Slunce (všechny planety jsou staticky umístěné v řadě — V1 řeší jen rotaci kolem vlastní osy a kompozici).
- Mobilní layout (pouze desktop 1280×720+).
- Sound / ambient audio.
- Zoom / pan kamery.

---

## Rizika a mitigace

| Riziko                             | Mitigace                                                |
|------------------------------------|---------------------------------------------------------|
| CORS pro textury                   | Textury lokálně v `textures/`, spouštění přes live server. |
| Velikost stažených textur (~15 MB) | 2k default, 4k jen Jupiter. Commit do repa akceptovaný. |
| Canvas font diakritika             | `system-ui` fallback, test při impl.                    |
| Shader kompatibilita               | Only stable GLSL, Three.js ShaderMaterial default.      |
| Výkon při 1500 particles + textures | Cíl 60 fps; fallback snížit na 1000 teček.             |

---

## Licence zdrojů

- Textury: **Solar System Scope** — CC BY 4.0 (https://www.solarsystemscope.com/textures/). Atribuce v README.
- Three.js: MIT.
- Code: MIT (nebo dle volby autora).

---

## Otevřené otázky (nic neblokuje V1)

- Komprese rotační periody (Země = 5 s vs. 10 s) — **rozhodne se v implementaci** podle vizuálního pocitu. Default 10 s.
- Blending mode pro tečky (additive vs. normal) — **rozhodne se v implementaci**.
- Přesné barvy star-field pozadí (pure black vs. tmavě modrý gradient) — **rozhodne se v implementaci**.

---

## Další krok

Po review tohoto spec → invoke `superpowers:writing-plans` skill pro detailní implementační plán V1.
