import * as THREE from 'three';
import { PLANETS, PLANET_BY_ID, POOL_SIZE } from './planets.js';
import { MOONS } from './moons.js';
import { createScene, createStarfield } from './scene.js';
import { createPlanetAnchors } from './planetAnchors.js';
import { createMoonAnchors } from './moonAnchors.js';
import { ParticlePool } from './particles.js';
import { rotateAnchors } from './rotation.js';
import { updateSolarWind } from './solarWind.js';
import { updatePlanetOrbits } from './planetOrbits.js';
import { updateMoonWind } from './moonWind.js';
import { orbitPosition, trueAnomaly } from './orbit.js';
import { createPicker } from './picking.js';
import { createTooltip } from './tooltip.js';
import { createInfoPanel } from './infoPanel.js';
import { createDetailView, STATE as DV_STATE } from './detailView.js';
import { createSunActivity } from './sunActivity.js';
import { createMoonLabels } from './moonLabels.js';
import { buildBodyMesh } from './bodyMesh.js';
import { buildSaturnRing } from './saturnRing.js';
import { BODY_DATA } from './bodyData.js';
import { MOON_OWNER_BASE } from './phase.js';
import { createTween } from './cameraTween.js';

const { renderer, scene, camera, controls } = createScene();
createStarfield(scene);
const { anchors, imageData, loaded } = createPlanetAnchors(scene);
const { anchors: moonAnchors, imageData: moonImageData, loaded: moonsLoaded } = createMoonAnchors(scene, anchors);

// Unified anchor array — planety 0..8, měsíce 9..27 (MOON_OWNER_BASE=9). Používá applyClusterRotation.
const anchorsByIndex = [
  ...PLANETS.map(p => anchors[p.id]),
  ...MOONS.map(m => moonAnchors[m.id]),
];

const pool = new ParticlePool(POOL_SIZE);
scene.add(pool.mesh);

const clock = new THREE.Clock();
let elapsed = 0;

let picker = null;
let tooltip = null;
let infoPanel = null;
let detailView = null;
let sunActivity = null;
let moonLabels = null;
const bodyMeshes = {}; // { [bodyId]: THREE.Mesh } — icosphere mesh per tělo (+ 'saturn_ring')
let _activeCameraTween = null;
const controlsTarget = { x: 0, y: 0, z: 0 };

// Unified mesh ↔ owner mapping pro formation gating + fadeOthers loops.
// Postaveno v initAfterLoad po build mesh-ů.
const SATURN_IDX = PLANETS.findIndex((p) => p.id === 'saturn');
/** @type {Array<{ key: string, ownerIdx: number, isPlanet: boolean, isMoon: boolean, parentId?: string }>} */
const gatedMeshes = [];

// ——— Perf diag ———
const statsEl = document.getElementById('stats');
let frameCount = 0;
let tickMsAcc = 0;
let rotMsAcc = 0;
let lastStatsAt = performance.now();

function initAfterLoad() {
  // Naplň Slunce initial Fibonacci clusterem (PLANETS[0] = sun).
  const sun = PLANETS[0];
  const sunAnchor = anchors.sun;
  // Sun dotty kousek nad mesh povrchem (1.02×) — jako planety. Bez offsetu
  // splývají s mesh trianglemi a vypadá to "vyplněně dírama".
  pool.initFullSun(
    sunAnchor.position,
    sun.radiusPx * 1.02,
    imageData.sun,
    sun.tickCount,
    sun.dotSize,
  );
}

/**
 * factorsByMoon: { [moonId]: { a, period } } — multiplier pro semi-major axis + orbit period.
 * Pro real-scale toggle: a = realAPx/compressedAPx, period = a^1.5 (Keplerův zákon).
 * Když chybí klíč, default {a:1, period:1} — compressed scale, compressed time.
 */
function updateMoonOrbits(t, factorsByMoon = {}) {
  for (const m of MOONS) {
    const parent = PLANET_BY_ID[m.parent];
    const parentRadius = parent.radiusPx;
    const entry = factorsByMoon[m.id] || { a: 1, period: 1 };
    const aPx = m.a * parentRadius * entry.a;
    const scaledPeriod = m.period * entry.period;
    const { x, z, E } = orbitPosition(t, m.phaseOffset, scaledPeriod, aPx, m.e);
    const moonAnchor = moonAnchors[m.id];
    if (!moonAnchor) continue;
    moonAnchor.position.set(x, 0, z);
    const nu = trueAnomaly(E, m.e);
    moonAnchor.rotation.y = nu + Math.PI;
    moonAnchor.updateMatrixWorld(true);
  }
}

