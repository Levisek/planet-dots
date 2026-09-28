// viewFraming — těleso v detailu do středu VOLNÉ plochy, ne pod info panel.
// Na telefonu panel leží přes spodek displeje (planeta byla schovaná pod ním),
// na počítači vpravo (zakrýval kus prstence Saturnu). Posouvá se jen
// promítání (camera.setViewOffset), kamera a let zůstávají — popisky
// i klikání počítají se stejnou projekční maticí, takže sedí dál.

/**
 * O kolik px posunout střed záběru, aby cíl pohledu ležel uprostřed volné
 * plochy. Záporné dx = doleva, dy = nahoru.
 * @param {{ vw:number, vh:number, panel?: {left:number, top:number, width:number, height:number}|null,
 *           leftInset?:number, topInset?:number }} o
 *   panel — rozměry panelu bez transformace (null = skrytý)
 *   leftInset — pravý okraj seznamu těles vlevo (desktop), topInset — spodek horní lišty (telefon)
 */
export function framingShift({ vw, vh, panel = null, leftInset = 0, topInset = 0 }) {
  if (!panel || vw <= 0 || vh <= 0) return { dx: 0, dy: 0 };
  if (panel.width >= vw * 0.6) {
    // Panel přes šířku displeje (telefon) — volno mezi horní lištou a panelem.
    const free = Math.max(0, panel.top - topInset);
    if (free < vh * 0.15) return { dx: 0, dy: 0 }; // rozbalený přes všechno — nemá smysl
    return { dx: 0, dy: Math.round(topInset + free / 2 - vh / 2) };
  }
  // Panel po straně — volno mezi seznamem těles a panelem.
  const free = Math.max(0, panel.left - leftInset);
  if (free < vw * 0.2) return { dx: 0, dy: 0 };
  return { dx: Math.round(leftInset + free / 2 - vw / 2), dy: 0 };
}

/**
 * Parametry pro camera.setViewOffset: virtuální snímek zvětšený o 2|d|,
 * z něj výřez velikosti obrazovky tak, aby jeho střed (cíl pohledu) padl
 * na obrazovce na (w/2 + dx, h/2 + dy). Svislý posun záběr trochu oddálí
 * (fov platí pro celou virtuální výšku) — na telefonu je volná plocha
 * menší než displej, takže to je žádoucí.
 */
export function viewOffsetParams(w, h, dx, dy) {
  const fullW = w + 2 * Math.abs(dx);
  const fullH = h + 2 * Math.abs(dy);
  return {
    fullW, fullH,
    x: Math.abs(dx) - dx,
    y: Math.abs(dy) - dy,
    w, h,
    aspect: fullW / fullH,
  };
}

/**
 * @param {{ camera: import('three').PerspectiveCamera, getSize: () => {w:number, h:number} }} deps
 */
export function createViewFraming({ camera, getSize }) {
  let target = { dx: 0, dy: 0 };
  let cur = { dx: 0, dy: 0 };
  let applied = null; // "w,h,dx,dy" naposledy aplikovaného stavu

  function apply() {
    const { w, h } = getSize();
    const dx = Math.round(cur.dx), dy = Math.round(cur.dy);
    const key = `${w},${h},${dx},${dy},${camera.aspect}`;
    if (key === applied) return;
    if (dx === 0 && dy === 0) {
      camera.clearViewOffset();
      camera.aspect = w / h;
    } else {
      const p = viewOffsetParams(w, h, dx, dy);
      camera.aspect = p.aspect;
      camera.setViewOffset(p.fullW, p.fullH, p.x, p.y, p.w, p.h);
    }
    camera.updateProjectionMatrix();
    applied = `${w},${h},${dx},${dy},${camera.aspect}`;
  }

  return {
    /** Nový cíl posunu (z framingShift). */
    setShift(s) { target = { dx: s.dx, dy: s.dy }; },
    /** Každý snímek: plynulý přechod k cíli (~0,3 s) a aplikace při změně. */
    update(dt) {
      const k = Math.min(1, dt * 8);
      cur.dx += (target.dx - cur.dx) * k;
      cur.dy += (target.dy - cur.dy) * k;
      if (Math.abs(target.dx - cur.dx) < 0.5) cur.dx = target.dx;
      if (Math.abs(target.dy - cur.dy) < 0.5) cur.dy = target.dy;
      apply(); // i při resize (scene.js přepíše aspect → klíč se změní)
    },
  };
}
