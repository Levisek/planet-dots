// eclipticGrid — mřížka v rovině ekliptiky (jen Pochopení). Z výchozí
// kamery (~30° nad rovinou) se mřížka zkracuje do dálky, takže je poznat
// rovina oběžných drah — hloubka, ne plochý obrázek. Čáry slábnou
// s poloměrem, ať mřížka nekonkuruje drahám a tělesům.

import * as THREE from 'three';
import { onModeChange, isFyzikalni } from './simMode.js';

export const GRID_HALF = 3900;   // půl strany čtverce (Neptun je ve 3030)
export const GRID_STEP = 300;
const GRID_OPACITY = 0.45;
const GRID_COLOR = [0.22, 0.34, 0.5]; // ztlumená modrošedá

/** Vrcholy a barvy čar mřížky (čisté, testovatelné). */
export function buildGridData(half = GRID_HALF, step = GRID_STEP, seg = 26) {
  const pos = [];
  const col = [];
  const n = Math.round(half / step);
  const fade = (x, z) => Math.max(0, 1 - Math.hypot(x, z) / (half * 1.05)) ** 0.8;
  const push = (x, z) => {
    pos.push(x, 0, z);
    const f = fade(x, z);
    col.push(GRID_COLOR[0] * f, GRID_COLOR[1] * f, GRID_COLOR[2] * f);
  };
  for (let i = -n; i <= n; i++) {
    const c = i * step;
    // čára podél X (z = c) a podél Z (x = c), dělená na úseky kvůli fade
    for (let s = 0; s < seg; s++) {
      const a = -half + (2 * half * s) / seg;
      const b = -half + (2 * half * (s + 1)) / seg;
      push(a, c); push(b, c);
      push(c, a); push(c, b);
    }
  }
  return { positions: new Float32Array(pos), colors: new Float32Array(col) };
}

export function createEclipticGrid(scene) {
  const { positions, colors } = buildGridData();
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0, depthWrite: false,
  });
  const grid = new THREE.LineSegments(geom, material);
  grid.renderOrder = -1;
  grid.visible = false;
  scene.add(grid);

  let revealed = false;
  const sync = () => { grid.visible = revealed && !isFyzikalni(); };
  onModeChange(sync);

  return {
    setVisible(v) { revealed = v; sync(); },
    /** Prolnutí po formaci: k = 0..1. */
    setOpacity(k) { material.opacity = GRID_OPACITY * k; },
  };
}
