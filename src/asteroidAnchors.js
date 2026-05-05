import * as THREE from 'three';
import { ASTEROIDS } from './asteroids.js';

/**
 * Načte texturu jako HTMLImageElement → offscreen canvas → ImageData.
 * (Stejné jako v planetAnchors.js a moonAnchors.js, duplikováno pro modularitu.)
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
    img.onerror = (e) => reject(new Error(`Failed to load asteroid texture ${url}: ${e}`));
    img.src = url;
  });
}

/**
 * Vytvoří asteroid anchors jako přímé children scene (ne planeta anchor).
 * Každý anchor je Object3D s pozicí kolem Slunce (x, 0, z).
 * Textury se načtou paralelně s error handling.
 *
 * @param {THREE.Scene} scene
 * @returns {{ anchors: Object<string, THREE.Object3D>, imageData: Object, loaded: Promise<void> }}
 */
export function createAsteroidAnchors(scene) {
  const anchors = {};
  const imageData = {};
  const loadPromises = [];

  for (const a of ASTEROIDS) {
    const anchor = new THREE.Object3D();
    anchor.position.set(0, 0, 0);
    anchor.userData.asteroid = a;
    scene.add(anchor);
    anchors[a.id] = anchor;

    loadPromises.push(
      loadImageData(a.texture).then((data) => {
        imageData[a.id] = data;
      }).catch((e) => {
        console.warn(`Asteroid texture failed: ${a.id}`, e.message);
        imageData[a.id] = null;
      })
    );
  }

  const loaded = Promise.all(loadPromises).then(() => {});
  return { anchors, imageData, loaded };
}
