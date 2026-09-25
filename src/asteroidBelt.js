import * as THREE from 'three';
import { ASTEROID_BELT } from './asteroids.js';
import { auToDisplayRadius } from './planetOrbits.js';
import { isFyzikalni, onModeChange } from './simMode.js';

const AU_TO_DISPLAY_REAL = 3846; // linear AU mapping per planets.js V4.2 spec

function auToDisplayMode(au) {
  return isFyzikalni() ? au * AU_TO_DISPLAY_REAL : auToDisplayRadius(au);
}

/**
 * Vytvoří particle ring jako THREE.Points.
 * 300 asteroidů s gaussian distribucí kolem 2.8 AU (Peak asteroid belt).
 * Každá částice obíhá Keplerovou rychlostí podle své vzdálenosti (T = a^1.5
 * roku) a úhel se počítá ze simulačního data — pás tak drží krok s Ceres/
 * Vestou/Pallas, respektuje scrub i reverse. Dřív rotoval jako tuhý disk
 * s periodou 30 s akumulovaného času (Ceres 17 s) a scrub ho ignoroval.
 * Reaguje na simMode (Pochopení/Fyzikální) — poloměr podle módu.
 *
 * @param {THREE.Scene} scene
 * @returns {{points: THREE.Points, update: (date: Date) => void}}
 */
export function createAsteroidBelt(scene) {
  const { count, innerAU, outerAU, peakAU, sigmaAU, sizeRange, colorRange } = ASTEROID_BELT;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  // Parsuj color range: '#3a3530' → RGB, '#7a7065' → RGB
  const minColor = hexToRgb(colorRange.min);
  const maxColor = hexToRgb(colorRange.max);

  // Store per-particle au/angle/yJitter so we can rebuild on mode change
  const particleAU = new Float32Array(count);
  const particleAngle = new Float32Array(count);
  const particleY = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Box-Muller transform pro Gaussian sample kolem peakAU
    let au;
    do {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      au = peakAU + z * sigmaAU;
    } while (au < innerAU || au > outerAU);

    const angle = Math.random() * Math.PI * 2;
    // Belt má lehkou tloušťku v Y (±5 jednotek)
    const yJitter = (Math.random() - 0.5) * 10;

    particleAU[i] = au;
    particleAngle[i] = angle;
    particleY[i] = yJitter;

    const radius = auToDisplayMode(au);
    positions[i * 3] = radius * Math.cos(angle);
    positions[i * 3 + 1] = yJitter;
    positions[i * 3 + 2] = radius * Math.sin(angle);

    // Color lerp min → max (random interpolace)
    const t = Math.random();
    colors[i * 3] = minColor.r + t * (maxColor.r - minColor.r);
    colors[i * 3 + 1] = minColor.g + t * (maxColor.g - minColor.g);
    colors[i * 3 + 2] = minColor.b + t * (maxColor.b - minColor.b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage)); // update() každý frame
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: sizeRange.maxPx,
    vertexColors: true,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.7,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  // Poloměr podle módu (cache, přepočet při změně simMode) + úhlová
  // rychlost per částice (rad/den) z Keplerova 3. zákona.
  const particleRadius = new Float32Array(count);
  const particleOmega = new Float32Array(count);
  function recomputeRadii() {
    for (let i = 0; i < count; i++) particleRadius[i] = auToDisplayMode(particleAU[i]);
  }
  recomputeRadii();
  for (let i = 0; i < count; i++) {
    const periodDays = 365.25 * Math.pow(particleAU[i], 1.5);
    // Prograde v scene frame = záporný úhel v X-Z (viz coordinateFrame).
    particleOmega[i] = -(2 * Math.PI) / periodDays;
  }
  onModeChange(recomputeRadii);

  const J2000_MS = Date.UTC(2000, 0, 1, 12);
  function update(date) {
    const days = (date.getTime() - J2000_MS) / 86400000;
    const posArr = geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const ang = particleAngle[i] + ((days * particleOmega[i]) % (2 * Math.PI));
      posArr[i * 3] = particleRadius[i] * Math.cos(ang);
      posArr[i * 3 + 2] = particleRadius[i] * Math.sin(ang);
    }
    geometry.attributes.position.needsUpdate = true;
  }

  return { points, update };
}

/**
 * Konvertuje hex color string na RGB [0,1] obiekt.
 * @param {string} hex - format '#rrggbb'
 * @returns {{r: number, g: number, b: number}}
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) throw new Error(`Invalid hex color: ${hex}`);
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  };
}
