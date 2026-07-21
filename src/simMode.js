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

import { auToDisplayRadius } from './scale.js';

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

// LEGACY (pre-V4.4): používá stará animační cesta; odstranit po plné migraci na positionProvider.

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

// LEGACY (pre-V4.4): používá stará animační cesta; odstranit po plné migraci na positionProvider.
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

/** Derived helper — true pokud má těleso retrográdní oběh (inclinationDeg > 90). */
export function isRetrograde(body) {
  return (body.inclinationDeg ?? 0) > 90;
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

// --- Mód jako zobrazovací transformace (V4.4 position path) ---

const LINEAR_AU = 3846;

/** Scéna pozice planety (AU → scene units) podle aktuálního módu. */
export function toDisplay(pAU) {
  if (isFyzikalni()) {
    return { x: pAU.x * LINEAR_AU, y: pAU.y * LINEAR_AU, z: pAU.z * LINEAR_AU };
  }
  const r = Math.hypot(pAU.x, pAU.y, pAU.z);
  if (r === 0) return { x: 0, y: 0, z: 0 };
  const rDisp = auToDisplayRadius(r);
  const k = rDisp / r;
  return { x: pAU.x * k, y: pAU.y * k, z: pAU.z * k };
}

const MOON_LINEAR_AU = 3846;      // Fyzikální stejné měřítko
const MOON_COMPRESS = 60000;      // Pochopení: AU → px vůči rodiči (kalibrovat v F1)

/** Scéna pozice měsíce relativně vůči rodiči (AU → scene units) podle aktuálního módu. */
export function toDisplayRelative(relAU) {
  if (isFyzikalni()) {
    return { x: relAU.x * MOON_LINEAR_AU, y: relAU.y * MOON_LINEAR_AU, z: relAU.z * MOON_LINEAR_AU };
  }
  const r = Math.hypot(relAU.x, relAU.y, relAU.z);
  if (r === 0) return { x: 0, y: 0, z: 0 };
  const rDisp = Math.sqrt(r) * MOON_COMPRESS; // kompaktní, monotónní
  const k = rDisp / r;
  return { x: relAU.x * k, y: relAU.y * k, z: relAU.z * k };
}

export const MODES = MODE;
