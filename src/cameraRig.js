import { createTween, easeInOutCubic } from './cameraTween.js';

/**
 * Camera rig — fly-to tween mezi dvěma stavy kamery (position + target) a
 * navazující follow (kamera jede s fokusovaným tělesem v detail view, dokud
 * simulace běží dál a těleso se hýbe).
 *
 * `controlsTarget` je sdílený objekt s main.js (window.__debug ho čte přímo),
 * rig ho mutuje na místě, nenahrazuje referenci.
 *
 * @param {{ camera, controls, controlsTarget: {x,y,z}, getBodyPos: (id: string) => {x,y,z} }} opts
 */
export function createCameraRig({ camera, controls, controlsTarget, getBodyPos }) {
  let _activeCameraTween = null;
  // Kamera v DETAIL jede s fokusovaným tělesem (simulace běží dál, těleso se
  // hýbe) — { id, last: {x,y,z} }. Během tweenu přebírá drift tween sám.
  let _follow = null;

  /**
   * Spustí přílet kamery. followId: cíl je relativní k tělesu — update()
   * přičítá jeho drift (null = pevný cíl, návrat do MAIN).
   */
  function flyTo(toPos, toTarget, duration, followId = null) {
    _follow = null;
    _activeCameraTween = {
      tween: createTween({
        fromPos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        fromTarget: { x: controlsTarget.x, y: controlsTarget.y, z: controlsTarget.z },
        toPos: { ...toPos },
        toTarget: { ...toTarget },
        duration,
      }),
      t: 0,
      followId,
      bodyStart: followId ? getBodyPos(followId) : null,
    };
  }

  /**
   * Zavolat jednou za frame, po update pozic těles (aby tween cílil na
   * aktuální polohu tělesa: cíl je relativní k tělesu, drift od startu
   * tweenu se přičítá úměrně easingu, takže přílet sedí, i když se těleso
   * mezitím posunulo).
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
        const e = easeInOutCubic(Math.min(1, ct.t / ct.tween.duration));
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

  return { flyTo, update, cancelUnfollowedTween };
}
