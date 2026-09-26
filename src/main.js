import * as THREE from 'three';
import { PLANETS, PLANET_BY_ID, POOL_SIZE } from './planets.js';
import { MOONS } from './moons.js';
import { createScene, createStarfield } from './scene.js';
import { createPlanetAnchors } from './planetAnchors.js';
import { createMoonAnchors } from './moonAnchors.js';
import { ParticlePool } from './particles.js';
import { rotateAnchors, rotationDaysPerSec } from './rotation.js';
import { updatePlanetOrbits, orbitalPosition, auToDisplayRadius } from './planetOrbits.js';
import { moonPeriodDays } from './moonOrbitLines.js';
import { cameraDistanceFor } from './cameraDistance.js';
import { initLightingToggle } from './lightingToggle.js';
import { initKeyboard } from './keyboard.js';
import { createAsteroidAnchors } from './asteroidAnchors.js';
import { createAsteroidBelt } from './asteroidBelt.js';
import { ASTEROIDS } from './asteroids.js';
import { updateFormationIntro } from './formationIntro.js';
import { updateMoonWind } from './moonWind.js';
import { updateSunWind } from './sunWind.js';
import { tickHyperion } from './hyperionChaos.js';
import { getRelativePosition } from './positionProvider.js';
import * as simClock from './simClock.js';
import { toDisplayRelative, setMode as setSimMode, onModeChange, isFyzikalni, MODES } from './simMode.js';
import { createPicker } from './picking.js';
import { createTooltip } from './tooltip.js';
import { createInfoPanel } from './infoPanel.js';
import { createDetailView, STATE as DV_STATE } from './detailView.js';
import { createSunActivity } from './sunActivity.js';
import { createMoonLabels } from './moonLabels.js';
import { createPlanetLabels } from './planetLabels.js';
import { createAsteroidLabels } from './asteroidLabels.js';
import { applyDeclutter, isBehindSphere } from './labelDeclutter.js';
import { createBodyList } from './bodyList.js';
import { createOrbitLines, createAsteroidOrbitLines } from './orbitLines.js';
import { buildBodyMeshes } from './bodyMeshes.js';
import { BODY_DATA } from './bodyData.js';
import { MOON_OWNER_BASE } from './phase.js';
import { createCameraRig } from './cameraRig.js';
import { initTimeControls, setFormationLock, setDetailRateNote } from './timeControls.js';
import { timelineAt } from './formationTimeline.js';
import { LIVE_START } from './animation.js';

const { renderer, scene, camera, controls, setLightingMode, onLightingModeChange } = createScene();
createStarfield(scene);
const { anchors, spins, imageData, loaded } = createPlanetAnchors(scene);

// Slunce v Pochopení zmenšené — s r = 995 (věrný poměr 109 R⊕) sahalo skoro
// k dráze Merkuru (1 318), vnitřní planety byly z výchozí kamery za ním a
// jejich popisky ležely přes kotouč. Fyzikální drží věrný poměr k planetám.
// Škáluje se `spin` node: mesh i tečky pod ním se zmenší samy.
const SUN_RADIUS_POCHOPENI = 400;
function sunScale() {
  return isFyzikalni() ? 1 : SUN_RADIUS_POCHOPENI / PLANETS[0].radiusPx;
}
function getSunRadius() {
  return PLANETS[0].radiusPx * sunScale();
}
/** Popisek tělesa za kotoučem Slunce se nekreslí (dřív ležel přes něj). */
function labelOccludedBySun(worldPos) {
  return isBehindSphere(camera.position, worldPos, anchors.sun.position, getSunRadius());
}
spins.sun.scale.setScalar(sunScale());
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

function updateAsteroidOrbits(date) {
  for (const a of ORBITABLE_ASTEROIDS) {
    const anchor = asteroidAnchors[a.id];
    if (!anchor) continue;
    const pos = orbitalPosition(a, date);
    anchor.position.set(pos.x, pos.y, pos.z);
  }
}

