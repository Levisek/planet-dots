// planetBoost — zvětšení planet v přehledu Pochopení.
//
// Věrné poloměry (Země 8 j.) jsou při dráhách o poloměru tisíců jednotek
// z výchozí kamery sub-pixelové: planety jsou jen tečky a poznají se
// podle popisku. V Pochopení se proto v přehledu (MAIN) škálují — vnitřní
// planety víc (nejmenší byly nejméně vidět), obři méně (ať se Saturnův
// prsten nevejde do dráhy Jupiteru ani Uranu). Škáluje se `spin` node:
// mesh, tečky i prsten pod ním. V detailu a ve Fyzikálním je násobitel 1
// (věrné poměry, detail beze změny).

// Po natažení drah (scale.js, mocnina AU^0,6) je mezi obry místo:
// zvětšení obrů víc, vnitřních o kus (mezery mezi nimi jsou pořád ~400).
export const PLANET_BOOST = {
  mercury: 14,
  venus: 10,
  earth: 10,
  mars: 13,
  jupiter: 4,
  saturn: 3.5,
  uranus: 7,
  neptune: 7,
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
