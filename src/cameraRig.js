import { createFlight } from './flightPath.js';

/**
 * Camera rig — přelet mezi dvěma stavy kamery (position + target) po dráze
 * van Wijk–Nuij (flightPath.js: oddálit – přeletět – přiblížit) a
 * navazující follow (kamera jede s fokusovaným tělesem v detail view, dokud
 * simulace běží dál a těleso se hýbe).
 *
 * `controlsTarget` je sdílený objekt s main.js (window.__debug ho čte přímo),
 * rig ho mutuje na místě, nenahrazuje referenci.
 *
 * @param {{ camera, controls, controlsTarget: {x,y,z}, getBodyPos: (id: string) => {x,y,z}, maxDuration?: number }} opts
 *   maxDuration — strop délky letu (s); main.js ho snižuje při prefers-reduced-motion.
 */
export function createCameraRig({ camera, controls, controlsTarget, getBodyPos, maxDuration = 4 }) {
  let _activeCameraTween = null;
  // Kamera v DETAIL jede s fokusovaným tělesem (simulace běží dál, těleso se
  // hýbe) — { id, last: {x,y,z} }. Během tweenu přebírá drift tween sám.
  let _follow = null;

  /**
   * Spustí přílet kamery. followId: cíl je relativní k tělesu — update()
   * přičítá jeho drift (null = pevný cíl, návrat do MAIN).
   * duration null = podle délky dráhy (flightDuration). Vrací délku letu (s).
   */
  function flyTo(toPos, toTarget, duration = null, followId = null) {
    _follow = null;
    const tween = createFlight({
      fromPos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      fromTarget: { x: controlsTarget.x, y: controlsTarget.y, z: controlsTarget.z },
      toPos,
      toTarget,
      duration,
      maxDuration,
    });
    _activeCameraTween = {
      tween,
      t: 0,
      followId,
      bodyStart: followId ? getBodyPos(followId) : null,
    };
    return tween.duration;
  }

  /**
   * Zavolat jednou za frame, po update pozic těles (aby let cílil na
   * aktuální polohu tělesa: cíl je relativní k tělesu, drift od startu
   * se přičítá úměrně uražené cestě mezi cíli (frac), takže přílet sedí,
   * i když se těleso mezitím posunulo).
   * @param {number} dt
   * @param {boolean} inDetail — detailView.state() === DV_STATE.DETAIL
   */
  function update(dt, inDetail) {
    if (_activeCameraTween) {
      const ct = _activeCameraTween;
      ct.t += dt;
      const s = ct.tween.sample(ct.t);
      if (ct.followId) {
        const now = getBodyPos(ct.followId);
        const e = s.frac;
        const dx = (now.x - ct.bodyStart.x) * e;
        const dy = (now.y - ct.bodyStart.y) * e;
        const dz = (now.z - ct.bodyStart.z) * e;
        s.pos.x += dx; s.pos.y += dy; s.pos.z += dz;
        s.target.x += dx; s.target.y += dy; s.target.z += dz;
      }
      camera.position.set(s.pos.x, s.pos.y, s.pos.z);
      controlsTarget.x = s.target.x;
      controlsTarget.y = s.target.y;
      controlsTarget.z = s.target.z;
      camera.lookAt(controlsTarget.x, controlsTarget.y, controlsTarget.z);
      if (controls.enabled) controls.target.set(controlsTarget.x, controlsTarget.y, controlsTarget.z);
      if (ct.tween.isComplete(ct.t)) {
        _activeCameraTween = null;
        _follow = ct.followId ? { id: ct.followId, last: getBodyPos(ct.followId) } : null;
      }
    } else if (_follow && inDetail) {
      // Kamera (i orbit target) se posune o pohyb tělesa za frame — relativní
      // pohled, který si uživatel natočil, zůstává.
      const now = getBodyPos(_follow.id);
      const dx = now.x - _follow.last.x, dy = now.y - _follow.last.y, dz = now.z - _follow.last.z;
      camera.position.x += dx; camera.position.y += dy; camera.position.z += dz;
      controls.target.x += dx; controls.target.y += dy; controls.target.z += dz;
      controlsTarget.x += dx; controlsTarget.y += dy; controlsTarget.z += dz;
      _follow.last = now;
    }
  }

  /** Zruší aktivní tween, pokud nemá followId (viz onModeChange v main.js). */
  function cancelUnfollowedTween() {
    if (_activeCameraTween && !_activeCameraTween.followId) _activeCameraTween = null;
  }

  /** Běží přelet? (main.js během něj nepouští OrbitControls.update — ten by
   *  kameru ořízl na minDistance/maxDistance cílového stavu.) */
  function isFlying() { return _activeCameraTween !== null; }

  return { flyTo, update, cancelUnfollowedTween, isFlying };
}
