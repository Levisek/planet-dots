import * as THREE from 'three';
import { PLANETS } from './planets.js';

const loader = new THREE.TextureLoader();

export function createPlanetMeshes(scene) {
  const meshes = {};
  for (const p of PLANETS) {
    const geometry = new THREE.SphereGeometry(p.radiusPx, 64, 64);
    const texture = loader.load(p.texture);
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = p.emissive
      ? new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0 })
      : new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 1,
          metalness: 0,
          transparent: true,
          opacity: 0,
        });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(p.xPosition, 0, 0);
    mesh.userData.planet = p;
    scene.add(mesh);
    meshes[p.id] = mesh;
  }
  return meshes;
}
