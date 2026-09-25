import { BODY_DATA } from './bodyData.js';
import { escapeHtml } from './escapeHtml.js';

// Horní indexy (10²⁴) — Press Start 2P má jen ¹²³ (Latin-1), ⁰ a ⁴–⁹
// (U+2070+) kreslil fallback font a exponent byl ze dvou různých písem.
// Totéž dolní indexy (SO₂). Převod na <sup>/<sub> s běžnými číslicemi;
// volat až NA escapovaný text.
const SUPERSCRIPT = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };
const SUBSCRIPT = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
export function superscriptToSup(escaped) {
  return escaped
    .replace(/[⁰¹²³⁴-⁹⁻]+/g, (run) => `<sup>${[...run].map((c) => SUPERSCRIPT[c]).join('')}</sup>`)
    .replace(/[₀-₉]+/g, (run) => `<sub>${[...run].map((c) => SUBSCRIPT[c]).join('')}</sub>`); // SO₂, CO₂
}

export function createInfoPanel() {
  const el = document.getElementById('infoPanel');
  if (!el) throw new Error('#infoPanel element nenalezen');
  let closeCb = null;

  function renderCoverageNote(body) {
    if (!body || !body.coverageNote) return '';
    return `<div class="coverage-note">* ${escapeHtml(body.coverageNote)}</div>`;
  }

  function render(id, body) {
    const data = BODY_DATA[id];
    if (!data) return;

    const rowsHtml = data.fields
      .map((f) => `<tr><td class="label">${escapeHtml(f.label)}</td><td class="value">${superscriptToSup(escapeHtml(f.value))}</td></tr>`)
      .join('');

    el.dataset.currentId = id;
    el.innerHTML = `
      <button class="close" aria-label="Zavřít"><svg viewBox="0 0 10 10" width="12" height="12" aria-hidden="true"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="1.6" fill="none"/></svg></button>
      <h2>${escapeHtml(data.name)}</h2>
      <p class="tagline">${escapeHtml(data.tagline)}</p>
      <table>${rowsHtml}</table>
      <div class="funFact">„${escapeHtml(data.funFact)}"</div>
      ${renderCoverageNote(body)}
    `;

    el.querySelector('.close').onclick = () => closeCb && closeCb();
  }

  return {
    show(id, body) {
      render(id, body);
      requestAnimationFrame(() => el.classList.add('visible'));
    },
    hide() {
      el.classList.remove('visible');
    },
    onClose(cb) { closeCb = cb; },
  };
}
