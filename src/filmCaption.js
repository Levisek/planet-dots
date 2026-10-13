// filmCaption — popisek filmu o vzniku soustavy (dole uprostřed, stejný
// vzhled jako popisek prohlídky): scéna, skutečný čas, krátký fakt,
// proužek celého filmu a tlačítko Přeskočit. Během filmu má <body> třídu
// `filming` — CSS schová seznam těles, časovou lištu a info panel.

import { sceneAt, realYearsAt, formatAge, LIVE_START } from './animation.js';

/** @param {{ onSkip(): void }} h */
export function createFilmCaption({ onSkip }) {
  const el = document.getElementById('filmCaption');
  if (!el) throw new Error('#filmCaption element nenalezen');
  el.innerHTML = `
    <div class="head">
      <span class="name"></span>
      <span class="count"></span>
      <span class="nav"><button class="skip">Přeskočit</button></span>
    </div>
    <p class="text" aria-live="polite"></p>
    <div class="bar"><div class="fill"></div></div>
  `;
  const name = el.querySelector('.name');
  const age = el.querySelector('.count');
  const text = el.querySelector('.text');
  const fill = el.querySelector('.fill');
  el.querySelector('.skip').onclick = onSkip;

  let _scene = null;
  let _age = '';
  let _fill = -1;
  return {
    show(on) {
      document.body.classList.toggle('filming', on);
      el.classList.toggle('visible', on);
    },
    /** Čas filmu (s) → scéna, počítadlo a proužek; DOM jen při změně. */
    update(t) {
      const s = sceneAt(t);
      if (s !== _scene) {
        _scene = s;
        name.textContent = s.label;
        text.textContent = s.fact;
      }
      const a = formatAge(realYearsAt(t));
      if (a !== _age) { _age = a; age.textContent = a; }
      const q = Math.round(Math.min(1, t / LIVE_START) * 200) / 200;
      if (q !== _fill) { _fill = q; fill.style.transform = `scaleX(${q})`; }
    },
  };
}
