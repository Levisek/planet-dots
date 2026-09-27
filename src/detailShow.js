// detailShow — po příletu do detailu kamera sama předvádí těleso: pomalu
// krouží (OrbitControls.autoRotate) a po chvíli přejede na další připravený
// úhel. Jakmile uživatel kameru chytne, show končí (do dalšího příletu).
// Nápad z gcdatlas („loops through its best angles until you take the
// camera"); úhly jsou naše, v jednotkách poloměru tělesa / vzdálenosti detailu.

export const SHOW_HOLD_SEC = 12;  // jak dlouho zůstat v jednom úhlu
export const SHOW_SWING_SEC = 4;  // přejezd mezi úhly
export const SHOW_AUTOROTATE = 0.35; // OrbitControls.autoRotateSpeed (2 = 30 s/otáčka) → ~170 s

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const len = (a) => Math.hypot(a.x, a.y, a.z);
const norm = (a, fallback) => { const l = len(a); return l > 1e-9 ? scale(a, 1 / l) : fallback; };
const mix = (...terms) => terms.reduce((acc, [v, k]) => add(acc, scale(v, k)), { x: 0, y: 0, z: 0 });

/**
 * Úhly pohledu na těleso. Směry se staví z pólu tělesa a směru ke Slunci,
 * takže „nad pólem" je opravdu nad pólem a srpek je opravdu proti Slunci.
 * @param {{ bodyPos:{x,y,z}, radius:number, dist:number, pole?:{x,y,z}, ringed?:boolean }} o
 *   dist — vzdálenost detailu (cameraDistanceFor), radius — skutečný poloměr
 * @returns {{ dir:{x,y,z}, dist:number, label:string }[]}
 */
export function showViews({ bodyPos, radius, dist, pole = { x: 0, y: 1, z: 0 }, ringed = false }) {
  const up = norm(pole, { x: 0, y: 1, z: 0 });
  // Slunce je v počátku; pro Slunce samo bereme výchozí směr kamery (+z).
  const toSun = norm(scale(bodyPos, -1), { x: 0, y: 0, z: 1 });
  // Směr ke Slunci v rovině rovníku a kolmice k němu (bok).
  const anyPerp = Math.abs(up.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const sunEq = norm(add(toSun, scale(up, -dot(toSun, up))), norm(cross(up, anyPerp), { x: 1, y: 0, z: 0 }));
  const side = norm(cross(up, sunEq), { x: 1, y: 0, z: 0 });

  const views = [
    { dir: norm(mix([sunEq, 0.9], [side, 0.35], [up, 0.25]), sunEq), dist, label: 'denní strana' },
    { dir: norm(mix([up, 0.8], [sunEq, 0.6]), up), dist: dist * 1.15, label: 'nad pólem' },
  ];
  if (ringed) {
    // Těsně nad rovinou prstence (≈ rovník), z boku, aby byl vidět stín na prstenci.
    views.push({ dir: norm(mix([side, 0.9], [sunEq, 0.4], [up, 0.035]), side), dist: Math.max(radius * 6, radius + 2), label: 'rovina prstence' });
  } else {
    // Proti Slunci — se zapnutými stíny srpek.
    views.push({ dir: norm(mix([sunEq, -0.75], [side, 0.6], [up, 0.25]), side), dist: dist * 0.85, label: 'proti Slunci' });
  }
  return views;
}

/**
 * Stavový automat show. Nic nekreslí, jen říká, kdy kam letět.
 * @param {{ flyToView(view): void, setAutoRotate(on:boolean): void, getViews(id:string): object[], isFlying(): boolean }} deps
 */
export function createDetailShow(deps) {
  let _id = null;
  let _idx = 0;   // 0 = příletový záběr, pak views[1], views[2], views[0], …
  let _t = 0;

  return {
    start(id) {
      _id = id;
      _idx = 0;
      _t = 0;
      deps.setAutoRotate(true);
    },
    stop() {
      if (_id === null) return;
      _id = null;
      deps.setAutoRotate(false);
    },
    active() { return _id !== null; },
    tick(dt) {
      if (_id === null || deps.isFlying()) return; // přelet (i změna módu) čas nepočítá
      _t += dt;
      if (_t < SHOW_HOLD_SEC) return;
      const views = deps.getViews(_id);
      if (!views.length) return;
      _idx = (_idx + 1) % views.length;
      _t = 0;
      deps.flyToView(views[_idx]);
    },
  };
}
