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

// timeScale — globální scalar pro time simulation (0.1x – 5x, default 0.5)
let _timeScale = 0.5;
let _userOverrideTimeScale = false;
const _timeScaleListeners = [];

export function getMode() { return _current; }

export function setMode(id) {
  if (id !== MODE.POCHOPENI && id !== MODE.FYZIKALNI) return;
  if (_current === id) return;
  _current = id;
  // Auto-default timeScale per mode pokud user nemá explicit override
  if (!_userOverrideTimeScale) {
    const newScale = id === MODE.POCHOPENI ? 0.5 : 1.0;
    if (newScale !== _timeScale) {
      _timeScale = newScale;
      for (const cb of _timeScaleListeners) cb(_timeScale);
    }
  }
  for (const cb of _listeners) cb(_current);
}

export function onModeChange(cb) {
  _listeners.push(cb);
  return () => {
    const i = _listeners.indexOf(cb);
    if (i >= 0) _listeners.splice(i, 1);
  };
}

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

/** Univerzální getter pro eccentricity — vrátí eReal v FYZIKALNI mode, jinak e. */
export function getEccentricity(body) {
  if (_current === MODE.FYZIKALNI && body.eReal !== undefined) return body.eReal;
  return body.e ?? 0;
}

// Backward-compat alias — deprecate v F4 cleanup
export const getMoonE = getEccentricity;

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

// --- timeScale getter/setter + listeners ---

export function getTimeScale() { return _timeScale; }

export function setTimeScale(x) {
  if (x === _timeScale) return;
  _timeScale = x;
  _userOverrideTimeScale = true;
  for (const cb of _timeScaleListeners) cb(_timeScale);
}

export function onTimeScaleChange(cb) {
  _timeScaleListeners.push(cb);
  return () => {
    const i = _timeScaleListeners.indexOf(cb);
    if (i >= 0) _timeScaleListeners.splice(i, 1);
  };
}

export function _resetTimeScaleOverride() { _userOverrideTimeScale = false; }
export function _isTimeScaleOverridden() { return _userOverrideTimeScale; }

export const MODES = MODE;
