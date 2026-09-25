import * as THREE from 'three';
import { PLANETS } from './planets.js';
import { orbitalPosition } from './planetOrbits.js';
import { poleToScene } from './coordinateFrame.js';

const _UP = new THREE.Vector3(0, 1, 0);

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
 * Vytvoří anchory (Object3D) pro 9 těles — `anchors` (pozice) + `spins`
 * (orientace osy + rotace, child anchoru). Žádná geometrie ani textura ve
 * scéně. Textury se načtou jako ImageData pro color sampling na tečky.
 *
 * @param {THREE.Scene} scene
 * @returns {{ anchors: Object, spins: Object, imageData: Object, loaded: Promise<void> }}
 */
export function createPlanetAnchors(scene) {
  const anchors = {};
  const spins = {};
  const imageData = {};
  const loadPromises = [];

  for (const p of PLANETS) {
    // Dvě úrovně: `anchor` nese jen POZICI (bez rotace) — pod ním visí měsíce
    // a jejich orbit lines, jejichž relativní pozice jsou v ekliptickém frame.
    // `spin` (child) nese orientaci osy (IAU pól) + vlastní rotaci planety;
    // pod ním je mesh, prstenec a tečky povrchu. Dřív byly měsíce přímo pod
    // rotujícím anchorem → jejich dráhy se točily s planetou (u Jupiteru
    // jednou za 4 s) a sklon osy se k reálnému sklonu drah přičítal podruhé.
    const anchor = new THREE.Object3D();
    const pos = orbitalPosition(p, new Date());
    anchor.position.set(pos.x, pos.y, pos.z);
    anchor.userData.planet = p;
    const spin = new THREE.Object3D();
    const pole = poleToScene(p.pole.raDeg, p.pole.decDeg);
    spin.quaternion.setFromUnitVectors(_UP, new THREE.Vector3(pole.x, pole.y, pole.z));
    anchor.add(spin);
    anchor.userData.spin = spin;
    scene.add(anchor);
    anchors[p.id] = anchor;
    spins[p.id] = spin;

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
  return { anchors, spins, imageData, loaded };
}
