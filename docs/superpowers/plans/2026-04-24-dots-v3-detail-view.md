# V3 Detail View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Přidat click → pauza + fly-to + detail view pro 28 těles s info panelem, real-scale toggle, drag-to-orbit; plus živé Slunce (sunspots + erupce).

**Architecture:** HTML overlay (tooltip + info panel) + raycast invisible mesh sféry pro hit test. Jediný scene graph — při vstupu do DETAIL fade-out ostatních těles via per-owner alpha multiplier v shaderu, hlavní animace pauzně, rotace + Kepler orbit update běží dál. `OrbitControls` zapnutý pouze v DETAIL. Sunspots = lerp barvy existujících Sun teček, prominence = reuse FLYING phase s parabolickou trajektorií.

**Tech Stack:** three.js 0.170 (import map), vanilla JS ES modules, CSS (inline v `index.html`), node:test pro unit testy.

---

## Task 1 — Import mapa, reálné vzdálenostní fieldy

Předchozí patch do dat + import OrbitControls do import map (potřebujeme v pozdějších taskách).

**Files:**
- Modify: `index.html`
- Modify: `src/planets.js`
- Modify: `src/moons.js`

- [ ] **Step 1.1: Přidat OrbitControls do importmap**

V `index.html` uprav `<script type="importmap">`:

```html
<script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
    }
  }
</script>
```

- [ ] **Step 1.2: Přidat reálnou vzdálenost Slunce-planeta**

V `src/planets.js` doplň pole `realDistanceFromSunKm` ke každé planetě (Slunce = 0):

```js
// sun
realDistanceFromSunKm: 0,
// mercury
realDistanceFromSunKm: 57_909_000,
// venus
realDistanceFromSunKm: 108_209_000,
// earth
realDistanceFromSunKm: 149_598_000,
// mars
realDistanceFromSunKm: 227_944_000,
// jupiter
realDistanceFromSunKm: 778_340_000,
// saturn
realDistanceFromSunKm: 1_426_666_000,
// uranus
realDistanceFromSunKm: 2_870_658_000,
// neptune
realDistanceFromSunKm: 4_498_396_000,
```

Každé planetě přidej řádek mezi existující fieldy (např. za `color:`).

- [ ] **Step 1.3: Přidat reálnou semi-major axis měsíců**

V `src/moons.js` doplň ke každému měsíci `realSemiMajorAxisKm`:

```js
// luna
realSemiMajorAxisKm: 384_400,
// phobos
realSemiMajorAxisKm: 9_376,
// deimos
realSemiMajorAxisKm: 23_463,
// io
realSemiMajorAxisKm: 421_700,
// europa
realSemiMajorAxisKm: 671_034,
// ganymede
realSemiMajorAxisKm: 1_070_400,
// callisto
realSemiMajorAxisKm: 1_882_700,
// titan
realSemiMajorAxisKm: 1_221_870,
// rhea
realSemiMajorAxisKm: 527_108,
// iapetus
realSemiMajorAxisKm: 3_560_820,
// dione
realSemiMajorAxisKm: 377_396,
// tethys
realSemiMajorAxisKm: 294_619,
// enceladus
realSemiMajorAxisKm: 237_948,
// mimas
realSemiMajorAxisKm: 185_539,
// miranda
realSemiMajorAxisKm: 129_390,
// ariel
realSemiMajorAxisKm: 191_020,
// umbriel
realSemiMajorAxisKm: 266_000,
// titania
realSemiMajorAxisKm: 435_910,
// oberon
realSemiMajorAxisKm: 583_520,
```

- [ ] **Step 1.4: Ověř, že existující testy stále projdou**

