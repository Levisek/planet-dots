import * as THREE from 'three';
import { rayHitsSphere } from './pickingMath.js';

export { rayHitsSphere };

/**
 * Picking controller — drží neviditelné THREE.Mesh sféry pro hit test.
 * Každé tělo má sféru centrovanou ve své pozici, poloměr ~ bodyRadius × 1.5.
 *
 * @param {{ scene, camera, canvas }} deps
 * @returns {{
 *   addBody(id, getPosition, radius): void,
 *   setActiveIds(idsSet: Set|null): void,
 *   onHover(cb: (id, ev) => void): void,
 *   onClick(cb: (id, ev) => void): void,
 *   update(): void,
 *   dispose(): void
 * }}
 */
export function createPicker({ scene, camera, canvas }) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const bodies = [];
  let activeIds = null;
  let hoverCb = null;
  let clickCb = null;
  let currentHover = null;

  const invisibleMat = new THREE.MeshBasicMaterial({ visible: false });

  function addBody(id, getPosition, radius) {
    const geom = new THREE.SphereGeometry(radius, 12, 10);
    const mesh = new THREE.Mesh(geom, invisibleMat);
    mesh.userData.bodyId = id;
    mesh.layers.set(1); // Picker only — kamera renderuje Layer 0, raycaster vidí 0+1
    scene.add(mesh);
    bodies.push({ id, mesh, getPosition, radius });
  }

  function setActiveIds(ids) {
    activeIds = ids;
  }

  function updateMeshPositions() {
    for (const b of bodies) {
      const p = b.getPosition();
      b.mesh.position.set(p.x, p.y, p.z);
    }
  }

  function pickFromMouse(ev) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    raycaster.layers.enable(0);
    raycaster.layers.enable(1); // vidět picker meshes na Layer 1
    const meshes = bodies
      .filter((b) => activeIds === null || activeIds.has(b.id))
      .map((b) => b.mesh);
    const hits = raycaster.intersectObjects(meshes, false);
    return hits.length > 0 ? hits[0].object.userData.bodyId : null;
  }

  function handleMove(ev) {
    const id = pickFromMouse(ev);
    if (id !== currentHover) {
      currentHover = id;
      hoverCb && hoverCb(id, ev);
    }
  }

  // Drag detection: pokud se mezi mousedown a mouseup kurzor hodně pohnul,
  // není to "click" — uživatel dragoval. V detail view to je orbit-kamera.
  let _downX = 0;
  let _downY = 0;
  let _downTime = 0;
  const DRAG_THRESHOLD_PX = 6;
  const CLICK_MAX_MS = 500;

  function handleDown(ev) {
    _downX = ev.clientX;
    _downY = ev.clientY;
    _downTime = performance.now();
  }

  function handleUp(ev) {
    const dx = ev.clientX - _downX;
    const dy = ev.clientY - _downY;
    const dist = Math.hypot(dx, dy);
    const dt = performance.now() - _downTime;
    if (dist > DRAG_THRESHOLD_PX || dt > CLICK_MAX_MS) return; // drag or long hold — ignoruj
    const id = pickFromMouse(ev);
    if (id) clickCb && clickCb(id, ev);
  }

  canvas.addEventListener('mousemove', handleMove);
  canvas.addEventListener('mousedown', handleDown);
  canvas.addEventListener('mouseup', handleUp);

  return {
    addBody,
    setActiveIds,
    onHover(cb) { hoverCb = cb; },
    onClick(cb) { clickCb = cb; },
    update() { updateMeshPositions(); },
    dispose() {
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('mousedown', handleDown);
      canvas.removeEventListener('mouseup', handleUp);
      for (const b of bodies) {
        scene.remove(b.mesh);
        b.mesh.geometry.dispose();
      }
      invisibleMat.dispose();
    },
  };
}