let moonScaleFactors = {}; // { [moonId]: { a, period } }, pokud klíč chybí → {a:1, period:1}

function computeRealFactor(m) {
  const parent = PLANET_BY_ID[m.parent];
  if (!parent.realDiameterKm || !m.realSemiMajorAxisKm) return 1;
  const kmPerPx = parent.realDiameterKm / (parent.radiusPx * 2);
  const realAPx = m.realSemiMajorAxisKm / kmPerPx;
  const compressedAPx = m.a * parent.radiusPx;
  return realAPx / compressedAPx;
}

function setMoonScaleReal(parentId, realOn) {
  for (const m of MOONS) {
    if (m.parent !== parentId) continue;
    if (realOn) {
      const aFactor = computeRealFactor(m);
      // Keplerův zákon: T² ∝ a³ → T = a^1.5. Real scale = real time.
      moonScaleFactors[m.id] = { a: aFactor, period: Math.pow(aFactor, 1.5) };
    } else {
      moonScaleFactors[m.id] = { a: 1, period: 1 };
    }
  }
}

function tick() {
  const tickStart = performance.now();
  const dt = clock.getDelta();
  elapsed += dt;

  // Camera tween (pro fly-to) — jednotný přes cameraTween.js
  if (_activeCameraTween) {
    _activeCameraTween.t += dt;
    const s = _activeCameraTween.tween.sample(_activeCameraTween.t);
    camera.position.set(s.pos.x, s.pos.y, s.pos.z);
    controlsTarget.x = s.target.x;
    controlsTarget.y = s.target.y;
    controlsTarget.z = s.target.z;
    camera.lookAt(controlsTarget.x, controlsTarget.y, controlsTarget.z);
    if (controls.enabled) controls.target.set(controlsTarget.x, controlsTarget.y, controlsTarget.z);
    if (_activeCameraTween.tween.isComplete(_activeCameraTween.t)) {
      _activeCameraTween = null;
    }
  }

  // Detail view state
  if (detailView) detailView.tick(dt);
  const dvState = detailView ? detailView.state() : 'MAIN';
  const isMainState = dvState === 'MAIN';

  // Rotace planet — v MAIN běží, v DETAIL se zastaví (uživatel si prohlíží tělo staticky).
  // Měsíčné orbity: v planet-detail běží (Kepler viz), v moon-detail se zmrazí (jinak moon
  // utíká z kamery).
  const focusId = detailView ? detailView.focusId() : null;
  const isMoonDetail = focusId && MOONS.some((m) => m.id === focusId);
  if (isMainState) {
    updatePlanetOrbits(anchors, PLANETS, elapsed);
    rotateAnchors(anchors, dt);
    updateMoonOrbits(elapsed, moonScaleFactors);
  } else if (isMoonDetail) {
    // Vše zmrazené — jen refresh matrixWorld. Planety + měsíce drží na místě.
    for (const p of PLANETS) {
      const a = anchors[p.id];
      if (a) a.updateMatrixWorld(true);
    }
    for (const m of MOONS) {
      const a = moonAnchors[m.id];
      if (a) a.updateMatrixWorld(true);
    }
  } else {
    // Planet-detail: planety stojí, měsíce dál obíhají.
    for (const p of PLANETS) {
      const a = anchors[p.id];
      if (a) a.updateMatrixWorld(true);
    }
    updateMoonOrbits(elapsed, moonScaleFactors);
  }

  // Solar wind + moon wind — pausnu v detail view
  if (isMainState) {
    updateSolarWind(pool, elapsed, dt, anchors, imageData);
    updateMoonWind(pool, elapsed, dt, anchors, moonAnchors, imageData, moonImageData);
  }

  pool.updateFlight(elapsed, dt);

  // Sun activity — vždy aktivní, ale intenzita vyšší pokud je Slunce v detailu
  if (sunActivity) {
    const isSunDetail = dvState === 'DETAIL' && detailView.focusId() === 'sun';
    sunActivity.update(pool, elapsed, dt, { intensity: isSunDetail ? 'high' : 'low' });
  }

  const rotStart = performance.now();
  pool.applyClusterRotation(anchorsByIndex);
  const rotEnd = performance.now();

  // Formation gating — mesh.userData.settled = true až ≥95 % teček dosedlo.
  // Skutečnou visibility řídí fadeOthers (kombinuje settled + focus).
  for (const g of gatedMeshes) {
    const m = bodyMeshes[g.key];
    if (!m || m.userData.settled) continue;
    const { settled, total } = pool.countSettled(g.ownerIdx);
    if (total > 0 && settled / total >= 0.95) {
      m.userData.settled = true;
      m.visible = true;
    }
  }

  // Picker updatuje mesh pozice (musí po applyClusterRotation)
  if (picker) picker.update();

  // OrbitControls aktivní jen v DETAIL
  if (controls.enabled) controls.update();

  // Tooltip follow (updatuje screen pos)
  if (tooltip) tooltip.update();
  // Moon labels (viditelné v planet-detail)
  if (moonLabels) moonLabels.update();

  renderer.render(scene, camera);

  const tickEnd = performance.now();
  frameCount++;
  tickMsAcc += (tickEnd - tickStart);
  rotMsAcc += (rotEnd - rotStart);
  if (tickEnd - lastStatsAt >= 500) {
    const fps = (frameCount * 1000 / (tickEnd - lastStatsAt)).toFixed(0);
    const tickMs = (tickMsAcc / frameCount).toFixed(1);
    const rotMs = (rotMsAcc / frameCount).toFixed(1);
    if (statsEl) statsEl.textContent = `fps ${fps} · tick ${tickMs} ms · rot ${rotMs} ms`;
    frameCount = 0;
    tickMsAcc = 0;
    rotMsAcc = 0;
    lastStatsAt = tickEnd;
  }

  requestAnimationFrame(tick);
}

