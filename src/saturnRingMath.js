// saturnRingMath — pure sampler pro Saturnův prsten (test-friendly).
// Ring textura je 1D radiální gradient (RGBA): inner = u 0, outer = u 1.

/**
 * Vrátí [r, g, b, a] 0..1 pro radiální t (0 = inner, 1 = outer).
 * Vzorkuje prostřední řádek obrázku.
 */
export function sampleRingColor(imageData, t) {
  const { data, width, height } = imageData;
  const py = Math.floor(height / 2);
  const px = Math.min(width - 1, Math.max(0, Math.floor(t * width)));
  const idx = (py * width + px) * 4;
  return [data[idx] / 255, data[idx + 1] / 255, data[idx + 2] / 255, data[idx + 3] / 255];
}
