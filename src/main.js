import * as THREE from 'three';
import { PLANETS, PLANET_BY_ID, POOL_SIZE } from './planets.js';
import { MOONS } from './moons.js';
import { createScene, createStarfield } from './scene.js';
import { createPlanetAnchors } from './planetAnchors.js';
import { createMoonAnchors } from './moonAnchors.js';
import { ParticlePool } from './particles.js';
import { rotateAnchors, rotateOne } from './rotation.js';
import { updateSolarWind } from './solarWind.js';
import { updatePlanetOrbits, orbitalPosition, auToDisplayRadius } from './planetOrbits.js';
import { createAsteroidAnchors } from './asteroidAnchors.js';
import { createAsteroidBelt } from './asteroidBelt.js';
import { ASTEROIDS } from './asteroids.js';
import { updateFormationIntro } from './formationIntro.js';
import { updateMoonWind } from './moonWind.js';
import { tickHyperion } from './hyperionChaos.js';
import { orbitPosition, trueAnomaly } from './orbit.js';
import { getEccentricity, getInclination, getMoonPeriod, setMode as setSimMode, getMode as getSimMode, onModeChange, isFyzikalni, MODES, getTimeScale, setTimeScale, _resetTimeScaleOverride, isRetrograde } from './simMode.js';
import { createPicker } from './picking.js';
import { createTooltip } from './tooltip.js';
import { createInfoPanel } from './infoPanel.js';
import { createDetailView, STATE as DV_STATE } from './detailView.js';
import { createSunActivity } from './sunActivity.js';
import { createMoonLabels } from './moonLabels.js';
import { createPlanetLabels } from './planetLabels.js';
import { createAsteroidLabels } from './asteroidLabels.js';
import { createBodyList } from './bodyList.js';
import { createOrbitLines, createAsteroidOrbitLines } from './orbitLines.js';
import { buildBodyMesh, applyShape } from './bodyMesh.js';
import { buildSaturnRing } from './saturnRing.js';
import { BODY_DATA } from './bodyData.js';
import { MOON_OWNER_BASE } from './phase.js';
import { createTween } from './cameraTween.js';
import { initTimeControls } from './timeControls.js';

const { renderer, scene, camera, controls, setLightingMode, onLightingModeChange } = createScene();
createStarfield(scene);
const { anchors, imageData, loaded } = createPlanetAnchors(scene);
const { anchors: moonAnchors, imageData: moonImageData, loaded: moonsLoaded } = createMoonAnchors(scene, anchors);
const { anchors: asteroidAnchors, imageData: asteroidImageData, loaded: asteroidsLoaded } = createAsteroidAnchors(scene);
const asteroidBelt = createAsteroidBelt(scene);

// Convert ASTEROIDS data to orbit-compatible format (same fields as planets).
const AU_TO_DISPLAY_REAL = 3846; // linear AU mapping per planets.js V4.2 spec

function makeAsteroidOrbitable(a) {
  return {
    ...a,
    orbitRadius: auToDisplayRadius(a.a),
    orbitRadiusReal: a.a * AU_TO_DISPLAY_REAL,
    orbitalPeriodSec: a.period,
    orbitalPeriodSecReal: a.periodReal,
    initialPhaseRad: a.phaseOffset,
  };
}
const ORBITABLE_ASTEROIDS = ASTEROIDS.map(makeAsteroidOrbitable);

function updateAsteroidOrbits(elapsed) {
  for (const a of ORBITABLE_ASTEROIDS) {
    const anchor = asteroidAnchors[a.id];
    if (!anchor) continue;
    const pos = orbitalPosition(a, elapsed);
    anchor.position.set(pos.x, pos.y, pos.z);
  }
}

// Unified anchor array — planety 0..8, měsíce 9..27 (MOON_OWNER_BASE=9). Používá applyClusterRotation.
const anchorsByIndex = [
  ...PLANETS.map(p => anchors[p.id]),
  ...MOONS.map(m => moonAnchors[m.id]),
];

const pool = new ParticlePool(POOL_SIZE);
scene.add(pool.mesh);

const clock = new THREE.Clock();
let elapsed = 0;

// Dvojitý časový kanál (V4.3):
// _simElapsed — akumuluje dt × getTimeScale(), použito pro orbity (může jít zpět)
// _realElapsed — akumuluje dt rovně, použito pro formation/sun/wind (vždy dopředu)
let _simElapsed = 0;
let _realElapsed = 0;

