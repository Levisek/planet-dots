export const STATE = Object.freeze({
  MAIN: 'MAIN',
  TRANSITION_IN: 'TRANSITION_IN',
  DETAIL: 'DETAIL',
  TRANSITION_OUT: 'TRANSITION_OUT',
});

const TRANSITION_DURATION = 0.8;

/**
 * Stav manager detailního pohledu. Tween (pohyb kamery) řeší main.js přes
 * `deps.cameraFlyTo(pos, target, duration)`. Tenhle modul drží jen state machine
 * a časovač pro přechody mezi stavy (musí odpovídat délce tween v main.js).
 */
export function createDetailView(deps) {
  let _state = STATE.MAIN;
  let _focusId = null;
  let _timer = 0; // sekundy v aktuální transition state
  let _returnPos = null;
  let _returnTarget = null;
  let _scaleOn = false;

  function computeDetailCameraOffset(id) {
    const r = deps.getBodyRadius(id);
    const p = deps.getBodyPosition(id);
    const dist = deps.getCameraDistance
      ? deps.getCameraDistance(id, _scaleOn)
      : r * 4.5;
    return {
      pos: { x: p.x, y: p.y + r * 0.6, z: p.z + dist },
      target: p,
    };
  }

  function startTransitionIn(id) {
    _focusId = id;
    _state = STATE.TRANSITION_IN;
    const cs = deps.getCameraState();
    if (_returnPos === null) {
      _returnPos = { ...cs.pos };
      _returnTarget = { ...cs.target };
    }
    const { pos, target } = computeDetailCameraOffset(id);
    _timer = 0;
    deps.setPaused(true);
    deps.fadeOthers(id, 0);
    deps.cameraFlyTo(pos, target, TRANSITION_DURATION);
  }

  function enterDetailState() {
    _state = STATE.DETAIL;
    const kind = deps.getBodyKind(_focusId);
    const hasScaleToggle = kind === 'planet';
    deps.showPanel(_focusId, { hasScaleToggle, scaleOn: _scaleOn });
    const p = deps.getBodyPosition(_focusId);
    deps.enableOrbit(true, p);
  }

  function startTransitionOut() {
    _state = STATE.TRANSITION_OUT;
    deps.hidePanel();
    deps.enableOrbit(false, null);
    _timer = 0;
    deps.fadeOthers(null, 1);
    deps.cameraFlyTo(_returnPos, _returnTarget, TRANSITION_DURATION);
  }

  function enterMainState() {
    _state = STATE.MAIN;
    _focusId = null;
    _returnPos = null;
    _returnTarget = null;
    _scaleOn = false;
    if (deps.resetScale) deps.resetScale();
    deps.setPaused(false);
  }

  return {
    enter(id) {
      if (_state === STATE.TRANSITION_IN || _state === STATE.TRANSITION_OUT) return;
      if (id === _focusId) return;
      if (_state === STATE.MAIN) {
        startTransitionIn(id);
        return;
      }
      // DETAIL → re-focus (bez průchodu MAIN)
      _focusId = id;
      _state = STATE.TRANSITION_IN;
      _timer = 0;
      const { pos, target } = computeDetailCameraOffset(id);
      deps.hidePanel();
      deps.enableOrbit(false, null);
      deps.fadeOthers(id, 0);
      deps.cameraFlyTo(pos, target, TRANSITION_DURATION);
    },
    exit() {
      if (_state !== STATE.DETAIL) return;
      startTransitionOut();
    },
    toggleScale(on) {
      _scaleOn = on;
      if (_state === STATE.DETAIL && _focusId) {
        const { pos, target } = computeDetailCameraOffset(_focusId);
        deps.cameraFlyTo(pos, target, 0.6);
      }
    },
    tick(dt) {
      if (_state === STATE.TRANSITION_IN || _state === STATE.TRANSITION_OUT) {
        _timer += dt;
        if (_timer >= TRANSITION_DURATION) {
          if (_state === STATE.TRANSITION_IN) enterDetailState();
          else enterMainState();
        }
      }
    },
    state() { return _state; },
    focusId() { return _focusId; },
    scaleOn() { return _scaleOn; },
  };
}
