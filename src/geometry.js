// Pure helpers (bez Three.js) pro rozmístění bodů.

/**
 * Uniformní náhodné rozložení bodů na kouli pomocí Marsaglia metody.
 * Nevytváří viditelnou spirálu/pattern jako Fibonacci (golden ratio má u pólů
 * konvergentní spirálu viditelnou lidskému oku). Kompromis: drobný
 * Poisson-clustering (některá místa hustší) — vizuálně mnohem méně rušivý
 * než spirála na texturovaných planetách.
 *
 * Funkce si jméno ponechává kvůli callerům; vnitřně je teď random.
 */
export function fibonacciSphere(count, radius) {
  const points = [];
  for (let i = 0; i < count; i++) {
    // Marsaglia: sample uniformly z jednotkové krychle, odmítni mimo-kouli, pak normalize.
    let x, y, z, d2;
    do {
      x = 2 * Math.random() - 1;
      y = 2 * Math.random() - 1;
      z = 2 * Math.random() - 1;
      d2 = x * x + y * y + z * z;
    } while (d2 > 1 || d2 < 1e-8);
    const d = Math.sqrt(d2);
    points.push([x / d * radius, y / d * radius, z / d * radius]);
  }
  return points;
}

export function ringPoints(count, innerRadius, outerRadius) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const t = Math.random();
    const r = Math.sqrt(innerRadius * innerRadius + t * (outerRadius * outerRadius - innerRadius * innerRadius));
    const theta = Math.random() * Math.PI * 2;
    points.push([Math.cos(theta) * r, Math.sin(theta) * r, 0]);
  }
  return points;
}
