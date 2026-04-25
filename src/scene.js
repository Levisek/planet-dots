import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createScene() {
  const canvas = document.getElementById('canvas');
  if (!canvas) throw new Error('canvas #canvas not found');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    1,         // near 1 (místo 0.1) — lepší Z-buffer precision pro vzdálené objekty
    200000,
  );
  // Default 3D pohled na celou soustavu — kamera nad orbital rovinou (~30°),
  // vidí Sun (origin) + Neptune orbit (radius 2197).
  camera.position.set(0, 2500, 4500);
  camera.lookAt(0, 0, 0);

  // světla — silný ambient (jasné barvy textur), bodové sluneční světlo v origin.
  // Žádný den/noc shader — meshe jsou flat MeshBasicMaterial.
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));
  const sunLight = new THREE.PointLight(0xffffff, 2.2, 8000);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  // resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 30;
  controls.maxDistance = 50000;

  return { renderer, scene, camera, controls };
}

export function createStarfield(scene, count = 1500) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Hvězdy daleko (r = 80k..120k) aby při přeletu kamery na libovolnou planetu
    // nedocházelo k viditelnému parallaxu (hvězdy musí vypadat jako v nekonečnu).
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 80000 + Math.random() * 40000;
    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 80,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  return points;
}
