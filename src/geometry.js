// Pure helpers (bez Three.js) pro rozmístění bodů.

/**
 * Fibonacci sphere s volitelným jitter (default 1.0 = rozbije viditelnou
 * golden-ratio spirálu). Body leží přesně na povrchu sféry daného poloměru.
 * jitter=0 vypne, jitter=1 posune každý bod zhruba o polovinu sousedské vzdálenosti.
 */
export function fibonacciSphere(count, radius, jitter = 1.0) {
  const points = [];
  const phi = Math.PI * (Math.sqrt(5) - 1); // golden angle
  const jitterMag = count > 1 ? jitter * 2 / Math.sqrt(count) : 0;
  for (let i = 0; i < count; i++) {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    let x = Math.cos(theta) * r;
    let yy = y;
    let z = Math.sin(theta) * r;

    if (jitterMag > 0) {
      x += (Math.random() - 0.5) * jitterMag;
      yy += (Math.random() - 0.5) * jitterMag;
      z += (Math.random() - 0.5) * jitterMag;
      // renormalize na jednotkovou sféru — bod zůstane přesně na povrchu po vynásobení radiusem
      const len = Math.sqrt(x * x + yy * yy + z * z) || 1;
      x /= len;
      yy /= len;
      z /= len;
    }

    points.push([x * radius, yy * radius, z * radius]);
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
