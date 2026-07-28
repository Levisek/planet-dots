// formationTimeline — geologické popisky formace (V4.4 F3, spec §6).
// Narativní fáze, ne přesné datování (out-of-scope dle specu §2).
const STAGES = [
  { start: 0,    label: 'Sluneční mlhovina se hroutí',            age: 'před 4,6 mld let' },
  { start: 4,    label: 'Zažehnutí Slunce — hvězda T Tauri',      age: 'před 4,6 mld let' },
  { start: 6.5,  label: 'Prach se slepuje do planetesimál',       age: 'před 4,57 mld let' },
  { start: 10,   label: 'Planetesimály narůstají v planety',      age: 'před 4,5 mld let' },
  { start: 14,   label: 'Systém se stabilizuje na dnešní dráhy',  age: 'před ~4 mld let' },
  { start: 22,   label: 'Dnes',                                   age: '' },
];

export function timelineAt(tSec) {
  let cur = STAGES[0];
  for (const s of STAGES) {
    if (tSec >= s.start) cur = s;
    else break;
  }
  return { label: cur.label, age: cur.age };
}
