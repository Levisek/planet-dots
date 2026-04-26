// Sdílené helpery pro sampling textur + sférické UV.
// Používají solarWind, moonWind, particles.initFullSun a bodyMesh.

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
