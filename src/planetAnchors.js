import * as THREE from 'three';
import { PLANETS } from './planets.js';
import { orbitalPosition } from './planetOrbits.js';

/**
 * Načte texturu jako HTMLImageElement, vykreslí ji na offscreen canvas
 * a vrátí ImageData pro CPU-side color sampling.
 */
function loadImageData(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    img.onerror = (e) => reject(new Error(`Failed to load texture ${url}: ${e}`));
    img.src = url;
  });
}

/**
 * Vytvoří anchory (Object3D) pro 9 těles — pouze pozice + axial tilt,
 * žádná geometrie ani textura v sceně. Textury se načtou jako ImageData
 * pro color sampling na tečky.
 *
 * @param {THREE.Scene} scene
 * @returns {{ anchors: Object, imageData: Object, loaded: Promise<void> }}
 */
export function createPlanetAnchors(scene) {
  const anchors = {};
  const imageData = {};
  const loadPromises = [];

  for (const p of PLANETS) {
    // Anchor = prázdný Object3D na pozici planety v 3D soustavě (kruhová orbita
    // kolem origin, axial tilt aplikovaný). updatePlanetOrbits hýbe pozicí v MAIN.
    const anchor = new THREE.Object3D();
    const pos = orbitalPosition(p, 0);
    anchor.position.set(pos.x, pos.y, pos.z);
    anchor.rotation.z = THREE.MathUtils.degToRad(p.axialTilt);
    anchor.userData.planet = p;
    scene.add(anchor);
    anchors[p.id] = anchor;

    // Load texture as ImageData.
    loadPromises.push(
      loadImageData(p.texture).then((data) => {
        imageData[p.id] = data;
      })
    );

    // Saturn ring texture too.
    if (p.ringTexture) {
      loadPromises.push(
        loadImageData(p.ringTexture).then((data) => {
          imageData[`${p.id}_ring`] = data;
        })
      );
    }
  }

  const loaded = Promise.all(loadPromises).then(() => {});
  return { anchors, imageData, loaded };
}
