// voxelTile — staví InstancedMesh pro tělo: base hexagon geometry + per-instance
// transforms do tangent frame na sféře + per-instance color sampled z textury.
// Shader Lambertian diffuse vůči uSunPos uniform (vypočítá se dir per vertex).

import * as THREE from 'three';
import { icosphereRaw } from './geometry.js';
import { sampleColorPoleSafe, sphericalUV } from './textureUtils.js';
import { buildHexagonGeometry, computeTangentFrame } from './voxelTileMath.js';

export { buildHexagonGeometry, computeTangentFrame };

export const VOXEL_VERTEX_SHADER = /* glsl */ `
  attribute vec3 aInstancePos;    // kde je tile na sféře (radius × dir)
  attribute vec3 aInstanceNormal; // tile normál (= jednotkový radial ven)
  attribute vec3 aInstanceTangent;// tangent v tangent plane (pro rotaci hex)
  attribute vec3 aInstanceColor;  // per-tile RGB

  uniform vec3 uSunPos;
  uniform float uAmbient;

  varying vec3 vColor;
  varying float vLight;

  void main() {
    // Tile local space: hexagon v XY rovině (Z = normal).
    // Umístíme ho do tangent frame instance:
    //   bitangent = normal × tangent
    //   world_offset = position.x * tangent + position.y * bitangent + aInstancePos
    vec3 bitangent = cross(aInstanceNormal, aInstanceTangent);
    vec3 worldOffset = position.x * aInstanceTangent
                     + position.y * bitangent
                     + aInstancePos;

    vec4 worldPos = modelMatrix * vec4(worldOffset, 1.0);
    vec3 worldNormal = normalize((modelMatrix * vec4(aInstanceNormal, 0.0)).xyz);

    vec3 sunDir = normalize(uSunPos - worldPos.xyz);
    float diffuse = max(0.0, dot(worldNormal, sunDir));
    vLight = uAmbient + (1.0 - uAmbient) * diffuse;
    vColor = aInstanceColor;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const VOXEL_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vLight;

  void main() {
    gl_FragColor = vec4(vColor * vLight, 1.0);
  }
`;

// Sun shader — emissive, žádné lighting (Slunce září samo).
const SUN_VERTEX_SHADER = /* glsl */ `
  attribute vec3 aInstancePos;
  attribute vec3 aInstanceNormal;
  attribute vec3 aInstanceTangent;
  attribute vec3 aInstanceColor;
  varying vec3 vColor;
  void main() {
    vec3 bitangent = cross(aInstanceNormal, aInstanceTangent);
    vec3 worldOffset = position.x * aInstanceTangent
                     + position.y * bitangent
                     + aInstancePos;
    vColor = aInstanceColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(worldOffset, 1.0);
  }
`;

const SUN_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
  }
