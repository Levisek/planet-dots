/**
 * Pure ray-sphere intersection — žádná THREE závislost, testovatelné v node.
 * @param {{ x, y, z }} origin  — počátek paprsku
 * @param {{ x, y, z }} dir     — směr paprsku (normalizovaný)
 * @param {{ x, y, z }} center  — střed sféry
 * @param {number}      radius  — poloměr sféry
 * @returns {number|null} t parametr (kladný = před kamerou), null = žádný hit.
 */
export function rayHitsSphere(origin, dir, center, radius) {
  const ox = origin.x - center.x;
  const oy = origin.y - center.y;
  const oz = origin.z - center.z;
  const b = ox * dir.x + oy * dir.y + oz * dir.z;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const sqrt = Math.sqrt(disc);
  const t0 = -b - sqrt;
  const t1 = -b + sqrt;
  if (t0 >= 0) return t0;
  if (t1 >= 0) return t1;
  return null;
}
