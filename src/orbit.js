/**
 * Newton-Raphson solver pro Keplerovu rovnici E - e·sin(E) = M.
 * @param {number} M — mean anomaly (rad)
 * @param {number} e — eccentricity (0..1)
 * @param {number} [iterations=5]
 * @returns {number} E — eccentric anomaly
 */
export function solveKepler(M, e, iterations = 5) {
  let E = M;
  for (let i = 0; i < iterations; i++) {
    E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

/**
 * Pozice na eliptické orbitě v lokálním frame (X-Z rovina, Y=0).
 * Focus v originu, periapsis na +X ose.
 * @param {number} t — absolutní čas (sec)
 * @param {number} phaseOffset — fázový offset (rad)
 * @param {number} period — perioda oběhu (sec)
 * @param {number} a — semi-major axis (px)
 * @param {number} e — eccentricity
 * @returns {{x:number, y:number, z:number, E:number}}
 */
export function orbitPosition(t, phaseOffset, period, a, e) {
  const M = (2 * Math.PI * t) / period + phaseOffset;
  const E = solveKepler(M, e);
  const x = a * (Math.cos(E) - e);
  const z = a * Math.sqrt(1 - e * e) * Math.sin(E);
  return { x, y: 0, z, E };
}

/**
 * True anomaly ν z eccentric anomaly E (pro tidal lock spin angle).
 */
export function trueAnomaly(E, e) {
  return 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2),
  );
}

/**
 * Rotuje 3D pozici kolem osy X o `incDeg` stupňů.
 * Pro inc=0 noop. Pro inc=90 flip Y/Z. Pro inc>90 retrograde flip plane.
 * @param {{x:number, y:number, z:number}} pos
 * @param {number} incDeg
 * @returns {{x:number, y:number, z:number}}
 */
export function applyInclination(pos, incDeg) {
  if (incDeg === 0) return { x: pos.x, y: pos.y, z: pos.z };
  const r = (incDeg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return {
    x: pos.x,
    y: pos.y * c - pos.z * s,
    z: pos.y * s + pos.z * c,
  };
}
