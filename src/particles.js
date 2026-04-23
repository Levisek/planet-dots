import * as THREE from 'three';
import { PHASE } from './phase.js';

export { PHASE };

const VERTEX_SHADER = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * (320.0 / -mv.z);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c);
  if (d > 0.5) discard;
  float g = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor, g * vAlpha);
}
`;

export class ParticlePool {
  constructor(count = 1500) {
    this.count = count;
    // GPU-uploaded (via BufferAttribute níže):
    this.position = new Float32Array(count * 3);
    this.color    = new Float32Array(count * 3);
    // CPU-only state pro animation lerp (nenahrává se na GPU):
    this.target      = new Float32Array(count * 3);
    this.velocity    = new Float32Array(count * 3);
    this.targetColor = new Float32Array(count * 3);
    // Local offset od center planety (pro cluster rotaci v live fázi):
    this.localOffset = new Float32Array(count * 3);
    this.size     = new Float32Array(count);
    this.alpha    = new Float32Array(count);
    this.phase    = new Uint8Array(count);
    this.owner    = new Int16Array(count); // planet index or -1

    const geometry = new THREE.BufferGeometry();
    this.posAttr   = new THREE.BufferAttribute(this.position, 3);
    this.colorAttr = new THREE.BufferAttribute(this.color, 3);
    this.sizeAttr  = new THREE.BufferAttribute(this.size, 1);
    this.alphaAttr = new THREE.BufferAttribute(this.alpha, 1);
    // všechny 4 atributy se přepisují každý frame → dynamic draw hint
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colorAttr.setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr.setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', this.posAttr);
    geometry.setAttribute('aColor',   this.colorAttr);
    geometry.setAttribute('aSize',    this.sizeAttr);
    geometry.setAttribute('aAlpha',   this.alphaAttr);
    this.geometry = geometry;

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.mesh = new THREE.Points(geometry, this.material);

    // init: všechny FREE, na random pozicích (naplníme v animation fázi Init).
    for (let i = 0; i < count; i++) {
      this.position[3 * i]     = 0;
      this.position[3 * i + 1] = 0;
      this.position[3 * i + 2] = 0;
      this.color[3 * i]     = 1;
      this.color[3 * i + 1] = 1;
      this.color[3 * i + 2] = 1;
      this.size[i] = 2.2;
      this.alpha[i] = 0;
      this.phase[i] = PHASE.IDLE;
      this.owner[i] = -1;
    }

    this.posAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
  }

  setPosition(i, x, y, z) {
    this.position[3*i] = x; this.position[3*i+1] = y; this.position[3*i+2] = z;
  }
  setTarget(i, x, y, z) {
    this.target[3*i] = x; this.target[3*i+1] = y; this.target[3*i+2] = z;
  }
  setColor(i, r, g, b) {
    this.color[3*i] = r; this.color[3*i+1] = g; this.color[3*i+2] = b;
  }
  setTargetColor(i, r, g, b) {
    this.targetColor[3*i] = r; this.targetColor[3*i+1] = g; this.targetColor[3*i+2] = b;
  }

  // Full re-upload všech 4 GPU atributů. Pro init/reset; per-frame updaty
  // volají `this.posAttr.needsUpdate = true` apod. granulárně.
  flushDirty() {
    this.posAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }

  resetAllToFree() {
    for (let i = 0; i < this.count; i++) {
      this.phase[i] = PHASE.FREE;
      this.owner[i] = -1;
      // random start position ve viewportu
      this.position[3*i]     = (Math.random() - 0.5) * 1800;
      this.position[3*i + 1] = (Math.random() - 0.5) * 800;
      this.position[3*i + 2] = (Math.random() - 0.5) * 400;
      this.target[3*i]     = this.position[3*i];
      this.target[3*i + 1] = this.position[3*i + 1];
      this.target[3*i + 2] = this.position[3*i + 2];
      this.color[3*i]     = 1; this.color[3*i + 1] = 1; this.color[3*i + 2] = 1;
      this.size[i] = 2.2;
      this.alpha[i] = 0;
    }
    this.flushDirty();
  }

  noiseDriftAll(time, dt, magnitude = 6) {
    for (let i = 0; i < this.count; i++) {
      if (this.phase[i] !== PHASE.FREE) continue;
      const seed = i * 0.13;
      this.position[3*i]     += Math.sin(time * 0.5 + seed) * magnitude * dt;
      this.position[3*i + 1] += Math.cos(time * 0.4 + seed * 2) * magnitude * dt;
      this.position[3*i + 2] += Math.sin(time * 0.3 + seed * 3) * magnitude * 0.5 * dt;
    }
    this.posAttr.needsUpdate = true;
  }

  fadeInAll(rate, dt) {
    let dirty = false;
    for (let i = 0; i < this.count; i++) {
      if (this.alpha[i] < 0.7) {
        this.alpha[i] = Math.min(0.7, this.alpha[i] + rate * dt);
        dirty = true;
      }
    }
    if (dirty) this.alphaAttr.needsUpdate = true;
  }

  /** Alokuje prvních `count` FREE particle indexů. Vrací pole indexů. */
  takeFreeIndices(count) {
    const out = [];
    for (let i = 0; i < this.count && out.length < count; i++) {
      if (this.phase[i] === PHASE.FREE) out.push(i);
    }
    return out;
  }

  /** Nastaví target pozice pro indexy + phase FORMING_LABEL. */
  assignLabelTargets(indices, labelPoints) {
    for (let k = 0; k < indices.length; k++) {
      const i = indices[k];
      const p = labelPoints[k % labelPoints.length];
      this.target[3*i]     = p[0];
      this.target[3*i + 1] = p[1];
      this.target[3*i + 2] = p[2];
      this.phase[i] = PHASE.FORMING_LABEL;
    }
  }

  /** Nastaví target pozice k povrchu planety + phase FLYING_TO_PLANET. */
  assignPlanetTargets(indices, planetPosition, fibonacciPts, planetColor) {
    for (let k = 0; k < indices.length; k++) {
      const i = indices[k];
      const off = fibonacciPts[k % fibonacciPts.length];
      this.target[3*i]     = planetPosition.x + off[0];
      this.target[3*i + 1] = planetPosition.y + off[1];
      this.target[3*i + 2] = planetPosition.z + off[2];
      this.phase[i] = PHASE.FLYING_TO_PLANET;
      this.targetColor[3*i]     = planetColor.r;
      this.targetColor[3*i + 1] = planetColor.g;
      this.targetColor[3*i + 2] = planetColor.b;
    }
  }

  /**
   * Přiřadí každé tečce pozici na povrchu planety + barvu sampled z textury.
   * Uloží také localOffset pro rotaci clusteru v live fázi.
   * @param {number[]} indices — indexy teček v poolu
   * @param {{x:number,y:number,z:number}} center — pozice planety v world space
   * @param {number[][]} fibPts — Fibonacci sphere body [x,y,z] (relativní, už škálované na radius)
   * @param {ImageData} imageData — bitmap textury planety
   */
  assignPlanetDotsFromTexture(indices, center, fibPts, imageData) {
    const { data, width, height } = imageData;
    for (let k = 0; k < indices.length; k++) {
      const i = indices[k];
      const off = fibPts[k % fibPts.length];
      const ox = off[0], oy = off[1], oz = off[2];
      // World target pozice:
      this.target[3*i]     = center.x + ox;
      this.target[3*i + 1] = center.y + oy;
      this.target[3*i + 2] = center.z + oz;
      // Local offset (pro rotaci):
      this.localOffset[3*i]     = ox;
      this.localOffset[3*i + 1] = oy;
      this.localOffset[3*i + 2] = oz;
      // UV z sphere pozice (normalizovat):
      const r = Math.sqrt(ox*ox + oy*oy + oz*oz) || 1;
      const u = Math.atan2(oz, ox) / (Math.PI * 2) + 0.5;
      const v = Math.asin(oy / r) / Math.PI + 0.5;
      const px = Math.min(width - 1, Math.max(0, Math.floor(u * width)));
      const py = Math.min(height - 1, Math.max(0, Math.floor((1 - v) * height)));
      const idx = (py * width + px) * 4;
      this.targetColor[3*i]     = data[idx]     / 255;
      this.targetColor[3*i + 1] = data[idx + 1] / 255;
      this.targetColor[3*i + 2] = data[idx + 2] / 255;
      this.phase[i] = PHASE.FLYING_TO_PLANET;
    }
  }

  /**
   * Přiřadí tečkám pozice v nakloněném prstencovém disku + barvy sampled
   * z 1D ring textury (horizontální proužek).
   * @param {number[]} indices
   * @param {{x:number,y:number,z:number}} center
   * @param {number} innerRadius
   * @param {number} outerRadius
   * @param {ImageData} imageData
   * @param {number} tiltRadians — sklon ring disku (kolem X osy, stejný jako axial tilt planety)
   */
  assignRingDotsFromTexture(indices, center, innerRadius, outerRadius, imageData, tiltRadians) {
    const { data, width, height } = imageData;
    const cosT = Math.cos(tiltRadians);
    const sinT = Math.sin(tiltRadians);
    const py = Math.floor(0.5 * height);
    for (let k = 0; k < indices.length; k++) {
      const i = indices[k];
      const t = Math.random();
      const r = Math.sqrt(innerRadius*innerRadius + t * (outerRadius*outerRadius - innerRadius*innerRadius));
      const theta = Math.random() * Math.PI * 2;
      // Local pos v ring plane (z=0):
      const lx = Math.cos(theta) * r;
      const ly = 0;
      const lz = Math.sin(theta) * r;
      // Apply tilt rotation kolem X osy:
      const ox = lx;
      const oy = ly * cosT - lz * sinT;
      const oz = ly * sinT + lz * cosT;
      this.target[3*i]     = center.x + ox;
      this.target[3*i + 1] = center.y + oy;
      this.target[3*i + 2] = center.z + oz;
      this.localOffset[3*i]     = ox;
      this.localOffset[3*i + 1] = oy;
      this.localOffset[3*i + 2] = oz;
      // Sample color z ring textury podle radiálního t:
      const px = Math.min(width - 1, Math.max(0, Math.floor(t * width)));
      const idx = (py * width + px) * 4;
      this.targetColor[3*i]     = data[idx]     / 255;
      this.targetColor[3*i + 1] = data[idx + 1] / 255;
      this.targetColor[3*i + 2] = data[idx + 2] / 255;
      // Alpha z textury — pokud je transparentní, tečka bude také míň viditelná
      const alpha = data[idx + 3] / 255;
      this.size[i] = 1.6 * alpha; // malé/neviditelné tam kde ring-texture má alpha 0
      this.phase[i] = PHASE.FLYING_TO_PLANET;
    }
  }

  /** Lerp position→target a color→targetColor s daným koeficientem (0..1). */
  lerpToTargets(k) {
    for (let i = 0; i < this.count; i++) {
      if (this.phase[i] === PHASE.FREE || this.phase[i] === PHASE.IDLE) continue;
      this.position[3*i]     += (this.target[3*i]     - this.position[3*i])     * k;
      this.position[3*i + 1] += (this.target[3*i + 1] - this.position[3*i + 1]) * k;
      this.position[3*i + 2] += (this.target[3*i + 2] - this.position[3*i + 2]) * k;
      this.color[3*i]     += (this.targetColor[3*i]     - this.color[3*i])     * k * 0.5;
      this.color[3*i + 1] += (this.targetColor[3*i + 1] - this.color[3*i + 1]) * k * 0.5;
      this.color[3*i + 2] += (this.targetColor[3*i + 2] - this.color[3*i + 2]) * k * 0.5;
    }
    this.posAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
  }

  /** Tečky v phase ON_PLANET lehce oscilují v normále povrchu (dýchavé). */
  surfaceOscillate(time, dt, amplitude = 0.4) {
    for (let i = 0; i < this.count; i++) {
      if (this.phase[i] !== PHASE.ON_PLANET) continue;
      const seed = i * 0.07;
      const osc = Math.sin(time * 1.2 + seed) * amplitude * dt;
      this.position[3*i]     += (this.target[3*i]     - this.position[3*i])     * 0.05 + osc;
      this.position[3*i + 1] += (this.target[3*i + 1] - this.position[3*i + 1]) * 0.05;
      this.position[3*i + 2] += (this.target[3*i + 2] - this.position[3*i + 2]) * 0.05;
    }
    this.posAttr.needsUpdate = true;
  }
}
