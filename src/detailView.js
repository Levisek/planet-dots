import { createTween } from './cameraTween.js';

export const STATE = Object.freeze({
  MAIN: 'MAIN',
  TRANSITION_IN: 'TRANSITION_IN',
  DETAIL: 'DETAIL',
  TRANSITION_OUT: 'TRANSITION_OUT',
});

const TRANSITION_DURATION = 0.8;

export function createDetailView(deps) {
  let _state = STATE.MAIN;
  let _focusId = null;
  let _tween = null;
  let _tweenT = 0;
  let _returnPos = null;
  let _returnTarget = null;
  let _scaleOn = false;

  function computeDetailCameraOffset(id) {
    const r = deps.getBodyRadius(id);
    const p = deps.getBodyPosition(id);
    return {
      pos: { x: p.x, y: p.y + r * 0.6, z: p.z + r * 4.5 },
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
    _tween = createTween({
      fromPos: cs.pos,
      fromTarget: cs.target,
      toPos: pos,
      toTarget: target,
      duration: TRANSITION_DURATION,
    });
    _tweenT = 0;
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
    const cs = deps.getCameraState();
    _tween = createTween({
      fromPos: cs.pos,
      fromTarget: cs.target,
      toPos: _returnPos,
      toTarget: _returnTarget,
      duration: TRANSITION_DURATION,
    });
    _tweenT = 0;
    deps.fadeOthers(null, 1);
    deps.cameraFlyTo(_returnPos, _returnTarget, TRANSITION_DURATION);
  }

  function enterMainState() {
    _state = STATE.MAIN;
    _focusId = null;
    _tween = null;
    _returnPos = null;
    _returnTarget = null;
    deps.setPaused(false);
  }

  return {
    enter(id) {
      if (_state === STATE.TRANSITION_IN || _state === STATE.TRANSITION_OUT) return;
      if (_state === STATE.MAIN) {
        startTransitionIn(id);
        return;
      }
      // DETAIL → přepni fokus
      _focusId = id;
      _state = STATE.TRANSITION_IN;
      const cs = deps.getCameraState();
      const { pos, target } = computeDetailCameraOffset(id);
      _tween = createTween({
        fromPos: cs.pos,
        fromTarget: cs.target,
        toPos: pos,
        toTarget: target,
        duration: TRANSITION_DURATION,
      });
      _tweenT = 0;
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
    },
    tick(dt) {
      if (_tween) {
        _tweenT += dt;
        if (_tween.isComplete(_tweenT)) {
          _tween = null;
          if (_state === STATE.TRANSITION_IN) enterDetailState();
          else if (_state === STATE.TRANSITION_OUT) enterMainState();
        }
      }
    },
    state() { return _state; },
    focusId() { return _focusId; },
    scaleOn() { return _scaleOn; },
  };
}
