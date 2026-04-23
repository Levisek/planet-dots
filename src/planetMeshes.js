import * as THREE from 'three';
import { PLANETS, PLANET_BY_ID } from './planets.js';

const loader = new THREE.TextureLoader();

function createRingMesh(planet) {
  const geometry = new THREE.RingGeometry(planet.ringInnerRadius, planet.ringOuterRadius, 128);
  // remap UV aby textura byla radiální (vnitřní okraj = u=0, vnější = u=1)
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.sqrt(x * x + y * y);
    const t = (r - planet.ringInnerRadius) / (planet.ringOuterRadius - planet.ringInnerRadius);
    uv.setXY(i, t, 0.5);
  }
  const texture = loader.load(planet.ringTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = Math.PI / 2; // ležet horizontálně
  return mesh;
}

export function createPlanetMeshes(scene) {
  const meshes = {};
  const rings = {};
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
    mesh.rotation.z = THREE.MathUtils.degToRad(p.axialTilt);
    mesh.userData.planet = p;
    scene.add(mesh);
    meshes[p.id] = mesh;

    if (p.ringTexture) {
      const ring = createRingMesh(p);
      ring.position.copy(mesh.position);
      // prstence sdílí tilt planety (jsou v rovníku)
      ring.rotation.x = Math.PI / 2 + THREE.MathUtils.degToRad(p.axialTilt);
      scene.add(ring);
      rings[p.id] = ring;
    }
  }
  return { meshes, rings };
}
