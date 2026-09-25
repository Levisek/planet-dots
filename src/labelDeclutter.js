// labelDeclutter — rozmístění screen-space popisků bez překryvu.
//
// Greedy podle priority: popisek s vyšší prioritou zůstane na místě, další
// se při kolizi posune o řádek NAHORU (dolů by zakryl samotné těleso), max
// `maxShift` řádků; když se nevejde nikam, skryje se. Dřív se CERES/PALLAS/
// ZEMĚ/MARS v Pochopení kreslily přes sebe.

/**
 * @param {Array<{x:number, y:number, w:number, h:number, priority:number}>} items
 *   x, y = bod tělesa; box popisku je vystředěný nad ním jako v CSS
 *   (`translate(-50%, -180%)`): [x − w/2, x + w/2] × [y − 1.8h, y − 0.8h].
 * @returns {Array<{shift:number, hidden:boolean}>} ve stejném pořadí jako items;
 *   shift = počet řádků nahoru.
 */
export function declutter(items, { maxShift = 2, gap = 3 } = {}) {
  const order = items.map((_, i) => i)
    .sort((a, b) => items[b].priority - items[a].priority || a - b);
  const placed = [];
  const out = items.map(() => ({ shift: 0, hidden: true }));
  for (const i of order) {
    const it = items[i];
    const step = it.h + gap;
    for (let s = 0; s <= maxShift; s++) {
      const box = {
        l: it.x - it.w / 2,
        r: it.x + it.w / 2,
        t: it.y - 1.8 * it.h - s * step,
        b: it.y - 0.8 * it.h - s * step,
      };
      if (placed.some((p) => overlaps(p, box, gap))) continue;
      placed.push(box);
      out[i] = { shift: s, hidden: false };
      break;
    }
  }
  return out;
}

// Posunuté řádky mají mezi sebou přesně `gap` — bez tolerance by je
// zaokrouhlení (14.4 vs 14.3999…) vyhodnotilo jako kolizi.
const EPS = 0.01;

function overlaps(a, b, pad) {
  const p = pad - EPS;
  return a.l < b.r + p && b.l < a.r + p && a.t < b.b + p && b.t < a.b + p;
}

/**
 * Leží bod za koulí (střed `center`, poloměr `radius`) při pohledu z `cam`?
 * Úsečka kamera → bod protne kouli dřív, než bod dosáhne.
 */
export function isBehindSphere(cam, point, center, radius) {
  const dx = point.x - cam.x, dy = point.y - cam.y, dz = point.z - cam.z;
  const len2 = dx * dx + dy * dy + dz * dz;
  if (len2 === 0) return false;
  const t = ((center.x - cam.x) * dx + (center.y - cam.y) * dy + (center.z - cam.z) * dz) / len2;
  if (t <= 0 || t >= 1) return false;
  const qx = cam.x + dx * t - center.x;
  const qy = cam.y + dy * t - center.y;
  const qz = cam.z + dz * t - center.z;
  return qx * qx + qy * qy + qz * qz < radius * radius;
}

// Rozměry popisků (text je statický) — měřit každý frame by vynutilo layout.
// Po dotažení fontu Press Start 2P se změří znovu.
let _sizes = new WeakMap();
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.addEventListener('loadingdone', () => { _sizes = new WeakMap(); });
}

function sizeOf(el) {
  let s = _sizes.get(el);
  if (!s || s.w === 0) {
    s = { w: el.offsetWidth, h: el.offsetHeight };
    _sizes.set(el, s);
  }
  return s;
}

/**
 * DOM část: změří popisky, rozmístí je a zapíše posun / skrytí.
 * @param {Array<{el:HTMLElement, x:number, y:number, priority:number}>} entries
 *   jen popisky, které jsou právě zobrazené (display != none).
 */
export function applyDeclutter(entries, opts) {
  const items = entries.map((e) => ({ x: e.x, y: e.y, priority: e.priority, ...sizeOf(e.el) }));
  const out = declutter(items, opts);
  const gap = opts?.gap ?? 3;
  entries.forEach((e, i) => {
    const { shift, hidden } = out[i];
    if (hidden) { e.el.style.display = 'none'; return; }
    const tf = shift === 0 ? '' : `translate(-50%, calc(-180% - ${shift * (items[i].h + gap)}px))`;
    if (e.el.style.transform !== tf) e.el.style.transform = tf;
  });
}
