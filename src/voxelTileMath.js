// voxelTileMath — pure math helpers pro voxel tile rendering (test-friendly,
// no THREE). Hex geometry + tangent frame výpočet pro instance na sféře.

/**
 * Base hexagon geometry v XY rovině (Z = 0).
 * Center vrchol + 6 rohů na kružnici. 6 trojúhelníků fan.
 *
 * @param {number} radius — circumradius hexagonu
 * @returns {{ positions: Float32Array, indices: Uint16Array }}
 */
export function buildHexagonGeometry(radius) {
  const positions = new Float32Array(7 * 3);
  const indices = new Uint16Array(6 * 3);

  // Center
  positions[0] = 0;
  positions[1] = 0;
  positions[2] = 0;

  // 6 rohů na kružnici
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    positions[(i + 1) * 3 + 0] = Math.cos(angle) * radius;
    positions[(i + 1) * 3 + 1] = Math.sin(angle) * radius;
    positions[(i + 1) * 3 + 2] = 0;
  }

  // 6 trojúhelníků: center + corner[i] + corner[i+1]
  for (let i = 0; i < 6; i++) {
    const next = ((i + 1) % 6) + 1;
    indices[i * 3 + 0] = 0;
    indices[i * 3 + 1] = i + 1;
    indices[i * 3 + 2] = next;
  }

  return { positions, indices };
}

const _UP = [0, 1, 0];
const _FORWARD = [0, 0, 1];

/**
 * Tangent frame pro vrchol na sféře.
 * normal = normalized(vertex), tangent = projection UP na tangent plane.
 * Pokud normal ≈ ±UP (pole), použije FORWARD jako fallback.
 *
 * @param {number[]|Float32Array} vertex — [x, y, z]
 * @returns {{ normal: number[], tangent: number[] }} oba jednotkové
 */
export function computeTangentFrame(vertex) {
  const len = Math.sqrt(vertex[0] ** 2 + vertex[1] ** 2 + vertex[2] ** 2) || 1;
  const normal = [vertex[0] / len, vertex[1] / len, vertex[2] / len];

  const dotUp = Math.abs(normal[1]);
  const ref = dotUp > 0.99 ? _FORWARD : _UP;

  const d = ref[0] * normal[0] + ref[1] * normal[1] + ref[2] * normal[2];
  const tx = ref[0] - d * normal[0];
  const ty = ref[1] - d * normal[1];
  const tz = ref[2] - d * normal[2];
  const tlen = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
  return {
    normal,
    tangent: [tx / tlen, ty / tlen, tz / tlen],
  };
}
