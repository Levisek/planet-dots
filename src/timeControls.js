import { getDate, scrubTo, isPlaying, play, pause, getTimeScale, setTimeScale, onDateChange, MIN_YEAR, MAX_YEAR } from './simClock.js';
import { formatCalendar } from './simulationDate.js';
import { DATE_PRESETS } from './datePresets.js';

let _timeScaleSlider = null;
let _speedLabel = null;
let _dateLabel = null;
let _reverseBtn = null;
let _playPauseBtn = null;
let _datePicker = null;
let _presetSelect = null;
let _rangeNote = null;
let _container = null;

let _lastTimeScale = null;
let _formationLocked = false;

// Piecewise log mapping: slider 0..100 → speed 0.1..5.0
// pos=0..50 → 0.1..1.0, pos=50..100 → 1.0..5.0
// pos=50 → speed=1.0 (per spec)
function sliderToSpeed(pos) {
  if (pos <= 50) {
    const t = pos / 50;
    return 0.1 * Math.pow(10, t);  // 0.1 → 1.0
  } else {
    const t = (pos - 50) / 50;
    return Math.pow(5, t);  // 1.0 → 5.0
  }
}

function speedToSlider(speed) {
  if (speed <= 1.0) {
    // Inverse of 0.1 * 10^t, t = pos/50
    return 50 * Math.log10(speed / 0.1);
  } else {
    // Inverse of 5^t, t = (pos-50)/50
    return 50 + 50 * Math.log(speed) / Math.log(5);
  }
}

