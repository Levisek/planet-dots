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
 * @param opts.obstacles — kotouče těles na obrazovce `{x, y, r}`; popisek na
 *   žádný z nich nesmí zasáhnout (ani na vlastní, ani na cizí, ani na Slunce).
 *   Zkouší se řádky nahoru 0..maxShift, pak (záporný shift) dolů.
 * @returns {Array<{shift:number, hidden:boolean}>} ve stejném pořadí jako items;
 *   shift = počet řádků nahoru (záporný = dolů).
 */
export function declutter(items, { maxShift = 2, gap = 3, obstacles = [] } = {}) {
  const order = items.map((_, i) => i)
    .sort((a, b) => items[b].priority - items[a].priority || a - b);
  const placed = [];
  const out = items.map(() => ({ shift: 0, hidden: true }));
  for (const i of order) {
    const it = items[i];
    const step = it.h + gap;
    const shifts = [];
    for (let s = 0; s <= maxShift; s++) shifts.push(s);
    // Dolů jen když známe kotouče těles (jinak by popisek zakryl vlastní těleso).
    if (obstacles.length) for (let s = 1; s <= maxShift; s++) shifts.push(-s);
    // Kandidáti: [řádky nahoru, vodorovný posun]; nakonec popisek vedle tělesa
    // (vlevo / vpravo, svisle na středu kotouče) — když nad ním není místo.
    const cands = shifts.map((s) => [s, 0, 0]);
    if (it.disc && obstacles.length) {
      const side = it.w / 2 + Math.max(it.disc.r, 3) + 5;
      const dy = it.disc.y - 0.5 * it.h - (it.y - 1.8 * it.h);
      cands.push([0, side, dy], [0, -side, dy]);
    }
    for (const [s, dx, dy] of cands) {
      const box = {
        l: it.x - it.w / 2 + dx,
        r: it.x + it.w / 2 + dx,
        t: it.y - 1.8 * it.h - s * step + dy,
        b: it.y - 0.8 * it.h - s * step + dy,
      };
      if (placed.some((p) => overlaps(p, box, gap))) continue;
      if (obstacles.some((o) => hitsDisc(box, o))) continue;
      placed.push(box);
      out[i] = dx || dy ? { shift: s, dx, dy, hidden: false } : { shift: s, hidden: false };
      break;
    }
  }
  return out;
}

// Posunuté řádky mají mezi sebou přesně `gap` — bez tolerance by je
// zaokrouhlení (14.4 vs 14.3999…) vyhodnotilo jako kolizi.
const EPS = 0.01;

// Kotouč tělesa (min. 3 px, ať i tečka drží odstup) vs. obdélník popisku.
function hitsDisc(b, o) {
  const r = Math.max(o.r, 3) + 2;
  const nx = Math.min(Math.max(o.x, b.l), b.r);
  const ny = Math.min(Math.max(o.y, b.t), b.b);
  return (o.x - nx) ** 2 + (o.y - ny) ** 2 < r * r;
}

/** Kotouč tělesa na obrazovce: střed (px) a poloměr z jeho zobrazeného poloměru. */
export function screenDisc(camera, worldPos, radius, canvas) {
  const rect = canvas.getBoundingClientRect();
  const dist = camera.position.distanceTo(worldPos);
  const p = worldPos.clone().project(camera);
  const r = dist > 0 ? (radius * rect.height) / (2 * Math.tan((camera.fov * Math.PI) / 360) * dist) : 0;
  return {
    x: (p.x * 0.5 + 0.5) * rect.width + rect.left,
    y: (-p.y * 0.5 + 0.5) * rect.height + rect.top,
    r,
  };
}

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
  const items = entries.map((e) => ({ x: e.x, y: e.y, priority: e.priority, disc: e.disc, ...sizeOf(e.el) }));
  const obstacles = [...(opts?.obstacles ?? []), ...entries.map((e) => e.disc).filter(Boolean)];
  const out = declutter(items, { ...opts, obstacles });
  const gap = opts?.gap ?? 3;
  entries.forEach((e, i) => {
    const { shift, hidden, dx = 0, dy = 0 } = out[i];
    if (hidden) { e.el.style.display = 'none'; return; }
    const up = shift * (items[i].h + gap) - dy; // záporný shift = dolů
    const tf = shift === 0 && dx === 0 && dy === 0 ? '' : `translate(calc(-50% + ${dx}px), calc(-180% - ${up}px))`;
    if (e.el.style.transform !== tf) e.el.style.transform = tf;
  });
}
