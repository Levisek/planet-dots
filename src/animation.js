// Animation timeline — akreční narativ (V4.4 F3):
//   beat_disk      (0–4s):    protoplanetární disk rotuje
//   beat_ignition  (4–6.5s):  střed disku se zhustí → zážeh Slunce, zbytek disku zůstává
//   beat_accretion (6.5–17s): planety se souběžně hustí z prstenců disku
//                             (per-planeta okna v ACCRETION_WINDOWS, překrývají se)
//   *_moons        (17–21.8s): měsíční rodiny z povrchu rodičů (moonWind, beze změny)
//   live           (22s+):    živý stav — simClock přebírá čas
export const PHASES = [
  { start: 0,    end: 4.0,  id: 'beat_disk' },
  { start: 4.0,  end: 6.5,  id: 'beat_ignition' },
  { start: 6.5,  end: 17.0, id: 'beat_accretion' },
  { start: 17.0, end: 17.5, id: 'earth_moons',   parentId: 'earth' },
  { start: 17.5, end: 18.0, id: 'mars_moons',    parentId: 'mars' },
  { start: 18.0, end: 19.0, id: 'jupiter_moons', parentId: 'jupiter' },
  { start: 19.0, end: 20.2, id: 'saturn_moons',  parentId: 'saturn' },
  { start: 20.2, end: 21.0, id: 'uranus_moons',  parentId: 'uranus' },
  { start: 21.0, end: 22.0, id: 'neptune_moons', parentId: 'neptune' },
  { start: 22.0, end: Infinity, id: 'live' },
];

export const LIVE_START = 22.0;

// Akreční okna: všechna se překrývají (souběžná akrece), vnitřní planety
// začínají dřív (kratší dynamický čas u Slunce). Žádné dávky.
export const ACCRETION_WINDOWS = [
  { planetId: 'mercury', start: 6.5,  end: 12.0 },
  { planetId: 'venus',   start: 7.0,  end: 12.5 },
  { planetId: 'earth',   start: 7.5,  end: 13.0 },
  { planetId: 'mars',    start: 8.0,  end: 13.5 },
  { planetId: 'jupiter', start: 8.75, end: 14.25 },
  { planetId: 'saturn',  start: 9.5,  end: 15.0 },
  { planetId: 'uranus',  start: 10.25, end: 15.75 },
  { planetId: 'neptune', start: 11.0, end: 16.5 },
];

export function phaseAt(t) {
  for (const ph of PHASES) {
    if (t >= ph.start && t < ph.end) return ph;
  }
  return PHASES[PHASES.length - 1];
}

const _SKIP_PROGRESS = new Set(['beat_disk', 'beat_ignition', 'beat_accretion']);

export function phaseProgress(t) {
  for (const ph of PHASES) {
    if (_SKIP_PROGRESS.has(ph.id)) continue;
    if (isFinite(ph.end) && t === ph.end) return 1;
  }
  const ph = phaseAt(t);
  if (!isFinite(ph.end)) return 0;
  return (t - ph.start) / (ph.end - ph.start);
}

/** Reset per-phase emission counters (volá se při restartu animace). */
export function resetPhaseEmissions() {
  for (const ph of PHASES) {
    delete ph._emittedCount;
  }
}
