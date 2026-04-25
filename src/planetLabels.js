// planetLabels — screen-space názvy planet (Pochopení režim, hlavní view).
// HTML overlay sleduje anchor world position planety. Klik na label → detailView.
// Skryté v detail view (jiný layer info) + skryté pro Sun (Sun je obrovský, label
// uprostřed by zakrýval).

import * as THREE from 'three';
import { PLANETS } from './planets.js';
import { BODY_DATA } from './bodyData.js';

const _vec = new THREE.Vector3();

export function createPlanetLabels({ camera, canvas, anchors, onClick }) {
  const container = document.body;
  const labels = {};

  for (const p of PLANETS) {
    if (p.id === 'sun') continue; // Sun zaberá celé centrum, label by rušil
    const anchor = anchors[p.id];
    if (!anchor) continue;
    const el = document.createElement('div');
    el.className = 'planetLabel';
    el.textContent = BODY_DATA[p.id]?.name || p.name;
    el.addEventListener('click', () => onClick && onClick(p.id));
    container.appendChild(el);
    labels[p.id] = { el, anchor };
  }

  function project(worldPos) {
    _vec.copy(worldPos);
    _vec.project(camera);
    const rect = canvas.getBoundingClientRect();
    return {
      x: (_vec.x * 0.5 + 0.5) * rect.width + rect.left,
      y: (-_vec.y * 0.5 + 0.5) * rect.height + rect.top,
      behindCamera: _vec.z > 1,
    };
  }

  let visible = true;

  return {
    setVisible(v) {
      visible = v;
      for (const id in labels) {
        labels[id].el.style.display = v ? '' : 'none';
      }
    },
    update() {
      if (!visible) return;
      for (const id in labels) {
        const lbl = labels[id];
        lbl.anchor.getWorldPosition(_vec);
        const { x, y, behindCamera } = project(_vec);
        if (behindCamera) {
          lbl.el.style.display = 'none';
          continue;
        }
        lbl.el.style.display = '';
        lbl.el.style.left = `${x}px`;
        lbl.el.style.top = `${y}px`;
      }
    },
    dispose() {
      for (const id in labels) labels[id].el.remove();
    },
  };
}
