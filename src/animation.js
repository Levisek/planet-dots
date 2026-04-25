// Animation timeline — fáze V1 (solar wind).

// 6-beat formation narrativ (V4.2):
//   Beat 1 (0-3s):  molekulární oblak rotuje kolem origin
//   Beat 2 (3-6s):  gravitační kolaps ke středu
//   Beat 3 (6-7s):  Slunce se zažehne (init phase = solarWind je quiet)
//   Beat 4+5 (7-15s): per-planet materializace + per-rodina měsíce (solarWind)
//   Beat 6 (15s+): live state
export const PHASES = [
  { start: 0,    end: 3.0, id: 'beat1_cloud' },
  { start: 3.0,  end: 6.0, id: 'beat2_collapse' },
  { start: 6.0,  end: 7.0, id: 'init' },
  { start: 7.0,  end: 8.0, id: 'sun',     planetId: 'sun',     label: 'SLUNCE' },
  { start: 8.0,  end: 8.5, id: 'mercury', planetId: 'mercury', label: 'MERKUR' },
  { start: 8.5,  end: 9.1, id: 'venus',   planetId: 'venus',   label: 'VENUŠE' },
  { start: 9.1,  end: 9.8, id: 'earth',   planetId: 'earth',   label: 'ZEMĚ' },
  { start: 9.8,  end: 10.3, id: 'mars',   planetId: 'mars',    label: 'MARS' },
  { start: 10.3, end: 11.7, id: 'jupiter', planetId: 'jupiter', label: 'JUPITER' },
  { start: 11.7, end: 13.0, id: 'saturn', planetId: 'saturn',  label: 'SATURN' },
  { start: 13.0, end: 13.8, id: 'uranus', planetId: 'uranus',  label: 'URAN' },
  { start: 13.8, end: 14.6, id: 'neptune', planetId: 'neptune', label: 'NEPTUN' },
  { start: 14.6, end: 15.0, id: 'earth_moons',   parentId: 'earth' },
  { start: 15.0, end: 15.4, id: 'mars_moons',    parentId: 'mars' },
  { start: 15.4, end: 16.4, id: 'jupiter_moons', parentId: 'jupiter' },
  { start: 16.4, end: 18.0, id: 'saturn_moons',  parentId: 'saturn' },
  { start: 18.0, end: 19.0, id: 'uranus_moons',  parentId: 'uranus' },
  { start: 19.0, end: 20.0, id: 'neptune_moons', parentId: 'neptune' },
  { start: 20.0, end: Infinity, id: 'live' },
];

export function phaseAt(t) {
  for (const ph of PHASES) {
    if (t >= ph.start && t < ph.end) return ph;
  }
  return PHASES[PHASES.length - 1];
}

const _SKIP_PROGRESS = new Set(['init', 'beat1_cloud', 'beat2_collapse']);

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