// Unified owner array — planety 0..8 (jejich SPIN nody: tečky povrchu rotují
// s planetou), měsíce 9..34 (MOON_OWNER_BASE=9). Používá applyClusterRotation.
const anchorsByIndex = [
  ...PLANETS.map(p => spins[p.id]),
  ...MOONS.map(m => moonAnchors[m.id]),
];

const pool = new ParticlePool(POOL_SIZE, anchorsByIndex.length);
scene.add(pool.mesh);

// Timer (THREE.Clock je v r184 deprecated) napojený na Page Visibility API:
// po návratu na záložku nepřijde jedno obří dt za celou dobu na pozadí
// (formace by přeskočila, simClock skočil o roky).
const clock = new THREE.Timer();
clock.connect(document);
// Strop dt — záseky GC / přepnutí okna nesmí přeskočit fázi formace.
const MAX_DT = 0.25;

// Dvojitý časový kanál: simulační datum drží simClock (orbity, pás asteroidů),
// _realElapsed akumuluje dt rovně — formace, Slunce, vítr (vždy dopředu)
// a Hyperion chaos spin (monotónní čas, nesouvisí s datem).
let _realElapsed = 0;

// Úklid po formaci: tečky měsíců Neptunu letí ještě MOON_TRAVEL_TIME (0.3 s)
// po LIVE_START — usazené tečky se uvolní až po doletu (viz tick()).
const FORMATION_CLEANUP_AT = LIVE_START + 1.0;
let _formationCleaned = false;

// Formation lifecycle (V4.4 F3) — true od startu, dokud _realElapsed
// nepřekročí LIVE_START (viz tick()). Během formace simClock stojí zamčený
// na dnešním datu (startup scrubTo), takže přechod na live je bez skoku.
let formationActive = true;

// Kdy začal fade ownerAlpha 0→1 pro sun-tečky (zážeh, konec beat_ignition
// v t=6.0) — null když fade neběží/skončil. Viz tick().
let _sunFadeStart = null;

// True jakmile proběhl zážeh (t≥6.0), NAVŽDY — jediný gate na spuštění fade.
// Záměrně NEZÁVISLÉ na bodyMeshes.sun.userData.settled: ten flag může být
// force-nastaven vstupem do detail view (F3 review HIGH fix) a kdyby na něm
// zážeh závisel, klik na Slunce před t=6 by ho natrvalo přeskočil (fade by
// se nikdy nespustil, sunActivity by zůstala navždy neviditelná).
let _sunIgnited = false;

// True jakmile ignition fade (0→1) doběhne — do té doby vlastní
// ownerAlpha(0, …) formace (tick() níže), fadeOthers (detailView) sáhne na
// owner 0 až po zážehu, ať se fady nepřou (viz I1 fix).
let sunRevealed = false;

// Dim alpha pro tělesa mimo focus v detail view (sdíleno tick() zážehem +
// fadeOthers) — když je zážeh Slunce dokončen v okamžiku, kdy je uživatel
// v detailu jiného tělesa, fade musí mířit sem, ne na 1 (HIGH fix re-review).
const DETAIL_DIM_ALPHA = 0.3;

let picker = null;
let tooltip = null;
let infoPanel = null;
let detailView = null;
let sunActivity = null;
let moonLabels = null;
let planetLabels = null;
let asteroidLabels = null;
const bodyMeshes = {}; // { [bodyId]: THREE.Mesh } — icosphere mesh per tělo (+ 'saturn_ring')
// Sdílený objekt s cameraRig (viz cameraRig.js) — window.__debug ho čte přímo,
// mutuje se na místě, reference se nemění.
const controlsTarget = { x: 0, y: 0, z: 0 };
const cameraRig = createCameraRig({ camera, controls, controlsTarget, getBodyPos: (id) => getBodyPosNow(id) });
// Mesh-e a linie, které se ukážou až po formaci (před 4,6 mld let nebyly
// ani popisky planet, ani pojmenované asteroidy a jejich dráhy).
const _revealAfterFormation = [];

