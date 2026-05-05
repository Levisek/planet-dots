import { PLANET_BY_ID } from './planets.js';
import { MOON_BY_ID, MOONS_BY_PARENT } from './moons.js';
import { ASTEROIDS } from './asteroids.js';
import * as moonOrbitLines from './moonOrbitLines.js';
import { onModeChange } from './simMode.js';

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
  let _currentMoonLines = [];
  let _modeChangeUnsub = null;

  function getBodyData(id) {
    return (PLANET_BY_ID[id]) ||
           (MOON_BY_ID[id]) ||
           (ASTEROIDS.find(a => a.id === id));
  }

  function computeDetailCameraOffset(id) {
    const r = deps.getBodyRadius(id);
    const p = deps.getBodyPosition(id);
    // Real měřítko měsíců aktivní jen v Fyzikálním simMode (deps.isFyzikalni()).
    const fyz = deps.isFyzikalni ? deps.isFyzikalni() : false;
    const dist = deps.getCameraDistance
      ? deps.getCameraDistance(id, fyz)
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

  function showMoonLines() {
    const isPlanet = !!(deps.planetAnchors && deps.planetAnchors[_focusId] && PLANET_BY_ID[_focusId]);
    if (!isPlanet) return;
    const scaleFactors = deps.getMoonScaleFactors ? deps.getMoonScaleFactors() : {};
    _currentMoonLines = moonOrbitLines.showFor(
      _focusId,
      deps.planetAnchors,
      MOONS_BY_PARENT,
      PLANET_BY_ID,
      scaleFactors
    );
    _modeChangeUnsub = onModeChange(() => {
      moonOrbitLines.disposeAll(_currentMoonLines);
      const sf = deps.getMoonScaleFactors ? deps.getMoonScaleFactors() : {};
      _currentMoonLines = moonOrbitLines.showFor(
        _focusId,
        deps.planetAnchors,
        MOONS_BY_PARENT,
        PLANET_BY_ID,
        sf
      );
    });
  }

  function hideMoonLines() {
    moonOrbitLines.disposeAll(_currentMoonLines);
    _currentMoonLines = [];
    if (_modeChangeUnsub) {
      _modeChangeUnsub();
      _modeChangeUnsub = null;
    }
  }

  function enterDetailState() {
    _state = STATE.DETAIL;
    const body = getBodyData(_focusId);
    deps.showPanel(_focusId, body);
    const p = deps.getBodyPosition(_focusId);
    deps.enableOrbit(true, p);
    showMoonLines();
  }

  function startTransitionOut() {
    _state = STATE.TRANSITION_OUT;
    deps.hidePanel();
    deps.enableOrbit(false, null);
    _timer = 0;
    deps.fadeOthers(null, 1);
    deps.cameraFlyTo(_returnPos, _returnTarget, TRANSITION_DURATION);
    hideMoonLines();
  }

  function enterMainState() {
    _state = STATE.MAIN;
    _focusId = null;
    _returnPos = null;
    _returnTarget = null;
    deps.setPaused(false);
  }

  return {
    enter(id) {
      if (_state === STATE.TRANSITION_IN) return;
      if (id === _focusId) return;
      if (_state === STATE.MAIN || _state === STATE.TRANSITION_OUT) {
        // TRANSITION_OUT: přeruš return tween a přejdi rovnou na nový cíl.
        // (cameraFlyTo přepíše _activeCameraTween v main.js)
        startTransitionIn(id);
        return;
      }
      // DETAIL → re-focus (bez průchodu MAIN)
      hideMoonLines();
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
    /** Zavolá main.js po simMode change během DETAIL — re-fly s novým distance. */
    refreshCamera() {
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
  };
}
