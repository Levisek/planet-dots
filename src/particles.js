import * as THREE from 'three';
import { PHASE } from './phase.js';

export { PHASE };

const _tmpVec3 = new THREE.Vector3();

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
  gl_PointSize = aSize * (900.0 / -mv.z);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c);
  if (d > 0.5) discard;
  // Ostrý, neprůhledný disk (žádný gradient) — planety/Slunce vypadají solidně.
  float edge = smoothstep(0.5, 0.45, d); // jen krátký anti-alias na okraji
  gl_FragColor = vec4(vColor, edge * vAlpha);
}
`;

export class ParticlePool {
  constructor(count) {
    this.count = count;
    // GPU-uploaded
    this.position = new Float32Array(count * 3);
    this.color = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    // CPU-only
    this.target = new Float32Array(count * 3);
    this.velocity = new Float32Array(count * 3);    // pro FLYING tečky (world-space units/sec)
    this.localOffset = new Float32Array(count * 3); // relative to owner anchor — pro cluster rotaci
    this.arrivalTime = new Float32Array(count);      // kdy FLYING tečka dorazí
    this.postArrivalTarget = new Float32Array(count * 3); // kam jít po HOLDING_LABEL (sphere pos)
    this.postArrivalColor = new Float32Array(count * 3);  // barva po HOLDING_LABEL
    this.holdUntil = new Float32Array(count);         // kdy skončí HOLDING_LABEL
    this.phase = new Uint8Array(count);
    this.owner = new Int16Array(count);

    const geometry = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.position, 3);
    this.colorAttr = new THREE.BufferAttribute(this.color, 3);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1);
    this.alphaAttr = new THREE.BufferAttribute(this.alpha, 1);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colorAttr.setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr.setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', this.posAttr);
    geometry.setAttribute('aColor', this.colorAttr);
    geometry.setAttribute('aSize', this.sizeAttr);
    geometry.setAttribute('aAlpha', this.alphaAttr);
    this.geometry = geometry;

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: true,                  // solid look, planety neprůsvitné
      blending: THREE.NormalBlending,    // bez additive překrytí
    });

    this.mesh = new THREE.Points(geometry, this.material);

    // init všechny IDLE
    for (let i = 0; i < count; i++) {
      this.phase[i] = PHASE.IDLE;
      this.owner[i] = -1;
      this.size[i] = 5.5;
      this.alpha[i] = 0;
    }
    this.flushAll();
  }

  flushAll() {
    this.posAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }

  /**
   * Naplní prvních `count` teček statickými pozicemi na Slunci (Fibonacci sphere).
   * Tečky mají phase ON_SUN, barvy sampled ze sun texture.
   * Tyto tečky jsou „zdrojem" — solar wind controller z nich bude brát při emisi.
   * @param {{x,y,z}} center
   * @param {number} radius
   * @param {ImageData} sunImageData
   * @param {number} count — kolik teček naplnit (první v poolu)
   * @returns {number[]} indices — použité indexy
   */
  initFullSun(center, radius, sunImageData, count) {
    const { data, width, height } = sunImageData;
    const phi = Math.PI * (Math.sqrt(5) - 1);
    const indices = [];
    for (let i = 0; i < count; i++) {
      if (i >= this.count) break;
      const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
      const rr = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = phi * i;
      const sx = Math.cos(theta) * rr;
      const sy = y;
      const sz = Math.sin(theta) * rr;
      const ox = sx * radius;
      const oy = sy * radius;
      const oz = sz * radius;
      this.position[3*i]     = center.x + ox;
      this.position[3*i + 1] = center.y + oy;
      this.position[3*i + 2] = center.z + oz;
      this.localOffset[3*i]     = ox;
      this.localOffset[3*i + 1] = oy;
      this.localOffset[3*i + 2] = oz;
      // sample color:
      const u = Math.atan2(sz, sx) / (Math.PI * 2) + 0.5;
      const v = Math.asin(sy) / Math.PI + 0.5;
      const px = Math.min(width - 1, Math.max(0, Math.floor(u * width)));
      const py = Math.min(height - 1, Math.max(0, Math.floor((1 - v) * height)));
      const idx = (py * width + px) * 4;
      this.color[3*i]     = data[idx] / 255;
      this.color[3*i + 1] = data[idx + 1] / 255;
      this.color[3*i + 2] = data[idx + 2] / 255;
      this.alpha[i] = 1.0;
      this.size[i] = 6.0;
      this.phase[i] = PHASE.ON_SUN;
      this.owner[i] = 0; // Sun = index 0 in PLANETS
      indices.push(i);
    }
    this.flushAll();
    return indices;
  }

  /**
   * Spawn jedné letící tečky ze Slunce. Použije FREE (IDLE) index.
   * Nastaví position = ze Slunce (random point on Sun surface), velocity k target.
   * @param {number} sourceIdx — index volné IDLE tečky
   * @param {{x,y,z}} sunCenter — world pos Slunce
   * @param {number} sunRadius
   * @param {{x,y,z}} finalTarget — kam dorazí (world pos)
   * @param {{x,y,z}} finalTargetLocal — local offset relativně k ownerovi (po příletu pro cluster rotaci)
   * @param {[number,number,number]} finalColor — barva po příletu (sampled from texture)
   * @param {number} planetOwnerIdx — planet index (pro ON_PLANET owner)
   * @param {number} finalPhase — PHASE.ON_PLANET nebo PHASE.ON_RING po příletu
   * @param {number} currentTime — čas v sekundách
   * @param {number} travelTime — jak dlouho letět
   * @param {{x,y,z}=} labelPos — pokud je dané, tečka nejdřív letí sem (hold 0.3s), pak finalTarget
   * @param {number=} labelHoldDuration
   */
  spawnFromSun(sourceIdx, sunCenter, sunRadius, finalTarget, finalTargetLocal,
               finalColor, planetOwnerIdx, finalPhase, currentTime, travelTime,
               labelPos, labelHoldDuration = 0.3) {
    const i = sourceIdx;
    // start pozice = random na Sun surface
    const rx = (Math.random() - 0.5) * 2;
    const ry = (Math.random() - 0.5) * 2;
    const rz = (Math.random() - 0.5) * 2;
    const len = Math.sqrt(rx*rx + ry*ry + rz*rz) || 1;
    const sx = sunCenter.x + (rx/len) * sunRadius;
    const sy = sunCenter.y + (ry/len) * sunRadius;
    const sz = sunCenter.z + (rz/len) * sunRadius;
    this.position[3*i]     = sx;
    this.position[3*i + 1] = sy;
    this.position[3*i + 2] = sz;
    // Final color = cílová barva (barva v průběhu letu se lerpne)
    // Barva při emit = bílá/sluneční (zažehnutá z povrchu Slunce)
    this.color[3*i]     = 1;
    this.color[3*i + 1] = 0.95;
    this.color[3*i + 2] = 0.7;
    this.alpha[i] = 1.0;

    // Target: buď label pos (pokud předán) nebo final target
    let tx, ty, tz;
    if (labelPos) {
      tx = labelPos.x; ty = labelPos.y; tz = labelPos.z;
      this.holdUntil[i] = currentTime + travelTime + labelHoldDuration;
    } else {
      tx = finalTarget.x; ty = finalTarget.y; tz = finalTarget.z;
      this.holdUntil[i] = 0; // no hold
    }
    this.target[3*i]     = tx;
    this.target[3*i + 1] = ty;
    this.target[3*i + 2] = tz;

    // Velocity = (target - start) / travelTime (linear flight)
    this.velocity[3*i]     = (tx - sx) / travelTime;
    this.velocity[3*i + 1] = (ty - sy) / travelTime;
    this.velocity[3*i + 2] = (tz - sz) / travelTime;

    // Post-arrival (po HOLDING_LABEL nebo rovnou settled)
    this.postArrivalTarget[3*i]     = finalTarget.x;
    this.postArrivalTarget[3*i + 1] = finalTarget.y;
    this.postArrivalTarget[3*i + 2] = finalTarget.z;
    this.postArrivalColor[3*i]     = finalColor[0];
    this.postArrivalColor[3*i + 1] = finalColor[1];
    this.postArrivalColor[3*i + 2] = finalColor[2];
    this.localOffset[3*i]     = finalTargetLocal.x;
    this.localOffset[3*i + 1] = finalTargetLocal.y;
    this.localOffset[3*i + 2] = finalTargetLocal.z;

    this.arrivalTime[i] = currentTime + travelTime;
    this.owner[i] = planetOwnerIdx;
    this.phase[i] = PHASE.FLYING;
    // finalPhase uložíme v odhadnutém místě: (hack — postArrivalColor[3] není, musíme někam jinam)
    // Řešení: používáme size[i] > 3 = ON_PLANET, size[i] <= 3 = ON_RING — simple discrimination
    // Nebo: použijeme owner znaménko nebo jiný bit. Nejjednodušší: size signals ring.
    this.size[i] = (finalPhase === PHASE.ON_RING) ? 4.5 : 6.0;
  }

  /**
   * Update tečky pro daný frame:
   *  - FLYING: position += velocity * dt; if time >= arrivalTime → snap to target, transition.
   *  - HOLDING_LABEL: drží, if time >= holdUntil → re-target na postArrivalTarget (velocity = ?).
   *  - Lerp color from current to postArrivalColor during FLYING.
   */
  updateFlight(currentTime, dt) {
    for (let i = 0; i < this.count; i++) {
      const ph = this.phase[i];
      if (ph === PHASE.FLYING) {
        // move
        this.position[3*i]     += this.velocity[3*i]     * dt;
        this.position[3*i + 1] += this.velocity[3*i + 1] * dt;
        this.position[3*i + 2] += this.velocity[3*i + 2] * dt;
        // lerp color toward post-arrival
        const k = 0.04;
        this.color[3*i]     += (this.postArrivalColor[3*i]     - this.color[3*i])     * k;
        this.color[3*i + 1] += (this.postArrivalColor[3*i + 1] - this.color[3*i + 1]) * k;
        this.color[3*i + 2] += (this.postArrivalColor[3*i + 2] - this.color[3*i + 2]) * k;
        // arrival?
        if (currentTime >= this.arrivalTime[i]) {
          // snap to target
          this.position[3*i]     = this.target[3*i];
          this.position[3*i + 1] = this.target[3*i + 1];
          this.position[3*i + 2] = this.target[3*i + 2];
          // if holdUntil > 0 → hold label; else settle
          if (this.holdUntil[i] > currentTime) {
            this.phase[i] = PHASE.HOLDING_LABEL;
          } else {
            // settle to final phase (ON_PLANET or ON_RING based on size)
            this.phase[i] = (this.size[i] < 5.0) ? PHASE.ON_RING : PHASE.ON_PLANET;
            // snap color to final
            this.color[3*i]     = this.postArrivalColor[3*i];
            this.color[3*i + 1] = this.postArrivalColor[3*i + 1];
            this.color[3*i + 2] = this.postArrivalColor[3*i + 2];
          }
        }
      } else if (ph === PHASE.HOLDING_LABEL) {
        // check if hold is over
        if (currentTime >= this.holdUntil[i]) {
          // re-target to postArrivalTarget (surface)
          const dx = this.postArrivalTarget[3*i]     - this.position[3*i];
          const dy = this.postArrivalTarget[3*i + 1] - this.position[3*i + 1];
          const dz = this.postArrivalTarget[3*i + 2] - this.position[3*i + 2];
          const flyTime = 0.5; // fall from label to surface
          this.velocity[3*i]     = dx / flyTime;
          this.velocity[3*i + 1] = dy / flyTime;
          this.velocity[3*i + 2] = dz / flyTime;
          this.target[3*i]     = this.postArrivalTarget[3*i];
          this.target[3*i + 1] = this.postArrivalTarget[3*i + 1];
          this.target[3*i + 2] = this.postArrivalTarget[3*i + 2];
          this.arrivalTime[i] = currentTime + flyTime;
          this.holdUntil[i] = 0; // won't hold again
          this.phase[i] = PHASE.FLYING;
        }
      }
    }
    this.posAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
  }

  /**
   * Pro ON_PLANET/ON_RING tečky: worldPos = anchor.matrixWorld * localOffset
   * @param {THREE.Object3D[]} anchorsByIndex
   */
  applyClusterRotation(anchorsByIndex) {
    const tmp = _tmpVec3;
    for (let i = 0; i < this.count; i++) {
      const ph = this.phase[i];
      if (ph !== PHASE.ON_PLANET && ph !== PHASE.ON_RING && ph !== PHASE.ON_SUN) continue;
      const oi = this.owner[i];
      if (oi < 0) continue;
      const anchor = anchorsByIndex[oi];
      if (!anchor) continue;
      tmp.set(
        this.localOffset[3*i],
        this.localOffset[3*i + 1],
        this.localOffset[3*i + 2],
      );
      tmp.applyMatrix4(anchor.matrixWorld);
      this.position[3*i]     = tmp.x;
      this.position[3*i + 1] = tmp.y;
      this.position[3*i + 2] = tmp.z;
    }
    this.posAttr.needsUpdate = true;
  }

  /**
   * Najde první N IDLE indexů, nebo vyhoří pokud ne je dostatek.
   */
  takeIdleIndices(count) {
    const out = [];
    for (let i = 0; i < this.count && out.length < count; i++) {
      if (this.phase[i] === PHASE.IDLE) out.push(i);
    }
    return out;
  }
}
