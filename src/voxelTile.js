// voxelTile — staví InstancedMesh pro tělo: base hexagon geometry + per-instance
// transforms do tangent frame na sféře + per-instance color sampled z textury.
// Shader Lambertian diffuse vůči uSunPos uniform (vypočítá se dir per vertex).

import * as THREE from 'three';
import { icosphereRaw } from './geometry.js';
import { sampleColorPoleSafe, sphericalUV } from './textureUtils.js';

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
