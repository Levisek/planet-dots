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
 * Statický v lokálním frame, rotuje kolem Y osy s periodou ~30s.
 * Reaguje na simMode (Pochopení/Fyzikální) — přepočítá pozice při mode change.
 *
 * @param {THREE.Scene} scene
 * @returns {{points: THREE.Points, update: (simElapsed: number) => void}}
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
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
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

  // Při změně simMode přepočítej pozice všech particles
  onModeChange(() => {
    const posArr = geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const radius = auToDisplayMode(particleAU[i]);
      posArr[i * 3] = radius * Math.cos(particleAngle[i]);
      posArr[i * 3 + 2] = radius * Math.sin(particleAngle[i]);
      // Y zůstává stejný (particleY[i] nezávisí na mode)
    }
    geometry.attributes.position.needsUpdate = true;
  });

  // Belt rotuje kolem Y osy s periodou ~30s sim (průměrný asteroid period ve Pochopení tempu)
  const ROTATION_PERIOD_SEC = 30;
  const omega = (2 * Math.PI) / ROTATION_PERIOD_SEC;

  function update(simElapsed) {
    points.rotation.y = simElapsed * omega;
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
