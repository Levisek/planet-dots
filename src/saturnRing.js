// saturnRing — real 3D RingGeometry v ekvatoriální rovině Saturnu.
// Barva + alfa per-pixel z radiálního profilu saturn_ring.png (DataTexture).
// Mesh je child Saturnova spin nodu → leží v rovníku (IAU pól).

import * as THREE from 'three';

// Pure sampler — vrátí [r,g,b,a] 0..1 pro radiální t (0 = inner, 1 = outer).
// Vzorkuje prostřední řádek (saturn_ring.png je 1D radiální).
export function sampleRingColor(imageData, t) {
  const { data, width, height } = imageData;
  const py = Math.floor(height / 2);
  const px = Math.min(width - 1, Math.max(0, Math.floor(t * width)));
  const idx = (py * width + px) * 4;
  return [data[idx] / 255, data[idx + 1] / 255, data[idx + 2] / 255, data[idx + 3] / 255];
}

/**
 * 1D radiální profil (prostřední řádek PNG) jako DataTexture. Vzorkuje se
 * per-pixel ve fragment shaderu — dřív per-vertex s 8 radiálními segmenty,
 * takže z profilu zbylo 9 vzorků: Cassiniho dělení zmizelo a poslední vrchol
 * (t=1, skoro průhledný modrý okraj PNG) táhl přes vnější 1/8 prstence
 * modrofialový lem.
 */
function buildRingProfileTexture(imageData) {
  const { data, width, height } = imageData;
  const row = Math.floor(height / 2);
  const out = new Uint8Array(width * 4);
  out.set(data.subarray(row * width * 4, (row + 1) * width * 4));
  const tex = new THREE.DataTexture(out, width, 1, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace; // shader čte surové hodnoty jako dřív vertex colors
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter; // z dálky bez moaré
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/**
 * @param {ImageData} ringImageData
 * @param {number} innerRadius — vnitřní okraj (scene units)
 * @param {number} outerRadius — vnější okraj
 * @param {number} segments — angular segments (default 128)
 * @returns {THREE.Mesh}
 */
export function buildSaturnRing(ringImageData, innerRadius, outerRadius, segments = 128) {
  const geom = new THREE.RingGeometry(innerRadius, outerRadius, segments, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ringTex: { value: buildRingProfileTexture(ringImageData) },
      innerR: { value: innerRadius },
      outerR: { value: outerRadius },
      // Ztlumení v detailu jiného tělesa — ShaderMaterial ignoruje
      // material.opacity, fadeOthers proto sahá sem (viz main.js).
      opacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vLocal;
      void main() {
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D ringTex;
      uniform float innerR;
      uniform float outerR;
      uniform float opacity;
      varying vec2 vLocal;
      void main() {
        float t = (length(vLocal) - innerR) / (outerR - innerR);
        if (t < 0.0 || t > 1.0) discard;
        vec4 c = texture2D(ringTex, vec2(t, 0.5));
        if (c.a < 0.01) discard;
        gl_FragColor = vec4(c.rgb, c.a * opacity);
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
