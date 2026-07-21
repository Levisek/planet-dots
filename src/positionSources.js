// Explicitní krytí: která tělesa jedou z ephemeris (astronomy-engine) a která
// z Kepleru (reálné JPL elementy). Transparentnost pro info panel a testy.
export const EPHEMERIS_BODIES = new Set([
  'sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune',
]);
export const EPHEMERIS_MOONS = new Set(['luna', 'io', 'europa', 'ganymede', 'callisto']);

export function sourceOf(bodyId) {
  return (EPHEMERIS_BODIES.has(bodyId) || EPHEMERIS_MOONS.has(bodyId))
    ? 'ephemeris' : 'kepler';
}