Run: `cd C:/dev/planet-dots && npm test`
Expected: `pass 38` (nic nepadlo, existing tests don't check these new fields).

- [ ] **Step 1.5: Commit**

```bash
git add index.html src/planets.js src/moons.js
git commit -m "V3 T1: OrbitControls import + real-world distance fields"
```

---

## Task 2 — `bodyData.js` (28 objektů s českými texty a fakty)

Jeden zdroj pravdy pro info panel. Volitelně se napíše ručně (informace z NASA/Wikipedie, bez externí validace — ok podle brainstormingu).

**Files:**
- Create: `src/bodyData.js`
- Create: `src/bodyData.test.js`

- [ ] **Step 2.1: Napiš failing schema test**

Vytvoř `src/bodyData.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODY_DATA } from './bodyData.js';
import { PLANETS } from './planets.js';
import { MOONS } from './moons.js';

test('BODY_DATA obsahuje záznam pro každou planetu', () => {
  for (const p of PLANETS) {
    assert.ok(BODY_DATA[p.id], `Chybí bodyData pro ${p.id}`);
  }
});

test('BODY_DATA obsahuje záznam pro každý měsíc', () => {
  for (const m of MOONS) {
    assert.ok(BODY_DATA[m.id], `Chybí bodyData pro ${m.id}`);
  }
});

test('každý záznam má povinná pole', () => {
  const required = ['name', 'kind', 'tagline', 'fields', 'funFact'];
  for (const [id, data] of Object.entries(BODY_DATA)) {
    for (const key of required) {
      assert.ok(key in data, `${id} postrádá pole ${key}`);
    }
    assert.ok(data.tagline.length > 0, `${id} tagline je prázdný`);
    assert.ok(data.funFact.length > 0, `${id} funFact je prázdný`);
    assert.ok(['sun', 'planet', 'moon'].includes(data.kind), `${id} kind = ${data.kind}`);
    assert.ok(Array.isArray(data.fields) && data.fields.length >= 6, `${id} fields musí být pole s ≥6 řádky`);
    for (const row of data.fields) {
      assert.equal(typeof row.label, 'string');
      assert.equal(typeof row.value, 'string');
    }
  }
});

test('český text obsahuje diakritiku u alespoň 5 záznamů', () => {
  const hasDiacritics = (s) => /[áčďéěíňóřšťúůýž]/i.test(s);
  let count = 0;
  for (const d of Object.values(BODY_DATA)) {
    if (hasDiacritics(d.tagline) || hasDiacritics(d.funFact)) count++;
  }
  assert.ok(count >= 5, `diakritika nalezena jen u ${count} záznamů`);
});
```

- [ ] **Step 2.2: Spusť test — má selhat (soubor neexistuje)**

Run: `npm test`
Expected: FAIL — `Cannot find module './bodyData.js'`.

- [ ] **Step 2.3: Vytvoř `src/bodyData.js` se všemi 28 objekty**

Struktura: `export const BODY_DATA = { [id]: { name, kind, tagline, fields: [{label, value}, ...], funFact } }`.

```js
// BODY_DATA — 28 těles, česká edukační data pro detail view info panel.
// Zdroje: NASA Solar System Exploration + cs.wikipedia.org (psáno ručně, 2026-04).
// Hodnoty jsou reprezentativní / zaokrouhlené pro čitelnost, ne přesné na desetinné místo.

export const BODY_DATA = {
  sun: {
    name: 'Slunce',
    kind: 'sun',
    tagline: 'Hvězda hlavní posloupnosti, střed naší soustavy.',
    fields: [
      { label: 'Průměr', value: '1 392 700 km (109× Země)' },
      { label: 'Hmota', value: '1,99×10³⁰ kg (333 000× Země)' },
      { label: 'Povrchová teplota', value: '~5 500 °C' },
      { label: 'Teplota jádra', value: '~15 milionů °C' },
      { label: 'Stáří', value: '~4,6 miliardy let' },
      { label: 'Rotační perioda (rovník)', value: '25 dní' },
      { label: 'Složení', value: '73 % vodík, 25 % helium' },
      { label: 'Vzdálenost od Země', value: '149,6 mil. km (1 AU)' },
      { label: 'Sluneční cyklus', value: '~11 let (skvrny)' },
    ],
    funFact: 'Světlo ze Slunce k nám letí 8 minut a 20 sekund — když se Slunce právě podívalo, na Zemi ještě svítí jeho minulost.',
  },

  mercury: {
    name: 'Merkur',
    kind: 'planet',
    tagline: 'Nejmenší a nejbližší planeta Slunci.',
    fields: [
      { label: 'Průměr', value: '4 879 km' },
      { label: 'Hmota', value: '3,30×10²³ kg (0,055× Země)' },
      { label: 'Den', value: '58,6 pozemských dní' },
      { label: 'Rok', value: '88 pozemských dní' },
      { label: 'Počet měsíců', value: '0' },
      { label: 'Atmosféra', value: 'prakticky žádná' },
      { label: 'Povrchová teplota', value: '−173 až +427 °C' },
      { label: 'Gravitace', value: '3,7 m/s²' },
      { label: 'Vzdálenost od Slunce', value: '57,9 mil. km' },
    ],
    funFact: 'Den na Merkuru trvá dvakrát déle než jeho rok — než se jednou otočí kolem osy, stihne dvakrát oběhnout Slunce.',
  },

  venus: {
    name: 'Venuše',
    kind: 'planet',
    tagline: 'Nejteplejší planeta, skleníkové peklo.',
    fields: [
      { label: 'Průměr', value: '12 104 km' },
      { label: 'Hmota', value: '4,87×10²⁴ kg (0,815× Země)' },
      { label: 'Den', value: '243 pozemských dní (retrográdně)' },
      { label: 'Rok', value: '225 pozemských dní' },
      { label: 'Počet měsíců', value: '0' },
      { label: 'Atmosféra', value: 'CO₂ 96 %, dusík 3 %' },
      { label: 'Povrchová teplota', value: '~462 °C' },
      { label: 'Gravitace', value: '8,87 m/s²' },
      { label: 'Vzdálenost od Slunce', value: '108,2 mil. km' },
    ],
    funFact: 'Na Venuši Slunce vychází na západě a zapadá na východě — planeta se otáčí opačným směrem než ostatní.',
  },

  earth: {
    name: 'Země',
    kind: 'planet',
    tagline: 'Modrá planeta, jediný známý domov života.',
    fields: [
      { label: 'Průměr', value: '12 742 km' },
      { label: 'Hmota', value: '5,97×10²⁴ kg' },
      { label: 'Den', value: '24 hodin' },
      { label: 'Rok', value: '365,25 dne' },
      { label: 'Počet měsíců', value: '1 (Luna)' },
      { label: 'Atmosféra', value: '78 % dusík, 21 % kyslík' },
      { label: 'Povrchová teplota', value: '−89 až +58 °C (průměr 15 °C)' },
      { label: 'Gravitace', value: '9,81 m/s²' },
      { label: 'Vzdálenost od Slunce', value: '149,6 mil. km (1 AU)' },
    ],
    funFact: '71 % zemského povrchu pokrývá voda, ale jen 3 % jsou sladká — a většina té je zamrzlá v ledovcích.',
  },

  mars: {
    name: 'Mars',
    kind: 'planet',
    tagline: 'Rudá planeta, kandidát na kolonizaci.',
    fields: [
      { label: 'Průměr', value: '6 779 km' },
      { label: 'Hmota', value: '6,42×10²³ kg (0,107× Země)' },
      { label: 'Den', value: '24 h 37 min' },
      { label: 'Rok', value: '687 pozemských dní' },
      { label: 'Počet měsíců', value: '2 (Phobos, Deimos)' },
      { label: 'Atmosféra', value: 'CO₂ 95 %, velmi řídká' },
      { label: 'Povrchová teplota', value: '−140 až +20 °C' },
      { label: 'Gravitace', value: '3,71 m/s²' },
      { label: 'Vzdálenost od Slunce', value: '227,9 mil. km' },
    ],
    funFact: 'Olympus Mons na Marsu je nejvyšší známá hora sluneční soustavy — 22 km vysoká, třikrát vyšší než Everest.',
  },

  jupiter: {
    name: 'Jupiter',
    kind: 'planet',
    tagline: 'Plynný obr, největší planeta soustavy.',
    fields: [
      { label: 'Průměr', value: '139 820 km (11× Země)' },
      { label: 'Hmota', value: '1,90×10²⁷ kg (318× Země)' },
      { label: 'Den', value: '9 h 56 min' },
      { label: 'Rok', value: '11,86 let' },
      { label: 'Počet měsíců', value: '95 známých (4 hlavní galilejské)' },
      { label: 'Atmosféra', value: 'vodík 90 %, helium 10 %' },
      { label: 'Povrchová teplota', value: '−145 °C (vrchol mraků)' },
      { label: 'Gravitace', value: '24,8 m/s²' },
      { label: 'Vzdálenost od Slunce', value: '778,3 mil. km' },
    ],
    funFact: 'Velká rudá skvrna je bouře větší než Země, která zuří už přes 350 let.',
  },

  saturn: {
    name: 'Saturn',
    kind: 'planet',
    tagline: 'Plynný obr s ikonickými prstenci z ledu.',
    fields: [
      { label: 'Průměr', value: '116 460 km' },
      { label: 'Hmota', value: '5,68×10²⁶ kg (95× Země)' },
      { label: 'Den', value: '10 h 42 min' },
      { label: 'Rok', value: '29,5 let' },
      { label: 'Počet měsíců', value: '146 známých (Titan největší)' },
      { label: 'Atmosféra', value: 'vodík 96 %, helium 3 %' },
      { label: 'Povrchová teplota', value: '−178 °C' },
      { label: 'Gravitace', value: '10,4 m/s²' },
      { label: 'Vzdálenost od Slunce', value: '1,43 mld. km' },
    ],
    funFact: 'Saturn je tak málo hustý, že by na dostatečně velikém oceánu plaval — je lehčí než voda.',
  },

  uranus: {
    name: 'Uran',
    kind: 'planet',
    tagline: 'Ledový obr, který leží na boku.',
    fields: [
      { label: 'Průměr', value: '50 724 km' },
      { label: 'Hmota', value: '8,68×10²⁵ kg (14,5× Země)' },
      { label: 'Den', value: '17 h 14 min (retrográdně)' },
      { label: 'Rok', value: '84 let' },
      { label: 'Počet měsíců', value: '28 známých' },
      { label: 'Atmosféra', value: 'vodík, helium, metan' },
      { label: 'Povrchová teplota', value: '−224 °C' },
      { label: 'Gravitace', value: '8,87 m/s²' },
      { label: 'Vzdálenost od Slunce', value: '2,87 mld. km' },
    ],
    funFact: 'Uran rotuje téměř přesně na boku — jeho osa je nakloněná 98°, takže na pólech trvá léto 42 pozemských let.',
  },

  neptune: {
    name: 'Neptun',
    kind: 'planet',
    tagline: 'Nejvzdálenější planeta, nejsilnější větry.',
    fields: [
      { label: 'Průměr', value: '49 244 km' },
      { label: 'Hmota', value: '1,02×10²⁶ kg (17× Země)' },
      { label: 'Den', value: '16 hodin' },
      { label: 'Rok', value: '165 let' },
      { label: 'Počet měsíců', value: '16 známých (Triton největší)' },
      { label: 'Atmosféra', value: 'vodík, helium, metan' },
      { label: 'Povrchová teplota', value: '−218 °C' },
      { label: 'Gravitace', value: '11,15 m/s²' },
      { label: 'Vzdálenost od Slunce', value: '4,50 mld. km' },
    ],
    funFact: 'Větry na Neptunu dosahují 2 100 km/h — nejrychlejší v celé sluneční soustavě, přestože je nejdál od Slunce.',
  },

  luna: {
    name: 'Luna',
    kind: 'moon',
    tagline: 'Jediný přirozený měsíc Země.',
    fields: [
      { label: 'Průměr', value: '3 474 km' },
      { label: 'Hmota', value: '7,35×10²² kg' },
      { label: 'Den', value: '27,3 pozemských dní (tidálně zamčeno)' },
      { label: 'Vzdálenost od Země', value: '384 400 km' },
      { label: 'Atmosféra', value: 'prakticky žádná' },
      { label: 'Povrchová teplota', value: '−173 až +127 °C' },
      { label: 'Gravitace', value: '1,62 m/s²' },
      { label: 'Mateřská planeta', value: 'Země' },
      { label: 'Objevitel', value: 'pozorovaná od pravěku' },
    ],
    funFact: 'Luna se od Země vzdaluje o 3,8 cm ročně — když vymřeli dinosauři, byla o 2,5 km blíž než dnes.',
  },

  phobos: {
    name: 'Phobos',
    kind: 'moon',
    tagline: 'Větší a bližší z marsovských měsíčků.',
    fields: [
      { label: 'Průměr', value: '22 km' },
      { label: 'Hmota', value: '1,07×10¹⁶ kg' },
      { label: 'Den', value: '7 h 39 min (tidálně zamčeno)' },
      { label: 'Vzdálenost od Marsu', value: '9 376 km' },
      { label: 'Atmosféra', value: 'žádná' },
      { label: 'Povrchová teplota', value: '~−40 °C' },
      { label: 'Gravitace', value: '0,0057 m/s²' },
      { label: 'Mateřská planeta', value: 'Mars' },
      { label: 'Objevitel', value: 'Asaph Hall, 1877' },
    ],
    funFact: 'Phobos spadne za 50 milionů let na Mars — jeho orbita se spirálou blíží k planetě.',
  },

  deimos: {
    name: 'Deimos',
    kind: 'moon',
    tagline: 'Menší a vzdálenější marsovský měsíc.',
    fields: [
      { label: 'Průměr', value: '12 km' },
      { label: 'Hmota', value: '1,48×10¹⁵ kg' },
      { label: 'Den', value: '30 h (tidálně zamčeno)' },
      { label: 'Vzdálenost od Marsu', value: '23 463 km' },
      { label: 'Atmosféra', value: 'žádná' },
      { label: 'Povrchová teplota', value: '~−40 °C' },
      { label: 'Gravitace', value: '0,003 m/s²' },
      { label: 'Mateřská planeta', value: 'Mars' },
      { label: 'Objevitel', value: 'Asaph Hall, 1877' },
    ],
    funFact: 'Z Marsu by Deimos vypadal jako jasná hvězda — je příliš malý, aby byl vidět jako kotouč pouhým okem.',
  },

  io: {
    name: 'Io',
    kind: 'moon',
    tagline: 'Nejvulkaničtější těleso sluneční soustavy.',
    fields: [
      { label: 'Průměr', value: '3 643 km' },
      { label: 'Hmota', value: '8,93×10²² kg' },
      { label: 'Den', value: '1,77 dne (tidálně zamčeno)' },
      { label: 'Vzdálenost od Jupiteru', value: '421 700 km' },
      { label: 'Atmosféra', value: 'SO₂, velmi řídká' },
      { label: 'Povrchová teplota', value: '−143 °C (sopky +1 600 °C)' },
      { label: 'Gravitace', value: '1,80 m/s²' },
      { label: 'Mateřská planeta', value: 'Jupiter' },
      { label: 'Objevitel', value: 'Galileo Galilei, 1610' },
    ],
    funFact: 'Io má přes 400 aktivních sopek a její povrch mění každou erupci — nejsou na něm žádné meteorické krátery, všechny byly už přelity lávou.',
  },

  europa: {
    name: 'Europa',
    kind: 'moon',
    tagline: 'Ledový měsíc s oceánem pod krustou.',
    fields: [
      { label: 'Průměr', value: '3 122 km' },
      { label: 'Hmota', value: '4,80×10²² kg' },
      { label: 'Den', value: '3,55 dne (tidálně zamčeno)' },
      { label: 'Vzdálenost od Jupiteru', value: '671 034 km' },
      { label: 'Atmosféra', value: 'kyslík, velmi řídká' },
      { label: 'Povrchová teplota', value: '−160 °C' },
      { label: 'Gravitace', value: '1,31 m/s²' },
      { label: 'Mateřská planeta', value: 'Jupiter' },
      { label: 'Objevitel', value: 'Galileo Galilei, 1610' },
    ],
    funFact: 'Pod ledovou slupkou Europy je oceán tekuté vody — možná obsahuje dvakrát víc vody než všechny pozemské oceány dohromady.',
  },

  ganymede: {
    name: 'Ganymede',
    kind: 'moon',
    tagline: 'Největší měsíc sluneční soustavy.',
    fields: [
      { label: 'Průměr', value: '5 268 km (větší než Merkur)' },
      { label: 'Hmota', value: '1,48×10²³ kg' },
      { label: 'Den', value: '7,15 dne (tidálně zamčeno)' },
      { label: 'Vzdálenost od Jupiteru', value: '1 070 400 km' },
      { label: 'Atmosféra', value: 'řídký kyslík' },
      { label: 'Povrchová teplota', value: '−163 °C' },
      { label: 'Gravitace', value: '1,43 m/s²' },
      { label: 'Mateřská planeta', value: 'Jupiter' },
      { label: 'Objevitel', value: 'Galileo Galilei, 1610' },
    ],
    funFact: 'Ganymede je jediný měsíc s vlastním magnetickým polem — a pravděpodobně má pod ledem podpovrchový oceán.',
  },

  callisto: {
    name: 'Callisto',
    kind: 'moon',
    tagline: 'Nejstarší povrch ve sluneční soustavě.',
    fields: [
      { label: 'Průměr', value: '4 820 km' },
      { label: 'Hmota', value: '1,08×10²³ kg' },
      { label: 'Den', value: '16,7 dne (tidálně zamčeno)' },
      { label: 'Vzdálenost od Jupiteru', value: '1 882 700 km' },
      { label: 'Atmosféra', value: 'CO₂, velmi řídká' },
      { label: 'Povrchová teplota', value: '−139 °C' },
      { label: 'Gravitace', value: '1,24 m/s²' },
      { label: 'Mateřská planeta', value: 'Jupiter' },
      { label: 'Objevitel', value: 'Galileo Galilei, 1610' },
    ],
    funFact: 'Callisto má nejhustěji pokrátrovaný povrch ve sluneční soustavě — je jako kosmický záznamník historie.',
  },

  titan: {
    name: 'Titan',
    kind: 'moon',
    tagline: 'Měsíc s hustou atmosférou a metanovými jezery.',
    fields: [
      { label: 'Průměr', value: '5 150 km' },
      { label: 'Hmota', value: '1,35×10²³ kg' },
      { label: 'Den', value: '15,9 dne (tidálně zamčeno)' },
      { label: 'Vzdálenost od Saturnu', value: '1 221 870 km' },
      { label: 'Atmosféra', value: 'dusík 94 %, metan 6 %' },
      { label: 'Povrchová teplota', value: '−179 °C' },
      { label: 'Gravitace', value: '1,35 m/s²' },
      { label: 'Mateřská planeta', value: 'Saturn' },
      { label: 'Objevitel', value: 'Christiaan Huygens, 1655' },
    ],
    funFact: 'Na Titanu prší metan — má jezera a řeky z tekutých uhlovodíků, jediné stabilní povrchové tekutiny mimo Zemi.',
  },

  rhea: {
    name: 'Rhea',
    kind: 'moon',
    tagline: 'Druhý největší saturnův měsíc.',
    fields: [
      { label: 'Průměr', value: '1 527 km' },
      { label: 'Hmota', value: '2,31×10²¹ kg' },
      { label: 'Den', value: '4,52 dne (tidálně zamčeno)' },
      { label: 'Vzdálenost od Saturnu', value: '527 108 km' },
      { label: 'Atmosféra', value: 'velmi řídká (kyslík, CO₂)' },
      { label: 'Povrchová teplota', value: '−174 °C' },
      { label: 'Gravitace', value: '0,26 m/s²' },
      { label: 'Mateřská planeta', value: 'Saturn' },
      { label: 'Objevitel', value: 'Giovanni Cassini, 1672' },
    ],
    funFact: 'Rhea je pravděpodobně jediný známý měsíc s vlastními prstenci — slabé, ale detekovatelné.',
  },

  iapetus: {
    name: 'Iapetus',
    kind: 'moon',
    tagline: 'Měsíc se dvěma tvářemi — jednou černou, druhou bílou.',
    fields: [
      { label: 'Průměr', value: '1 470 km' },
      { label: 'Hmota', value: '1,81×10²¹ kg' },
      { label: 'Den', value: '79,3 dne (tidálně zamčeno)' },
      { label: 'Vzdálenost od Saturnu', value: '3 560 820 km' },
      { label: 'Atmosféra', value: 'žádná' },
      { label: 'Povrchová teplota', value: '−143 °C' },
      { label: 'Gravitace', value: '0,22 m/s²' },
      { label: 'Mateřská planeta', value: 'Saturn' },
      { label: 'Objevitel', value: 'Giovanni Cassini, 1671' },
    ],
    funFact: 'Iapetus má rovníkový hřeben vysoký 20 km, který obtáčí téměř celou polokouli — nikdo neví, jak vznikl.',
  },

  dione: {
    name: 'Dione',
    kind: 'moon',
    tagline: 'Ledový saturnův měsíc s útesy.',
    fields: [
      { label: 'Průměr', value: '1 123 km' },
      { label: 'Hmota', value: '1,10×10²¹ kg' },
      { label: 'Den', value: '2,74 dne (tidálně zamčeno)' },
      { label: 'Vzdálenost od Saturnu', value: '377 396 km' },
      { label: 'Atmosféra', value: 'stopově kyslík' },
      { label: 'Povrchová teplota', value: '−186 °C' },
      { label: 'Gravitace', value: '0,23 m/s²' },
      { label: 'Mateřská planeta', value: 'Saturn' },
      { label: 'Objevitel', value: 'Giovanni Cassini, 1684' },
    ],
    funFact: 'Světlé pruhy na Dione, které z dálky vypadaly jako mraky, jsou ve skutečnosti ledové útesy vysoké stovky metrů.',
  },

  tethys: {
    name: 'Tethys',
    kind: 'moon',
    tagline: 'Saturnův měsíc s obřím kráterem Odysseus.',
    fields: [
      { label: 'Průměr', value: '1 062 km' },
      { label: 'Hmota', value: '6,17×10²⁰ kg' },
      { label: 'Den', value: '1,89 dne (tidálně zamčeno)' },
      { label: 'Vzdálenost od Saturnu', value: '294 619 km' },
      { label: 'Atmosféra', value: 'žádná' },
      { label: 'Povrchová teplota', value: '−187 °C' },
      { label: 'Gravitace', value: '0,15 m/s²' },
      { label: 'Mateřská planeta', value: 'Saturn' },
      { label: 'Objevitel', value: 'Giovanni Cassini, 1684' },
    ],
    funFact: 'Kráter Odysseus má průměr 450 km — dvě pětiny průměru celého Tethyse.',
  },

  enceladus: {
    name: 'Enceladus',
    kind: 'moon',
    tagline: 'Ledový měsíc s gejzíry tekuté vody.',
    fields: [
      { label: 'Průměr', value: '504 km' },
      { label: 'Hmota', value: '1,08×10²⁰ kg' },
      { label: 'Den', value: '1,37 dne (tidálně zamčeno)' },
      { label: 'Vzdálenost od Saturnu', value: '237 948 km' },
      { label: 'Atmosféra', value: 'vodní pára z gejzírů' },
      { label: 'Povrchová teplota', value: '−198 °C' },
      { label: 'Gravitace', value: '0,11 m/s²' },
      { label: 'Mateřská planeta', value: 'Saturn' },
      { label: 'Objevitel', value: 'William Herschel, 1789' },
    ],
    funFact: 'Enceladus chrlí z jižního pólu gejzíry vody do vesmíru — pod ledem má globální oceán a je horkým kandidátem na život.',
  },

  mimas: {
    name: 'Mimas',
    kind: 'moon',
    tagline: '"Hvězda smrti" díky obřímu kráteru Herschel.',
    fields: [
      { label: 'Průměr', value: '396 km' },
      { label: 'Hmota', value: '3,75×10¹⁹ kg' },
      { label: 'Den', value: '0,94 dne (tidálně zamčeno)' },
      { label: 'Vzdálenost od Saturnu', value: '185 539 km' },
      { label: 'Atmosféra', value: 'žádná' },
      { label: 'Povrchová teplota', value: '−209 °C' },
      { label: 'Gravitace', value: '0,064 m/s²' },
      { label: 'Mateřská planeta', value: 'Saturn' },
      { label: 'Objevitel', value: 'William Herschel, 1789' },
    ],
    funFact: 'Kráter Herschel zabírá třetinu průměru Mimasu a dává mu vzhled jako Death Star ze Star Wars.',
  },

  miranda: {
    name: 'Miranda',
    kind: 'moon',
    tagline: 'Nejmenší a nejdivočejší uranský měsíc.',
    fields: [
      { label: 'Průměr', value: '471 km' },
      { label: 'Hmota', value: '6,59×10¹⁹ kg' },
      { label: 'Den', value: '1,41 dne (tidálně zamčeno)' },
      { label: 'Vzdálenost od Uranu', value: '129 390 km' },
      { label: 'Atmosféra', value: 'žádná' },
      { label: 'Povrchová teplota', value: '−187 °C' },
      { label: 'Gravitace', value: '0,079 m/s²' },
      { label: 'Mateřská planeta', value: 'Uran' },
      { label: 'Objevitel', value: 'Gerard Kuiper, 1948' },
    ],
    funFact: 'Miranda má útes Verona Rupes vysoký 20 km — největší útes sluneční soustavy, skok z něj by trval 12 minut.',
  },

  ariel: {
    name: 'Ariel',
    kind: 'moon',
    tagline: 'Nejsvětlejší uranský měsíc.',
    fields: [
      { label: 'Průměr', value: '1 158 km' },
      { label: 'Hmota', value: '1,35×10²¹ kg' },
      { label: 'Den', value: '2,52 dne (tidálně zamčeno)' },
      { label: 'Vzdálenost od Uranu', value: '191 020 km' },
      { label: 'Atmosféra', value: 'žádná' },
      { label: 'Povrchová teplota', value: '−213 °C' },
      { label: 'Gravitace', value: '0,27 m/s²' },
      { label: 'Mateřská planeta', value: 'Uran' },
      { label: 'Objevitel', value: 'William Lassell, 1851' },
    ],
    funFact: 'Ariel je pokrytý hlubokými údolími z ledu — možná důsledek gravitačního žmoulání, když byl zahřátý.',
  },

  umbriel: {
    name: 'Umbriel',
    kind: 'moon',
    tagline: 'Nejtmavší z hlavních uranských měsíců.',
    fields: [
      { label: 'Průměr', value: '1 169 km' },
      { label: 'Hmota', value: '1,17×10²¹ kg' },
      { label: 'Den', value: '4,14 dne (tidálně zamčeno)' },
      { label: 'Vzdálenost od Uranu', value: '266 000 km' },
      { label: 'Atmosféra', value: 'žádná' },
      { label: 'Povrchová teplota', value: '−198 °C' },
      { label: 'Gravitace', value: '0,23 m/s²' },
      { label: 'Mateřská planeta', value: 'Uran' },
      { label: 'Objevitel', value: 'William Lassell, 1851' },
    ],
    funFact: 'Na Umbrielu je jasný prstencový útvar Wunda — nikdo si není jistý, proč je o tolik světlejší než okolí.',
  },

  titania: {
    name: 'Titania',
    kind: 'moon',
    tagline: 'Největší uranský měsíc.',
    fields: [
      { label: 'Průměr', value: '1 577 km' },
      { label: 'Hmota', value: '3,53×10²¹ kg' },
      { label: 'Den', value: '8,71 dne (tidálně zamčeno)' },
      { label: 'Vzdálenost od Uranu', value: '435 910 km' },
      { label: 'Atmosféra', value: 'stopová CO₂' },
      { label: 'Povrchová teplota', value: '−203 °C' },
      { label: 'Gravitace', value: '0,37 m/s²' },
      { label: 'Mateřská planeta', value: 'Uran' },
      { label: 'Objevitel', value: 'William Herschel, 1787' },
    ],
    funFact: 'Titania je pojmenována podle královny víl z Shakespearova Snu noci svatojánské — všechny uranské měsíce mají shakespearovská jména.',
  },

  oberon: {
    name: 'Oberon',
    kind: 'moon',
    tagline: 'Nejvzdálenější hlavní uranský měsíc.',
    fields: [
      { label: 'Průměr', value: '1 523 km' },
      { label: 'Hmota', value: '3,01×10²¹ kg' },
      { label: 'Den', value: '13,5 dne (tidálně zamčeno)' },
      { label: 'Vzdálenost od Uranu', value: '583 520 km' },
      { label: 'Atmosféra', value: 'žádná' },
      { label: 'Povrchová teplota', value: '−203 °C' },
      { label: 'Gravitace', value: '0,35 m/s²' },
      { label: 'Mateřská planeta', value: 'Uran' },
      { label: 'Objevitel', value: 'William Herschel, 1787' },
    ],
    funFact: 'Na Oberonu byly nalezeny tmavé skvrny neznámého původu — možná stopy dopadů s vysokým obsahem uhlíku.',
  },
};
```

- [ ] **Step 2.4: Spusť test — má projít**

Run: `npm test`
Expected: všechny 4 nové testy pass; celkem ≥42 pass.

- [ ] **Step 2.5: Commit**

```bash
git add src/bodyData.js src/bodyData.test.js
git commit -m "V3 T2: bodyData.js — 28 objektů s českými fakty"
```

---

## Task 3 — `cameraTween.js` (pure tween)

Čistě matematický modul, plně testovatelný bez Three.

**Files:**
- Create: `src/cameraTween.js`
- Create: `src/cameraTween.test.js`

- [ ] **Step 3.1: Napiš failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTween, easeInOutCubic } from './cameraTween.js';

