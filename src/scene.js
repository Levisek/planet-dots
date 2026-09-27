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
    1,
    2000000, // far plane — Fyzikální Neptun (115K) + obloha (sky.js, 900K od kamery).
  );
  // Default 3D pohled na celou soustavu — kamera nad orbital rovinou (~30°),
  // vidí Sun (origin) + Neptune orbit (radius 3018).
  // VISUAL-AUDIT I4: dřívější (0,3500,6000) nechalo Slunce zabrat ⅓ framu
  // a inner planety splývaly se sluneční sférou — zoom-out na (0,5000,9000).
  camera.position.set(0, 5000, 9000);
  camera.lookAt(0, 0, 0);

  // Lighting toggle: ON → silný PointLight z origin (Sun) + nízký ambient.
  // OFF → light intensity 0 (planety jsou flat MeshBasicMaterial, ignorují světla).
  // Material swap pro planety řídí main.js přes setLightingMode callback.
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(ambientLight);
  // PointLight constructor: (color, intensity, distance, decay).
  // distance=0 → light dosáhne nekonečna. decay=0 → bez inverse-square falloff
  // (jinak Neptune ve vzdálenosti 3018 dostane ~0 intensity z 1.5).
  // Lambertian dán direction světla (radial od origin) — den/noc strana funguje.
  const sunPoint = new THREE.PointLight(0xffffff, 0, 0, 0);
  sunPoint.position.set(0, 0, 0);
  scene.add(sunPoint);

  const _modeListeners = [];
  function setLightingMode(real) {
    if (real) {
      // Sun side full saturate (color × 4 → clamped na 1.0 = plné barvy).
      // Ambient 0.3 ať noční strana není uplně černá ale je výrazně tmavší.
      ambientLight.intensity = 0.3;
      sunPoint.intensity = 4.0;
    } else {
      ambientLight.intensity = 1.0;
      sunPoint.intensity = 0;
    }
    for (const cb of _modeListeners) cb(real);
  }
  function onLightingModeChange(cb) { _modeListeners.push(cb); }

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
  controls.maxDistance = 500000; // Fyzikální mode: Neptune at 115K, kamera musí umět odzoom out

  return { renderer, scene, camera, controls, setLightingMode, onLightingModeChange };
}