// ISO YYYY-MM-DD z UTC složek data — pro <input type="date"> (nerozumí BCE).
function isoDateFromDate(date) {
  const y = String(date.getUTCFullYear()).padStart(4, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function updatePlayPauseIcon() {
  _playPauseBtn.textContent = isPlaying() ? '⏸' : '▶';
}

// Datum label + picker + rozsahová poznámka — aktualizováno reaktivně z
// onDateChange (ne per-frame RAF, viz task-5 brief).
function updateDateUI(date) {
  _dateLabel.textContent = formatCalendar(date);

  const y = date.getUTCFullYear();
  // Picker je otevřený nativní popup (má focus) → nepřepisovat .value/.disabled
  // pod uživatelem při každém frame přehrávání, jinak to popup rozhodí. Label
  // pod ním se ale aktualizuje dál.
  const pickerFocused = document.activeElement === _datePicker;
  // Formation lock má přednost před BCE-range logikou — dokud běží formace,
  // picker zůstává disabled bez ohledu na rok (setFormationLock volá tuto
  // funkci znovu při unlocku, aby BCE-range logika převzala vládu zpět).
  if (_formationLocked) {
    if (!pickerFocused) _datePicker.disabled = true;
  } else if (y < 1 || y > 9999) {
    // <input type="date"> neumí BCE ani roky >9999 → mimo tento rozsah picker
    // disable, uživatel se spoléhá na label + presety.
    if (!pickerFocused) {
      _datePicker.value = '';
      _datePicker.disabled = true;
    }
  } else {
    if (!pickerFocused) {
      _datePicker.disabled = false;
      _datePicker.value = isoDateFromDate(date);
    }
  }

  if (y <= MIN_YEAR || y >= MAX_YEAR) {
    _rangeNote.textContent = 'rozsah modelu VSOP87';
  } else {
    _rangeNote.textContent = '';
  }
}

// Rychlostní slider/label nemá v simClock event ekvivalent onTimeScaleChange
// (klávesy [ ] \ 0 mění timeScale přímo, bez notifikace). Lehký polling v
// RAF udrží UI konzistentní bez ohledu na to, odkud změna přišla — jednodušší
// než přidávat listener API do simClock jen pro tohle. Datum label/picker
// naproti tomu je reaktivní (onDateChange), protože pro něj event existuje.
function tickSpeedUI() {
  const v = getTimeScale();
  if (v !== _lastTimeScale) {
    _lastTimeScale = v;
    _timeScaleSlider.value = speedToSlider(Math.abs(v));
    _speedLabel.textContent = `${v.toFixed(2)}×`;
  }
  updatePlayPauseIcon();
  requestAnimationFrame(tickSpeedUI);
}

/**
 * Inicializuje time controls v dolním HUD středu. Čte/píše výhradně simClock
 * (V4.4 F2 — jediná autorita simulačního data a timeScale).
 */
export function initTimeControls() {
  _container = document.createElement('div');
  _container.id = 'time-controls';
  _container.innerHTML = `
    <button id="play-pause-btn" title="Přehrát/pauza (mezerník)">⏸</button>
    <button id="reverse-btn" title="Reverse playback (\\)">◀</button>
    <input type="range" id="speed-slider" min="0" max="100" value="50" />
    <span id="speed-label">0.5×</span>
    <input type="date" id="date-picker" />
    <span id="date-label">1. 1. 2000</span>
    <select id="preset-select" title="Edu presety">
      <option value="">— přejít na událost —</option>
    </select>
    <span id="date-range-note"></span>
  `;
  document.body.appendChild(_container);

  _playPauseBtn = _container.querySelector('#play-pause-btn');
  _reverseBtn = _container.querySelector('#reverse-btn');
  _timeScaleSlider = _container.querySelector('#speed-slider');
  _speedLabel = _container.querySelector('#speed-label');
  _datePicker = _container.querySelector('#date-picker');
  _dateLabel = _container.querySelector('#date-label');
  _presetSelect = _container.querySelector('#preset-select');
  _rangeNote = _container.querySelector('#date-range-note');

  for (const preset of DATE_PRESETS) {
    const opt = document.createElement('option');
    opt.value = preset.id;
    opt.textContent = preset.label;
    _presetSelect.appendChild(opt);
  }

  // Initial stav
  _lastTimeScale = getTimeScale();
  _timeScaleSlider.value = speedToSlider(Math.abs(_lastTimeScale));
  _speedLabel.textContent = `${_lastTimeScale.toFixed(2)}×`;
  updatePlayPauseIcon();
  updateDateUI(getDate());

  _timeScaleSlider.addEventListener('input', () => {
    const speed = sliderToSpeed(parseFloat(_timeScaleSlider.value));
    const sign = getTimeScale() < 0 ? -1 : 1;
    setTimeScale(speed * sign);
  });

  _reverseBtn.addEventListener('click', () => {
    setTimeScale(-getTimeScale());
  });

  _playPauseBtn.addEventListener('click', () => {
    if (isPlaying()) pause(); else play();
    updatePlayPauseIcon();
  });

  _datePicker.addEventListener('change', () => {
    if (!_datePicker.value) return;
    scrubTo(new Date(`${_datePicker.value}T00:00:00Z`));
    _presetSelect.value = '';
  });

  _presetSelect.addEventListener('change', () => {
    const preset = DATE_PRESETS.find((p) => p.id === _presetSelect.value);
    if (!preset) return;
    scrubTo(preset.date);
  });

  onDateChange((date) => {
    updateDateUI(date);
    updatePlayPauseIcon();
  });

  tickSpeedUI();
}

/**
 * Zamkne/odemkne časové ovládání během formace (V4.4 F3) — date picker,
 * preset select, play/pause, speed slider, reverse btn jdou disabled a
 * kontejner dostane .formation-locked (opacity 0.4, viz index.html).
 * Datum label i geologický popisek (main.js #formation-label) zůstávají
 * viditelné/aktivní — lock je jen na ovládání, ne na čtení.
 */
export function setFormationLock(locked) {
  _formationLocked = locked;
  for (const el of [_datePicker, _presetSelect, _playPauseBtn, _timeScaleSlider, _reverseBtn]) {
    if (el) el.disabled = locked;
  }
  if (_container) _container.classList.toggle('formation-locked', locked);
  // Po unlocku musí BCE-range logika v updateDateUI zase převzít vládu nad
  // picker.disabled (viz komentář tamtéž) — blanket disable výše by jinak
  // zůstal poslední slovo i pro nesmyslné kombinace.
  if (!locked) updateDateUI(getDate());
}
