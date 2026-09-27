# Co vzít z gcdatlas

[gcdatlas](https://github.com/eshin087/gcdatlas) (živě gcdatlas.vercel.app) —
atlas vesmíru kreslený ASCII znaky: ~2 000 hvězd na skutečných místech,
galaxie, černé díry, prohlídky s přelety mezi tělesy.

**Repo nemá licenci** → kód se nekopíruje, bereme nápady, publikované
algoritmy a otevřená data (d3-celestial BSD-3, Hipparcos).

## Pořadí

1. **Přelety** — hotovo 2026-09-27 (`src/flightPath.js`). Dráha
   van Wijk & Nuij 2003 („Smooth and efficient zooming and panning"):
   dlouhý skok se oddálí, až jsou vidět oba konce, a snese se k cíli; krátký
   je skoro jen posun. Délka letu z délky dráhy (0,8–4 s), směr pohledu po
   oblouku, v cíli dosedá pomaleji než vyráží. Za letu jde přesměrovat.
   Cestou opraveny dvě starší chyby: `controls.update()` ořezával každý snímek
   letu na `minDistance` 5000 (let vypadal jako skok a cvak) a návrat /
   přeskok detail → detail startoval s cílem pohledu na Slunci.
2. **Po příletu** — pomalý oblet a střídání 2–3 připravených úhlů, dokud
   uživatel nechytne kameru; u Saturnu průlet rovinou prstence, u Slunce
   let těsně nad povrchem a odjezd (gcdatlas „flybys": vzdálenosti
   v poloměrech tělesa, takže jeden recept platí pro všechna).
3. **Skutečná obloha** — hotovo 2026-09-27 (`src/sky.js`). Místo 1 500
   náhodných bílých bodů 5 044 hvězd do mag 6 (d3-celestial `stars.6.json`)
   s barvou z B–V (Ballesteros → černé těleso, zjemněno k bílé) a velikostí
   a jasem z magnitudy, natočené přes `poleToScene` (EQJ → scéna). Mléčná
   dráha: 15 200 teček rovnoměrně po pěti konturách jasu z `mw.json`, jádro
   ve Střelci. Koule jede s kamerou → žádná paralaxa. Data v `src/skyData.js`
   (base64, 152 kB), build `scripts/build-sky.mjs` (~2 min, deterministický).
   Na CPU rendereru (swiftshader) stojí ~10–20 % snímků, na GPU zanedbatelné.
4. **Prohlídka** — seznam zastávek s českými popisky, `[` `]` mezi nimi;
   bez zásahu jede dokola → spořič na televizi.

## Co nebrat

- ASCII vykreslování — Dots má vlastní tečkovou identitu.
- Galaxie, černé díry, živé satelity a starty — mimo rozsah sluneční
  soustavy (a satelity by chtěly API ven).
- `Tonight`/poloha — geolokace přes http na LAN nefunguje.

Poctivost (jejich `docs/ACCURACY.md`): každá zvětšenina / zrychlení má říct,
že je zvětšená. Stojí za vlastní krátkou českou verzi.
