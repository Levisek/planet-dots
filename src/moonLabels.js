import * as THREE from 'three';
import { MOONS } from './moons.js';
import { BODY_DATA } from './bodyData.js';

const _vec = new THREE.Vector3();

/**
 * Správa drobných textových labelů nad měsíci (viditelné jen v planet-detail).
 * Každý label = jméno + vzdálenost. Pozice přes world-to-screen projekci.
 */
export function createMoonLabels({ camera, canvas, moonAnchors }) {
  const container = document.getElementById('moonLabels');
  if (!container) throw new Error('#moonLabels element nenalezen');

  const labels = {}; // { [moonId]: { el, anchor, dist (km string) } }
  for (const m of MOONS) {
    const anchor = moonAnchors[m.id];
    if (!anchor) continue;
    const el = document.createElement('div');
    el.className = 'moonLabel';
    const name = BODY_DATA[m.id]?.name || m.name;
    const distStr = m.realSemiMajorAxisKm
      ? `· ${(m.realSemiMajorAxisKm / 1000).toLocaleString('cs-CZ')} tis. km`
      : '';
    el.innerHTML = `${name}<span class="dist">${distStr}</span>`;
    container.appendChild(el);
    labels[m.id] = { el, anchor };
  }

  let activeParentId = null;

  function project(worldPos) {
    _vec.copy(worldPos);
    _vec.project(camera);
    const rect = canvas.getBoundingClientRect();
    const x = (_vec.x * 0.5 + 0.5) * rect.width + rect.left;
    const y = (-_vec.y * 0.5 + 0.5) * rect.height + rect.top;
    return { x, y, behindCamera: _vec.z > 1 };
  }

  return {
    /** Zobrazí labely pro měsíce daného rodiče. null → schovej všechny. */
    showForParent(parentId) {
      activeParentId = parentId;
      for (const m of MOONS) {
        const label = labels[m.id];
        if (!label) continue;
        if (parentId && m.parent === parentId) {
          label.el.classList.add('visible');
        } else {
          label.el.classList.remove('visible');
        }
      }
    },
    hideAll() {
      activeParentId = null;
      for (const id in labels) labels[id].el.classList.remove('visible');
    },
    update() {
      if (!activeParentId) return;
      for (const m of MOONS) {
        if (m.parent !== activeParentId) continue;
        const label = labels[m.id];
        if (!label) continue;
        const world = new THREE.Vector3();
        label.anchor.getWorldPosition(world);
        const { x, y, behindCamera } = project(world);
        if (behindCamera) {
          label.el.style.opacity = 0;
          continue;
        }
        label.el.style.left = `${x}px`;
        label.el.style.top = `${y}px`;
        label.el.style.opacity = '';
      }
    },
  };
}
