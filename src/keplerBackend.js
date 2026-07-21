import { orbitPosition } from './orbit.js';

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const MS_PER_DAY = 86400000;

// Elementy referencované k ekliptice J2000; a v AU. Vrací scene-frame AU
// (orbit.js pracuje v Y-up X-Z = scene frame). M0 v epoše J2000.
export function keplerHelio(el, date) {
  const days = (date.getTime() - J2000_MS) / MS_PER_DAY;
  const period = el.periodDays;
  const phase = (el.M0Deg * Math.PI) / 180;
  const { x, y, z } = orbitPosition(
    days, phase, period, el.aAU, el.e, el.incDeg, el.OmegaDeg, el.omegaDeg,
  );
  return { x, y, z };
}

// Měsíc: totožná matematika, elementy vůči rodiči; vrací AU vůči rodiči.
export const keplerRelative = keplerHelio;
