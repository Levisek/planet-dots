import * as THREE from 'three';
import { MOONS } from './moons.js';

/**
 * Načte texturu jako HTMLImageElement → offscreen canvas → ImageData.
 * (Stejné jako v planetAnchors.js, duplikováno pro modularitu.)
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
    img.onerror = (e) => reject(new Error(`Failed to load moon texture ${url}: ${e}`));
    img.src = url;
  });
}

/**
 * Vytvoří moon anchors jako children mateřských planet anchorů.
 * Každý moonAnchor je Object3D s pozicí v lokálním frame parenta,
 * rotovaný přes updateMatrixWorld z main.js loopu. Textury se načtou paralelně.
 *
 * @param {THREE.Scene} _scene — nepoužito (moon anchors jsou children planet, ne scene), parametr ponechán pro API konzistenci s createPlanetAnchors
 * @param {Object<string, THREE.Object3D>} planetAnchors — z createPlanetAnchors
 * @returns {{ anchors: Object, imageData: Object, loaded: Promise<void> }}
 */
export function createMoonAnchors(_scene, planetAnchors) {
  const anchors = {};
  const imageData = {};
  const loadPromises = [];

  for (const m of MOONS) {
    const parent = planetAnchors[m.parent];
    if (!parent) {
      console.warn(`Moon ${m.id} má parent ${m.parent}, ten nebyl nalezen v planetAnchors`);
      continue;
    }
    const anchor = new THREE.Object3D();
    // pozice (x, 0, z) se updatuje per-frame v main.js z orbitPosition
    anchor.position.set(0, 0, 0);
    anchor.userData.moon = m;
    parent.add(anchor); // child of planet anchor → dědí axial tilt
    anchors[m.id] = anchor;

    loadPromises.push(
      loadImageData(m.texture).then((data) => {
        imageData[m.id] = data;
      })
    );
  }

  const loaded = Promise.all(loadPromises).then(() => {});
  return { anchors, imageData, loaded };
}
