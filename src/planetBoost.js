// planetBoost — zvětšení planet v přehledu Pochopení.
//
// Věrné poloměry (Země 8 j.) jsou při dráhách o poloměru tisíců jednotek
// z výchozí kamery sub-pixelové: planety jsou jen tečky a poznají se
// podle popisku. V Pochopení se proto v přehledu (MAIN) škálují — vnitřní
// planety víc (nejmenší byly nejméně vidět), obři méně (ať se Saturnův
// prsten nevejde do dráhy Jupiteru ani Uranu). Škáluje se `spin` node:
// mesh, tečky i prsten pod ním. V detailu a ve Fyzikálním je násobitel 1
// (věrné poměry, detail beze změny).

export const PLANET_BOOST = {
  mercury: 12,
  venus: 8,
  earth: 8,
  mars: 11,
  jupiter: 1.7,
  saturn: 1.5,
  uranus: 3,
  neptune: 3,
};

/**
 * Násobitel poloměru planety.
 * @param {string} id
 * @param {number} weight — 0 (věrná velikost) .. 1 (plný boost v přehledu)
 */
export function planetBoost(id, weight) {
  const b = PLANET_BOOST[id] ?? 1;
  const w = Math.min(1, Math.max(0, weight));
  return 1 + (b - 1) * w;
}
