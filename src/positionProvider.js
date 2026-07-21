import { ephemHelio, ephemMoonRelative } from './ephemerisBackend.js';
import { keplerHelio, keplerRelative } from './keplerBackend.js';
import { EPHEMERIS_BODIES, EPHEMERIS_MOONS, sourceOf } from './positionSources.js';
import { PLANET_BY_ID } from './planets.js';
import { MOON_BY_ID } from './moons.js';
import { ASTEROIDS } from './asteroids.js';

const ASTEROID_BY_ID = Object.fromEntries(ASTEROIDS.map((a) => [a.id, a]));

export { sourceOf };

export function getHelioPosition(bodyId, date) {
  if (EPHEMERIS_BODIES.has(bodyId)) return ephemHelio(bodyId, date);
  const body = ASTEROID_BY_ID[bodyId] || PLANET_BY_ID[bodyId];
  return keplerHelio(body.elements, date);
}

export function getRelativePosition(moonId, date) {
  if (EPHEMERIS_MOONS.has(moonId)) return ephemMoonRelative(moonId, date);
  return keplerRelative(MOON_BY_ID[moonId].elements, date);
}
