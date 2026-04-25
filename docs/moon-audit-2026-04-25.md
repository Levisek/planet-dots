# Moon Audit — V4.2 (2026-04-25)

Reálná astronomická data vs. aktuální `moons.js`. Kontrola period, retrográdního pohybu, eccentricity.

## Konvence

- `period` v `moons.js` = sec pro plný oběh kolem rodičovské planety (compressed time scale).
- Cíl: zachovat **relativní poměry period uvnitř rodiny** (Io:Europa:Ganymede:Callisto = real ratios).
- Eccentricity clamp na ≤0.3 (větší by způsobilo vizuálně rušivý wobble).
- `retrograde: true` flag flipuje směr orbity (CCW → CW seen from north).

## Tabulka

| Moon | Real period | Real e | Retrograde | Aktuální period | Aktuální e | Aktuální retro | Status |
|------|------------:|-------:|------------|----------------:|-----------:|---------------:|--------|
| **Luna** (Earth) | 27.32 d | 0.055 | ne | 20 | 0.275 | – | ⚠ e moc vysoké (5×) |
| **Phobos** (Mars) | 0.319 d (7.66h) | 0.015 | ne | 2 | 0.1 | – | ⚠ e vysoké (6×) |
| **Deimos** (Mars) | 1.262 d (30.3h) | 0.0002 | ne | 8 | 0.05 | – | ⚠ e moc vysoké (250×) — ale ratio Phobos:Deimos = 1:4 ✓ |
| **Io** (Jupiter) | 1.769 d | 0.004 | ne | 5 | 0.04 | – | ⚠ e moc vysoké (10×) |
| **Europa** (Jupiter) | 3.551 d | 0.009 | ne | 10 | 0.09 | – | ⚠ e moc vysoké (10×) |
| **Ganymede** (Jupiter) | 7.155 d | 0.001 | ne | 20 | 0.02 | – | ⚠ e moc vysoké (20×) |
| **Callisto** (Jupiter) | 16.689 d | 0.007 | ne | 47 | 0.07 | – | ⚠ e moc vysoké (10×) |
| **Mimas** (Saturn) | 0.942 d | 0.020 | ne | 3 | 0.2 | – | ⚠ e moc vysoké (10×) |
| **Enceladus** (Saturn) | 1.370 d | 0.005 | ne | 4.3 | 0.05 | – | ⚠ e moc vysoké (10×) |
| **Tethys** (Saturn) | 1.888 d | 0.0001 | ne | 6 | 0.02 | – | ⚠ e moc vysoké (200×) |
| **Dione** (Saturn) | 2.737 d | 0.002 | ne | 8.7 | 0.02 | – | ⚠ e moc vysoké (10×) |
| **Rhea** (Saturn) | 4.518 d | 0.001 | ne | 14.3 | 0.02 | – | ⚠ e moc vysoké (20×) |
| **Titan** (Saturn) | 15.945 d | 0.029 | ne | 50 | 0.2 | – | ⚠ e moc vysoké (7×) |
| **Iapetus** (Saturn) | 79.32 d | 0.029 | ne | 60 | 0.2 | – | ⚠ period MOC krátké (real 79.32, aktuální 60 — by mělo být ~250 vs Mimas 3 = ratio 84) |
| **Miranda** (Uranus) | 1.413 d | 0.001 | ne | 4 | 0.02 | – | ⚠ e moc vysoké (20×) |
| **Ariel** (Uranus) | 2.520 d | 0.001 | ne | 7 | 0.02 | – | ⚠ e moc vysoké (20×) |
| **Umbriel** (Uranus) | 4.144 d | 0.004 | ne | 12 | 0.04 | – | ⚠ e moc vysoké (10×) |
| **Titania** (Uranus) | 8.706 d | 0.001 | ne | 25 | 0.02 | – | ⚠ e moc vysoké (20×) |
| **Oberon** (Uranus) | 13.463 d | 0.001 | ne | 38 | 0.02 | – | ⚠ e moc vysoké (20×) |
| **Triton** (Neptune) | 5.877 d | 0.000016 | **ANO** ✓ | 6 | 0.001 | true ✓ | ✅ retrograde flag aktivní |
| **Nereid** (Neptune) | 360.13 d | 0.751 | ne | 36 | 0.3 | – | ⚠ period extrémně krátké (real 360 → ratio Triton:Nereid = 1:61 ≈ aktuální 6:36 = 1:6) |
| **Proteus** (Neptune) | 1.122 d | 0.0005 | ne | 1.1 | 0.005 | – | ✅ period ratio (Proteus rychlejší než Triton) |

## Problémy

### 1. Eccentricity globálně 5–250× vyšší než real
Komentář v `moons.js:3` řekne "real × ~7, clamp ≤ 0.3" — záměrně zveličené pro vizuální oblouk. Pro real-fyzikální mode by se mělo brát **real e**, default mode může mít zveličené. Ale aktuálně eccentricity je v default mode přehnané.

**Doporučení:** snížit globálně ~50× (clamp 0.05). Real moony (mimo Nereid) jsou téměř kruhové.

### 2. Iapetus period
Iapetus: real 79.32 d, Mimas 0.942 d → ratio 84:1. Aktuálně 60:3 = 20:1. Iapetus by měl mít period ≈250 (3 × 84) — výrazně pomalejší než Titan.

### 3. Nereid period
Nereid je extrémně eccentrická (real e=0.75) a má 360-day period. Aktuálně 36s je 10× moc rychle. Buď zachovat e=0.3 + period ~360 nebo zachovat compressed period 36 + e zvýšit. **Reálné je extreme** — je to "outlier" měsíc.

### 4. Triton retrograde
✅ Funguje díky `retrograde: true` flag a fix v `main.js` (negative period flip).

## Návrh fix

```js
// e clamp 0.02 default (téměř kruhové, jen Nereid 0.3)
// Iapetus period 250
// Nereid period 360 nebo zachovat 36 + dokumentovat compressed
```

Toto je věc rozhodnutí — buď fyzikální real (Triton fast, Iapetus 84× pomaleji) nebo "vizuálně srozumitelné" (Iapetus 20× pomaleji ať se uživatel nenudí čekáním). User volba.
