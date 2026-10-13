# Vznik soustavy — věrný příběh

Zadání (2026-10-13): formace má ukázat, jak sluneční soustava doopravdy
vznikla — fyzicky přesně. Zvolená cesta: **věrný příběh**. Události, pořadí,
časy, místa a fyzika pohybu podle dnešní vědy, kamera a tempo režírované.

## Co znamená „přesně"

Skutečný výpočet gravitace tisíců těles naši soustavu nevyrobí: je
chaotický a každý běh dopadne jinak. Přesnost proto drží jinde:

- **Pořadí a data** jsou z datování meteoritů a modelů. Na obrazovce běží
  počítadlo skutečného času (logaritmicky, ať se vejde 100 tisíc let
  kolapsu i 4,5 miliardy let do jednoho filmu).
- **Pohyb** dodržuje Keplera: vnitřek disku obíhá rychleji než okraj,
  oběžná rychlost ~ r^(−1/2). Žádná tuhá rotace disku jako dnes.
- **Místa** jsou skutečná: sněžná čára ~2,7 AU, Jupiter vzniká na své dráze,
  Neptun začíná blíž (~20 AU) a odstěhuje se.
- **Kde si věda není jistá**, popisek to řekne („nejspíš", „podle modelu
  z Nice"). Ukazujeme nejlíp doloženou variantu, ne tu nejefektnější.
- Velikosti těles zůstávají zvětšené jako ve zbytku aplikace (Pochopení);
  vzdálenosti v módu Fyzikální jsou věrné.

## Scény

Čas filmu (s) → skutečný čas od vzniku prvních pevných zrn (CAI,
**4,567 mld let** zpátky, Connelly et al. 2012).

| # | film (s) | skutečně | co se děje |
|---|---|---|---|
| 1 | 0–8 | před vznikem | chladný molekulový mrak (zploštělá koule ~1,35× disk), pomalu se točí |
| 2 | 8–12 | před vznikem | supernova v dálce, mrakem projde rázová vlna (zjasní a postrčí) |
| 3 | 12–20 | 0–100 tis. let | kolaps zevnitř ven, roztočení do disku, protohvězda tmavě rudá |
| 4 | 20–28 | 0,1–0,5 mil. | keplerovský disk (ω ~ r^−3/2), sněžná čára, plyn šedomodrý a řidší |
| 5 | 28–38 | 0,5–3 mil. | Jupiter první, Saturn, Mars (brzy), Uran, Neptun; obři pohltí plyn své zóny; měsíce obrů |
| 6 | 38–44 | 3–5 mil. | plyn kamenných zón odfouknut ven |
| 7 | 44–54 | 5–30 mil. | Merkur, Venuše, Země rostou z planetesimál |
| 8 | 54–58 | 30–40 mil. | zážeh fúze: záblesk, Slunce z rudé do plných barev, trvalá záře |
| 9 | 58–64 | 40–60 mil. | stěhování obrů (etapa F), Triton |
| 10 | 64–70 | 60–100 mil. | srážka s Theiou (etapa E), Měsíc |
| 11 | 70–76 | → dnes | dráhy se dokreslí zevnitř ven, kamera do přehledu |

Ověřeno (2026-10-13): Jupiter jádro ~20 M⊕ do 1 mil. let, mezera v disku
1–4 mil. let (Kruijer et al. 2017, PNAS); plyn pryč do ~4 mil. let
(Wang et al. 2017, Science, paleomagnetismus angritů); srážka s Theiou
odhady 30–220 mil. let, spor (Schneider & Kleine 2025: ~65 ± 20) — popisek
proto „kdy přesně, se neví"; nestabilita obrů ~60 mil. let (Avdellidou
et al. 2024, Science), Neptun začínal na ~20–25 AU.

Zdroje k ověření před psaním textů: Connelly 2012 (CAI), Kruijer 2017
(Jupiter ~1 mil. let), Wang 2017 (plyn pryč do ~4 mil. let), Dauphas &
Pourmand 2011 (Mars 2–4 mil. let), Canup 2012 / datace Měsíce, Nesvorný 2018
(nestabilita obrů brzy). Čísla v popiscích se musí shodovat se zdroji.

## Ovládání

78 s při každém načtení je moc. Návrh: celý film při první návštěvě,
pak rovnou přehled. Tlačítko „VZNIK" ho pustí znovu a dá se přeskočit
(tlačítko i Esc). V prohlídce na televizi může být jako jedna ze zastávek.

## Etapy

- **A+B — hotovo 2026-10-13** (osa, ovládání, mrak, kolaps): `animation.js`
  (SCENES, realYearsAt), `formationIntro.js`, `filmCaption.js`.
- **A — osa a ovládání**: nová časová osa scén, počítadlo skutečného času,
  popisky, přeskočení / znovu přehrát, jízda kamery přes všechny scény.
  Dnešní mechaniky (disk, akrece, měsíce) přemapované na nové pořadí
  (Jupiter první, Země poslední).
- **B — mrak a kolaps**: 3D mrak, rázová vlna, zploštění do disku.
- **C — Keplerovský disk**: diferenciální rotace, sněžná čára, mezera
  po Jupiteru.
- **D — vyfoukání plynu** a zážeh fúze.
- **E — Theia a Měsíc**.
- **F — stěhování obrů**: radiální posun drah Uranu a Neptunu během
  formace, rozmetané zbytky.

Každá etapa se nasadí zvlášť a jde vidět.