// Unified mesh ↔ owner mapping pro formation gating + fadeOthers loops.
// Postaveno v initAfterLoad po build mesh-ů (SATURN_IDX logika viz bodyMeshes.js).
/** @type {Array<{ key: string, ownerIdx: number, isPlanet: boolean, isMoon: boolean, parentId?: string }>} */
const gatedMeshes = [];

// ——— Perf diag ——— (HUD jen s ?debug v URL, návštěvník ho nepotřebuje)
const statsEl = new URLSearchParams(location.search).has('debug')
  ? document.getElementById('stats')
  : null;
if (statsEl) statsEl.hidden = false;
const formationLabelEl = document.getElementById('formation-label');
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
  // Sun tečky (owner 0, ON_SUN) ztlum na 0 hned po initu — zážeh (t=6.0, viz
  // tick()) je pak "rozsvítí" krátkým fade. initFullSun sama nastavuje
  // alpha[i]=0 per-částice, ale ownerAlphaMul zůstává 1 — bez tohohle by
  // sunActivity (prominence/CME, viz sunActivity.js spawnProminence) hned od
  // startu spawnovala tečky s ownerAlpha[i] = ownerAlphaMul[0] = 1, tedy
  // plně viditelné dřív, než Slunce vůbec "zapálí".
  pool.setOwnerAlpha(0, 0);
}

/**
 * Aktualizuje pozice + tidal-lock rotaci měsíců ke konkrétnímu datu, z
 * positionProvideru (V4.4 — nahrazuje starý orbit.js Kepler solver napojený
 * na elapsed). Pozice je relativní vůči rodičovské planetě (moon anchor je
 * child POZIČNÍHO anchoru planety — bez rotace — takže lokální position =
 * disp v ekliptickém frame stačí).
 */
function updateMoonOrbits(date) {
  for (const m of MOONS) {
    const moonAnchor = moonAnchors[m.id];
    if (!moonAnchor) continue;
    const rel = getRelativePosition(m.id, date);
    const disp = toDisplayRelative(rel, m);
    moonAnchor.position.set(disp.x, disp.y, disp.z);
    if (m.chaoticRotation) {
      tickHyperion(_realElapsed, moonAnchor);
    } else {
      // Tidal lock: stejná strana měsíce vždy směřuje k rodičovské planetě.
      moonAnchor.rotation.y = Math.atan2(rel.x, rel.z) + Math.PI;
    }
    moonAnchor.updateMatrixWorld(true);
  }
}

/**
 * Zpomalení času v detail view (násobitel simClocku): nejrychlejší
 * zobrazený oběh má trvat ~DETAIL_ORBIT_SEC sekund. Při 1× (36,5 dne/s) by
 * Io oběhlo Jupiter 20× za sekundu — stroboskop místo oběhu.
 */
const DETAIL_ORBIT_SEC = 8;
const DETAIL_DEFAULT_DAYS_PER_SEC = 1; // Slunce, Merkur, Venuše, asteroidy
function detailRateMultiplier(id) {
  let periodDays = null;
  const moon = MOONS.find((m) => m.id === id);
  if (moon) {
    periodDays = moonPeriodDays(moon);
  } else if (PLANET_BY_ID[id]) {
    const regular = MOONS.filter((m) => m.parent === id && m.category !== 'irregular');
    if (regular.length) periodDays = Math.min(...regular.map(moonPeriodDays));
  }
  const daysPerSec = periodDays ? periodDays / DETAIL_ORBIT_SEC : DETAIL_DEFAULT_DAYS_PER_SEC;
  return Math.min(1, daysPerSec / simClock.DAYS_PER_REAL_SEC);
}

/** Pozice → rotace → matrixWorld všech těles k datu (MAIN i DETAIL). */
function updateBodies(date, dt) {
  updatePlanetOrbits(anchors, PLANETS, date);
  rotateAnchors(spins, dt, rotationDaysPerSec({
    formation: formationActive,
    playing: simClock.isPlaying(),
    simDaysPerSec: simClock.getTimeScale() * simClock.getRateMultiplier() * simClock.DAYS_PER_REAL_SEC,
  }));
  // Poziční anchor → kaskádou spin, prstenec, měsíce, orbit lines. Musí být
  // před updateMoonOrbits (ten čte matrixWorld rodiče).
  for (const p of PLANETS) anchors[p.id].updateMatrixWorld(true);
  updateMoonOrbits(date);
  updateAsteroidOrbits(date);
  asteroidBelt.update(date);
}

