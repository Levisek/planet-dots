// PHASE enum — samostatný modul bez Three.js závislosti,
// aby šel importovat i v čistě JS testech.

export const PHASE = Object.freeze({
  IDLE: 0,            // neemitovaná, čeká
  ON_SUN: 1,          // statická tečka na Slunci (initial fill)
  FLYING: 2,          // letí k cíli (ať už label nebo surface)
  HOLDING_LABEL: 3,   // dorazila k label pozici, drží
  ON_PLANET: 4,       // usazená na povrchu planety
  ON_RING: 5,         // usazená na prstenci
  ON_MOON: 6,         // usazená na povrchu měsíce
});

// Unified anchor index base pro měsíce v pool.owner[i].
// Planety obsazují 0..MOON_OWNER_BASE-1, měsíce MOON_OWNER_BASE..MOON_OWNER_BASE+18.
// Hodnota odpovídá PLANETS.length (9: Slunce + 8 planet).
export const MOON_OWNER_BASE = 9;
