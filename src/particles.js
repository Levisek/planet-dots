import * as THREE from 'three';

export const PHASE = Object.freeze({
  IDLE: 0,           // rezerva
  FREE: 1,           // vznáší se v Perlin noise
  FORMING_LABEL: 2,  // letí k label pozici
  HOLDING_LABEL: 3,  // drží v label pozici
  FLYING_TO_PLANET: 4,
  ON_PLANET: 5,
  ON_RING: 6,
});

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
}
