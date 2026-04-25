// lighting — pure-math helpers pro směrové sluneční osvětlení.
// Sun je umístěn u své x-pozice (-1500); voxel shader vypočítá direction
// per fragment z `uSunPos` uniform. Tady jen helpers (test-friendly, no THREE).

// Vrátí uniform-like objekt { value: {x,y,z} } pro shader uSunPos.
// Plain {x,y,z} Three.js akceptuje pro vec3 uniform.
export function createSunUniform(sunPos) {
  return { value: { x: sunPos.x, y: sunPos.y, z: sunPos.z } };
}

// Pure-math helper: jednotkový vektor směřující z `point` k `sunPos`.
export function computeSunDirection(point, sunPos) {
  const dx = sunPos.x - point.x;
  const dy = sunPos.y - point.y;
  const dz = sunPos.z - point.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  return { x: dx / len, y: dy / len, z: dz / len };
}
