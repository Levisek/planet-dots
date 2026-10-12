// sunGlowSprite — záře kolem Slunce (aditivní sprite s radiálním přechodem)
// a záblesk při zážehu ve formaci. Sprite visí na spin nodu Slunce, takže
// roste se Sluncem (sunIgnitionScale) i s módem (sunScale). Kotouč Slunce
// střed spritu zakryje — záře je vidět jen kolem okraje.
// Intenzity počítá formationFilm.sunGlow, tady je jen kreslení.

import * as THREE from 'three';

function glowTexture(stops) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function sprite(map, diameter) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  s.scale.setScalar(diameter);
  s.visible = false;
  return s;
}

/**
 * @param {THREE.Object3D} parent — spin node Slunce
 * @param {number} radius — poloměr Slunce v lokálních jednotkách parentu
 */
export function createSunGlowSprite(parent, radius) {
  // Trvalá záře: teplá koróna těsně u okraje, rychle slábne.
  const glow = sprite(glowTexture([
    [0, 'rgba(255,214,140,1)'],
    [0.38, 'rgba(255,170,70,0.75)'],
    [0.5, 'rgba(255,130,40,0.28)'],
    [0.7, 'rgba(255,100,30,0.08)'],
    [1, 'rgba(255,90,20,0)'],
  ]), radius * 5.2);
  // Záblesk zážehu: bílý, mnohem širší.
  const flash = sprite(glowTexture([
    [0, 'rgba(255,255,250,1)'],
    [0.2, 'rgba(255,248,225,0.9)'],
    [0.45, 'rgba(255,225,170,0.25)'],
    [1, 'rgba(255,210,150,0)'],
  ]), radius * 9);
  parent.add(glow, flash);

  const set = (s, a) => {
    s.material.opacity = a;
    s.visible = a > 0.002;
  };
  return {
    /** @param {number} flashA @param {number} glowA — průhlednost 0..1 */
    update(flashA, glowA) {
      set(flash, flashA);
      set(glow, glowA);
    },
  };
}
