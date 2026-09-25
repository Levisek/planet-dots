// simMode — dva režimy zobrazení. Od V4.4 jsou pozice, periody i dráhy
// reálné z efemerid (positionProvider) v obou módech; mód mění jen měřítko:
//
//   POCHOPENÍ (default): komprimované vzdálenosti (1100 + 350·√AU), soustavy
//     měsíců podle ručně laděného `m.a`, Slunce zmenšené (main.js).
//   FYZIKÁLNÍ: lineární AU, soustavy měsíců ve věrném poměru k rodiči.
//
// Pre-V4.4 gettery (getOrbitRadius, getInclination, …) a vlastní timeScale
// byly odstraněny 2026-09-25 — autoritou času je simClock.

import { auToDisplayRadius } from './scale.js';
import { moonDisplayScale } from './moonScale.js';

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

export function onModeChange(cb) {
  _listeners.push(cb);
  return () => {
    const i = _listeners.indexOf(cb);
    if (i >= 0) _listeners.splice(i, 1);
  };
}

export function isFyzikalni() { return _current === MODE.FYZIKALNI; }

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

/**
 * Scéna pozice měsíce relativně vůči rodiči (AU → scene units) podle
 * aktuálního módu. Lineární per-měsíc měřítko (viz moonScale.js) — dráha
 * si zachová reálný tvar i sklon.
 */
export function toDisplayRelative(relAU, moon) {
  const k = moonDisplayScale(moon, isFyzikalni());
  return { x: relAU.x * k, y: relAU.y * k, z: relAU.z * k };
}

export const MODES = MODE;
