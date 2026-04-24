import { BODY_DATA } from './bodyData.js';

export function createInfoPanel() {
  const el = document.getElementById('infoPanel');
  if (!el) throw new Error('#infoPanel element nenalezen');
  let closeCb = null;
  let scaleToggleCb = null;

  function render(id, { hasScaleToggle, scaleOn }) {
    const data = BODY_DATA[id];
    if (!data) return;

    const rowsHtml = data.fields
      .map((f) => `<tr><td class="label">${escapeHtml(f.label)}</td><td class="value">${escapeHtml(f.value)}</td></tr>`)
      .join('');

    const toggleHtml = hasScaleToggle
      ? `
        <div class="scaleToggle">
          <span>Reálné měřítko</span>
          <input type="checkbox" id="scaleToggleInput" ${scaleOn ? 'checked' : ''}>
        </div>
        <div class="scaleHint">${scaleOn ? 'Některé měsíce uletí daleko — zoom out myší.' : 'Přepne na proporční vzdálenosti měsíců.'}</div>
      `
      : '';

    el.dataset.currentId = id;
    el.innerHTML = `
      <button class="close" aria-label="Zavřít">✕</button>
      <h2>${escapeHtml(data.name)}</h2>
      <p class="tagline">${escapeHtml(data.tagline)}</p>
      <table>${rowsHtml}</table>
      <div class="funFact">„${escapeHtml(data.funFact)}"</div>
      ${toggleHtml}
    `;

    el.querySelector('.close').onclick = () => closeCb && closeCb();
    const toggle = el.querySelector('#scaleToggleInput');
    if (toggle) toggle.onchange = (e) => scaleToggleCb && scaleToggleCb(e.target.checked);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    show(id, opts = {}) {
      render(id, { hasScaleToggle: !!opts.hasScaleToggle, scaleOn: !!opts.scaleOn });
      requestAnimationFrame(() => el.classList.add('visible'));
    },
    hide() {
      el.classList.remove('visible');
    },
    updateScaleState(scaleOn) {
      const id = el.dataset.currentId;
      if (id) render(id, { hasScaleToggle: true, scaleOn });
    },
    onClose(cb) { closeCb = cb; },
    onScaleToggle(cb) { scaleToggleCb = cb; },
  };
}
