// saturnRing — real 3D RingGeometry v ekvatoriální rovině Saturnu.
// Per-vertex barva sampled z saturn_ring.png podle radiální pozice t.
// Mesh je child Saturn anchoru → dědí axial tilt automaticky.

import * as THREE from 'three';
import { sampleRingColor } from './saturnRingMath.js';

export { sampleRingColor };

/**
 * @param {ImageData} ringImageData
 * @param {number} innerRadius — vnitřní okraj (scene units)
 * @param {number} outerRadius — vnější okraj
 * @param {number} segments — angular segments (default 128)
 * @param {number} radialSegments — radial subdivisions (default 8)
 * @returns {THREE.Mesh}
 */
export function buildSaturnRing(ringImageData, innerRadius, outerRadius, segments = 128, radialSegments = 8) {
  const geom = new THREE.RingGeometry(innerRadius, outerRadius, segments, radialSegments);

  // RingGeometry má atribut `position` v XY rovině. Per-vertex color + alpha
  // sampled radiálně podle vzdálenosti od středu.
  const posArr = geom.attributes.position;
  const colorArr = new Float32Array(posArr.count * 3);
  const alphaArr = new Float32Array(posArr.count);

  for (let i = 0; i < posArr.count; i++) {
    const x = posArr.getX(i);
    const y = posArr.getY(i);
    const r = Math.sqrt(x * x + y * y);
    const t = (r - innerRadius) / (outerRadius - innerRadius);
    const [cr, cg, cb, ca] = sampleRingColor(ringImageData, t);
    colorArr[i * 3] = cr;
    colorArr[i * 3 + 1] = cg;
    colorArr[i * 3 + 2] = cb;
    alphaArr[i] = ca;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
  geom.setAttribute('ringAlpha', new THREE.BufferAttribute(alphaArr, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float ringAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = color;
        vAlpha = ringAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        gl_FragColor = vec4(vColor, vAlpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false, // ať za prstencem viditelné objekty správně blendují
  });

  const mesh = new THREE.Mesh(geom, material);
  // RingGeometry default je v XY (kolmo na Z). Saturnův equator je v rovině XZ
  // (Y = severní pól anchoru). Otočíme o 90° kolem X aby ring ležel v XZ.
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}