test('easeInOutCubic: t=0 → 0, t=1 → 1, t=0.5 → 0.5', () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.equal(easeInOutCubic(0.5), 0.5);
});

test('easeInOutCubic: monotonní (rostoucí) v [0,1]', () => {
  let prev = easeInOutCubic(0);
  for (let i = 1; i <= 20; i++) {
    const cur = easeInOutCubic(i / 20);
    assert.ok(cur >= prev, `i=${i}: ${cur} < ${prev}`);
    prev = cur;
  }
});

test('createTween: začíná ve fromPos, končí v toPos', () => {
  const tween = createTween({
    fromPos: { x: 0, y: 0, z: 0 },
    fromTarget: { x: 0, y: 0, z: 0 },
    toPos: { x: 10, y: 5, z: 2 },
    toTarget: { x: 1, y: 2, z: 3 },
    duration: 1.0,
  });
  const s0 = tween.sample(0);
  assert.deepEqual(s0.pos, { x: 0, y: 0, z: 0 });
  assert.deepEqual(s0.target, { x: 0, y: 0, z: 0 });
  const s1 = tween.sample(1.0);
  assert.deepEqual(s1.pos, { x: 10, y: 5, z: 2 });
  assert.deepEqual(s1.target, { x: 1, y: 2, z: 3 });
});

test('createTween: sample(t > duration) = end hodnota (clamp)', () => {
  const tween = createTween({
    fromPos: { x: 0, y: 0, z: 0 },
    fromTarget: { x: 0, y: 0, z: 0 },
    toPos: { x: 100, y: 0, z: 0 },
    toTarget: { x: 0, y: 0, z: 0 },
    duration: 0.5,
  });
  assert.equal(tween.sample(10).pos.x, 100);
  assert.equal(tween.isComplete(10), true);
});

