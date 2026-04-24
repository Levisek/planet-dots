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

  function handleClick(ev) {
    const id = pickFromMouse(ev);
    if (id) clickCb && clickCb(id, ev);
  }

  canvas.addEventListener('mousemove', handleMove);
  canvas.addEventListener('click', handleClick);

  return {
    addBody,
    setActiveIds,
    onHover(cb) { hoverCb = cb; },
    onClick(cb) { clickCb = cb; },
    update() { updateMeshPositions(); },
    dispose() {
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('click', handleClick);
      for (const b of bodies) {
        scene.remove(b.mesh);
        b.mesh.geometry.dispose();
      }
      invisibleMat.dispose();
    },
  };
}