let picker = null;
let tooltip = null;
let infoPanel = null;
let detailView = null;
let sunActivity = null;
let moonLabels = null;
let planetLabels = null;
let asteroidLabels = null;
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
    const e = getEccentricity(m);
    const basePeriod = getMoonPeriod(m);
    const inc = getInclination(m);
    const scaledPeriod = basePeriod * entry.period;
    const { x, y, z, E } = orbitPosition(t, m.phaseOffset, scaledPeriod, aPx, e, inc);
    const moonAnchor = moonAnchors[m.id];
    if (!moonAnchor) continue;
    moonAnchor.position.set(x, y, z);
    const nu = trueAnomaly(E, e);
    if (m.chaoticRotation) {
      tickHyperion(t, moonAnchor);
    } else {
      moonAnchor.rotation.y = nu + Math.PI;
    }
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

function setAllMoonScaleReal(realOn) {
  for (const m of MOONS) {
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

  // Dual time channel
  const dtSim = dt * getTimeScale();
  _simElapsed += dtSim;
  _realElapsed += dt;

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

  // Rotace v MAIN: všechny planety. V DETAIL: jen focus body (planeta nebo měsíc) —
  // user si prohlíží jak se točí. Cizí tělesa stojí (matrixWorld stále refresh).
  const focusId = detailView ? detailView.focusId() : null;
  const isMoonDetail = focusId && MOONS.some((m) => m.id === focusId);
  if (isMainState) {
    updatePlanetOrbits(anchors, PLANETS, _simElapsed);
    rotateAnchors(anchors, dt);
    updateMoonOrbits(_simElapsed, moonScaleFactors);
    updateAsteroidOrbits(_simElapsed);
    asteroidBelt.update(_simElapsed);
  } else if (isMoonDetail) {
    // Moon-detail: focus měsíc rotuje, ostatní stojí.
    for (const p of PLANETS) {
      const a = anchors[p.id];
      if (a) a.updateMatrixWorld(true);
    }
    for (const m of MOONS) {
      const a = moonAnchors[m.id];
      if (!a) continue;
      if (m.id === focusId) {
        rotateOne(a, { rotationPeriod: m.period ?? 10, direction: isRetrograde(m) ? -1 : 1 }, dt);
      } else {
        a.updateMatrixWorld(true);
      }
    }
  } else {
    // Planet-detail: focus planeta rotuje, ostatní planety stojí, měsíce focused planety obíhají.
    for (const p of PLANETS) {
      const a = anchors[p.id];
      if (!a) continue;
      if (p.id === focusId) {
        rotateOne(a, p, dt);
      } else {
        a.updateMatrixWorld(true);
      }
    }
    updateMoonOrbits(_simElapsed, moonScaleFactors);
  }

  // Formation intro Beat 1+2 (cloud + kolaps), pak solar/moon wind.
  // Tyto systémy vždy jedou dopředu — používají _realElapsed.
  if (isMainState) {
    updateFormationIntro(pool, _realElapsed, dt);
    updateSolarWind(pool, _realElapsed, dt, anchors, imageData);
    updateMoonWind(pool, _realElapsed, dt, anchors, moonAnchors, imageData, moonImageData);
  }

  pool.updateFlight(_realElapsed, dt);

  // Sun activity — vždy aktivní, ale intenzita vyšší pokud je Slunce v detailu
  if (sunActivity) {
    const isSunDetail = dvState === 'DETAIL' && detailView.focusId() === 'sun';
    sunActivity.update(pool, _realElapsed, dt, { intensity: isSunDetail ? 'high' : 'low' });
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
  if (planetLabels) planetLabels.update();
  if (asteroidLabels) asteroidLabels.update();

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

Promise.all([loaded, moonsLoaded, asteroidsLoaded]).then(() => {
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
    // Sun je zdroj světla (ne příjemce) — flat MeshBasicMaterial vždy plné jasné.
    if (p.id === 'sun') {
      mesh.material = new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: 1.0,
      });
    }
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
    // L5 (10242 verts) — L4 dělalo facety viditelné v detail view (Titan, Luna).
    const mesh = buildBodyMesh(tex, m.radiusPx, 10242);
    applyShape(mesh, m);
    mesh.visible = false;
    moonAnchors[m.id].add(mesh);
    bodyMeshes[m.id] = mesh;
    gatedMeshes.push({ key: m.id, ownerIdx: MOON_OWNER_BASE + i, isPlanet: false, isMoon: true, parentId: m.parent });
  }
  // Asteroid meshes (Ceres / Vesta / Pallas) — vždy viditelné, nejsou gated (žádný particle owner).
  for (const a of ASTEROIDS) {
    const tex = asteroidImageData[a.id] ?? null;
    if (!tex) continue;
    const mesh = buildBodyMesh(tex, a.radiusPx, 2562);
    applyShape(mesh, a);
    mesh.visible = true;
    asteroidAnchors[a.id].add(mesh);
    bodyMeshes[a.id] = mesh;
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
  for (const a of ASTEROIDS) {
    const aAnchor = asteroidAnchors[a.id];
    if (!aAnchor) continue;
    picker.addBody(a.id, () => {
      const v = new THREE.Vector3();
      aAnchor.getWorldPosition(v);
      return { x: v.x, y: v.y, z: v.z };
    }, Math.max(a.radiusPx * 2, 8));
  }
  // V main stavu aktivní = jen planets + sun
  picker.setActiveIds(new Set(PLANETS.map((p) => p.id)));

  tooltip = createTooltip({ camera, canvas: renderer.domElement });
  infoPanel = createInfoPanel();
  sunActivity = createSunActivity({ sunOwner: 0, sunRadius: PLANETS[0].radiusPx });
  moonLabels = createMoonLabels({ camera, canvas: renderer.domElement, moonAnchors });
  planetLabels = createPlanetLabels({
    camera,
    canvas: renderer.domElement,
    anchors,
    onClick: (id) => detailView && detailView.enter(id),
  });
  asteroidLabels = createAsteroidLabels({
    camera,
    canvas: renderer.domElement,
    asteroidAnchors,
    onClick: (id) => detailView && detailView.enter(id),
  });
  const bodyList = createBodyList({
    onClick: (id) => detailView && detailView.enter(id),
  });
  const orbitLines = createOrbitLines(scene);
  const asteroidOrbitLines = createAsteroidOrbitLines(scene);

  // Lighting toggle button — přepíná material na všech body mesh-ích:
  // VYP → MeshBasicMaterial (flat, plné barvy, ignoruje světla).
  // ZAP → MeshLambertMaterial (Lambertian, den/noc strana podle PointLight z origin).
  // Sun zůstává vždy MeshBasicMaterial (self-emissive zdroj světla).
  onLightingModeChange((real) => {
    for (const id in bodyMeshes) {
      if (id === 'sun' || id === 'saturn_ring') continue;
      const mesh = bodyMeshes[id];
      if (!mesh) continue;
      if (real) {
        if (!mesh.userData._lambertMaterial) {
          mesh.userData._lambertMaterial = new THREE.MeshLambertMaterial({
            vertexColors: true,
            transparent: false,
            opacity: 1,
          });
        }
        mesh.material = mesh.userData._lambertMaterial;
      } else {
        mesh.material = mesh.userData._flatMaterial;
      }
    }
  });
  const lightingBtn = document.getElementById('toggleLighting');
  let _lightingOn = false;
  lightingBtn?.addEventListener('click', () => {
    _lightingOn = !_lightingOn;
    setLightingMode(_lightingOn);
    lightingBtn.textContent = _lightingOn ? 'STÍNY: ZAP' : 'STÍNY: VYP';
    lightingBtn.classList.toggle('active', _lightingOn);
  });

  // simMode buttons (Pochopení / Fyzikální)
  const modeButtons = document.querySelectorAll('#topToggles button[data-mode]');
  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.mode;
      setSimMode(id);
      modeButtons.forEach((b) => b.classList.toggle('active', b.dataset.mode === id));
    });
  });
  // Při změně simMode přepocítej kameru — Fyzikální má Neptune ve 4105,
  // default kamera (0,3500,6000) je pak nedostatečná. Auto-zoom out.
  onModeChange((mode) => {
    const fyz = mode === MODES.FYZIKALNI;
    // Real měřítko měsíců — Triton, Iapetus, Nereid uletí daleko od rodiče.
    setAllMoonScaleReal(fyz);
    if (detailView && detailView.state() === DV_STATE.DETAIL) {
      // V detailu jen refresh camera distance, neměnit globální view.
      detailView.refreshCamera();
    } else {
      if (fyz) {
        camera.position.set(0, 90000, 160000);
      } else {
        camera.position.set(0, 3500, 6000);
      }
      camera.lookAt(0, 0, 0);
    }
  });

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
    const aAnchor = asteroidAnchors[id];
    if (aAnchor) {
      const v = new THREE.Vector3();
      aAnchor.getWorldPosition(v);
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
      // alpha < 1 = detail focus, alpha = 1 = MAIN view.
      // Ostatní planety zůstávají viditelné v detail (kvůli orientaci v soustavě),
      // ale dim — fade alpha 0.3, mesh stále render (ne skryt).
      const isDetail = alpha < 1;
      const dimAlpha = 0.3;
      for (const g of gatedMeshes) {
        const isFocus = g.key === focusId || (g.parentId && g.parentId === focusId);
        const ownerA = isDetail ? (isFocus ? 1 : dimAlpha) : 1;
        if (g.isPlanet || g.isMoon) pool.setOwnerAlpha(g.ownerIdx, ownerA);
        const mesh = bodyMeshes[g.key];
        if (!mesh) continue;
        // Mesh visible vždy (po settle), opacity dim pro non-focus v detail.
        mesh.visible = !!mesh.userData.settled;
        if (mesh.material) {
          mesh.material.transparent = isDetail && !isFocus;
          mesh.material.opacity = isDetail && !isFocus ? dimAlpha : 1;
        }
      }
    },
    showPanel: (id, opts) => {
      infoPanel.show(id, opts);
      // V detail view izolované prostředí: jen aktuální tělo + jeho měsíce (pro planet).
      // Cizí planety nejsou klikatelné (exit přes ESC/křížek pro návrat do MAIN).
      const planet = PLANET_BY_ID[id];
      if (planet) {
        // V detail view klikatelné všechna tělesa (re-focus na jinou planetu).
        const allIds = [...PLANETS.map((p) => p.id), ...MOONS.map((m) => m.id)];
        picker.setActiveIds(new Set(allIds));
        // Přepnout na detailDotSize (menší tečky → bez překryvu / "šupin").
        const ownerIdx = PLANETS.findIndex((p) => p.id === id);
        if (planet.detailDotSize !== undefined) {
          pool.setOwnerSize(ownerIdx, planet.detailDotSize);
        }
        // Zobraz labely pro měsíce této planety; planet labely skryt (focus jeden)
        if (moonLabels) moonLabels.showForParent(id);
        if (planetLabels) planetLabels.setVisible(false);
        if (asteroidLabels) asteroidLabels.setVisible(false);
        bodyList.setActive(id);
      } else {
        // Moon detail — všechna tělesa klikatelná pro re-focus.
        const allIds = [...PLANETS.map((p) => p.id), ...MOONS.map((m) => m.id)];
        picker.setActiveIds(new Set(allIds));
        if (moonLabels) moonLabels.hideAll();
        if (planetLabels) planetLabels.setVisible(false);
        if (asteroidLabels) asteroidLabels.setVisible(false);
        bodyList.setActive(id);
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
      if (planetLabels) planetLabels.setVisible(true);
      if (asteroidLabels) asteroidLabels.setVisible(true);
      bodyList.setActive(null);
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
      controls.enabled = true; // vždy zapnuto (MAIN i DETAIL)
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
        controls.maxDistance = 500000;
      } else {
        // MAIN state — orbit kolem Slunce (origin)
        controls.target.set(0, 0, 0);
        controlsTarget.x = 0;
        controlsTarget.y = 0;
        controlsTarget.z = 0;
        controls.minDistance = 5000;  // nepřiblížit se dovnitř Slunce
        controls.maxDistance = 500000; // nepřekročit za Neptune
      }
    },
    getBodyPosition: getBodyPos,
    getBodyRadius: (id) => {
      const p = PLANET_BY_ID[id];
      if (p) return p.radiusPx;
      const m = MOONS.find((mm) => mm.id === id);
      if (m) return Math.max(m.radiusPx, 3);
      const a = ASTEROIDS.find((aa) => aa.id === id);
      return a ? Math.max(a.radiusPx, 3) : 1;
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
    isFyzikalni,
    planetAnchors: anchors,
  });

  // Inicializuj OrbitControls pro MAIN stav (orbit kolem Slunce)
  controls.enabled = true;
  controls.target.set(0, 0, 0);
  controls.minDistance = 5000;
  controls.maxDistance = 500000;

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

  // ESC handler
  window.addEventListener('keydown', (e) => {
    // Skip when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'Escape' && detailView.state() === DV_STATE.DETAIL) {
      detailView.exit();
    }

    // timeScale keybinds: [ ] \ 0
    switch (e.key) {
      case '[':
        setTimeScale(Math.max(0.1, Math.abs(getTimeScale()) - 0.1) * (getTimeScale() < 0 ? -1 : 1));
        e.preventDefault();
        break;
      case ']':
        setTimeScale(Math.min(5.0, Math.abs(getTimeScale()) + 0.1) * (getTimeScale() < 0 ? -1 : 1));
        e.preventDefault();
        break;
      case '\\':
        setTimeScale(-getTimeScale());
        e.preventDefault();
        break;
      case '0':
        _resetTimeScaleOverride();
        const defaultScale = getSimMode() === MODES.POCHOPENI ? 0.5 : 1.0;
        setTimeScale(defaultScale);
        _resetTimeScaleOverride();
        e.preventDefault();
        break;
    }
  });

  // Initialize time controls UI
  initTimeControls(() => _simElapsed);

  clock.start();
  requestAnimationFrame(tick);
}).catch((err) => {
  console.error('Texture preload failed:', err);
  clock.start();
  requestAnimationFrame(tick);
});
