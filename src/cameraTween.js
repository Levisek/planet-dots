// cameraTween — pure math modul pro plynulý přelet kamery mezi dvěma stavy
// (position + look-at target). Žádná Three dependence, ať je plně testovatelné.

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerpVec3(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

/**
 * Vytvoří tween object pro přelet kamery.
 * @param {{ fromPos, fromTarget, toPos, toTarget, duration }} opts
 * @returns {{ sample(t): { pos, target }, isComplete(t): boolean, duration }}
 */
export function createTween(opts) {
  const { fromPos, fromTarget, toPos, toTarget, duration } = opts;
  return {
    duration,
    sample(t) {
      const clamped = Math.max(0, Math.min(1, t / duration));
      const eased = easeInOutCubic(clamped);
      return {
        pos: lerpVec3(fromPos, toPos, eased),
        target: lerpVec3(fromTarget, toTarget, eased),
      };
    },
    isComplete(t) {
      return t >= duration;
    },
  };
}
