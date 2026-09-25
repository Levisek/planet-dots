// Ekliptika J2000 (x=jarní bod, z=ekliptický sever) → scene (y nahoru,
// orbitální rovina X-Z). Rotace −90° kolem X: (x,y,z) → (x, z, −y).
// Proper rotace (det=+1) → zachovává handedness, prograde zůstává prograde.
export function eclToScene(p) {
  return { x: p.x, y: p.z, z: -p.y };
}

export function sceneToEcl(p) {
  return { x: p.x, y: -p.z, z: p.y };
}

// Sklon zemské osy J2000 (IAU 2006) — rovník EQJ vs. ekliptika J2000.
const OBLIQUITY_J2000_RAD = (23.4392911 * Math.PI) / 180;

// Severní pól rotace tělesa zadaný rektascenzí/deklinací (IAU WGCCRE, EQJ)
// → jednotkový vektor ve scene frame. Z pólu se staví orientace planety,
// takže rovník (a Saturnův prstenec) leží ve stejné rovině jako dráhy
// měsíců z efemerid/JPL elementů — jeden skalár `axialTilt` kolem osy X
// to nezaručí, chybí mu uzel (kam je osa skloněná).
export function poleToScene(raDeg, decDeg) {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  const x = Math.cos(dec) * Math.cos(ra);
  const y = Math.cos(dec) * Math.sin(ra);
  const z = Math.sin(dec);
  const c = Math.cos(OBLIQUITY_J2000_RAD);
  const s = Math.sin(OBLIQUITY_J2000_RAD);
  return eclToScene({ x, y: y * c + z * s, z: -y * s + z * c });
}
