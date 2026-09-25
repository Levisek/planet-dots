// Sdílené helpery pro sampling textur + sférické UV.
// Používají formationIntro, moonWind, particles.initFullSun a bodyMesh.

/** RGB [0..1] z ImageData podle UV [0..1]. */
export function sampleColor(imageData, u, v) {
  const { data, width, height } = imageData;
  const px = Math.min(width - 1, Math.max(0, Math.floor(u * width)));
  const py = Math.min(height - 1, Math.max(0, Math.floor((1 - v) * height)));
  const idx = (py * width + px) * 4;
  return [data[idx] / 255, data[idx + 1] / 255, data[idx + 2] / 255];
}

/** UV na jednotkové sféře z kartézských souřadnic. radius = vzdálenost bodu od středu. */
export function sphericalUV(x, y, z, radius) {
  const u = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
  const v = Math.asin(y / radius) / Math.PI + 0.5;
  return [u, v];
}

/**
 * Sampling s ochranou proti pólové artefakty — equirectangular textury mívají
 * tmavý horní/dolní pixel, který by způsobil černý pól. Clamp v na [0.03, 0.97].
 * Stejný problém je i na meridianu (u≈0/1) u Wikimedia měsíčních map: krajní
 * sloupec je často tmavý / nesouvislý → svislá černá čára přes celý měsíc.
 * Clamp u na [0.005, 0.995] posune sampling o ~1 px od okraje.
 */
export function sampleColorPoleSafe(imageData, u, v) {
  const vSafe = Math.max(0.03, Math.min(0.97, v));
  const uSafe = Math.max(0.005, Math.min(0.995, u));
  return sampleColor(imageData, uSafe, vSafe);
}

/**
 * sRGB složka (0..1, jak leží v ImageData) → lineární. Vertex colors meshů
 * three.js bere jako lineární a při výstupu do sRGB je gama-koriguje — bez
 * převodu šla korekce dvakrát a textury byly vybledlé (světle modrý oceán,
 * mdlý Jupiter) a mesh při odkrytí po formaci „poskočil" jasem oproti
 * tečkám. Tečky a prstenec (ShaderMaterial) převod NEPOTŘEBUJÍ — jejich
 * shader výstup nekóduje, takže surové sRGB hodnoty projdou beze změny.
 */
export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
