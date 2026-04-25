import * as THREE from 'three';
import { PHASE, MOON_OWNER_BASE } from './phase.js';
import { icosphere } from './geometry.js';
import { sphericalUV, sampleColorPoleSafe } from './textureUtils.js';

export { PHASE };

const _tmpVec3 = new THREE.Vector3();

const VERTEX_SHADER = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
attribute float aOwnerAlpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha * aOwnerAlpha;
  if (vAlpha <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * (900.0 / -mv.z);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  // Octagon — kulatější než hexagon, hranatější než kruh.
  // Netilují dokonale (mezi 4 octagony vzniknou čtvercové mezery), ale
  // vypadají pixelart-příjemně a při malé velikosti vizuálně zaplní.
  vec2 p = abs(gl_PointCoord - vec2(0.5));
  const float INV_SQRT2 = 0.7071068;
  float oct = max(max(p.x, p.y), (p.x + p.y) * INV_SQRT2);
  if (oct > 0.5) discard;
  gl_FragColor = vec4(vColor, vAlpha);
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
    this.ownerAlpha = new Float32Array(count); // per-particle kopie ownerAlphaMul[owner]
    // CPU-only
    this.target = new Float32Array(count * 3);
    this.velocity = new Float32Array(count * 3);    // pro FLYING tečky (world-space units/sec)
    this.localOffset = new Float32Array(count * 3); // relative to owner anchor — pro cluster rotaci
    this.arrivalTime = new Float32Array(count);      // kdy FLYING tečka dorazí
    this.postArrivalTarget = new Float32Array(count * 3); // kam jít po settle (final surface pos)
    this.postArrivalColor = new Float32Array(count * 3);  // barva po settle (sampled z textury)
    this.postArrivalAlpha = new Float32Array(count);      // alpha po settle (Jupiter/Saturn průhlednost)
    this.phase = new Uint8Array(count);
    this.finalPhase = new Uint8Array(count); // cílový phase po příletu (ON_PLANET / ON_RING / ON_MOON)
    this.owner = new Int16Array(count);

    const geometry = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.position, 3);
    this.colorAttr = new THREE.BufferAttribute(this.color, 3);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1);
    this.alphaAttr = new THREE.BufferAttribute(this.alpha, 1);
    this.ownerAlphaAttr = new THREE.BufferAttribute(this.ownerAlpha, 1);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colorAttr.setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr.setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr.setUsage(THREE.DynamicDrawUsage);
    this.ownerAlphaAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', this.posAttr);
    geometry.setAttribute('aColor', this.colorAttr);
    geometry.setAttribute('aSize', this.sizeAttr);
    geometry.setAttribute('aAlpha', this.alphaAttr);
    geometry.setAttribute('aOwnerAlpha', this.ownerAlphaAttr);
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
      this.ownerAlpha[i] = 1.0;
      this.postArrivalAlpha[i] = 1.0;
    }
    this.flushAll();
  }

  ownerAlphaMul = new Float32Array(28).fill(1);

  /**
   * Nastaví ownerAlphaMul[ownerIdx] a propaguje hodnotu do per-particle ownerAlpha arrayu.
   */
  setOwnerAlpha(ownerIdx, value) {
    this.ownerAlphaMul[ownerIdx] = value;
    for (let i = 0; i < this.count; i++) {
      if (this.owner[i] === ownerIdx) {
        this.ownerAlpha[i] = value;
      }
    }
    this.ownerAlphaAttr.needsUpdate = true;
  }

  /**
   * Přepíše size[i] pro všechny tečky daného ownera — kromě ON_RING (ring má
   * vlastní velikost). Volá se z detail view při vstupu / výstupu.
   */
  setOwnerSize(ownerIdx, size) {
    for (let i = 0; i < this.count; i++) {
      if (this.owner[i] === ownerIdx && this.phase[i] !== PHASE.ON_RING) {
        this.size[i] = size;
      }
    }
    this.sizeAttr.needsUpdate = true;
  }

  flushAll() {
    this.posAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
    this.ownerAlphaAttr.needsUpdate = true;
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
  initFullSun(center, radius, sunImageData, count, dotSize = 6.0) {
    this._sunDotSize = dotSize;
    const indices = [];
    const unit = icosphere(count, 1);
    const total = Math.min(count, unit.length);
    for (let i = 0; i < total; i++) {
      if (i >= this.count) break;
      const [sx, sy, sz] = unit[i];
      const ox = sx * radius;
      const oy = sy * radius;
      const oz = sz * radius;
      this.position[3*i]     = center.x + ox;
      this.position[3*i + 1] = center.y + oy;
      this.position[3*i + 2] = center.z + oz;
      this.localOffset[3*i]     = ox;
      this.localOffset[3*i + 1] = oy;
      this.localOffset[3*i + 2] = oz;
      const [u, v] = sphericalUV(sx, sy, sz, 1);
      const [cr, cg, cb] = sampleColorPoleSafe(sunImageData, u, v);
      this.color[3*i]     = cr;
      this.color[3*i + 1] = cg;
      this.color[3*i + 2] = cb;
      this.alpha[i] = 0; // sun reveal ramp odemkne v sun fázi (1..2s)
      this.postArrivalAlpha[i] = 1.0;
      this.size[i] = this._sunDotSize ?? 6.0;
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
   */
  spawnFromSun(sourceIdx, sunCenter, sunRadius, finalTarget, finalTargetLocal,
               finalColor, planetOwnerIdx, finalPhase, currentTime, travelTime,
               finalAlpha = 1.0, finalSize = null) {
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
    // Barva při emit = bílá/sluneční (zažehnutá z povrchu), final color se lerpne během letu.
    this.color[3*i]     = 1;
    this.color[3*i + 1] = 0.95;
    this.color[3*i + 2] = 0.7;
    this.alpha[i] = 1.0;

    const tx = finalTarget.x, ty = finalTarget.y, tz = finalTarget.z;
    this.target[3*i]     = tx;
    this.target[3*i + 1] = ty;
    this.target[3*i + 2] = tz;
    this.velocity[3*i]     = (tx - sx) / travelTime;
    this.velocity[3*i + 1] = (ty - sy) / travelTime;
    this.velocity[3*i + 2] = (tz - sz) / travelTime;

    this.postArrivalTarget[3*i]     = finalTarget.x;
    this.postArrivalTarget[3*i + 1] = finalTarget.y;
    this.postArrivalTarget[3*i + 2] = finalTarget.z;
    this.postArrivalColor[3*i]     = finalColor[0];
    this.postArrivalColor[3*i + 1] = finalColor[1];
    this.postArrivalColor[3*i + 2] = finalColor[2];
    this.postArrivalAlpha[i] = finalAlpha;
    this.localOffset[3*i]     = finalTargetLocal.x;
    this.localOffset[3*i + 1] = finalTargetLocal.y;
    this.localOffset[3*i + 2] = finalTargetLocal.z;

    this.arrivalTime[i] = currentTime + travelTime;
    this.owner[i] = planetOwnerIdx;
    this.ownerAlpha[i] = this.ownerAlphaMul[planetOwnerIdx];
    this.phase[i] = PHASE.FLYING;
    this.finalPhase[i] = finalPhase; // ON_PLANET nebo ON_RING — ukládáme explicitně
    if (finalSize !== null) {
      this.size[i] = finalSize;
    } else {
      this.size[i] = (finalPhase === PHASE.ON_RING) ? 4.5 : 6.0;
    }
  }

  /**
   * Spawn tečky z povrchu mateřské planety ven na orbitu měsíce.
   * Podobné spawnFromSun, ale zdroj = planet surface, cíl = moon orbit position.
   * Používá IDLE index, nastaví FLYING pak ON_MOON po arrival.
   *
   * @param {number} sourceIdx — volný IDLE index
   * @param {{x,y,z}} planetCenter — world pos planety
   * @param {number} planetRadius
   * @param {{x,y,z}} moonOrbitWorld — world pos cílové pozice (moonAnchor surface point)
   * @param {{x,y,z}} moonLocalOffset — offset v moonAnchor frame (pro cluster rotaci)
   * @param {[number,number,number]} planetColor — barva startu
   * @param {[number,number,number]} moonColor — barva po příletu
   * @param {number} moonOwnerIdx — unified anchor index (9 + moon array index)
   * @param {number} currentTime
   * @param {number} travelTime — 0.25–0.35 s
   */
  spawnFromPlanet(sourceIdx, planetCenter, planetRadius, moonOrbitWorld, moonLocalOffset,
                  planetColor, moonColor, moonOwnerIdx, currentTime, travelTime, finalSize = 5.0) {
    const i = sourceIdx;
    // start pozice = random bod na povrchu planety
    const rx = (Math.random() - 0.5) * 2;
    const ry = (Math.random() - 0.5) * 2;
    const rz = (Math.random() - 0.5) * 2;
    const len = Math.sqrt(rx*rx + ry*ry + rz*rz) || 1;
    const sx = planetCenter.x + (rx/len) * planetRadius;
    const sy = planetCenter.y + (ry/len) * planetRadius;
    const sz = planetCenter.z + (rz/len) * planetRadius;
    this.position[3*i]     = sx;
    this.position[3*i + 1] = sy;
    this.position[3*i + 2] = sz;
    // barva při emit = planet color (sampled)
    this.color[3*i]     = planetColor[0];
    this.color[3*i + 1] = planetColor[1];
    this.color[3*i + 2] = planetColor[2];
    this.alpha[i] = 1.0;

    const tx = moonOrbitWorld.x;
    const ty = moonOrbitWorld.y;
    const tz = moonOrbitWorld.z;
    this.target[3*i]     = tx;
    this.target[3*i + 1] = ty;
    this.target[3*i + 2] = tz;

    this.velocity[3*i]     = (tx - sx) / travelTime;
    this.velocity[3*i + 1] = (ty - sy) / travelTime;
    this.velocity[3*i + 2] = (tz - sz) / travelTime;

    this.postArrivalTarget[3*i]     = tx;
    this.postArrivalTarget[3*i + 1] = ty;
    this.postArrivalTarget[3*i + 2] = tz;
    this.postArrivalColor[3*i]     = moonColor[0];
    this.postArrivalColor[3*i + 1] = moonColor[1];
    this.postArrivalColor[3*i + 2] = moonColor[2];
    this.postArrivalAlpha[i] = 1.0;
    this.localOffset[3*i]     = moonLocalOffset.x;
    this.localOffset[3*i + 1] = moonLocalOffset.y;
    this.localOffset[3*i + 2] = moonLocalOffset.z;

    this.arrivalTime[i] = currentTime + travelTime;
    this.owner[i] = moonOwnerIdx;
    this.ownerAlpha[i] = this.ownerAlphaMul[moonOwnerIdx];
    this.phase[i] = PHASE.FLYING;
    this.finalPhase[i] = PHASE.ON_MOON;
    this.size[i] = finalSize;
  }

  /**
   * Update tečky pro daný frame:
   *  - FLYING: position += velocity * dt; if time >= arrivalTime → snap to target, settle.
   *  - Lerp color from current to postArrivalColor during FLYING.
   *  - Settled (ON_PLANET / ON_MOON) → mesh canonical, alpha = 0. ON_RING zůstává visible.
   */
  updateFlight(currentTime, dt) {
    for (let i = 0; i < this.count; i++) {
      if (this.phase[i] !== PHASE.FLYING) continue;
      this.position[3*i]     += this.velocity[3*i]     * dt;
      this.position[3*i + 1] += this.velocity[3*i + 1] * dt;
      this.position[3*i + 2] += this.velocity[3*i + 2] * dt;
      const k = 0.04;
      this.color[3*i]     += (this.postArrivalColor[3*i]     - this.color[3*i])     * k;
      this.color[3*i + 1] += (this.postArrivalColor[3*i + 1] - this.color[3*i + 1]) * k;
      this.color[3*i + 2] += (this.postArrivalColor[3*i + 2] - this.color[3*i + 2]) * k;
      if (currentTime < this.arrivalTime[i]) continue;
      // arrival — snap + settle
      this.position[3*i]     = this.target[3*i];
      this.position[3*i + 1] = this.target[3*i + 1];
      this.position[3*i + 2] = this.target[3*i + 2];
      const fp = this.finalPhase[i] || PHASE.ON_PLANET;
      this.phase[i] = fp;
      this.color[3*i]     = this.postArrivalColor[3*i];
      this.color[3*i + 1] = this.postArrivalColor[3*i + 1];
      this.color[3*i + 2] = this.postArrivalColor[3*i + 2];
      this.alpha[i] = (fp === PHASE.ON_PLANET || fp === PHASE.ON_MOON) ? 0 : this.postArrivalAlpha[i];
    }
    this.posAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
  }

  /**
   * Pro ON_PLANET/ON_RING tečky: worldPos = anchor.matrixWorld * localOffset
   * @param {THREE.Object3D[]} anchorsByIndex
   */
  applyClusterRotation(anchorsByIndex) {
    const tmp = _tmpVec3;
    for (let i = 0; i < this.count; i++) {
      const ph = this.phase[i];
      if (ph !== PHASE.ON_PLANET && ph !== PHASE.ON_RING && ph !== PHASE.ON_SUN && ph !== PHASE.ON_MOON) continue;
      // Přeskočit neviditelné tečky (ownerAlpha=0 → vAlpha=0 → GPU je discarduje).
      // Šetří ~90 % matrixWorld výpočtů v detail view kde fadeOthers = 0 pro ostatní.
      if (this.ownerAlpha[i] === 0) continue;
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

  /**
   * Spočítá kolik teček daného owneru už dosedlo (ON_PLANET/ON_MOON/ON_RING/ON_SUN)
   * vs. kolik je celkem alokovaných (ne IDLE). Slouží formation gating —
   * mesh tělesa se zobrazí až když settled/total > threshold.
   *
   * @param {number} ownerIdx
   * @returns {{ settled: number, total: number }}
   */
  countSettled(ownerIdx) {
    let settled = 0;
    let total = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.owner[i] !== ownerIdx) continue;
      if (this.phase[i] === PHASE.IDLE) continue;
      total++;
      const ph = this.phase[i];
      if (ph === PHASE.ON_PLANET || ph === PHASE.ON_MOON || ph === PHASE.ON_RING || ph === PHASE.ON_SUN) {
        settled++;
      }
    }
    return { settled, total };
  }
}
