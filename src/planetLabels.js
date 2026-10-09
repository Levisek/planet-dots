// planetLabels — screen-space názvy planet (Pochopení režim, hlavní view).
// HTML overlay sleduje anchor world position planety. Klik na label → detailView.
// Skryté v detail view (jiný layer info) + skryté pro Sun (Sun je obrovský, label
// uprostřed by zakrýval).

import * as THREE from 'three';
import { PLANETS } from './planets.js';
import { BODY_DATA } from './bodyData.js';

const _vec = new THREE.Vector3();

// isOccluded(worldPos) — popisek tělesa schovaného za Sluncem se nekreslí.
// update() vrací zobrazené popisky s prioritou pro labelDeclutter.
// getBodyRadius(id) — zobrazený poloměr tělesa (scene units); popisek se zvedne
// nad jeho kotouč, ať leží vedle tělesa, ne přes něj (planety jsou v přehledu
// zvětšené, planetBoost.js).
export function createPlanetLabels({ camera, canvas, anchors, onClick, isOccluded = null, getBodyRadius = null }) {
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
    labels[p.id] = { el, anchor, priority: 10 + p.radiusPx / 100 }; // větší planeta vyhrává
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

  const _tanHalfFov = () => Math.tan((camera.fov * Math.PI) / 360);

  /** Poloměr tělesa na obrazovce (px) z jeho zobrazeného poloměru a vzdálenosti. */
  function screenRadius(id, worldPos, rectH) {
    if (!getBodyRadius) return 0;
    const dist = camera.position.distanceTo(worldPos);
    if (dist <= 0) return 0;
    return (getBodyRadius(id) * rectH) / (2 * _tanHalfFov() * dist);
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
      const shown = [];
      if (!visible) return shown;
      for (const id in labels) {
        const lbl = labels[id];
        lbl.anchor.getWorldPosition(_vec);
        if (isOccluded && isOccluded(_vec)) {
          lbl.el.style.display = 'none';
          continue;
        }
        // project() přepisuje _vec do NDC — poloměr na obrazovce se počítá předem.
        const rPx = screenRadius(id, _vec, canvas.getBoundingClientRect().height);
        const { x, y: yCenter, behindCamera } = project(_vec);
        const y = yCenter - rPx;
        if (behindCamera) {
          lbl.el.style.display = 'none';
          continue;
        }
        lbl.el.style.display = '';
        lbl.el.style.left = `${x}px`;
        lbl.el.style.top = `${y}px`;
        shown.push({ el: lbl.el, x, y, priority: lbl.priority, disc: { x, y: yCenter, r: rPx } });
      }
      return shown;
    },
    dispose() {
      for (const id in labels) labels[id].el.remove();
    },
  };
}