test('createTween: isComplete je false pro t < duration', () => {
  const tween = createTween({
    fromPos: { x: 0, y: 0, z: 0 },
    fromTarget: { x: 0, y: 0, z: 0 },
    toPos: { x: 1, y: 0, z: 0 },
    toTarget: { x: 0, y: 0, z: 0 },
    duration: 1.0,
  });
  assert.equal(tween.isComplete(0.5), false);
  assert.equal(tween.isComplete(1.0), true);
});
```

- [ ] **Step 3.2: Spusť test — má selhat**

Run: `npm test`
Expected: FAIL — `Cannot find module './cameraTween.js'`.

- [ ] **Step 3.3: Implementuj `src/cameraTween.js`**

```js
// cameraTween — pure math modul pro plynulý přelet kamery mezi dvěma stavy
// (position + look-at target). Žádná Three dependence, ať je plně testovatelné.

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerpVec3(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

/**
 * Vytvoří tween object pro přelet kamery.
 * @param {{ fromPos, fromTarget, toPos, toTarget, duration }} opts
 * @returns {{ sample(t): { pos, target }, isComplete(t): boolean, duration }}
 */
export function createTween(opts) {
  const { fromPos, fromTarget, toPos, toTarget, duration } = opts;
  return {
    duration,
    sample(t) {
      const clamped = Math.max(0, Math.min(1, t / duration));
      const eased = easeInOutCubic(clamped);
      return {
        pos: lerpVec3(fromPos, toPos, eased),
        target: lerpVec3(fromTarget, toTarget, eased),
      };
    },
    isComplete(t) {
      return t >= duration;
    },
  };
}
```

- [ ] **Step 3.4: Spusť test — má projít**

Run: `npm test`
Expected: 5 nových testů pass.

- [ ] **Step 3.5: Commit**

```bash
git add src/cameraTween.js src/cameraTween.test.js
git commit -m "V3 T3: cameraTween.js — pure tween pro fly-to"
```

---

## Task 4 — `particles.js` per-owner alpha multiplier

Pro fade-out ostatních těles při vstupu do detail view. Per-owner Float32Array (max 28 slotů), shader násobí vAlpha × ownerAlphaMul.

**Files:**
- Modify: `src/particles.js`

- [ ] **Step 4.1: Přidej uniform do shaderu a JS stav**

V `src/particles.js` uprav `VERTEX_SHADER` aby používal `ownerAlphaMul` uniform:

```glsl
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
attribute float aOwnerAlpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha * aOwnerAlpha;
  if (vAlpha <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * (900.0 / -mv.z);
}
```

V konstruktoru `ParticlePool`, za řádek s `this.alpha = new Float32Array(count);` přidej:

```js
this.ownerAlpha = new Float32Array(count); // per-particle kopie ownerAlphaMul[owner] — updatováno každý frame před flush
```

Za `this.alphaAttr = new THREE.BufferAttribute(this.alpha, 1);` přidej:

```js
this.ownerAlphaAttr = new THREE.BufferAttribute(this.ownerAlpha, 1);
this.ownerAlphaAttr.setUsage(THREE.DynamicDrawUsage);
```

A za `geometry.setAttribute('aAlpha', this.alphaAttr);`:

```js
geometry.setAttribute('aOwnerAlpha', this.ownerAlphaAttr);
```

- [ ] **Step 4.2: Přidej API pro per-owner alpha**

Přidej jako novou property (po konstruktoru, před `flushAll`):

```js
// Per-owner multiplier (planets 0..8, moons 9..27, total 28). Default 1.
ownerAlphaMul = new Float32Array(28).fill(1);

/**
 * Nastaví ownerAlphaMul[ownerIdx] a propaguje hodnotu do per-particle ownerAlpha arrayu
 * (všem tečkám s tímhle ownerem). Volá se z detailView při fade-in/out.
 */
setOwnerAlpha(ownerIdx, value) {
  this.ownerAlphaMul[ownerIdx] = value;
  for (let i = 0; i < this.count; i++) {
    if (this.owner[i] === ownerIdx) {
      this.ownerAlpha[i] = value;
    }
  }
  this.ownerAlphaAttr.needsUpdate = true;
}
```

V init loopu v konstruktoru (kde se inicializuje `this.alpha[i] = 0`), přidej:

```js
this.ownerAlpha[i] = 1.0;
```

Ve `flushAll()` přidej:

```js
this.ownerAlphaAttr.needsUpdate = true;
```

Ve `spawnFromSun` a `spawnFromPlanet` za řádek s `this.owner[i] = ...` přidej:

```js
this.ownerAlpha[i] = this.ownerAlphaMul[planetOwnerIdx]; // nebo moonOwnerIdx
```

(Poznámka: nahraď `planetOwnerIdx` resp. `moonOwnerIdx` podle kontextu funkce.)

- [ ] **Step 4.3: Manual smoke test**

Spusť `npm run serve`, otevři `http://localhost:3000/`. Scéna se má zobrazit normálně (všechny tečky viditelné, jelikož všechny ownerAlphaMul = 1).

V DevTools console vyzkoušej:
```js
// přes window debug hook — přidáme později; tento krok jen ručně potvrdí že shader compile ok
```

Pokud se scéna nezobrazí nebo je úplně černá, je bug v shaderu nebo attribute wiring. Debug pomocí browser console.

- [ ] **Step 4.4: Ověř že existing testy stále procházejí**

Run: `npm test`
Expected: all pass.

- [ ] **Step 4.5: Commit**

```bash
git add src/particles.js
git commit -m "V3 T4: particles — per-owner alpha multiplier pro fade v detail view"
```

---

## Task 5 — `picking.js` (raycast invisible meshes)

Neviditelná `THREE.Mesh` sféra per tělo; eventy hover/click.

**Files:**
- Create: `src/picking.js`
- Create: `src/picking.test.js`

- [ ] **Step 5.1: Napiš failing test (pure math)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rayHitsSphere } from './picking.js';

test('rayHitsSphere: přímý zásah', () => {
  // Ray z (0,0,0) směr +Z, sféra ve (0,0,10) poloměr 2
  const hit = rayHitsSphere(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: 10 },
    2,
  );
  assert.ok(hit > 0);
});

test('rayHitsSphere: žádný zásah (paprsek míjí)', () => {
  const hit = rayHitsSphere(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 10, y: 0, z: 10 }, // sféra odsunuta do strany
    2,
  );
  assert.equal(hit, null);
});

test('rayHitsSphere: sféra za ray (negativní t) = null', () => {
  const hit = rayHitsSphere(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -10 },
    2,
  );
  assert.equal(hit, null);
});

test('rayHitsSphere: edge case — ray právě tečný', () => {
  const hit = rayHitsSphere(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 2, y: 0, z: 10 }, // vzdálenost sféry od ray = 2 = radius
    2,
  );
  assert.ok(hit !== null, 'tečný ray by měl hit (nebo velmi blízko)');
});
```

- [ ] **Step 5.2: Spusť test — má selhat**

Run: `npm test`
Expected: FAIL — chybí modul.

- [ ] **Step 5.3: Implementuj `src/picking.js`**

```js
import * as THREE from 'three';

/**
 * Pure ray-sphere intersection.
 * @returns {number|null} t parametr (kladný = před kamerou), null = žádný hit.
 */
export function rayHitsSphere(origin, dir, center, radius) {
  const ox = origin.x - center.x;
  const oy = origin.y - center.y;
  const oz = origin.z - center.z;
  const b = ox * dir.x + oy * dir.y + oz * dir.z;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const sqrt = Math.sqrt(disc);
  const t0 = -b - sqrt;
  const t1 = -b + sqrt;
  if (t0 >= 0) return t0;
  if (t1 >= 0) return t1;
  return null;
}

/**
 * Picking controller — drží neviditelné THREE.Mesh sféry pro hit test.
 * Každé tělo má sféru centrovanou ve své pozici, poloměr ~ bodyRadius × 1.5.
 *
 * @param {{ scene, camera, canvas }} deps
 * @returns {{
 *   addBody(id, getPosition, radius),
 *   setActiveIds(idsSet),
 *   onHover(cb),
 *   onClick(cb),
 *   update(),
 *   dispose()
 * }}
 */
export function createPicker({ scene, camera, canvas }) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const bodies = []; // { id, mesh, getPosition, radius }
  let activeIds = null; // null = všechna těla; Set = jen tato id
  let hoverCb = null;
  let clickCb = null;
  let currentHover = null;

  const invisibleMat = new THREE.MeshBasicMaterial({ visible: false });

  function addBody(id, getPosition, radius) {
    const geom = new THREE.SphereGeometry(radius, 12, 10);
    const mesh = new THREE.Mesh(geom, invisibleMat);
    mesh.userData.bodyId = id;
    scene.add(mesh);
    bodies.push({ id, mesh, getPosition, radius });
  }

  function setActiveIds(ids) {
    activeIds = ids; // null nebo Set
  }

  function updateMeshPositions() {
    for (const b of bodies) {
      const p = b.getPosition();
      b.mesh.position.set(p.x, p.y, p.z);
    }
  }

  function pickFromMouse(ev) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const meshes = bodies
      .filter((b) => activeIds === null || activeIds.has(b.id))
      .map((b) => b.mesh);
    const hits = raycaster.intersectObjects(meshes, false);
    return hits.length > 0 ? hits[0].object.userData.bodyId : null;
  }

  function handleMove(ev) {
    const id = pickFromMouse(ev);
    if (id !== currentHover) {
      currentHover = id;
      hoverCb && hoverCb(id, ev);
    }
  }
  function handleClick(ev) {
    const id = pickFromMouse(ev);
    if (id) clickCb && clickCb(id, ev);
  }

  canvas.addEventListener('mousemove', handleMove);
  canvas.addEventListener('click', handleClick);

  return {
    addBody,
    setActiveIds,
    onHover(cb) { hoverCb = cb; },
    onClick(cb) { clickCb = cb; },
    update() { updateMeshPositions(); },
    dispose() {
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('click', handleClick);
      for (const b of bodies) {
        scene.remove(b.mesh);
        b.mesh.geometry.dispose();
      }
      invisibleMat.dispose();
    },
  };
}
```

- [ ] **Step 5.4: Spusť test — má projít**

Run: `npm test`
Expected: 4 nové testy pass.

- [ ] **Step 5.5: Commit**

```bash
git add src/picking.js src/picking.test.js
git commit -m "V3 T5: picking — ray-sphere math + invisible mesh controller"
```

---

## Task 6 — `tooltip.js` (HTML tooltip)

Malý DOM element, následuje tělo přes world-to-screen projekci.

**Files:**
- Create: `src/tooltip.js`
- Modify: `index.html`

- [ ] **Step 6.1: Přidej CSS do `index.html`**

V `<style>` bloku v `index.html` přidej:

```css
#tooltip {
  position: fixed;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 4px 10px;
  border-radius: 3px;
  font: 13px/1.2 system-ui, sans-serif;
  letter-spacing: 0.04em;
  white-space: nowrap;
  transform: translate(-50%, -130%);
  opacity: 0;
  transition: opacity 0.12s;
  user-select: none;
  z-index: 10;
}
#tooltip.visible { opacity: 1; }
```

A v `<body>` pod `<div id="stats">` přidej:

```html
<div id="tooltip"></div>
```

- [ ] **Step 6.2: Vytvoř `src/tooltip.js`**

```js
import * as THREE from 'three';
import { BODY_DATA } from './bodyData.js';

const _vec = new THREE.Vector3();

/**
 * Hover tooltip — sleduje tělo přes world-to-screen projekci.
 * Skrytý na touch zařízeních.
 */
