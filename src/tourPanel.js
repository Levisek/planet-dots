// tourPanel — popisek zastávky prohlídky (dole uprostřed) a tlačítko
// v horní liště. Během prohlídky má <body> třídu `touring` — CSS v index.html
// schová seznam těles, časovou lištu a info panel (na televizi je z gauče
// stejně nikdo nepřečte; příběh nese popisek).

import { BODY_DATA } from './bodyData.js';

const ICON = {
  prev: '<path d="M6.5 1.5l-4 3.5 4 3.5" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  next: '<path d="M3.5 1.5l4 3.5-4 3.5" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  close: '<path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="1.6" fill="none"/>',
};
const svg = (d) => `<svg viewBox="0 0 10 10" width="12" height="12" aria-hidden="true">${d}</svg>`;

/**
 * @param {{ onPrev(): void, onNext(): void, onClose(): void, onToggle(): void }} h
 */
export function createTourPanel({ onPrev, onNext, onClose, onToggle }) {
  const el = document.getElementById('tourCaption');
  const btn = document.getElementById('toggleTour');
  if (!el) throw new Error('#tourCaption element nenalezen');

  el.innerHTML = `
    <div class="head">
      <span class="count"></span>
      <span class="name"></span>
      <span class="nav">
        <button class="prev" aria-label="Předchozí zastávka">${svg(ICON.prev)}</button>
        <button class="next" aria-label="Další zastávka">${svg(ICON.next)}</button>
        <button class="close" aria-label="Ukončit prohlídku">${svg(ICON.close)}</button>
      </span>
    </div>
    <p class="text" aria-live="polite"></p>
    <div class="bar"><div class="fill"></div></div>
  `;
  const count = el.querySelector('.count');
  const name = el.querySelector('.name');
  const text = el.querySelector('.text');
  const fill = el.querySelector('.fill');
  el.querySelector('.prev').onclick = onPrev;
  el.querySelector('.next').onclick = onNext;
  el.querySelector('.close').onclick = onClose;
  if (btn) btn.addEventListener('click', onToggle);

  let _lastFill = -1;

  return {
    /** @param {{index:number,total:number,stop:{id:string|null,name?:string,text:string}}|null} info */
    show(info) {
      const on = !!info;
      document.body.classList.toggle('touring', on);
      el.classList.toggle('visible', on);
      if (btn) btn.classList.toggle('active', on);
      if (!on) return;
      count.textContent = `${info.index + 1}/${info.total}`;
      name.textContent = info.stop.name || BODY_DATA[info.stop.id]?.name || info.stop.id;
      text.textContent = info.stop.text;
      _lastFill = -1;
    },
    /** Proužek času zastávky (0..1); do DOM jen při viditelné změně. */
    setProgress(p) {
      const q = Math.round(p * 200) / 200;
      if (q === _lastFill) return;
      _lastFill = q;
      fill.style.transform = `scaleX(${q})`;
    },
    /** Tlačítko jde použít až po formaci. */
    setEnabled(on) { if (btn) btn.disabled = !on; },
    element: el,
  };
}
