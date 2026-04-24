import * as THREE from 'three';
import { BODY_DATA } from './bodyData.js';

const _vec = new THREE.Vector3();

/**
 * Hover tooltip — sleduje tělo přes world-to-screen projekci.
 * Skrytý na touch zařízeních.
 */
export function createTooltip({ camera, canvas }) {
  const el = document.getElementById('tooltip');
  if (!el) throw new Error('#tooltip element nenalezen');
  let currentId = null;
  let currentGetPos = null;

  function projectToScreen(worldPos) {
    _vec.copy(worldPos);
    _vec.project(camera);
    const rect = canvas.getBoundingClientRect();
    const x = (_vec.x * 0.5 + 0.5) * rect.width + rect.left;
    const y = (-_vec.y * 0.5 + 0.5) * rect.height + rect.top;
    return { x, y, behindCamera: _vec.z > 1 };
  }

  return {
    show(id, getPos) {
      const data = BODY_DATA[id];
      if (!data) return;
      currentId = id;
      currentGetPos = getPos;
      el.textContent = data.name.toUpperCase();
      el.classList.add('visible');
    },
    hide() {
      currentId = null;
      currentGetPos = null;
      el.classList.remove('visible');
    },
    update() {
      if (!currentGetPos) return;
      const world = currentGetPos();
      _vec.set(world.x, world.y, world.z);
      const { x, y, behindCamera } = projectToScreen(_vec);
      if (behindCamera) {
        el.classList.remove('visible');
        return;
      }
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    },
    currentId() { return currentId; },
  };
}