export function createTooltip({ camera, canvas }) {
  const el = document.getElementById('tooltip');
  if (!el) throw new Error('#tooltip element nenalezen');
  let currentId = null;
  let currentGetPos = null;

  function projectToScreen(worldPos) {
    _vec.copy(worldPos);
    _vec.project(camera);
    const rect = canvas.getBoundingClientRect();
    const x = (_vec.x * 0.5 + 0.5) * rect.width + rect.left;
    const y = (-_vec.y * 0.5 + 0.5) * rect.height + rect.top;
    return { x, y, behindCamera: _vec.z > 1 };
  }

  return {
    show(id, getPos) {
      const data = BODY_DATA[id];
      if (!data) return;
      currentId = id;
      currentGetPos = getPos;
      el.textContent = data.name.toUpperCase();
      el.classList.add('visible');
    },
    hide() {
      currentId = null;
      currentGetPos = null;
      el.classList.remove('visible');
    },
    update() {
      if (!currentGetPos) return;
      const world = currentGetPos();
      _vec.set(world.x, world.y, world.z);
      const { x, y, behindCamera } = projectToScreen(_vec);
      if (behindCamera) {
        el.classList.remove('visible');
        return;
      }
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    },
    currentId() { return currentId; },
  };
}
```

- [ ] **Step 6.3: Manual smoke test**

Není co testovat dokud není integrované v main.js (Task 13). Ověř alespoň že nic nepadá:

Run: `npm test`
Expected: pass.

- [ ] **Step 6.4: Commit**

```bash
git add src/tooltip.js index.html
git commit -m "V3 T6: tooltip.js + CSS"
```

---

## Task 7 — `infoPanel.js` (HTML info panel)

Render panel z `BODY_DATA[id]`, s close button a scale toggle.

**Files:**
- Create: `src/infoPanel.js`
- Modify: `index.html`

- [ ] **Step 7.1: Přidej CSS a kontejner do `index.html`**

V `<style>` přidej:

```css
#infoPanel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 360px;
  max-height: 75vh;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: #eee;
  font: 14px/1.5 system-ui, sans-serif;
  padding: 16px 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  transform: translateX(420px);
  opacity: 0;
  transition: transform 0.3s ease-out, opacity 0.3s ease-out;
  z-index: 20;
}
#infoPanel.visible { transform: translateX(0); opacity: 1; }
#infoPanel h2 { margin: 0 0 4px; font-size: 22px; letter-spacing: 0.06em; }
#infoPanel .tagline { color: #aaa; font-style: italic; margin: 0 0 14px; font-size: 13px; }
#infoPanel .close {
  position: absolute;
  top: 10px;
  right: 12px;
  background: none;
  border: none;
  color: #aaa;
  font-size: 22px;
  cursor: pointer;
  padding: 2px 8px;
  line-height: 1;
}
#infoPanel .close:hover { color: #fff; }
#infoPanel table { width: 100%; border-collapse: collapse; margin: 10px 0; }
#infoPanel td { padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 13px; }
#infoPanel td.label { color: #888; width: 45%; }
#infoPanel td.value { color: #fff; text-align: right; }
#infoPanel .funFact {
  margin-top: 12px;
  padding: 10px 12px;
  background: rgba(255, 200, 80, 0.08);
  border-left: 3px solid #ffc850;
  font-size: 13px;
  font-style: italic;
  color: #ddd;
}
#infoPanel .scaleToggle {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(255,255,255,0.15);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}
#infoPanel .scaleToggle input { cursor: pointer; transform: scale(1.3); }
#infoPanel .scaleHint { color: #888; font-size: 11px; margin-top: 4px; text-align: right; }
```

V `<body>` pod tooltip div přidej:

```html
<div id="infoPanel"></div>
```

- [ ] **Step 7.2: Vytvoř `src/infoPanel.js`**

```js
import { BODY_DATA } from './bodyData.js';

export function createInfoPanel() {
  const el = document.getElementById('infoPanel');
  if (!el) throw new Error('#infoPanel element nenalezen');
  let closeCb = null;
  let scaleToggleCb = null;

  function render(id, { hasScaleToggle, scaleOn }) {
    const data = BODY_DATA[id];
    if (!data) return;

    const rowsHtml = data.fields
      .map((f) => `<tr><td class="label">${escapeHtml(f.label)}</td><td class="value">${escapeHtml(f.value)}</td></tr>`)
      .join('');

    const toggleHtml = hasScaleToggle
      ? `
        <div class="scaleToggle">
          <span>Reálné měřítko</span>
          <input type="checkbox" id="scaleToggleInput" ${scaleOn ? 'checked' : ''}>
        </div>
        <div class="scaleHint">${scaleOn ? 'Některé měsíce uletí daleko — zoom out myší.' : 'Přepne na proporční vzdálenosti měsíců.'}</div>
      `
      : '';

    el.innerHTML = `
      <button class="close" aria-label="Zavřít">✕</button>
      <h2>${escapeHtml(data.name)}</h2>
      <p class="tagline">${escapeHtml(data.tagline)}</p>
      <table>${rowsHtml}</table>
      <div class="funFact">„${escapeHtml(data.funFact)}"</div>
      ${toggleHtml}
    `;

    el.querySelector('.close').onclick = () => closeCb && closeCb();
    const toggle = el.querySelector('#scaleToggleInput');
    if (toggle) toggle.onchange = (e) => scaleToggleCb && scaleToggleCb(e.target.checked);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    show(id, opts = {}) {
      render(id, { hasScaleToggle: !!opts.hasScaleToggle, scaleOn: !!opts.scaleOn });
      requestAnimationFrame(() => el.classList.add('visible'));
    },
    hide() {
      el.classList.remove('visible');
    },
    updateScaleState(scaleOn) {
      // re-render zachová toggle
      const id = el.dataset.currentId;
      if (id) render(id, { hasScaleToggle: true, scaleOn });
    },
    onClose(cb) { closeCb = cb; },
    onScaleToggle(cb) { scaleToggleCb = cb; },
  };
}
```

- [ ] **Step 7.3: Commit**

```bash
git add src/infoPanel.js index.html
git commit -m "V3 T7: infoPanel.js + CSS — render z BODY_DATA"
```

---

## Task 8 — `detailView.js` state machine

Stavové centrum: MAIN / TRANSITION_IN / DETAIL / TRANSITION_OUT. Mockovatelné dependencies.

**Files:**
- Create: `src/detailView.js`
- Create: `src/detailView.test.js`

- [ ] **Step 8.1: Napiš failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDetailView, STATE } from './detailView.js';

function makeMockDeps() {
  const calls = [];
  return {
    calls,
    cameraFlyTo: (toPos, toTarget, duration) => { calls.push(['fly', toPos, toTarget, duration]); },
    getCameraState: () => ({ pos: { x: 0, y: 40, z: 2000 }, target: { x: 0, y: 0, z: 0 } }),
    setPaused: (v) => { calls.push(['paused', v]); },
    fadeOthers: (focusId, alpha) => { calls.push(['fade', focusId, alpha]); },
    showPanel: (id, opts) => { calls.push(['panel', id, opts]); },
    hidePanel: () => { calls.push(['hidePanel']); },
    enableOrbit: (enabled, target) => { calls.push(['orbit', enabled, target]); },
    getBodyPosition: (id) => ({ x: 100, y: 0, z: 0 }),
    getBodyRadius: (id) => 10,
    getBodyKind: (id) => (id === 'jupiter' ? 'planet' : 'moon'),
  };
}

test('initial state = MAIN', () => {
  const deps = makeMockDeps();
  const dv = createDetailView(deps);
  assert.equal(dv.state(), STATE.MAIN);
});

test('enter() transition MAIN → TRANSITION_IN → DETAIL', () => {
  const deps = makeMockDeps();
  const dv = createDetailView(deps);
  dv.enter('jupiter');
  assert.equal(dv.state(), STATE.TRANSITION_IN);
  // simulate time advance
  dv.tick(0.9); // po duration 0.8s končí
  assert.equal(dv.state(), STATE.DETAIL);
});

test('exit() transition DETAIL → TRANSITION_OUT → MAIN', () => {
  const deps = makeMockDeps();
  const dv = createDetailView(deps);
  dv.enter('jupiter');
  dv.tick(0.9);
  dv.exit();
  assert.equal(dv.state(), STATE.TRANSITION_OUT);
  dv.tick(0.9);
  assert.equal(dv.state(), STATE.MAIN);
});

test('enter(newId) v DETAIL → přepne fokus bez průchodu MAIN', () => {
  const deps = makeMockDeps();
  const dv = createDetailView(deps);
  dv.enter('jupiter');
  dv.tick(0.9);
  dv.enter('io');
  assert.equal(dv.state(), STATE.TRANSITION_IN);
  assert.equal(dv.focusId(), 'io');
});

test('enter() ignorován během TRANSITION_IN', () => {
  const deps = makeMockDeps();
  const dv = createDetailView(deps);
  dv.enter('jupiter');
  dv.enter('saturn'); // during TRANSITION_IN → ignored
  assert.equal(dv.focusId(), 'jupiter');
});

test('panel se zobrazí až po TRANSITION_IN dokončí', () => {
  const deps = makeMockDeps();
  const dv = createDetailView(deps);
  dv.enter('jupiter');
  const panelCallsDuringTransition = deps.calls.filter((c) => c[0] === 'panel').length;
  assert.equal(panelCallsDuringTransition, 0);
  dv.tick(0.9);
  const panelCallsAfter = deps.calls.filter((c) => c[0] === 'panel').length;
  assert.equal(panelCallsAfter, 1);
});

test('hasScaleToggle true pro planet, false pro sun', () => {
  const deps = makeMockDeps();
  deps.getBodyKind = (id) => (id === 'sun' ? 'sun' : 'planet');
  const dv = createDetailView(deps);
  dv.enter('sun');
  dv.tick(0.9);
  const panelCall = deps.calls.find((c) => c[0] === 'panel');
  assert.equal(panelCall[2].hasScaleToggle, false);
});
```

- [ ] **Step 8.2: Spusť test — má selhat**

Run: `npm test`
Expected: FAIL — modul neexistuje.

- [ ] **Step 8.3: Implementuj `src/detailView.js`**

```js
import { createTween } from './cameraTween.js';

export const STATE = Object.freeze({
  MAIN: 'MAIN',
  TRANSITION_IN: 'TRANSITION_IN',
  DETAIL: 'DETAIL',
  TRANSITION_OUT: 'TRANSITION_OUT',
});

const TRANSITION_DURATION = 0.8;

/**
 * Deps interface:
 *   cameraFlyTo(toPos, toTarget, duration) — spustí tween, vrátí void (tween samotný drží detailView)
 *   getCameraState() → { pos, target }
 *   setPaused(bool)
 *   fadeOthers(focusId, alpha)  // alpha: 0..1 pro všechna tělesa kromě focusId
 *   showPanel(id, { hasScaleToggle, scaleOn })
 *   hidePanel()
 *   enableOrbit(bool, target)
 *   getBodyPosition(id) → { x, y, z }
 *   getBodyRadius(id) → number
 *   getBodyKind(id) → 'sun' | 'planet' | 'moon'
 */
export function createDetailView(deps) {
  let _state = STATE.MAIN;
  let _focusId = null;
  let _tween = null; // CameraTween aktivní
  let _tweenT = 0;
  let _returnPos = null;
  let _returnTarget = null;
  let _scaleOn = false;
  let _pendingTarget = null; // po TRANSITION_OUT, pokud chceme do dalšího

  function computeDetailCameraOffset(id) {
    const r = deps.getBodyRadius(id);
    const p = deps.getBodyPosition(id);
    return {
      pos: { x: p.x, y: p.y + r * 0.6, z: p.z + r * 4.5 },
      target: p,
    };
  }

  function startTransitionIn(id) {
    _focusId = id;
    _state = STATE.TRANSITION_IN;
    const cs = deps.getCameraState();
    if (_returnPos === null) {
      _returnPos = { ...cs.pos };
      _returnTarget = { ...cs.target };
    }
    const { pos, target } = computeDetailCameraOffset(id);
    _tween = createTween({
      fromPos: cs.pos,
      fromTarget: cs.target,
      toPos: pos,
      toTarget: target,
      duration: TRANSITION_DURATION,
    });
    _tweenT = 0;
    deps.setPaused(true);
    deps.fadeOthers(id, 0); // fade ostatních na 0 během transition
    deps.cameraFlyTo(pos, target, TRANSITION_DURATION);
  }

  function enterDetailState() {
    _state = STATE.DETAIL;
    const kind = deps.getBodyKind(_focusId);
    const hasScaleToggle = kind === 'planet';
    deps.showPanel(_focusId, { hasScaleToggle, scaleOn: _scaleOn });
    const p = deps.getBodyPosition(_focusId);
    deps.enableOrbit(true, p);
  }

  function startTransitionOut() {
    _state = STATE.TRANSITION_OUT;
    deps.hidePanel();
    deps.enableOrbit(false, null);
    const cs = deps.getCameraState();
    _tween = createTween({
      fromPos: cs.pos,
      fromTarget: cs.target,
      toPos: _returnPos,
      toTarget: _returnTarget,
      duration: TRANSITION_DURATION,
    });
    _tweenT = 0;
    deps.fadeOthers(null, 1); // fade všech zpět na 1
    deps.cameraFlyTo(_returnPos, _returnTarget, TRANSITION_DURATION);
  }

  function enterMainState() {
    _state = STATE.MAIN;
    _focusId = null;
    _tween = null;
    _returnPos = null;
    _returnTarget = null;
    deps.setPaused(false);
    if (_pendingTarget) {
      const t = _pendingTarget;
      _pendingTarget = null;
      startTransitionIn(t);
    }
  }

  return {
    enter(id) {
      if (_state === STATE.TRANSITION_IN || _state === STATE.TRANSITION_OUT) return;
      if (_state === STATE.MAIN) {
        startTransitionIn(id);
        return;
      }
      // DETAIL → přepne fokus přímo na nové tělo (fly-to nový target)
      _focusId = id;
      _state = STATE.TRANSITION_IN;
      const cs = deps.getCameraState();
      const { pos, target } = computeDetailCameraOffset(id);
      _tween = createTween({
        fromPos: cs.pos,
        fromTarget: cs.target,
        toPos: pos,
        toTarget: target,
        duration: TRANSITION_DURATION,
      });
      _tweenT = 0;
      deps.hidePanel();
      deps.enableOrbit(false, null);
      deps.fadeOthers(id, 0);
      deps.cameraFlyTo(pos, target, TRANSITION_DURATION);
    },
    exit() {
      if (_state !== STATE.DETAIL) return;
      startTransitionOut();
    },
    toggleScale(on) {
      _scaleOn = on;
    },
    tick(dt) {
      if (_tween) {
        _tweenT += dt;
        if (_tween.isComplete(_tweenT)) {
          _tween = null;
          if (_state === STATE.TRANSITION_IN) enterDetailState();
          else if (_state === STATE.TRANSITION_OUT) enterMainState();
        }
      }
    },
    state() { return _state; },
    focusId() { return _focusId; },
    scaleOn() { return _scaleOn; },
  };
}
```

