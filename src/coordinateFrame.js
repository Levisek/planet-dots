// Ekliptika J2000 (x=jarní bod, z=ekliptický sever) → scene (y nahoru,
// orbitální rovina X-Z). Rotace −90° kolem X: (x,y,z) → (x, z, −y).
// Proper rotace (det=+1) → zachovává handedness, prograde zůstává prograde.
export function eclToScene(p) {
  return { x: p.x, y: p.z, z: -p.y };
}

export function sceneToEcl(p) {
  return { x: p.x, y: -p.z, z: p.y };
}