function tick(timestamp) {
  const tickStart = performance.now();
  clock.update(timestamp);
  const dt = Math.min(clock.getDelta(), MAX_DT);

  // Dual time channel (V4.4 F2): simClock je jediná autorita simulačního data.
  _realElapsed += dt;                              // formace/sun/wind běží dál na real-time
  if (formationActive && _realElapsed >= LIVE_START) {
    // Konec formace (F3) — simClock stojí od startu zamčený na dnešním datu
    // (scrubTo v Promise.all), takže přepnutí na live přehrávání nezpůsobí
    // skok pozic. NEVOLAT simClock.setDate(new Date()) — simClock už na
    // správném datu je; resample by po probuzení taby z pozadí (RAF suspend,
    // hodiny reálného rozdílu) způsobil viditelný skok pozic (fix C1). Necháme
    // jen play() — případné zpoždění doženě plynule běh (rate 36.5 dní/s).
    formationActive = false;
    // Poslední emise měsíců: fáze neptune_moons končí přesně v LIVE_START,
    // takže její zbytek by jinak propadl (gate formationActive níže).
    updateMoonWind(pool, _realElapsed, dt, anchors, moonAnchors, imageData, moonImageData);
    simClock.play();
    setFormationLock(false);
    if (formationLabelEl) formationLabelEl.style.display = 'none';
    revealAfterFormation();
  } else if (!formationActive) {
    simClock.tick(dt * 1000);  // dt je v sekundách → simClock chce ms
  }
  const simDate = simClock.getDate();

  // Geologická osa HUD (F3) — jen během formace, levné (textContent jen při změně).
  if (formationActive && formationLabelEl) {
    const s = timelineAt(_realElapsed);
    const text = s.age ? `${s.label} · ${s.age}` : s.label;
    if (formationLabelEl.textContent !== text) formationLabelEl.textContent = text;
  }

  // Detail view state
  if (detailView) detailView.tick(dt);
  const dvState = detailView ? detailView.state() : 'MAIN';
  const focusId = detailView ? detailView.focusId() : null;

  // Simulace běží v MAIN i v DETAIL (detail má jen zpomalený čas, viz
  // detailRateMultiplier) — kamera jede s fokusovaným tělesem. Dřív se
  // v detailu planety zmrazily, zatímco datum běželo dál: po návratu
  // do MAIN všechny planety naráz skočily o roky.
  updateBodies(simDate, dt);

  // Camera tween (fly-to) + follow — po update pozic, aby tween cílil na
  // aktuální polohu tělesa (viz cameraRig.js).
  cameraRig.update(dt, dvState === DV_STATE.DETAIL);

  // Formation intro — akrece z disku (beat_disk/ignition/accretion), pak moon wind.
  // Tyto systémy vždy jedou dopředu — používají _realElapsed. Gate na
  // formationActive (NE na stav detailu, F3 review HIGH fix): pokud návštěvník
  // stráví akreční okno (6.5–17s) nebo moon fáze (17–22s) v detail view,
  // formace musí pokračovat na pozadí — jinak by okno proteklo bez emise a
  // dané těleso by po formaci zůstalo navždy bez teček (total=0, nikdy
  // settled). fadeOthers stejně dimuje non-focus ownery, takže i letící
  // tečky do jiné planety jsou v detailu ztlumené.
  if (formationActive) {
    updateFormationIntro(pool, _realElapsed, dt, anchors, imageData);
    updateMoonWind(pool, _realElapsed, dt, anchors, moonAnchors, imageData, moonImageData);
  }

  pool.updateFlight(_realElapsed, dt);

  // Sluneční vítr — ambientní kosmetika, běží od zážehu dál (beat_ignition
  // start = 4.0s). Natvrdo gatováno číslem (Task 5 může navázat na PHASES).
  if (_realElapsed >= 4.0) updateSunWind(pool, _realElapsed, dt, getSunRadius());

  // Sun activity — vždy aktivní, ale intenzita vyšší pokud je Slunce v detailu
  if (sunActivity) {
    const isSunDetail = dvState === 'DETAIL' && focusId === 'sun';
    sunActivity.update(pool, _realElapsed, dt, { intensity: isSunDetail ? 'high' : 'low' });
  }

  const rotStart = performance.now();
  pool.applyClusterRotation(anchorsByIndex);
  const rotEnd = performance.now();

  // Formation gating — mesh.userData.settled = true až ≥95 % teček dosedlo.
  // Skutečnou visibility řídí fadeOthers (kombinuje settled + focus).
  if (!_formationCleaned) {
    for (const g of gatedMeshes) {
      const m = bodyMeshes[g.key];
      if (!m || m.userData.settled) continue;
      const { settled, total } = pool.countSettled(g.ownerIdx);
      if (total > 0 && settled / total >= 0.95) {
        m.userData.settled = true;
        m.visible = true;
      }
    }
  }

  // Úklid po formaci: odkrýt všechno, co gating nestihl (těleso bez teček,
  // pomalý stroj), a uvolnit usazené tečky — mají alpha 0 (povrch kreslí
  // mesh), ale jinak by se ~576k z nich transformovalo a nahrávalo na GPU
  // každý frame až do zavření záložky.
  if (!_formationCleaned && _realElapsed >= FORMATION_CLEANUP_AT) {
    _formationCleaned = true;
    for (const g of gatedMeshes) {
      const m = bodyMeshes[g.key];
      if (!m || m.userData.settled) continue;
      m.userData.settled = true;
      m.visible = true;
    }
    pool.releaseSettled();
    // Mesh-e dosedlé až teď: v detailu je musí fadeOthers ztlumit jako ostatní.
    if (detailView && detailView.state() === DV_STATE.DETAIL) {
      detailView.refreshFade();
    }
  }

  // Zážeh Slunce (F3) — generic countSettled gating výše NEFUNGUJE pro Slunce:
  // ON_SUN tečky z initFullSun jsou "settled" hned od t=0 (initial fill, ne
  // formation fly-in), takže by countSettled(0) hlásil 100 % na první frame.
  // Sun proto není v gatedMeshes (viz Promise.all níže) a jeho reveal řídíme
  // explicitně na konci beat_ignition (t=6.0), s krátkým fade ownerAlpha 0→1
  // (gate na formationActive, ať se nepere s detailView.fadeOthers).
  // Gate ČISTĚ na _sunIgnited/_realElapsed — NE na bodyMeshes.sun.userData.settled
  // (F3 review HIGH fix): detail view force-settluje focus mesh (viz fadeOthers
  // níže) a kdyby klik na Slunce před t=6 nastavil settled=true, tenhle blok
  // by se přeskočil navždy → _sunFadeStart by se nikdy nenastavil, sunRevealed
  // by zůstalo false, ownerAlphaMul[0] (prominence/CME) by zůstalo 0 na celou
  // session. Settled/visible se tu i tak nastaví (idempotentní, i kdyby už
  // byly force-nastavené dřív) — jen SPUŠTĚNÍ fade na nich nezávisí.
  if (bodyMeshes.sun && _realElapsed >= 6.0 && !_sunIgnited) {
    _sunIgnited = true;
    bodyMeshes.sun.userData.settled = true;
    bodyMeshes.sun.visible = true;
    _sunFadeStart = _realElapsed;
  }
  if (formationActive && _sunFadeStart !== null) {
    const fadeT = Math.min(1, (_realElapsed - _sunFadeStart) / 0.5);
    // Cíl fade musí respektovat aktivní detail view — pokud uživatel v
    // okamžiku zážehu sleduje detail jiného tělesa než Slunce, fade má jít
    // 0 → dim (ne 0 → 1 se skokem dolů při dalším fadeOthers volání).
    const sunFadeTarget = dvState === 'DETAIL' && focusId !== 'sun' ? DETAIL_DIM_ALPHA : 1;
    pool.setOwnerAlpha(0, fadeT * sunFadeTarget);
    if (fadeT >= 1) {
      _sunFadeStart = null;
      sunRevealed = true;
    }
  }

  // Picker updatuje mesh pozice (musí po applyClusterRotation)
  if (picker) picker.update();

  // OrbitControls aktivní jen v DETAIL
  if (controls.enabled) controls.update();

  // Tooltip follow (updatuje screen pos)
  if (tooltip) tooltip.update();
  // Moon labels (viditelné v planet-detail)
  if (moonLabels) {
    const shownMoonLabels = moonLabels.update();
    if (shownMoonLabels.length) applyDeclutter(shownMoonLabels);
  }
  // Popisky planet a planetek se rozmisťují společně — kolidují spolu
  // (CERES/PALLAS přes ZEMI/MARS v Pochopení).
  const shownLabels = [
    ...(planetLabels ? planetLabels.update() : []),
    ...(asteroidLabels ? asteroidLabels.update() : []),
  ];
  if (shownLabels.length) applyDeclutter(shownLabels);

  pool.prepareUpload();
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

/** World pozice tělesa (planeta / měsíc / asteroid) z aktuálních matrixWorld. */
const _posTmp = new THREE.Vector3();
function getBodyPosNow(id) {
  const node = anchors[id] || moonAnchors[id] || asteroidAnchors[id];
  if (!node) return { x: 0, y: 0, z: 0 };
  node.getWorldPosition(_posTmp);
  return { x: _posTmp.x, y: _posTmp.y, z: _posTmp.z };
}

/** Skutečný (neclampovaný) poloměr tělesa — pro kameru a minDistance. */
function getBodyRadiusRaw(id) {
  const p = PLANET_BY_ID[id];
  if (p) return id === 'sun' ? getSunRadius() : p.radiusPx;
  const m = MOONS.find((mm) => mm.id === id);
  if (m) return m.radiusPx * (m.shape?.scale ? Math.max(...m.shape.scale) : 1);
  const a = ASTEROIDS.find((aa) => aa.id === id);
  return a ? a.radiusPx : 1;
}

/** Konec formace: popisky, dráhy, asteroidy a pás se objeví až „dnes". */
function revealAfterFormation() {
  for (const obj of _revealAfterFormation) obj.visible = true;
  if (planetLabels) planetLabels.setVisible(!detailView || detailView.state() === DV_STATE.MAIN);
  if (asteroidLabels) asteroidLabels.setVisible(!detailView || detailView.state() === DV_STATE.MAIN);
}

Promise.all([loaded, moonsLoaded, asteroidsLoaded]).then(() => {
  initAfterLoad();

  // Mesh-e planet, měsíců a asteroidů (viz bodyMeshes.js) — mesh-y jsou
  // skryté (visible=false) dokud nedoletí dost teček, formation gating
  // řeší tick() níže.
  const asteroidMeshes = buildBodyMeshes({
    spins, moonAnchors, asteroidAnchors, imageData, moonImageData, asteroidImageData, bodyMeshes, gatedMeshes,
  });
  // Asteroidí mesh-e (Ceres / Vesta / Pallas) nejsou gated (žádný particle
  // owner) — objeví se až po formaci.
  _revealAfterFormation.push(...asteroidMeshes);
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
    }), pickRadius, p.id === 'sun' ? sunScale : null);
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
  sunActivity = createSunActivity({ sunOwner: 0, sunRadius: getSunRadius(), sunMesh: bodyMeshes.sun });
  moonLabels = createMoonLabels({
    camera,
    canvas: renderer.domElement,
    moonAnchors,
    isOccluded: (worldPos, parentId) => isBehindSphere(
      camera.position, worldPos, getBodyPosNow(parentId), getBodyRadiusRaw(parentId)),
  });
  planetLabels = createPlanetLabels({
    camera,
    canvas: renderer.domElement,
    isOccluded: labelOccludedBySun,
    anchors,
    onClick: (id) => detailView && detailView.enter(id),
  });
  asteroidLabels = createAsteroidLabels({
    camera,
    canvas: renderer.domElement,
    asteroidAnchors,
    onClick: (id) => detailView && detailView.enter(id),
    isOccluded: labelOccludedBySun,
  });
  const bodyList = createBodyList({
    onClick: (id) => detailView && detailView.enter(id),
  });
  const orbitLines = createOrbitLines(scene);
  const asteroidOrbitLines = createAsteroidOrbitLines(scene);
  // Během formace (před 4,6 mld let) ještě nejsou dnešní dráhy ani popisky.
  planetLabels.setVisible(false);
  asteroidLabels.setVisible(false);
  orbitLines.setVisible(false);
  asteroidOrbitLines.setVisible(false);
  asteroidBelt.points.visible = false;
  _revealAfterFormation.push(
    { set visible(v) { orbitLines.setVisible(v); } },
    { set visible(v) { asteroidOrbitLines.setVisible(v); } },
    asteroidBelt.points,
  );

  // Lighting toggle button (přepíná material na body mesh-ích při ZAP/VYP).
  initLightingToggle({ bodyMeshes, setLightingMode, onLightingModeChange });

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
  // default kamera (0,5000,9000) je pak nedostatečná. Auto-zoom out.
  onModeChange((mode) => {
    const fyz = mode === MODES.FYZIKALNI;
    spins.sun.scale.setScalar(sunScale());
    if (sunActivity) sunActivity.setSunRadius(getSunRadius());
    const mainPos = fyz ? { x: 0, y: 90000, z: 160000 } : { x: 0, y: 5000, z: 9000 };
    if (detailView && detailView.state() === DV_STATE.DETAIL) {
      // Pozice se přepočtou v příštím tick() (běží i v DETAIL); tween kamery
      // je relativní k tělesu, takže doletí k jeho NOVÉ poloze.
      detailView.refreshCamera();
      // ESC se má vrátit na přehled NOVÉHO módu — dřív zůstala uložená
      // kamera z módu, ve kterém se do detailu vstoupilo.
      detailView.setReturnPose(mainPos, { x: 0, y: 0, z: 0 });
    } else {
      // Během odletu z detailu (TRANSITION_OUT) by návratový tween kameru
      // v dalším frame přepsal na pozici STARÉHO módu — zrušit ho.
      cameraRig.cancelUnfollowedTween();
      camera.position.set(mainPos.x, mainPos.y, mainPos.z);
      controlsTarget.x = 0; controlsTarget.y = 0; controlsTarget.z = 0;
      controls.target.set(0, 0, 0);
      camera.lookAt(0, 0, 0);
    }
  });

  // Detail view: zpomalený čas (oběhy měsíců viditelné, ne stroboskop) —
  // násobitel simClocku podle fokusovaného tělesa, zpět na 1 v MAIN.
  function applyDetailRate(id) {
    const mul = id ? detailRateMultiplier(id) : 1;
    simClock.setRateMultiplier(mul);
    setDetailRateNote(mul);
  }

  const getBodyPos = getBodyPosNow;

  // Detail view wiring
  detailView = createDetailView({
    cameraFlyTo: (toPos, toTarget, duration, followId = null) => {
      cameraRig.flyTo(toPos, toTarget, duration, followId);
      applyDetailRate(followId);
    },
    getCameraState: () => ({
      pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: controlsTarget.x, y: controlsTarget.y, z: controlsTarget.z },
    }),
    fadeOthers: (focusId, alpha) => {
      // alpha < 1 = detail focus, alpha = 1 = MAIN view.
      // Ostatní planety zůstávají viditelné v detail (kvůli orientaci v soustavě),
      // ale dim — fade alpha 0.3, mesh stále render (ne skryt).
      const isDetail = alpha < 1;
      const dimAlpha = DETAIL_DIM_ALPHA;
      for (const g of gatedMeshes) {
        const isFocus = g.key === focusId || (g.parentId && g.parentId === focusId);
        const ownerA = isDetail ? (isFocus ? 1 : dimAlpha) : 1;
        if (g.isPlanet || g.isMoon) pool.setOwnerAlpha(g.ownerIdx, ownerA);
        const mesh = bodyMeshes[g.key];
        if (!mesh) continue;
        // Vstup do detailu force-settluje focus mesh (+ ring/měsíce přes parentId).
        // Uživatel může kliknout dřív, než doletí tečky formace — bez tohohle
        // by detail view bylo prázdné (VISUAL-AUDIT I2).
        if (isDetail && isFocus && !mesh.userData.settled) {
          mesh.userData.settled = true;
        }
        // Mesh visible vždy (po settle), opacity dim pro non-focus v detail.
        mesh.visible = !!mesh.userData.settled;
        const a = isDetail && !isFocus ? dimAlpha : 1;
        if (mesh.material?.uniforms?.opacity) {
          // Prstenec (ShaderMaterial) je průhledný VŽDY — přepnutí na
          // transparent=false vypnulo blending a tmavý vnitřní prstenec C se
          // kreslil jako neprůhledný pás přes spodek Saturnu.
          mesh.material.uniforms.opacity.value = a;
        } else if (mesh.material) {
          mesh.material.transparent = a < 1;
          mesh.material.opacity = a;
        }
      }
      // Slunce (owner 0) není v gatedMeshes (countSettled gating mu nefunguje,
      // viz komentář u tick()), takže smyčka výše jeho ownerAlpha nikdy nesahá.
      // Bez explicitní větve by sluneční aktivita (sunActivity — prominence/CME
      // čtou ownerAlphaMul[0] při spawnu) zůstala na plný jas i v detailu jiného
      // tělesa (I1 fix). Gate na sunRevealed: dokud neproběhl zážeh, ownerAlpha(0)
      // vlastní formační fade (tick(), 0→1 přes t≈6.0–6.5) — kdybychom sem sahali
      // dřív, přebili bychom ho.
      if (sunRevealed) {
        pool.setOwnerAlpha(0, isDetail && focusId !== 'sun' ? dimAlpha : 1);
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
      if (planetLabels && !formationActive) planetLabels.setVisible(true);
      if (asteroidLabels && !formationActive) asteroidLabels.setVisible(true);
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
        // Dynamické minDistance: kamera nesmí dovnitř tělesa (ani near plane = 1
        // za povrch). Dřív radius×1.2 + 10 — u měsíců s radiusPx 0.5 to
        // nedovolilo přiblížit se víc než na 21 poloměrů.
        const radius = getBodyRadiusRaw(detailView.focusId());
        controls.minDistance = Math.max(radius * 1.3, radius + 1.5);
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
    getBodyRadius: getBodyRadiusRaw,
    getCameraDistance: (id, scaleOn) => cameraDistanceFor(id, scaleOn, getBodyRadiusRaw),
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
    window.__debug = { pool, anchors, moonAnchors, asteroidAnchors, camera, controls, controlsTarget };
  }

  // Panel handlers
  infoPanel.onClose(() => detailView.exit());

  // ESC + časové klávesy (Space, [ ] \ 0)
  initKeyboard({ detailView, isFormationActive: () => formationActive });

  // Initialize time controls UI
  initTimeControls();

  // Formation lifecycle startup (F3): scrubTo pauzne simClock na dnešním
  // datu — formation cíle (getPlanetTargets/anchor pozice) tak od začátku
  // sedí na ephemeris pozicích a přechod na live v LIVE_START (tick()) je
  // bez skoku. setFormationLock(true) disabluje time HUD po dobu formace.
  simClock.scrubTo(new Date());
  setFormationLock(true);

  clock.reset(); // první dt od teď, ne od konstrukce (load textur trvá sekundy)
  requestAnimationFrame(tick);
}).catch((err) => {
  console.error('Texture preload failed:', err);
  clock.reset();
  requestAnimationFrame(tick);
});
