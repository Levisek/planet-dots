// bodyList — klikatelný seznam těles (vlevo). Klik → detailView.enter(id).
// Aktivní item je highlight (focusId match). Update na MAIN/DETAIL state change.

import { PLANETS } from './planets.js';
import { MOONS, MOONS_BY_PARENT } from './moons.js';
import { BODY_DATA } from './bodyData.js';
import { ASTEROIDS } from './asteroids.js';

export function createBodyList({ onClick }) {
  const root = document.createElement('div');
  root.id = 'bodyList';
  document.body.appendChild(root);

  // Na telefonu je seznam schovaný za tlačítkem (CSS @media v index.html);
  // na desktopu tlačítko není vidět a seznam je otevřený vždy.
  const toggle = document.createElement('button');
  toggle.id = 'bodyListToggle';
  toggle.textContent = 'Tělesa'; // Press Start 2P nemá velké Ě
  toggle.setAttribute('aria-controls', 'bodyList');
  toggle.setAttribute('aria-expanded', 'false');
  document.body.appendChild(toggle);
  function setOpen(open) {
    root.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  }
  toggle.addEventListener('click', () => setOpen(!root.classList.contains('open')));

  const items = {};

  function addItem(id, name, label) {
    const el = document.createElement('div');
    el.className = 'item';
    el.textContent = label || name;
    el.title = name;
    el.addEventListener('click', () => {
      setOpen(false); // na telefonu po výběru uvolnit scénu
      if (onClick) onClick(id);
    });
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

  // Asteroidy
  root.appendChild(group('Asteroidy'));
  for (const a of ASTEROIDS) {
    root.appendChild(addItem(a.id, BODY_DATA[a.id]?.name || a.name));
  }

  return {
    setActive(id) {
      for (const k in items) items[k].classList.toggle('active', k === id);
    },
    dispose() {
      root.remove();
      toggle.remove();
    },
  };
}
