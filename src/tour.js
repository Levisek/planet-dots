// tour — prohlídka soustavy: seznam zastávek s krátkým českým popiskem.
// Kamera přeletí k tělesu (detailView), chvíli ho předvádí (detailShow)
// a jede dál; po poslední zastávce začne znovu → spořič na televizi.
// Nápad z gcdatlas („tours"); zastávky a texty jsou naše.
//
// Čistý stavový automat bez three.js a DOM — testy v tour.test.js.
// Kreslení popisku řeší tourPanel.js, přelety main.js (deps.goTo).

// Zastávka u tělesa: příletový záběr 12 s + přejezd nad pól + 12 s
// (detailShow.SHOW_HOLD_SEC; přelety se do času nepočítají).
export const TOUR_HOLD_SEC = 24;
export const TOUR_OVERVIEW_SEC = 16;

/** id: null = přehled celé soustavy. Jména těles bere panel z BODY_DATA. */
export const TOUR_STOPS = [
  { id: null, name: 'Sluneční soustava', hold: TOUR_OVERVIEW_SEC,
    text: 'Osm planet, stovky měsíců a jedna hvězda. Všechno je tu poskládané z teček.' },
  { id: 'sun',
    text: 'Slunce drží 99,8 % hmoty celé soustavy. Jeho světlo letí k Zemi osm minut.' },
  { id: 'mercury',
    text: 'Nejmenší planeta, nejblíž Slunci. Rok tu trvá 88 dní. Ve dne je přes 400 °C, v noci −170 °C.' },
  { id: 'venus',
    text: 'Pod hustými mračny je 460 °C, víc než na Merkuru. Otáčí se pozpátku a den tu trvá déle než rok.' },
  { id: 'earth',
    text: 'Jediné místo, kde víme o životě. Oceány pokrývají sedm desetin povrchu.' },
  { id: 'luna',
    text: 'Obrací k nám stále stejnou tvář. Vznikl nejspíš z trosek po srážce Země s tělesem velkým jako Mars.' },
  { id: 'mars',
    text: 'Rudou barvu mu dává rez v prachu. Sopka Olympus Mons je vysoká přes 20 km, nejvyšší v soustavě.' },
  { id: 'ceres',
    text: 'Největší těleso pásu asteroidů mezi Marsem a Jupiterem a nejbližší trpasličí planeta.' },
  { id: 'jupiter',
    text: 'Největší planeta, těžší než všechny ostatní dohromady. Velká rudá skvrna je bouře větší než Země.' },
  { id: 'io',
    text: 'Sopečně nejčinnější těleso soustavy. Jupiter ho slapy hněte tak, že se uvnitř taví.' },
  { id: 'europa',
    text: 'Pod ledovou krustou je oceán. Vody v něm je víc než ve všech pozemských mořích.' },
  { id: 'saturn',
    text: 'Prstence jsou z ledu a kamení. Jsou široké stovky tisíc kilometrů a místy tenké jen desítky metrů.' },
  { id: 'titan',
    text: 'Jediný měsíc s hustou atmosférou. Prší tu metan a na povrchu jsou jezera kapalných uhlovodíků.' },
  { id: 'uranus',
    text: 'Obíhá položený na boku, osu má skloněnou o 98°. Každý pól má 42 let světlo a 42 let tmu.' },
  { id: 'neptune',
    text: 'Nejvzdálenější planeta, rok tu trvá 165 let. Vanou tu nejrychlejší větry soustavy, přes 2 000 km/h.' },
  { id: 'triton',
    text: 'Obíhá Neptun proti směru jeho otáčení. Nejspíš je to zachycené těleso z Kuiperova pásu.' },
];

/**
 * @param {{
 *   stops?: typeof TOUR_STOPS,
 *   goTo(stop): (boolean|void),  // pošle kameru na zastávku; false = teď to nejde, zkus příští snímek
 *   isBusy(): boolean,           // kamera letí / přechod stavu — čas zastávky stojí
 *   onChange?(info: {index:number, total:number, stop:object, auto:boolean}|null): void,
 * }} deps
 */
export function createTour({ stops = TOUR_STOPS, goTo, isBusy, onChange }) {
  const n = stops.length;
  let _i = -1;       // -1 = prohlídka neběží
  let _t = 0;        // čas strávený na zastávce (bez přeletů)
  let _pending = false;
  let _auto = false; // spuštěná sama po nečinnosti (spořič)

  const hold = () => stops[_i].hold ?? TOUR_HOLD_SEC;
  function go(i) {
    _i = ((i % n) + n) % n;
    _t = 0;
    _pending = true;
    if (onChange) onChange({ index: _i, total: n, stop: stops[_i], auto: _auto });
  }

  return {
    /** @param {{ auto?: boolean, from?: number }} [o] from — index první zastávky */
    start({ auto = false, from = 0 } = {}) {
      if (_i >= 0) return;
      _auto = auto;
      go(from);
    },
    stop() {
      if (_i < 0) return;
      _i = -1;
      _pending = false;
      if (onChange) onChange(null);
    },
    next() { if (_i >= 0) go(_i + 1); },
    prev() { if (_i >= 0) go(_i - 1); },
    active() { return _i >= 0; },
    isAuto() { return _i >= 0 && _auto; },
    index() { return _i; },
    /** Aktuální zastávka, nebo null. */
    current() { return _i < 0 ? null : stops[_i]; },
    /** Kolik času zastávky uplynulo (0..1) — pro proužek v popisku. */
    progress() { return _i < 0 ? 0 : Math.min(1, _t / hold()); },
    /** Index zastávky daného tělesa, nebo -1. */
    indexOf(id) { return stops.findIndex((s) => s.id === id); },
    tick(dt) {
      if (_i < 0) return;
      if (_pending) {
        if (goTo(stops[_i]) !== false) _pending = false;
        return;
      }
      if (isBusy()) return;
      _t += dt;
      if (_t >= hold()) go(_i + 1);
    },
  };
}
