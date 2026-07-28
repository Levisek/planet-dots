// simClock — jediná autorita simulačního času (V4.4 F2).
// Nahrazuje F1 dočasný most getSimulationDate(_simElapsed) v main.js.

const J2000_MS = Date.UTC(2000, 0, 1, 12);
export const MIN_YEAR = -4000;
export const MAX_YEAR = 8000;

// Uniformní rate: reálné periody zachovány (volba A). 10 real-sekund = 1 rok Země
// při timeScale=1 → viditelný pohyb vnitřních planet, vnější reálně pomalé.
const DAYS_PER_SEC = 365.25 / 10;
const MS_PER_REAL_MS = (DAYS_PER_SEC * 86400 * 1000) / 1000; // sim-ms na real-ms

let _date = new Date(J2000_MS);
let _playing = true;
let _timeScale = 1;
const _listeners = [];

function clampDate(d) {
  const y = d.getUTCFullYear();
  if (y < MIN_YEAR) return new Date(Date.UTC(MIN_YEAR, 0, 1));
  if (y > MAX_YEAR) return new Date(Date.UTC(MAX_YEAR, 11, 31));
  return d;
}

function emit() { for (const cb of _listeners) cb(_date); }

export function getDate() { return _date; }
export function isPlaying() { return _playing; }
export function play() { _playing = true; }
export function pause() { _playing = false; }
export function getTimeScale() { return _timeScale; }
export function setTimeScale(x) { _timeScale = x; }

export function setDate(date) { _date = clampDate(new Date(date.getTime())); emit(); }
export function scrubTo(date) { pause(); setDate(date); }

export function tick(dtRealMs) {
  if (!_playing) return;
  const deltaSimMs = dtRealMs * _timeScale * MS_PER_REAL_MS;
  _date = clampDate(new Date(_date.getTime() + deltaSimMs));
  emit();
}

export function onDateChange(cb) {
  _listeners.push(cb);
  return () => { const i = _listeners.indexOf(cb); if (i >= 0) _listeners.splice(i, 1); };
}