`;

// Společný builder pro instance buffers — používán oběma variantami (Lambertian/Sun).
function buildInstanceBuffers(imageData, radius, minVertices) {
  const { vertices } = icosphereRaw(minVertices);
  const tileCount = vertices.length;

  // Tile circumradius — hexy musí pokrýt sférický povrch bez velkých mezer.
  // Mean spacing mezi sousedními vrcholy icosphere ≈ 2/sqrt(N) na jednotce,
  // tj. radius × 2/sqrt(N) na našem tělese. Hex circumradius (vzdálenost
  // od středu k rohu) musí být alespoň polovina toho, +overlap pro zatáčky:
  //   tileRadius = (radius / sqrt(N)) × 1.15
  const tileRadius = (radius / Math.sqrt(tileCount)) * 1.15;

  const instPos = new Float32Array(tileCount * 3);
  const instNormal = new Float32Array(tileCount * 3);
  const instTangent = new Float32Array(tileCount * 3);
  const instColor = new Float32Array(tileCount * 3);

  for (let i = 0; i < tileCount; i++) {
    const v = vertices[i];
    const { normal, tangent } = computeTangentFrame(v);

    instPos[i * 3 + 0] = normal[0] * radius;
    instPos[i * 3 + 1] = normal[1] * radius;
    instPos[i * 3 + 2] = normal[2] * radius;

    instNormal[i * 3 + 0] = normal[0];
    instNormal[i * 3 + 1] = normal[1];
    instNormal[i * 3 + 2] = normal[2];

    instTangent[i * 3 + 0] = tangent[0];
    instTangent[i * 3 + 1] = tangent[1];
    instTangent[i * 3 + 2] = tangent[2];

    const [u, vt] = sphericalUV(normal[0], normal[1], normal[2], 1);
    const [cr, cg, cb] = sampleColorPoleSafe(imageData, u, vt);
    instColor[i * 3 + 0] = cr;
    instColor[i * 3 + 1] = cg;
    instColor[i * 3 + 2] = cb;
  }

  return { tileCount, tileRadius, instPos, instNormal, instTangent, instColor };
}

function buildInstancedGeometry(tileRadius, tileCount, instPos, instNormal, instTangent, instColor) {
  const hexGeom = buildHexagonGeometry(tileRadius);
  const geom = new THREE.InstancedBufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(hexGeom.positions, 3));
  geom.setIndex(new THREE.BufferAttribute(hexGeom.indices, 1));
  geom.setAttribute('aInstancePos', new THREE.InstancedBufferAttribute(instPos, 3));
  geom.setAttribute('aInstanceNormal', new THREE.InstancedBufferAttribute(instNormal, 3));
  geom.setAttribute('aInstanceTangent', new THREE.InstancedBufferAttribute(instTangent, 3));
  geom.setAttribute('aInstanceColor', new THREE.InstancedBufferAttribute(instColor, 3));
  geom.instanceCount = tileCount;
  // Bounding sphere z radius — Three jinak nemůže odhadnout (instanced).
  const bsRadius = Math.sqrt((tileRadius + 1) ** 2);
  geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), bsRadius);
  return geom;
}

/**
 * Postaví InstancedMesh pro Lambertian-lit tělo (planeta/měsíc).
 *
 * @param {ImageData} imageData — textura pro per-tile color sampling
 * @param {number} radius — poloměr tělesa v scene units
 * @param {number} minVertices — icosphere subdivision: 10242 = L5, 40962 = L6
 * @param {{ uSunPos: { value: any } }} uniforms — shared sun uniform
 * @returns {THREE.Mesh}
 */
export function buildVoxelTiles(imageData, radius, minVertices, uniforms) {
  const buf = buildInstanceBuffers(imageData, radius, minVertices);
  const geom = buildInstancedGeometry(
    buf.tileRadius, buf.tileCount,
    buf.instPos, buf.instNormal, buf.instTangent, buf.instColor,
  );
  // Scene bounding sphere musí pokrýt celé tělo (radius + tile circumradius).
  geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius + buf.tileRadius);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uSunPos: uniforms.uSunPos,
      uAmbient: { value: 0.12 },
    },
    vertexShader: VOXEL_VERTEX_SHADER,
    fragmentShader: VOXEL_FRAGMENT_SHADER,
  });

  return new THREE.Mesh(geom, material);
}

/**
 * Self-emissive varianta pro Slunce — stejné instance buffery, jiný shader.
 */
export function buildSunVoxelTiles(imageData, radius, minVertices) {
  const buf = buildInstanceBuffers(imageData, radius, minVertices);
  const geom = buildInstancedGeometry(
    buf.tileRadius, buf.tileCount,
    buf.instPos, buf.instNormal, buf.instTangent, buf.instColor,
  );
  geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius + buf.tileRadius);

  const material = new THREE.ShaderMaterial({
    vertexShader: SUN_VERTEX_SHADER,
    fragmentShader: SUN_FRAGMENT_SHADER,
  });

  return new THREE.Mesh(geom, material);
}
