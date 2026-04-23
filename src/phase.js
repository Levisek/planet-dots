// PHASE enum — samostatný modul bez Three.js závislosti,
// aby šel importovat i v čistě JS testech (animation.test.js).

export const PHASE = Object.freeze({
  IDLE: 0,           // rezerva
  FREE: 1,           // vznáší se v Perlin noise
  FORMING_LABEL: 2,  // letí k label pozici
  HOLDING_LABEL: 3,  // drží v label pozici
  FLYING_TO_PLANET: 4,
  ON_PLANET: 5,
  ON_RING: 6,
});
