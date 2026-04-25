import { BODY_DATA } from './bodyData.js';

export function createInfoPanel() {
  const el = document.getElementById('infoPanel');
  if (!el) throw new Error('#infoPanel element nenalezen');
  let closeCb = null;

  function render(id) {
    const data = BODY_DATA[id];
    if (!data) return;

    const rowsHtml = data.fields
      .map((f) => `<tr><td class="label">${escapeHtml(f.label)}</td><td class="value">${escapeHtml(f.value)}</td></tr>`)
      .join('');

    el.dataset.currentId = id;
    el.innerHTML = `
      <button class="close" aria-label="Zavřít">✕</button>
      <h2>${escapeHtml(data.name)}</h2>
      <p class="tagline">${escapeHtml(data.tagline)}</p>
      <table>${rowsHtml}</table>
      <div class="funFact">„${escapeHtml(data.funFact)}"</div>
    `;

    el.querySelector('.close').onclick = () => closeCb && closeCb();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    show(id) {
      render(id);
      requestAnimationFrame(() => el.classList.add('visible'));
    },
    hide() {
      el.classList.remove('visible');
    },
    onClose(cb) { closeCb = cb; },
  };
}
