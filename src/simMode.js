// simMode — dva režimy simulace.
//
//   POCHOPENÍ (default): vizuálně srozumitelný — outer planety zrychlené,
//     compressed sqrt mapping vzdáleností, eccentricity moonů max 0.05.
//   FYZIKÁLNÍ: real proporce. Linear AU mapping (Neptune ~10× dál než Earth),
//     real periody (Iapetus 84× pomalejší než Mimas), real eccentricity včetně
//     extrémní Nereid e=0.75.
//
// Každá data zdroj (planets.js, moons.js) drží oba sady polí: `orbitRadius`/
// `orbitRadiusReal` a `period`/`periodReal`. Getteři níže vrátí podle mode.

const MODE = {
  POCHOPENI: 'pochopeni',
  FYZIKALNI: 'fyzikalni',
};

let _current = MODE.POCHOPENI;
const _listeners = [];

export function getMode() { return _current; }

export function setMode(id) {
  if (id !== MODE.POCHOPENI && id !== MODE.FYZIKALNI) return;
  if (_current === id) return;
  _current = id;
  for (const cb of _listeners) cb(_current);
}

export function onModeChange(cb) { _listeners.push(cb); }

export function isFyzikalni() { return _current === MODE.FYZIKALNI; }

// --- Data resolvers ---

/** Aktuální orbitRadius planety podle mode. Sun (orbitRadius=0) vždy 0. */
export function getOrbitRadius(planet) {
  if (planet.orbitRadius === 0) return 0;
  return _current === MODE.FYZIKALNI && planet.orbitRadiusReal !== undefined
    ? planet.orbitRadiusReal
    : planet.orbitRadius;
}

/** Aktuální period planety. */
export function getOrbitalPeriod(planet) {
  return _current === MODE.FYZIKALNI && planet.orbitalPeriodSecReal !== undefined
    ? planet.orbitalPeriodSecReal
    : planet.orbitalPeriodSec;
}

/** Aktuální eccentricity moonu. Default v fyzikálním = real, v pochopení = clamp 0.05 */
export function getMoonE(moon) {
  return _current === MODE.FYZIKALNI && moon.eReal !== undefined
    ? moon.eReal
    : moon.e;
}

/** Aktuální period moonu (kolem rodičovské planety). */
export function getMoonPeriod(moon) {
  return _current === MODE.FYZIKALNI && moon.periodReal !== undefined
    ? moon.periodReal
    : moon.period;
}

// --- Inclination with per-category clamp ---

const INCLINATION_CAPS = {
  planet: 5,
  moon: 15,
  irregular: 30,
  dwarf: 30,
};

export function getInclination(body) {
  const real = body.inclinationDeg;
  if (real === undefined) return 0;
  if (_current === MODE.FYZIKALNI) return real;

  const cap = INCLINATION_CAPS[body.category] ?? 15;
  const effective = real > 90 ? 180 - real : real;
  const clamped = Math.min(effective, cap);
  return real > 90 ? 180 - clamped : clamped;
}

export const MODES = MODE;