- [ ] **Step 8.4: Spusť test — má projít**

Run: `npm test`
Expected: 7 nových testů pass.

- [ ] **Step 8.5: Commit**

```bash
git add src/detailView.js src/detailView.test.js
git commit -m "V3 T8: detailView state machine + test"
```

---

## Task 9 — OrbitControls integrace do `scene.js`

**Files:**
- Modify: `src/scene.js`

- [ ] **Step 9.1: Doplň OrbitControls**

V `src/scene.js`, na začátek přidej import:

```js
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
```

Do funkce `createScene()`, před `return`, přidej:

```js
const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 30;
controls.maxDistance = 8000;
```

Upravit return:

```js
return { renderer, scene, camera, controls };
```

- [ ] **Step 9.2: Updatuj main.js aby controls šly do loop update**

V `src/main.js`, uprav destructuring:

```js
const { renderer, scene, camera, controls } = createScene();
```

V `tick()` před `renderer.render(scene, camera);` přidej:

```js
if (controls.enabled) controls.update();
```

- [ ] **Step 9.3: Manual smoke test**

Run: `npm run serve`. Scéna se renderuje jako dříve, žádné interakční změny (controls disabled).

- [ ] **Step 9.4: Commit**

```bash
git add src/scene.js src/main.js
git commit -m "V3 T9: OrbitControls přidány (disabled by default)"
```

---

## Task 10 — `sunActivity.js` — sunspots

**Files:**
- Create: `src/sunActivity.js`
- Create: `src/sunActivity.test.js`

- [ ] **Step 10.1: Napiš test pro sunspot lifecycle**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSunActivity } from './sunActivity.js';

function makeMockPool(count) {
  return {
    count,
    owner: new Int16Array(count).fill(0),
    color: new Float32Array(count * 3).fill(1),
    alpha: new Float32Array(count).fill(1),
    phase: new Uint8Array(count),
    position: new Float32Array(count * 3),
    localOffset: new Float32Array(count * 3),
    colorAttr: { needsUpdate: false },
  };
}

test('spawnSunspot označí ~30-50 teček', () => {
  const pool = makeMockPool(1000);
  // naplň pozice Fibonacci-like (pseudorandom)
  for (let i = 0; i < 1000; i++) {
    pool.localOffset[3*i] = Math.cos(i);
    pool.localOffset[3*i+1] = Math.sin(i);
    pool.localOffset[3*i+2] = Math.cos(i * 2);
  }
  const act = createSunActivity({ sunOwner: 0, sunRadius: 1 });
  const spot = act._spawnSunspot(pool, 0);
  assert.ok(spot.indices.length >= 20 && spot.indices.length <= 60,
    `cluster size = ${spot.indices.length}`);
});

test('lifecycle: fade-in → stable → fade-out → dead', () => {
  const act = createSunActivity({ sunOwner: 0, sunRadius: 1 });
  const spot = { bornAt: 0, stableAt: 3, deathAt: 31, indices: [1, 2, 3] };
  assert.equal(act._intensityAt(spot, 0), 0, 'at birth = 0');
  assert.ok(Math.abs(act._intensityAt(spot, 1.5) - 0.5) < 0.05, 'halfway fade-in ~0.5');
  assert.equal(act._intensityAt(spot, 15), 1, 'stable = 1');
  assert.ok(act._intensityAt(spot, 27) < 1, 'fading out');
  assert.equal(act._intensityAt(spot, 32), 0, 'dead = 0');
});

test('update: spawnuje nový sunspot po intervalu (low intensity)', () => {
  const pool = makeMockPool(500);
  for (let i = 0; i < 500; i++) {
    pool.localOffset[3*i] = Math.cos(i);
    pool.localOffset[3*i+1] = Math.sin(i);
    pool.localOffset[3*i+2] = Math.cos(i*2);
  }
  const act = createSunActivity({ sunOwner: 0, sunRadius: 1, seed: 42 });
  act.update(pool, 0, 0.016, { intensity: 'low' });
  // po 30 sekundách simulace by měl být alespoň 1 sunspot
  for (let t = 0; t < 30; t += 1) {
    act.update(pool, t, 1, { intensity: 'low' });
  }
  assert.ok(act._activeSpots().length >= 1, 'po 30s má být alespoň 1 spot');
});
```

- [ ] **Step 10.2: Spusť test — má selhat**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 10.3: Implementuj `src/sunActivity.js`** (pouze sunspots, erupce v T11)

```js
// sunActivity — stateful controller pro vitalní chování Slunce.
// T10: sunspoty. T11 přidá prominence/CME.

const SUNSPOT_FADE_IN = 3;
const SUNSPOT_STABLE = 20;
const SUNSPOT_FADE_OUT = 8;
const SUNSPOT_LIFETIME = SUNSPOT_FADE_IN + SUNSPOT_STABLE + SUNSPOT_FADE_OUT;
const SUNSPOT_CLUSTER_MIN = 30;
const SUNSPOT_CLUSTER_MAX = 50;
const SUNSPOT_COLOR = [40/255, 20/255, 0/255]; // tmavá barva v plném intensity

