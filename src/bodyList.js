// bodyList — klikatelný seznam těles (vlevo). Klik → detailView.enter(id).
// Aktivní item je highlight (focusId match). Update na MAIN/DETAIL state change.

import { PLANETS } from './planets.js';
import { MOONS, MOONS_BY_PARENT } from './moons.js';
import { BODY_DATA } from './bodyData.js';

export function createBodyList({ onClick }) {
  const root = document.createElement('div');
  root.id = 'bodyList';
  document.body.appendChild(root);

  const items = {};

  function addItem(id, name, label) {
    const el = document.createElement('div');
    el.className = 'item';
    el.textContent = label || name;
    el.title = name;
    el.addEventListener('click', () => onClick && onClick(id));
    items[id] = el;
    return el;
  }

  function group(label) {
    const el = document.createElement('div');
    el.className = 'group';
    el.textContent = label;
    return el;
  }

  // Slunce
  root.appendChild(addItem('sun', BODY_DATA.sun?.name || 'Slunce'));

  // Planety + jejich měsíce (vnořené)
  for (const p of PLANETS) {
    if (p.id === 'sun') continue;
    root.appendChild(addItem(p.id, BODY_DATA[p.id]?.name || p.name));
    const moons = MOONS_BY_PARENT[p.id] || [];
    for (const m of moons) {
      const el = addItem(m.id, BODY_DATA[m.id]?.name || m.name, '· ' + (BODY_DATA[m.id]?.name || m.name));
      el.style.paddingLeft = '14px';
      el.style.fontSize = '7px';
      el.style.color = '#888';
      root.appendChild(el);
    }
  }

  return {
    setActive(id) {
      for (const k in items) items[k].classList.toggle('active', k === id);
    },
    dispose() {
      root.remove();
    },
  };
}
