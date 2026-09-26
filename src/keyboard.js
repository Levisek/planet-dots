import * as simClock from './simClock.js';
import { STATE as DV_STATE } from './detailView.js';

/**
 * Globální keydown handler — ESC (detail view exit) + časové klávesy
 * (Space, [ ] \ 0). Formace zamyká jen ČAS, detail view zůstává funkční
 * (F3 decision 6).
 *
 * @param {{ detailView: object, isFormationActive: () => boolean }} opts
 */
export function initKeyboard({ detailView, isFormationActive }) {
  window.addEventListener('keydown', (e) => {
    // Skip when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (e.key === 'Escape' && detailView.state() === DV_STATE.DETAIL) {
      detailView.exit();
    }

    // Formace zamyká jen ČAS (Space + [ ] \ 0) — detail view (Escape výše)
    // zůstává funkční, formace není hard-lock UI (F3 decision 6).
    if (isFormationActive()) return;

    // Space toggle play/pauza
    if (e.key === ' ') {
      simClock.isPlaying() ? simClock.pause() : simClock.play();
      e.preventDefault();
      return;
    }

    // timeScale keybinds: [ ] \ 0 — simClock je od V4.4 F2 jediná autorita.
    // timeControls.js (UI slider/reverse) čte/píše stejné simClock API
    // (přepojeno v Tasku 5), takže klávesy i slider sdílí jednu timeScale hodnotu.
    switch (e.key) {
      case '[':
        simClock.setTimeScale(Math.max(0.1, Math.abs(simClock.getTimeScale()) - 0.1) * (simClock.getTimeScale() < 0 ? -1 : 1));
        e.preventDefault();
        break;
      case ']':
        simClock.setTimeScale(Math.min(5.0, Math.abs(simClock.getTimeScale()) + 0.1) * (simClock.getTimeScale() < 0 ? -1 : 1));
        e.preventDefault();
        break;
      case '\\':
        simClock.setTimeScale(-simClock.getTimeScale());
        e.preventDefault();
        break;
      case '0':
        simClock.setTimeScale(1);
        simClock.play();
        e.preventDefault();
        break;
    }
  });
}