Promise.all([loaded, moonsLoaded]).then(() => {
  initAfterLoad();

  // Flat-triangle icosphere mesh per tělo (V3 stylu — žádný shader,
  // MeshBasicMaterial s vertexColors). Saturnův prsten = real RingGeometry
  // mesh. Mesh-y jsou skryté (visible=false) dokud nedoletí dost teček —
  // formation gating řeší tick() níže.
  for (let i = 0; i < PLANETS.length; i++) {
    const p = PLANETS[i];
    const tex = imageData[p.id];
    if (!tex) continue;
    // Sun je 50× větší než největší planeta → potřebuje hustší icosphere
    // jinak vidíš low-poly facety. L6 (40962 verts = 81920 trianglů).
    const subdiv = p.id === 'sun' ? 40962 : 10242;
    const mesh = buildBodyMesh(tex, p.radiusPx, subdiv);
    mesh.visible = false;
    anchors[p.id].add(mesh);
    bodyMeshes[p.id] = mesh;
    gatedMeshes.push({ key: p.id, ownerIdx: i, isPlanet: true, isMoon: false });

    if (p.id === 'saturn' && imageData.saturn_ring) {
      const ring = buildSaturnRing(imageData.saturn_ring, p.ringInnerRadius, p.ringOuterRadius);
      ring.visible = false;
      anchors.saturn.add(ring);
      bodyMeshes['saturn_ring'] = ring;
      gatedMeshes.push({ key: 'saturn_ring', ownerIdx: SATURN_IDX, isPlanet: false, isMoon: false, parentId: 'saturn' });
    }
  }
  for (let i = 0; i < MOONS.length; i++) {
    const m = MOONS[i];
    const tex = moonImageData[m.id];
    if (!tex) continue;
    const mesh = buildBodyMesh(tex, m.radiusPx, 2562);
    mesh.visible = false;
    moonAnchors[m.id].add(mesh);
    bodyMeshes[m.id] = mesh;
    gatedMeshes.push({ key: m.id, ownerIdx: MOON_OWNER_BASE + i, isPlanet: false, isMoon: true, parentId: m.parent });
  }

  // Picking — invisible raycast koule pro 9 planet/sun + 19 moons.
  picker = createPicker({ scene, camera, canvas: renderer.domElement });
  for (const p of PLANETS) {
    // Slunce má menší picker radius než jeho vizuální (malé vnitřní planety by jinak
    // byly uvnitř sluneční raycast sféry a nešlo by je kliknout). Pro malé planety
    // zvýšíme minimální raycast poloměr aby šly pohodlně kliknout.
    const pickRadius = p.id === 'sun'
      ? p.radiusPx * 0.95
      : Math.max(p.radiusPx * 1.5, 30);
    picker.addBody(p.id, () => ({
      x: anchors[p.id].position.x,
      y: anchors[p.id].position.y,
      z: anchors[p.id].position.z,
    }), pickRadius);
  }
  for (const m of MOONS) {
    const moonAnchor = moonAnchors[m.id];
    picker.addBody(m.id, () => {
      const v = new THREE.Vector3();
      moonAnchor.getWorldPosition(v);
      return { x: v.x, y: v.y, z: v.z };
    }, Math.max(m.radiusPx * 2, 4));
  }
  // V main stavu aktivní = jen planets + sun
  picker.setActiveIds(new Set(PLANETS.map((p) => p.id)));

  tooltip = createTooltip({ camera, canvas: renderer.domElement });
  infoPanel = createInfoPanel();
  sunActivity = createSunActivity({ sunOwner: 0, sunRadius: PLANETS[0].radiusPx });
  moonLabels = createMoonLabels({ camera, canvas: renderer.domElement, moonAnchors });

  // Helper pro body world-position
  function getBodyPos(id) {
    const p = PLANET_BY_ID[id];
    if (p) return { x: anchors[id].position.x, y: anchors[id].position.y, z: anchors[id].position.z };
    const mAnchor = moonAnchors[id];
    if (mAnchor) {
      const v = new THREE.Vector3();
      mAnchor.getWorldPosition(v);
      return { x: v.x, y: v.y, z: v.z };
    }
    return { x: 0, y: 0, z: 0 };
  }

  // Detail view wiring
  detailView = createDetailView({
    cameraFlyTo: (toPos, toTarget, duration) => {
      _activeCameraTween = {
        tween: createTween({
          fromPos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          fromTarget: { x: controlsTarget.x, y: controlsTarget.y, z: controlsTarget.z },
          toPos: { ...toPos },
          toTarget: { ...toTarget },
          duration,
        }),
        t: 0,
      };
    },
    getCameraState: () => ({
      pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: controlsTarget.x, y: controlsTarget.y, z: controlsTarget.z },
    }),
    setPaused: () => { /* placeholder — pauza se řídí přes detailView.state() v tick() */ },
    fadeOthers: (focusId, alpha) => {
      // alpha < 1 = detail focus (ostatní úplně skrýt, ne průhledné — žádní duchové).
      // alpha = 1 = MAIN (vše vidět). Visible = keep && settled (formation gating).
      // Měsíce focused planety necháme viditelné kvůli orbitám.
      const hideOthers = alpha < 1;
      for (const g of gatedMeshes) {
        const isFocus = g.key === focusId || (g.parentId && g.parentId === focusId);
        const keep = isFocus || !hideOthers;
        if (g.isPlanet || g.isMoon) pool.setOwnerAlpha(g.ownerIdx, keep ? 1 : 0);
        const mesh = bodyMeshes[g.key];
        if (mesh) mesh.visible = keep && !!mesh.userData.settled;
      }
    },
    showPanel: (id, opts) => {
      infoPanel.show(id, opts);
      // V detail view izolované prostředí: jen aktuální tělo + jeho měsíce (pro planet).
      // Cizí planety nejsou klikatelné (exit přes ESC/křížek pro návrat do MAIN).
      const planet = PLANET_BY_ID[id];
      if (planet) {
        const childMoons = MOONS.filter((m) => m.parent === id).map((m) => m.id);
        picker.setActiveIds(new Set([id, ...childMoons]));
        // Přepnout na detailDotSize (menší tečky → bez překryvu / "šupin").
        const ownerIdx = PLANETS.findIndex((p) => p.id === id);
        if (planet.detailDotSize !== undefined) {
          pool.setOwnerSize(ownerIdx, planet.detailDotSize);
        }
        // Zobraz labely pro měsíce této planety
        if (moonLabels) moonLabels.showForParent(id);
      } else {
        // Moon detail — nic klikatelného, exit pouze přes ESC/křížek.
        picker.setActiveIds(new Set());
        if (moonLabels) moonLabels.hideAll();
        // Přepnout vybraný měsíc na detailDotSize
        const moonIdx = MOONS.findIndex((m) => m.id === id);
        if (moonIdx >= 0) {
          const moon = MOONS[moonIdx];
          if (moon.detailDotSize !== undefined) {
            pool.setOwnerSize(MOON_OWNER_BASE + moonIdx, moon.detailDotSize);
          }
        }
      }
    },
    hidePanel: () => {
      infoPanel.hide();
      picker.setActiveIds(new Set(PLANETS.map((p) => p.id)));
      // Obnovit všechny planet i moon dotSize na main-scene hodnoty.
      for (let i = 0; i < PLANETS.length; i++) {
        pool.setOwnerSize(i, PLANETS[i].dotSize ?? 6.0);
      }
      for (let i = 0; i < MOONS.length; i++) {
        pool.setOwnerSize(MOON_OWNER_BASE + i, MOONS[i].dotSize ?? 5.0);
      }
      if (moonLabels) moonLabels.hideAll();
    },
    enableOrbit: (enabled, target) => {
      controls.enabled = enabled;
      if (enabled && target) {
        controls.target.set(target.x, target.y, target.z);
        controlsTarget.x = target.x;
        controlsTarget.y = target.y;
        controlsTarget.z = target.z;
        // Dynamické minDistance: kamera nesmí dovnitř tělesa. Pro Jupiter radius 90 = min 110, pro Sun 995 = 1200.
        const focusId = detailView.focusId();
        const p = PLANET_BY_ID[focusId];
        const m = MOONS.find((mm) => mm.id === focusId);
        const radius = p ? p.radiusPx : (m ? m.radiusPx : 10);
        controls.minDistance = radius * 1.2 + 10; // povrch + buffer
      } else {
        // MAIN state — reset na default
        controls.minDistance = 30;
      }
    },
    getBodyPosition: getBodyPos,
    getBodyRadius: (id) => {
      const p = PLANET_BY_ID[id];
      if (p) return p.radiusPx;
      const m = MOONS.find((mm) => mm.id === id);
      return m ? Math.max(m.radiusPx, 3) : 1;
    },
    getCameraDistance: (id, scaleOn) => {
      // Pro planety se zahrnou i jejich měsíce (camera z-offset zahrne max moon dist).
      const p = PLANET_BY_ID[id];
      if (!p) {
        // Moon detail — rozumný offset.
        const m = MOONS.find((mm) => mm.id === id);
        return m ? Math.max(m.radiusPx * 8, 30) : 40;
      }
      const baseDist = p.radiusPx * 4.5;
      const childMoons = MOONS.filter((mm) => mm.parent === id);
      if (childMoons.length === 0) return baseDist;
      let maxMoonDist = 0;
      for (const m of childMoons) {
        const factor = scaleOn ? computeRealFactor(m) : 1;
        const moonDist = m.a * p.radiusPx * factor;
        if (moonDist > maxMoonDist) maxMoonDist = moonDist;
      }
      // Camera musí být dál než nejvzdálenější měsíc a celý orbit musí být ve viewportu.
      // FOV=45° → half_angle=22.5° → tan(22.5°)≈0.414. S 15% safety marginem:
      // cameraDist = maxMoonDist / tan(22.5°) * 1.15 ≈ maxMoonDist * 2.78
      return Math.max(baseDist, maxMoonDist * 2.8 + p.radiusPx);
    },
    getBodyKind: (id) => BODY_DATA[id]?.kind || 'planet',
    resetScale: () => {
      // Vymaž všechny moon scale faktory — každá další planeta začne v compressed scale.
      for (const k in moonScaleFactors) delete moonScaleFactors[k];
    },
  });

  // Picker events
  picker.onHover((id) => {
    if (id && detailView.state() === DV_STATE.MAIN) {
      tooltip.show(id, () => getBodyPos(id));
    } else {
      tooltip.hide();
    }
  });
  picker.onClick((id) => {
    tooltip.hide();
    detailView.enter(id);
  });

  // Debug / audit API — playwright-friendly programmatic control
  if (typeof window !== 'undefined') {
    window.__dotsAudit = {
      enter: (id) => detailView.enter(id),
      exit: () => detailView.exit(),
      state: () => detailView.state(),
      focusId: () => detailView.focusId(),
      planets: PLANETS.map((p) => p.id),
      moons: MOONS.map((m) => m.id),
    };
    window.__pool = pool;
    window.__debug = { pool, anchors, moonAnchors };
  }

  // Panel handlers
  infoPanel.onClose(() => detailView.exit());
  infoPanel.onScaleToggle((on) => {
    detailView.toggleScale(on);
    infoPanel.updateScaleState(on);
    const focusId = detailView.focusId();
    if (focusId) setMoonScaleReal(focusId, on);
  });

  // ESC handler
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && detailView.state() === DV_STATE.DETAIL) {
      detailView.exit();
    }
  });

  clock.start();
  requestAnimationFrame(tick);
}).catch((err) => {
  console.error('Texture preload failed:', err);
  clock.start();
  requestAnimationFrame(tick);
});