// Simple seeded PRNG pro deterministické testy
function makeRng(seed = 1) {
  let s = seed >>> 0;
  return function() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createSunActivity({ sunOwner = 0, sunRadius = 1, seed = Date.now() & 0xffff } = {}) {
  const rng = makeRng(seed);
  const activeSpots = []; // { indices: number[], origColors: number[][], bornAt, stableAt, deathAt }
  let lastSpawnAt = -Infinity;

  function intensityAt(spot, time) {
    const age = time - spot.bornAt;
    if (age < 0 || age > (spot.deathAt - spot.bornAt)) return 0;
    if (age < SUNSPOT_FADE_IN) return age / SUNSPOT_FADE_IN;
    if (age < SUNSPOT_FADE_IN + SUNSPOT_STABLE) return 1;
    const fadeAge = age - SUNSPOT_FADE_IN - SUNSPOT_STABLE;
    return Math.max(0, 1 - fadeAge / SUNSPOT_FADE_OUT);
  }

  function spawnSunspot(pool, time) {
    // Vyber seed bod s preferencí ekvatoru
    const seedIdx = findSunSeed(pool);
    if (seedIdx === -1) return null;
    const clusterSize = SUNSPOT_CLUSTER_MIN + Math.floor(rng() * (SUNSPOT_CLUSTER_MAX - SUNSPOT_CLUSTER_MIN));
    const indices = findKNearest(pool, seedIdx, clusterSize);
    const origColors = indices.map((i) => [pool.color[3*i], pool.color[3*i+1], pool.color[3*i+2]]);
    const spot = {
      indices,
      origColors,
      bornAt: time,
      stableAt: time + SUNSPOT_FADE_IN,
      deathAt: time + SUNSPOT_LIFETIME,
    };
    activeSpots.push(spot);
    return spot;
  }

  function findSunSeed(pool) {
    // Vyber Sun tečku s preferencí |localOffset.y| < 0.5×sunRadius (±30° lat)
    const candidates = [];
    for (let i = 0; i < pool.count; i++) {
      if (pool.owner[i] !== sunOwner) continue;
      const ly = pool.localOffset[3*i + 1];
      if (Math.abs(ly) < 0.5 * sunRadius) candidates.push(i);
    }
    if (candidates.length === 0) {
      // fallback — jakákoli Sun tečka
      for (let i = 0; i < pool.count; i++) {
        if (pool.owner[i] === sunOwner) candidates.push(i);
        if (candidates.length >= 100) break;
      }
    }
    if (candidates.length === 0) return -1;
    return candidates[Math.floor(rng() * candidates.length)];
  }

  function findKNearest(pool, seedIdx, k) {
    const sx = pool.localOffset[3*seedIdx];
    const sy = pool.localOffset[3*seedIdx + 1];
    const sz = pool.localOffset[3*seedIdx + 2];
    const dists = [];
    for (let i = 0; i < pool.count; i++) {
      if (pool.owner[i] !== sunOwner) continue;
      const dx = pool.localOffset[3*i] - sx;
      const dy = pool.localOffset[3*i + 1] - sy;
      const dz = pool.localOffset[3*i + 2] - sz;
      dists.push([dx*dx + dy*dy + dz*dz, i]);
    }
    dists.sort((a, b) => a[0] - b[0]);
    return dists.slice(0, k).map((d) => d[1]);
  }

  function update(pool, time, dt, opts = {}) {
    const intensity = opts.intensity || 'low';
    const spawnInterval = intensity === 'high' ? 12 : 25;
    const maxSpots = intensity === 'high' ? 3 : 1;

    // Spawn pokud interval uplynul a pod max
    if (time - lastSpawnAt >= spawnInterval && activeSpots.length < maxSpots) {
      spawnSunspot(pool, time);
      lastSpawnAt = time;
    }

    // Update barev podle intensity
    for (let s = activeSpots.length - 1; s >= 0; s--) {
      const spot = activeSpots[s];
      const k = intensityAt(spot, time);
      for (let j = 0; j < spot.indices.length; j++) {
        const i = spot.indices[j];
        const oc = spot.origColors[j];
        pool.color[3*i]     = oc[0] + (SUNSPOT_COLOR[0] - oc[0]) * k;
        pool.color[3*i + 1] = oc[1] + (SUNSPOT_COLOR[1] - oc[1]) * k;
        pool.color[3*i + 2] = oc[2] + (SUNSPOT_COLOR[2] - oc[2]) * k;
      }
      if (time > spot.deathAt) {
        // restore pro jistotu
        for (let j = 0; j < spot.indices.length; j++) {
          const i = spot.indices[j];
          const oc = spot.origColors[j];
          pool.color[3*i]     = oc[0];
          pool.color[3*i + 1] = oc[1];
          pool.color[3*i + 2] = oc[2];
        }
        activeSpots.splice(s, 1);
      }
    }
    pool.colorAttr.needsUpdate = true;
  }

  return {
    update,
    // internals pro test
    _spawnSunspot: spawnSunspot,
    _intensityAt: intensityAt,
    _activeSpots: () => activeSpots,
  };
}
```

- [ ] **Step 10.4: Spusť test — má projít**

Run: `npm test`
Expected: 3 nové testy pass.

- [ ] **Step 10.5: Commit**

```bash
git add src/sunActivity.js src/sunActivity.test.js
git commit -m "V3 T10: sunActivity sunspots — lifecycle + cluster picking"
```

---

## Task 11 — Prominence / CME do `sunActivity.js`

Arch prominence + CME sharing mechanics s pool.spawn.

**Files:**
- Modify: `src/sunActivity.js`
- Modify: `src/sunActivity.test.js`

- [ ] **Step 11.1: Napiš testy pro prominence trajectory**

Přidej do `sunActivity.test.js`:

```js
import { parabolicArcPos } from './sunActivity.js';

test('parabolicArcPos: t=0 = A, t=1 = B', () => {
  const A = { x: 0, y: 0, z: 0 };
  const B = { x: 10, y: 0, z: 0 };
  const peak = 2;
  const p0 = parabolicArcPos(A, B, peak, 0);
  const p1 = parabolicArcPos(A, B, peak, 1);
  assert.ok(Math.abs(p0.x - 0) < 0.001);
  assert.ok(Math.abs(p1.x - 10) < 0.001);
});

test('parabolicArcPos: max výška při t=0.5', () => {
  const A = { x: 0, y: 0, z: 0 };
  const B = { x: 10, y: 0, z: 0 };
  const peak = 2;
  const mid = parabolicArcPos(A, B, peak, 0.5);
  assert.ok(Math.abs(mid.y - peak) < 0.01, `y = ${mid.y}, expected ~${peak}`);
});
```

- [ ] **Step 11.2: Implementuj prominence spawn**

V `src/sunActivity.js` přidej export `parabolicArcPos` a prominence spawn. Přidej nad `createSunActivity`:

```js
export function parabolicArcPos(A, B, peak, t) {
  return {
    x: A.x + (B.x - A.x) * t,
    y: A.y + (B.y - A.y) * t + Math.sin(Math.PI * t) * peak,
    z: A.z + (B.z - A.z) * t,
  };
}
```

Do `createSunActivity` přidej state pro prominence/CME. Do `update()` přidej spawn logiku, do return přidej `_spawnProminence`:

```js
const PROMINENCE_LIFETIME = 3.0;
const CME_LIFETIME = 2.2;
const PROMINENCE_DOTS = 40;
const CME_DOTS = 25;
const PROMINENCE_PEAK_FACTOR = 0.18; // peak height = peak_factor × sunRadius
const PROMINENCE_SPAN_MIN = 0.35;
const PROMINENCE_SPAN_MAX = 0.55;

let lastFlareAt = -Infinity;
const activeFlares = []; // { kind: 'arch'|'cme', A, B, peak, bornAt, dieAt, indices }

function spawnProminence(pool, time) {
  // Najdi surface bod A (Sun dot s ON_SUN phase)
  const sunDots = [];
  for (let i = 0; i < pool.count && sunDots.length < 200; i++) {
    if (pool.owner[i] === sunOwner) sunDots.push(i);
  }
  if (sunDots.length < 2) return null;
  const aIdx = sunDots[Math.floor(rng() * sunDots.length)];
  const A = {
    x: pool.position[3*aIdx],
    y: pool.position[3*aIdx + 1],
    z: pool.position[3*aIdx + 2],
  };

  // Typ: 75% arch, 25% CME
  if (rng() < 0.75) {
    // Arch — najdi bod B v určitém span range
    let bIdx = -1;
    for (let tries = 0; tries < 40; tries++) {
      const candidate = sunDots[Math.floor(rng() * sunDots.length)];
      const B = {
        x: pool.position[3*candidate],
        y: pool.position[3*candidate + 1],
        z: pool.position[3*candidate + 2],
      };
      const d = Math.hypot(B.x - A.x, B.y - A.y, B.z - A.z);
      if (d >= sunRadius * PROMINENCE_SPAN_MIN && d <= sunRadius * PROMINENCE_SPAN_MAX) {
        bIdx = candidate;
        break;
      }
    }
    if (bIdx === -1) return null;
    const B = {
      x: pool.position[3*bIdx],
      y: pool.position[3*bIdx + 1],
      z: pool.position[3*bIdx + 2],
    };
    // Get IDLE dots
    const idle = pool.takeIdleIndices ? pool.takeIdleIndices(PROMINENCE_DOTS) : takeIdleFromMock(pool, PROMINENCE_DOTS);
    if (idle.length === 0) return null;
    const flare = {
      kind: 'arch',
      A, B,
      peak: sunRadius * PROMINENCE_PEAK_FACTOR,
      bornAt: time,
      dieAt: time + PROMINENCE_LIFETIME,
      indices: idle,
    };
    // Init tečky — pozice = A, barva jasně oranžová, alpha 1, phase FLYING (reuse)
    for (const i of idle) {
      pool.position[3*i] = A.x;
      pool.position[3*i+1] = A.y;
      pool.position[3*i+2] = A.z;
      pool.color[3*i] = 1.0;
      pool.color[3*i+1] = 0.7;
      pool.color[3*i+2] = 0.2;
      pool.alpha[i] = 1.0;
      if (pool.size) pool.size[i] = 5.0;
      if (pool.phase) pool.phase[i] = 99; // custom FLARE phase (viz níže)
      if (pool.owner) pool.owner[i] = sunOwner;
    }
    activeFlares.push(flare);
    return flare;
  } else {
    // CME — radial ejection
    const idle = pool.takeIdleIndices ? pool.takeIdleIndices(CME_DOTS) : takeIdleFromMock(pool, CME_DOTS);
    if (idle.length === 0) return null;
    // Direction = from center to A
    const nx = A.x, ny = A.y, nz = A.z;
    const len = Math.hypot(nx, ny, nz) || 1;
    const dx = nx / len, dy = ny / len, dz = nz / len;
    const flare = {
      kind: 'cme',
      A, dir: { x: dx, y: dy, z: dz },
      bornAt: time,
      dieAt: time + CME_LIFETIME,
      indices: idle,
    };
    for (const i of idle) {
      pool.position[3*i] = A.x;
      pool.position[3*i+1] = A.y;
      pool.position[3*i+2] = A.z;
      pool.color[3*i] = 1.0;
      pool.color[3*i+1] = 0.8;
      pool.color[3*i+2] = 0.3;
      pool.alpha[i] = 1.0;
      if (pool.size) pool.size[i] = 4.5;
      if (pool.phase) pool.phase[i] = 99;
      if (pool.owner) pool.owner[i] = sunOwner;
    }
    activeFlares.push(flare);
    return flare;
  }
}

function takeIdleFromMock(pool, n) {
  const out = [];
  for (let i = 0; i < pool.count && out.length < n; i++) {
    if (pool.phase && pool.phase[i] === 0) out.push(i);
  }
  return out;
}

function updateFlares(pool, time, dt) {
  for (let f = activeFlares.length - 1; f >= 0; f--) {
    const flare = activeFlares[f];
    const age = time - flare.bornAt;
    const lifetime = flare.dieAt - flare.bornAt;
    const t = Math.min(1, age / lifetime);
    if (flare.kind === 'arch') {
      for (const i of flare.indices) {
        const pos = parabolicArcPos(flare.A, flare.B, flare.peak, t);
        pool.position[3*i] = pos.x;
        pool.position[3*i+1] = pos.y;
        pool.position[3*i+2] = pos.z;
        // fade color oranžová→žlutá→surface (end fade to low alpha)
        pool.alpha[i] = t < 0.9 ? 1 : (1 - (t - 0.9) / 0.1);
      }
    } else {
      // cme — radial, rychlost roste, alpha klesá
      const dist = 0.8 * sunRadius * t + 1.2 * sunRadius * t * t;
      for (const i of flare.indices) {
        pool.position[3*i] = flare.A.x + flare.dir.x * dist;
        pool.position[3*i+1] = flare.A.y + flare.dir.y * dist;
        pool.position[3*i+2] = flare.A.z + flare.dir.z * dist;
        pool.alpha[i] = 1 - t;
      }
    }
    if (time >= flare.dieAt) {
      // Recycle dots → IDLE
      for (const i of flare.indices) {
        pool.alpha[i] = 0;
        if (pool.phase) pool.phase[i] = 0; // IDLE
        if (pool.owner) pool.owner[i] = -1;
      }
      activeFlares.splice(f, 1);
    }
  }
}
```

V `update()` (existující funkce) PŘED `// Spawn pokud interval uplynul` přidej:

```js
const flareInterval = intensity === 'high' ? 6 : 12;
if (time - lastFlareAt >= flareInterval) {
  if (spawnProminence(pool, time)) lastFlareAt = time;
}
updateFlares(pool, time, dt);
```

A na konci, za `pool.colorAttr.needsUpdate = true;` přidej:

```js
if (pool.posAttr) pool.posAttr.needsUpdate = true;
if (pool.alphaAttr) pool.alphaAttr.needsUpdate = true;
```

Do return přidej:

```js
_spawnProminence: spawnProminence,
_activeFlares: () => activeFlares,
```

- [ ] **Step 11.3: Spusť test — má projít**

Run: `npm test`
Expected: 2 nové testy pass (celkem v sunActivity.test.js 5).

- [ ] **Step 11.4: Commit**

```bash
git add src/sunActivity.js src/sunActivity.test.js
git commit -m "V3 T11: sunActivity — prominence arch + CME"
```

---

## Task 12 — Moon scale factor support

Podpora real-scale toggle pro orbity měsíců.

**Files:**
- Modify: `src/main.js`

- [ ] **Step 12.1: Rozšíř `updateMoonOrbits` o per-moon scale factor**

V `src/main.js` nahraď funkci `updateMoonOrbits` touto verzí (per-moon factor):

```js
/**
 * factorsByMoon: { [moonId]: number } — multiplier pro orbit semi-major axis (default 1).
 * Pro real-scale toggle obsahuje poměr realAPx / compressedAPx pro každý měsíc rodiče.
 */
function updateMoonOrbits(t, factorsByMoon = {}) {
  for (const m of MOONS) {
    const parent = PLANET_BY_ID[m.parent];
    const parentRadius = parent.radiusPx;
    const factor = factorsByMoon[m.id] ?? 1;
    const aPx = m.a * parentRadius * factor;
    const { x, z, E } = orbitPosition(t, m.phaseOffset, m.period, aPx, m.e);
    const moonAnchor = moonAnchors[m.id];
    if (!moonAnchor) continue;
    moonAnchor.position.set(x, 0, z);
    const nu = trueAnomaly(E, m.e);
    moonAnchor.rotation.y = nu + Math.PI;
    moonAnchor.updateMatrixWorld(true);
  }
}
```

Přidej modulární state + helpery (umísti poblíž `updateMoonOrbits`):

```js
let moonScaleFactors = {}; // { [moonId]: number }, pokud klíč chybí → 1

function computeRealFactor(m) {
  const parent = PLANET_BY_ID[m.parent];
  if (!parent.realDiameterKm || !m.realSemiMajorAxisKm) return 1;
  const kmPerPx = parent.realDiameterKm / (parent.radiusPx * 2);
  const realAPx = m.realSemiMajorAxisKm / kmPerPx;
  const compressedAPx = m.a * parent.radiusPx;
  return realAPx / compressedAPx;
}

function setMoonScaleReal(parentId, realOn) {
  for (const m of MOONS) {
    if (m.parent !== parentId) continue;
    moonScaleFactors[m.id] = realOn ? computeRealFactor(m) : 1;
  }
}
```

V `tick()` uprav volání na `updateMoonOrbits(elapsed, moonScaleFactors);`.

- [ ] **Step 12.2: Ověř — měsíce by měly se chovat stejně jako dřív**

Protože default `moonScaleFactors = {}`, factor je 1 a orbit stejný. Otevři `npm run serve` — měsíce mají stejné pozice.

- [ ] **Step 12.3: Ověř existing testy**

Run: `npm test` — pass.

- [ ] **Step 12.4: Commit**



```bash
git add src/main.js
git commit -m "V3 T12: moon orbit scale factor support"
```

---

## Task 13 — Integrace všeho v main.js

Tady se všechny kusy spojí.

**Files:**
- Modify: `src/main.js`

- [ ] **Step 13.1: Přidej importy**

Na začátek `src/main.js`, doplň:

```js
import { createPicker } from './picking.js';
import { createTooltip } from './tooltip.js';
import { createInfoPanel } from './infoPanel.js';
import { createDetailView, STATE as DV_STATE } from './detailView.js';
import { createSunActivity } from './sunActivity.js';
import { BODY_DATA } from './bodyData.js';
```

- [ ] **Step 13.2: Setup instancí po loaded**

V `Promise.all([loaded, moonsLoaded]).then(() => { ... })` blok, po `initAfterLoad();`, přidej:

```js
  // Picking setup
  const picker = createPicker({ scene, camera, canvas: renderer.domElement });
  for (const p of PLANETS) {
    picker.addBody(p.id, () => ({
      x: anchors[p.id].position.x,
      y: anchors[p.id].position.y,
      z: anchors[p.id].position.z,
    }), p.radiusPx * 1.5);
  }
  // Moons — přidáme je, ale deaktivujeme v main scéně (setActiveIds)
  for (const m of MOONS) {
    const moonAnchor = moonAnchors[m.id];
    picker.addBody(m.id, () => {
      const p = new THREE.Vector3();
      moonAnchor.getWorldPosition(p);
      return { x: p.x, y: p.y, z: p.z };
    }, Math.max(m.radiusPx * 2, 4));
  }
  // V main stavu aktivní = jen planets + sun
  picker.setActiveIds(new Set(PLANETS.map((p) => p.id)));

  const tooltip = createTooltip({ camera, canvas: renderer.domElement });
  const infoPanel = createInfoPanel();
  const sunActivity = createSunActivity({ sunOwner: 0, sunRadius: PLANETS[0].radiusPx });

  // Detail view wiring
  let pendingPauseFlag = false;
  const detailView = createDetailView({
    cameraFlyTo: (toPos, toTarget) => {
      // camera se updatuje per-frame v detailView.tick přes tween; ale ok — 
      // pro prostý fly-to použijeme paralelně tween, main.js drží current camera pos.
      _activeCameraTween = { toPos, toTarget, fromPos: { x: camera.position.x, y: camera.position.y, z: camera.position.z }, fromTarget: { ...controlsTarget }, t: 0, duration: 0.8 };
    },
    getCameraState: () => ({
      pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { ...controlsTarget },
    }),
    setPaused: (v) => { pendingPauseFlag = v; },
    fadeOthers: (focusId, alpha) => {
      const allBodies = [...PLANETS.map((p) => p.id), ...MOONS.map((m) => m.id)];
      for (let i = 0; i < PLANETS.length; i++) {
        const id = PLANETS[i].id;
        pool.setOwnerAlpha(i, id === focusId ? 1 : alpha);
      }
      for (let i = 0; i < MOONS.length; i++) {
        const id = MOONS[i].id;
        const ownerIdx = 9 + i;
        pool.setOwnerAlpha(ownerIdx, id === focusId ? 1 : alpha);
      }
    },
    showPanel: (id, opts) => infoPanel.show(id, opts),
    hidePanel: () => infoPanel.hide(),
    enableOrbit: (enabled, target) => {
      controls.enabled = enabled;
      if (enabled && target) {
        controls.target.set(target.x, target.y, target.z);
      }
    },
    getBodyPosition: (id) => {
      const p = PLANET_BY_ID[id];
      if (p) return { x: anchors[id].position.x, y: anchors[id].position.y, z: anchors[id].position.z };
      const mAnchor = moonAnchors[id];
      if (mAnchor) {
        const v = new THREE.Vector3();
        mAnchor.getWorldPosition(v);
        return { x: v.x, y: v.y, z: v.z };
      }
      return { x: 0, y: 0, z: 0 };
    },
    getBodyRadius: (id) => {
      const p = PLANET_BY_ID[id];
      if (p) return p.radiusPx;
      const m = MOONS.find((mm) => mm.id === id);
      return m ? Math.max(m.radiusPx, 3) : 1;
    },
    getBodyKind: (id) => BODY_DATA[id]?.kind || 'planet',
  });

  // Camera tween state (vlastní, ne uvnitř detailView)
  let _activeCameraTween = null;
  let controlsTarget = { x: 0, y: 0, z: 0 };

  // Picker eventy
  picker.onHover((id) => {
    if (id && detailView.state() === DV_STATE.MAIN) {
      tooltip.show(id, () => getBodyPosForTooltip(id));
    } else {
      tooltip.hide();
    }
  });
  picker.onClick((id) => {
    detailView.enter(id);
    // Při vstupu do planet-detail aktivuj moon picking pro dané měsíce
    const p = PLANET_BY_ID[id];
    if (p) {
      const childMoons = MOONS.filter((m) => m.parent === id).map((m) => m.id);
      picker.setActiveIds(new Set([...PLANETS.map((pp) => pp.id), ...childMoons]));
    }
  });

  function getBodyPosForTooltip(id) {
    const p = PLANET_BY_ID[id];
    if (p) return { x: anchors[id].position.x, y: anchors[id].position.y, z: anchors[id].position.z };
    const mAnchor = moonAnchors[id];
    if (mAnchor) {
      const v = new THREE.Vector3();
      mAnchor.getWorldPosition(v);
      return { x: v.x, y: v.y, z: v.z };
    }
    return { x: 0, y: 0, z: 0 };
  }

  // Panel close handler
  infoPanel.onClose(() => detailView.exit());
  infoPanel.onScaleToggle((on) => {
    detailView.toggleScale(on);
    const focusId = detailView.focusId();
    if (focusId) setMoonScaleReal(focusId, on);
  });

  // ESC handler
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && detailView.state() === DV_STATE.DETAIL) {
      detailView.exit();
    }
  });

  // Click outside body (canvas background) → exit
  // Řešíme přes onClick — pokud id === null a jsme v DETAIL, exit
  renderer.domElement.addEventListener('click', (e) => {
    if (detailView.state() !== DV_STATE.DETAIL) return;
    // Pokud klik nebyl na body (onClick se nezavolal s id), exit
    // Pomocný flag: picker.onClick se trigger jen na hit. Jiný listener zachytí všechny.
    // Zde použijeme: pokud current hover je null, exit.
    if (!tooltip.currentId()) {
      // Check next tick; pokud se onClick neprojeví, exit
      setTimeout(() => {
        if (detailView.state() === DV_STATE.DETAIL && !tooltip.currentId()) {
          // double-check: raycast znova
          // Skip pro jednoduchost — pointerdown na canvas mimo mesh = exit
          detailView.exit();
        }
      }, 50);
    }
  });

  // Do tick() loop přidáme volání:
  // detailView.tick(dt)
  // sunActivity.update(pool, elapsed, dt, { intensity: detailView.state() === DETAIL && detailView.focusId() === 'sun' ? 'high' : 'low' })
  // tooltip.update()
  // picker.update() (updatuje mesh pozice)
  // camera tween update
```

**Místo toho** (protože výše je moc komplexní inline kód), uprav `tick()` funkci přímo. Aktuální tick() zůstává, ale přidáme:

```js
function tick() {
  const tickStart = performance.now();
  const dt = paused ? 0 : clock.getDelta();
  elapsed += dt;

  // Camera tween (pro fly-to)
  if (_activeCameraTween) {
    const twn = _activeCameraTween;
    twn.t += dt;
    const u = Math.min(1, twn.t / twn.duration);
    const eased = u < 0.5 ? 4*u*u*u : 1 - Math.pow(-2*u + 2, 3) / 2;
    camera.position.set(
      twn.fromPos.x + (twn.toPos.x - twn.fromPos.x) * eased,
      twn.fromPos.y + (twn.toPos.y - twn.fromPos.y) * eased,
      twn.fromPos.z + (twn.toPos.z - twn.fromPos.z) * eased,
    );
    controlsTarget.x = twn.fromTarget.x + (twn.toTarget.x - twn.fromTarget.x) * eased;
    controlsTarget.y = twn.fromTarget.y + (twn.toTarget.y - twn.fromTarget.y) * eased;
    controlsTarget.z = twn.fromTarget.z + (twn.toTarget.z - twn.fromTarget.z) * eased;
    camera.lookAt(controlsTarget.x, controlsTarget.y, controlsTarget.z);
    if (u >= 1) _activeCameraTween = null;
  }

  // Detail view state update
  if (typeof detailView !== 'undefined') detailView.tick(dt);
  const inDetailPause = typeof detailView !== 'undefined' && (detailView.state() === DV_STATE.DETAIL || detailView.state() === DV_STATE.TRANSITION_IN);

  // Rotace planet + moons pokračuje i v detail view (chceme vidět spin + orbit)
  rotateAnchors(anchors, dt);
  updateMoonOrbits(elapsed, moonScaleFactors);

  // Solar wind + moon wind — pausne se v detail view
  if (!inDetailPause && typeof detailView !== 'undefined' ? detailView.state() === DV_STATE.MAIN : true) {
    updateSolarWind(pool, elapsed, dt, anchors, imageData);
    updateMoonWind(pool, elapsed, dt, anchors, moonAnchors, imageData, moonImageData);
  }
  pool.updateFlight(elapsed, dt);

  // Sun activity (sunspots + flares)
  if (typeof sunActivity !== 'undefined') {
    const isSunDetail = detailView.state() === DV_STATE.DETAIL && detailView.focusId() === 'sun';
    sunActivity.update(pool, elapsed, dt, { intensity: isSunDetail ? 'high' : 'low' });
  }

  const rotStart = performance.now();
  pool.applyClusterRotation(anchorsByIndex);
  const rotEnd = performance.now();

  // Picker updatuje mesh pozice (musí po applyClusterRotation)
  if (typeof picker !== 'undefined') picker.update();

  // OrbitControls (platí jen když enabled — v DETAIL)
  if (controls.enabled) controls.update();

  // Tooltip follow
  if (typeof tooltip !== 'undefined') tooltip.update();

  renderer.render(scene, camera);
  // ... rest stats code
}
```

Poznámka: refaktoring tick je komplexní, dělej tento step opatrně — ujisti se že struktura if/else je konzistentní.

- [ ] **Step 13.3: Upravit exit flow — reset moon picking active IDs**

V callback `setPaused: (v) => { ... }` a při exit (TRANSITION_OUT → MAIN), reset picker active IDs na jen planets+sun:

Lepší přístup — sledovat via `state().MAIN` a v tick updatovat:

```js
// V tick, za detailView.tick(dt):
if (detailView.state() === DV_STATE.MAIN) {
  picker.setActiveIds(new Set(PLANETS.map((pp) => pp.id)));
}
```

- [ ] **Step 13.4: Manual smoke test**

Run: `npm run serve`. V prohlížeči:

1. Hover over Jupiter → tooltip "JUPITER" objeví
2. Click on Jupiter → scéna pauzne, kamera odletí, info panel se objeví s daty
3. OrbitControls drag — kamera rotuje kolem Jupitera
4. Click na Io (v planet detail) → fly-to Io, panel se updatuje
5. ESC → návrat do main, scéna pokračuje
6. Toggle "Reálné měřítko" u planety → měsíce se rozprostřou
7. Sun: klik → detail view, vidíš sunspoty + občasnou prominence

Pokud něco nefunguje, debug pomocí browser console.

- [ ] **Step 13.5: Commit**

```bash
git add src/main.js
git commit -m "V3 T13: integrace picking + tooltip + detailView + infoPanel + sunActivity do main.js"
```

---

## Task 14 — Finální testy + README update

**Files:**
- Modify: `README.md`

- [ ] **Step 14.1: Run all tests**

Run: `npm test`
Expected: ≥55 pass, 0 fail.

- [ ] **Step 14.2: Update README**

V `README.md`, sekce Roadmap, uprav:

```markdown
- **V3** (aktuální): Click → detail view s info panelem, reálné měřítko toggle, drag-to-orbit kamera, živé Slunce (sunspoty + erupce).
```

A přesuň V1/V2 do "hotové".

V sekci Ovládání přidej:

```markdown
- Hover nad tělem — tooltip
- Klik na Slunce/planetu — detail view (ESC zavře)
- V detailu: drag myší = orbit kamera, scroll = zoom, checkbox = reálné měřítko
```

- [ ] **Step 14.3: Commit**

```bash
git add README.md
git commit -m "V3 T14: README update — V3 features popsány"
```

---

## Self-Review Checklist (for the planning engineer, before executing)

- Všechny spec sekce pokryty? Ano — hover, click, panel, real scale, sun vitality.
- Žádné placeholder? Zkontroluj znovu: všechny kódy jsou explicitní.
- Type consistency: `setOwnerAlpha`, `ownerAlphaMul`, `moonScaleFactors` — konsistentní napříč soubory.
- `tooltip.currentId()` — existuje v tooltip.js returnu? Ano.
- `_getPos` v picker? Není. Oprava v Task 13: použít `getBodyPosForTooltip` přímo.
- Testy: bodyData, cameraTween, picking, detailView, sunActivity — všechny pokryté.
