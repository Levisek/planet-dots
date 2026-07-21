// Ephemeris backend: astronomy-engine (vendor) → scene-frame AU.
//
// POZN. k API (ověřeno proti vendor/astronomy/astronomy.js, viz smoke test):
// Astronomy.Ecliptic(v) NENÍ ekliptika J2000 — dle dokumentace v knihovně
// "Converts EQJ vector to a TRUE ECLIPTIC OF DATE (ECT)", tzn. zahrnuje
// precesi/nutaci k danému datu a je časově proměnná. To by rozbilo pevný
// scene frame z coordinateFrame.js (ten předpokládá stálou ekliptiku J2000).
// Místo toho používáme Rotation_EQJ_ECL() — konstantní rotační matici
// EQJ → J2000 mean ecliptic (ECL) — a RotateVector/RotateState s ní.
import * as Astronomy from '../vendor/astronomy/astronomy.js';
import { eclToScene } from './coordinateFrame.js';

const PLANET_BODY = {
  sun: Astronomy.Body.Sun, mercury: Astronomy.Body.Mercury,
  venus: Astronomy.Body.Venus, earth: Astronomy.Body.Earth,
  mars: Astronomy.Body.Mars, jupiter: Astronomy.Body.Jupiter,
  saturn: Astronomy.Body.Saturn, uranus: Astronomy.Body.Uranus,
  neptune: Astronomy.Body.Neptune,
};

// Pevná rotace EQJ → ekliptika J2000 (nezávisí na čase).
const EQJ_TO_ECL = Astronomy.Rotation_EQJ_ECL();

// EQJ vektor (Vector/StateVector, {x,y,z,...}) → ekliptika J2000 → scene frame.
function eqjToScene(v) {
  const ecl = Astronomy.RotateVector(EQJ_TO_ECL, v);
  return eclToScene({ x: ecl.x, y: ecl.y, z: ecl.z });
}

export function ephemHelio(bodyId, date) {
  const body = PLANET_BODY[bodyId];
  if (body === Astronomy.Body.Sun) return { x: 0, y: 0, z: 0 };
  const t = Astronomy.MakeTime(date);
  return eqjToScene(Astronomy.HelioVector(body, t));
}

export function ephemMoonRelative(moonId, date) {
  const t = Astronomy.MakeTime(date);
  if (moonId === 'luna') {
    const g = Astronomy.GeoVector(Astronomy.Body.Moon, t, false); // geocentr. EQJ, AU
    return eqjToScene(g);
  }
  const jm = Astronomy.JupiterMoons(t); // stavové vektory vůči Jupiteru, EQJ, AU
  return eqjToScene(jm[moonId]);
}
