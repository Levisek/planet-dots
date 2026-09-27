// flightPath — přelet kamery po optimální dráze „oddálit – přeletět – přiblížit"
// (van Wijk & Nuij, Smooth and efficient zooming and panning, InfoVis 2003).
// Čistá matematika bez Three, ať je testovatelná.
//
// Dráha žije ve dvou veličinách: u = jak daleko od startu je cíl pohledu
// (podél úsečky A→B), w = šířka záběru (tady vzdálenost kamery od cíle).
// Krátký skok (Země → Luna) je skoro jen posun, dlouhý (Země → Neptun) nejdřív
// odjede tak daleko, že jsou vidět oba konce, a pak se snese k cíli. Délka
// dráhy S je v „vnímaných" jednotkách, proto z ní jde i délka letu.

const RHO = 1.3; // poměr zoom : posun; √2 je optimum z článku, víc = víc zoomu
const EPS = 1e-9;

/**
 * Dráha van Wijk–Nuij.
 * @param {number} u1 vzdálenost cílů A→B
 * @param {number} w0 vzdálenost kamery od cíle na startu
 * @param {number} w1 … v cíli
 * @returns {{ S: number, u: (s:number)=>number, w: (s:number)=>number }}
 */
export function vwPath(u1, w0, w1, rho = RHO) {
  w0 = Math.max(w0, EPS);
  w1 = Math.max(w1, EPS);
  if (u1 < 1e-6 * Math.min(w0, w1)) {
    // Cíl se nehýbe — jen zoom, exponenciálně (stejná vnímaná rychlost).
    const k = Math.log(w1 / w0);
    const dir = Math.sign(k);
    return { S: Math.abs(k) / rho, u: () => 0, w: (s) => w0 * Math.exp(dir * rho * s) };
  }
  const r2 = rho * rho, r4 = r2 * r2;
  const b0 = (w1 * w1 - w0 * w0 + r4 * u1 * u1) / (2 * w0 * r2 * u1);
  const b1 = (w1 * w1 - w0 * w0 - r4 * u1 * u1) / (2 * w1 * r2 * u1);
  const r0 = -Math.asinh(b0);
  const r1 = -Math.asinh(b1);
  // u(s) z článku: w0/ρ² (cosh r0 · tanh(ρs + r0) − sinh r0), přepsané
  // na sinh(ρs) / cosh(ρs + r0) — stejná hodnota, bez odečítání velkých čísel.
  return {
    S: (r1 - r0) / rho,
    u: (s) => (w0 * Math.sinh(rho * s)) / (r2 * Math.cosh(rho * s + r0)),
    w: (s) => (w0 * Math.cosh(r0)) / Math.cosh(rho * s + r0),
  };
}

/**
 * Průběh letu v čase τ ∈ [0,1] → podíl dráhy. Rychlost sin(πτ) s malou
 * rezervou na koncích: z místa vyrazí svižně (0,12), v cíli dosedá pomalu
 * (0,03), aby kamera nepřiletěla v plné rychlosti a nezastavila se naráz.
 */
const F0 = 0.12, F1 = 0.03;
const P_TOTAL = 2 / Math.PI + F0 / 2 + F1 / 2;
export function flightProgress(tau) {
  const t = Math.min(1, Math.max(0, tau));
  const a = (1 - Math.cos(Math.PI * t)) / Math.PI + F0 * (t - (t * t) / 2) + (F1 * t * t) / 2;
  return a / P_TOTAL;
}

/** Délka letu (s) podle délky dráhy — krátký skok ~0,8 s, přes soustavu ~4 s. */
export function flightDuration(S, maxDuration = 4) {
  return Math.min(maxDuration, Math.max(0.8, 0.7 + 0.28 * S));
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len = (a) => Math.hypot(a.x, a.y, a.z);
const scale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a) => { const l = len(a); return l > EPS ? scale(a, 1 / l) : { x: 0, y: 0, z: 1 }; };

/** Sférická interpolace jednotkových směrů (kamera se stáčí po oblouku). */
export function slerpDir(a, b, t) {
  const c = Math.min(1, Math.max(-1, dot(a, b)));
  const th = Math.acos(c);
  if (th < 1e-4) return norm(add(a, scale(sub(b, a), t)));
  if (th > Math.PI - 1e-3) {
    // Protilehlé směry — oblouk přes libovolnou kolmici (nahoru, je-li to jde).
    const ref = Math.abs(a.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const perp = norm(sub(ref, scale(a, dot(ref, a))));
    return add(scale(a, Math.cos(th * t)), scale(perp, Math.sin(th * t)));
  }
  const s = Math.sin(th);
  return add(scale(a, Math.sin((1 - t) * th) / s), scale(b, Math.sin(t * th) / s));
}

/**
 * Let kamery z (fromPos, fromTarget) do (toPos, toTarget).
 * sample(t) vrací pozici, cíl pohledu a `frac` — jak velký díl cesty mezi
 * cíli už je za námi (0..1); cameraRig podle něj přičítá pohyb tělesa.
 * @param {{ fromPos, fromTarget, toPos, toTarget, duration?: number|null, maxDuration?: number }} o
 */
export function createFlight({ fromPos, fromTarget, toPos, toTarget, duration = null, maxDuration = 4 }) {
  const A = { ...fromTarget }, B = { ...toTarget };
  const AB = sub(B, A);
  const u1 = len(AB);
  const w0 = len(sub(fromPos, fromTarget));
  const w1 = len(sub(toPos, toTarget));
  const dir1 = norm(sub(toPos, toTarget));
  const dir0 = w0 > EPS ? norm(sub(fromPos, fromTarget)) : dir1;
  const path = vwPath(u1, w0, w1);
  const dur = duration ?? flightDuration(path.S, maxDuration);
  const end = { pos: { ...toPos }, target: { ...toTarget } };
  return {
    duration: dur,
    S: path.S,
    sample(t) {
      if (dur <= 0 || t >= dur) return { pos: { ...end.pos }, target: { ...end.target }, frac: 1 };
      const p = flightProgress(t / dur);
      const s = path.S * p;
      const frac = u1 > EPS ? Math.min(1, path.u(s) / u1) : p;
      const target = add(A, scale(AB, frac));
      const dir = slerpDir(dir0, dir1, smoothstep(0.1, 0.9, p));
      const pos = add(target, scale(dir, path.w(s)));
      return { pos, target, frac };
    },
    isComplete(t) { return t >= dur; },
  };
}
