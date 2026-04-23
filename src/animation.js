// Animation timeline — fáze V1.

export const PHASES = [
  { start: 0,   end: 1,   id: 'init' },
  { start: 1,   end: 2,   id: 'sun',     planetId: 'sun',     label: 'SLUNCE' },
  { start: 2,   end: 2.4, id: 'mercury', planetId: 'mercury', label: 'MERKUR' },
  { start: 2.4, end: 2.9, id: 'venus',   planetId: 'venus',   label: 'VENUŠE' },
  { start: 2.9, end: 3.4, id: 'earth',   planetId: 'earth',   label: 'ZEMĚ' },
  { start: 3.4, end: 3.9, id: 'mars',    planetId: 'mars',    label: 'MARS' },
  { start: 3.9, end: 5,   id: 'jupiter', planetId: 'jupiter', label: 'JUPITER' },
  { start: 5,   end: 6,   id: 'saturn',  planetId: 'saturn',  label: 'SATURN' },
  { start: 6,   end: 6.5, id: 'uranus',  planetId: 'uranus',  label: 'URAN' },
  { start: 6.5, end: 7,   id: 'neptune', planetId: 'neptune', label: 'NEPTUN' },
  { start: 7,   end: Infinity, id: 'live' },
];

export function phaseAt(t) {
  for (const ph of PHASES) {
    if (t >= ph.start && t < ph.end) return ph;
  }
  return PHASES[PHASES.length - 1];
}

export function phaseProgress(t) {
  // Na hraně t === ph.end (pro non-init konečné fáze) vracíme 1 této fáze,
  // nikoliv 0 následující — kvůli plynulému dojezdu animace.
  for (const ph of PHASES) {
    if (ph.id === 'init') continue;
    if (isFinite(ph.end) && t === ph.end) return 1;
  }
  const ph = phaseAt(t);
  if (!isFinite(ph.end)) return 0;
  return (t - ph.start) / (ph.end - ph.start);
}

// Sub-fáze uvnitř každého planet slotu:
//   0.0 – 0.25  : label forming
//   0.25 – 0.55 : label holding
//   0.55 – 0.85 : flying to planet
//   0.85 – 1.0  : fade-in textury
export const SUB = Object.freeze({
  LABEL_FORM_END: 0.25,
  LABEL_HOLD_END: 0.55,
  FLY_END: 0.85,
});

export function updatePhaseInit(pool, tSeconds, dt) {
  // 0..1s — materializace (fade-in alpha) + noise drift
  pool.fadeInAll(1.2, dt);
  pool.noiseDriftAll(tSeconds, dt, 8);
}
