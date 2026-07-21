// Komprese vzdálenosti pro Pochopení mód (sdílené simMode i planetOrbits).
export function auToDisplayRadius(au) {
  return 1100 + 350 * Math.sqrt(au);
}
