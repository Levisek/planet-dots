// Animation timeline — vznik soustavy jako věrný příběh (docs/vznik-plan.md).
// Scény jdou za sebou; skutečný čas od prvních pevných zrn (CAI, před
// 4,567 mld let) ukazuje realYearsAt. Data a pořadí podle datování
// meteoritů a modelů — kde si věda není jistá, říká to popisek.
//
// Mechaniky, které na scény navazují:
//   cloud/shock/collapse — formationIntro: mrak, rázová vlna, zploštění do disku
//   disk — keplerovská rotace, sněžná čára
//   ACCRETION_WINDOWS — planety rostou z prachu své zóny (Jupiter první)
//   clearing — plyn odfouknut, zůstanou planetesimály
//   fusion — formationFilm.sunGlow: Slunce zažehne fúzi
//   PHASES (_moons) — měsíce z povrchu rodičů (moonWind)
//   LIVE_START — živý stav, simClock přebírá čas

export const SCENES = [
  { id: 'cloud', start: 0, label: 'Chladný mrak plynu a prachu',
    fact: 'Je větší než celá dnešní soustava a pomalu se otáčí.' },
  { id: 'shock', start: 8, label: 'Rázová vlna',
    fact: 'Mrak nejspíš stlačila vlna z umírající hvězdy. Zůstal po ní hliník-26 v meteoritech.' },
  { id: 'collapse', start: 12, label: 'Mrak se hroutí',
    fact: 'Za zhruba 100 tisíc let se roztočí do placky. Uprostřed se rodí Slunce.' },
  { id: 'disk', start: 20, label: 'Protoplanetární disk',
    fact: 'Vnitřek obíhá rychleji než okraj. Za sněžnou čarou mrzne voda na led.' },
  { id: 'giants', start: 28, label: 'Jupiter vzniká první',
    fact: 'Jádro má do milionu let a vyhloubí v disku mezeru. Po něm Saturn, Uran a Neptun.' },
  { id: 'clearing', start: 38, label: 'Plyn mizí',
    fact: 'Mladé Slunce ho do 4 milionů let vyfouká. Obři už nic nenaberou.' },
  { id: 'rocky', start: 44, label: 'Kamenné planety',
    fact: 'Mars byl hotový za pár milionů let. Země roste srážkami desítky milionů let.' },
  { id: 'fusion', start: 54, label: 'Slunce se stává hvězdou',
    fact: 'Po desítkách milionů let se v jeho jádru zažehne fúze vodíku.' },
  { id: 'migration', start: 58, label: 'Obři se stěhují',
    fact: 'Neptun se odstěhuje ven a rozmetá zbytky. Podle modelů asi 60 milionů let po vzniku.' },
  { id: 'theia', start: 64, label: 'Srážka s Theiou',
    fact: 'Těleso velké jako Mars narazí do Země. Z trosek vzniká Měsíc. Kdy přesně, se neví.' },
  { id: 'today', start: 70, label: 'Dnes',
    fact: 'Od prvních zrnek prachu uběhlo 4,57 miliardy let.' },
];

export const LIVE_START = 76.0;

/** Čas začátku scény (s). */
export const sceneStart = (id) => SCENES.find((s) => s.id === id).start;
/** Konec scény = začátek další (u poslední LIVE_START). */
export function sceneEnd(id) {
  const i = SCENES.findIndex((s) => s.id === id);
  return i + 1 < SCENES.length ? SCENES[i + 1].start : LIVE_START;
}

/** Scéna v čase t (po LIVE_START poslední). */
export function sceneAt(t) {
  let cur = SCENES[0];
  for (const s of SCENES) {
    if (t >= s.start) cur = s;
    else break;
  }
  return cur;
}

// Skutečný čas (roky od CAI) na začátcích scén; mezi nimi logaritmicky.
// Před kolapsem (mrak, vlna) se nepočítá. Zdroje v docs/vznik-plan.md.
const AGE_KEYS = [
  [12, 0], [20, 1e5], [28, 5e5], [38, 3e6], [44, 5e6], [54, 3e7],
  [58, 4e7], [64, 6e7], [70, 1e8], [LIVE_START, 4.567e9],
];
export const SOLAR_AGE_YEARS = 4.567e9;

/** Roky od vzniku prvních zrn (CAI) v čase filmu t; před kolapsem null. */
export function realYearsAt(t) {
  if (t < AGE_KEYS[0][0]) return null;
  if (t >= LIVE_START) return SOLAR_AGE_YEARS;
  for (let i = 0; i < AGE_KEYS.length - 1; i++) {
    const [t0, y0] = AGE_KEYS[i];
    const [t1, y1] = AGE_KEYS[i + 1];
    if (t > t1) continue;
    const u = (t - t0) / (t1 - t0);
    // log(1 + y) — první úsek začíná nulou.
    return Math.expm1(Math.log1p(y0) + (Math.log1p(y1) - Math.log1p(y0)) * u);
  }
  return SOLAR_AGE_YEARS;
}

const num = (x, d) => x.toLocaleString('cs-CZ', { maximumFractionDigits: d, minimumFractionDigits: 0 });
/** Česky: „před 4,57 mld let" / „100 tis. let" / „3,2 mil. let" / „dnes". */
export function formatAge(years) {
  if (years === null) return 'před 4,57 mld let';
  if (years >= SOLAR_AGE_YEARS) return 'dnes';
  if (years < 1e3) return `${num(Math.round(years / 10) * 10, 0)} let`;
  if (years < 1e6) return `${num(Math.round(years / 1e3), 0)} tis. let`;
  if (years < 1e9) return `${num(years / 1e6, years < 1e7 ? 1 : 0)} mil. let`;
  return `${num(years / 1e9, 2)} mld let`;
}

// Okna růstu planet z prachu jejich zóny. Jupiter první (jádro do ~1 mil.
// let, Kruijer 2017), Mars brzy (2–4 mil. let), Merkur, Venuše a Země až
// po odfouknutí plynu (srážky zárodků, desítky mil. let).
export const ACCRETION_WINDOWS = [
  { planetId: 'mercury', start: 44,   end: 50 },
  { planetId: 'venus',   start: 45,   end: 51.5 },
  { planetId: 'earth',   start: 46,   end: 53 },
  { planetId: 'mars',    start: 31,   end: 35 },
  { planetId: 'jupiter', start: 28,   end: 32 },
  { planetId: 'saturn',  start: 29.5, end: 34 },
  { planetId: 'uranus',  start: 31.5, end: 36 },
  { planetId: 'neptune', start: 32.5, end: 37 },
];

// Měsíce: pravidelné měsíce obrů vznikají v jejich vlastních discích ještě
// s plynem; Měsíc až po srážce s Theiou; Triton je zachycený při stěhování.
export const PHASES = [
  { start: 66.0, end: 69.0, id: 'earth_moons',   parentId: 'earth' },
  { start: 52.0, end: 53.0, id: 'mars_moons',    parentId: 'mars' },
  { start: 35.0, end: 37.0, id: 'jupiter_moons', parentId: 'jupiter' },
  { start: 36.0, end: 38.5, id: 'saturn_moons',  parentId: 'saturn' },
  { start: 38.5, end: 40.0, id: 'uranus_moons',  parentId: 'uranus' },
  { start: 61.0, end: 63.0, id: 'neptune_moons', parentId: 'neptune' },
];

/** Reset per-phase emission counters (volá se při restartu animace). */
export function resetPhaseEmissions() {
  for (const ph of PHASES) {
    delete ph._emittedCount;
    delete ph._done;
  }
}
