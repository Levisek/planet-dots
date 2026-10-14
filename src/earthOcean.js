// earthOcean — oceán Země jednou přirozenou barvou. Blue Marble s reliéfem
// dna (textures/earth.jpg) má mělčiny světle modré: v ploškách povrchu
// vypadaly jako další pevnina a pobřeží se trhalo. Pevnina, led a mraky
// zůstanou z textury, oceán dostane hlubokou modř s jemnou stopou originálu.

const DEEP = [10, 26, 66];
const KEEP = 0.15; // kolik z původní barvy oceánu zůstane (ať není jako plast)

/** Oceán: modrá jasně převládá nad červenou i zelenou (i mělčiny), nebo
 *  nejhlubší oceán — skoro černý, modrá aspoň nepodléhá (zelený prales ne). */
export function isOcean(r, g, b) {
  return (b > 24 && b > 1.8 * r && b > 1.3 * g) || (b <= 40 && b >= r && b >= g);
}

/** Přebarví oceán v RGBA poli (ImageData.data) na místě. */
export function flattenOcean(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (!isOcean(r, g, b)) continue;
    data[i] = Math.round(DEEP[0] + (r - DEEP[0]) * KEEP);
    data[i + 1] = Math.round(DEEP[1] + (g - DEEP[1]) * KEEP);
    data[i + 2] = Math.round(DEEP[2] + (b - DEEP[2]) * KEEP);
  }
  return data;
}
