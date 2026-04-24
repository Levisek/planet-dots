// Animation timeline — fáze V1 (solar wind).

export const PHASES = [
  { start: 0,   end: 1,   id: 'init' },
  { start: 1,   end: 2,   id: 'sun',     planetId: 'sun',     label: 'SLUNCE' },
  { start: 2,   end: 2.5, id: 'mercury', planetId: 'mercury', label: 'MERKUR' },
  { start: 2.5, end: 3.1, id: 'venus',   planetId: 'venus',   label: 'VENUŠE' },
  { start: 3.1, end: 3.8, id: 'earth',   planetId: 'earth',   label: 'ZEMĚ' },
  { start: 3.8, end: 4.3, id: 'mars',    planetId: 'mars',    label: 'MARS' },
  { start: 4.3, end: 5.7, id: 'jupiter', planetId: 'jupiter', label: 'JUPITER' },
  { start: 5.7, end: 7.0, id: 'saturn',  planetId: 'saturn',  label: 'SATURN' },
  { start: 7.0, end: 7.8, id: 'uranus',  planetId: 'uranus',  label: 'URAN' },
  { start: 7.8, end: 8.6, id: 'neptune', planetId: 'neptune', label: 'NEPTUN' },
  { start: 8.6, end: 9.0,   id: 'earth_moons',   parentId: 'earth' },
  { start: 9.0, end: 9.4,   id: 'mars_moons',    parentId: 'mars' },
  { start: 9.4, end: 10.4,  id: 'jupiter_moons', parentId: 'jupiter' },
  { start: 10.4, end: 12.0, id: 'saturn_moons',  parentId: 'saturn' },
  { start: 12.0, end: 13.0, id: 'uranus_moons',  parentId: 'uranus' },
  { start: 13.0, end: Infinity, id: 'live' },
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

// Sub-fáze uvnitř každého planet slotu (ponecháno pro referenční použití ve solar windu).
export const SUB = Object.freeze({
  LABEL_FORM_END: 0.25,
  LABEL_HOLD_END: 0.55,
  FLY_END: 0.85,
});

/** Reset per-phase emission counters (volá se při restartu animace). */
export function resetPhaseEmissions() {
  for (const ph of PHASES) {
    delete ph._emittedCount;
  }
}
