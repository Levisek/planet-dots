import { getTimeScale, setTimeScale, onTimeScaleChange } from './simMode.js';
import { formatRelative } from './simulationDate.js';

let _timeScaleSlider = null;
let _speedLabel = null;
let _dateLabel = null;
let _reverseBtn = null;
let _container = null;

let _getSimElapsed = null;

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

/**
 * Inicializuje time controls v dolním HUD středu.
 * @param {() => number} getSimElapsed — callback pro aktuální simElapsed
 */
export function initTimeControls(getSimElapsed) {
  _getSimElapsed = getSimElapsed;
  _container = document.createElement('div');
  _container.id = 'time-controls';
  _container.innerHTML = `
    <button id="reverse-btn" title="Reverse playback (\\)">◀</button>
    <input type="range" id="speed-slider" min="0" max="100" value="50" />
    <span id="speed-label">0.5×</span>
    <span id="date-label">J2000 + 0d 00h</span>
  `;
  document.body.appendChild(_container);

  _timeScaleSlider = _container.querySelector('#speed-slider');
  _speedLabel = _container.querySelector('#speed-label');
  _dateLabel = _container.querySelector('#date-label');
  _reverseBtn = _container.querySelector('#reverse-btn');

  // Initial slider position from current timeScale
  _timeScaleSlider.value = speedToSlider(Math.abs(getTimeScale()));
  _speedLabel.textContent = `${getTimeScale().toFixed(2)}×`;

  _timeScaleSlider.addEventListener('input', () => {
    const speed = sliderToSpeed(parseFloat(_timeScaleSlider.value));
    const sign = getTimeScale() < 0 ? -1 : 1;
    setTimeScale(speed * sign);
    _speedLabel.textContent = `${(speed * sign).toFixed(2)}×`;
  });

  _reverseBtn.addEventListener('click', () => {
    setTimeScale(-getTimeScale());
    _speedLabel.textContent = `${getTimeScale().toFixed(2)}×`;
  });

  onTimeScaleChange((v) => {
    _timeScaleSlider.value = speedToSlider(Math.abs(v));
    _speedLabel.textContent = `${v.toFixed(2)}×`;
  });

  // Update date label per frame (call externally from main.js loop)
  function tickLabel() {
    const simE = _getSimElapsed ? _getSimElapsed() : 0;
    _dateLabel.textContent = `J2000 ${formatRelative(simE)}`;
    requestAnimationFrame(tickLabel);
  }
  tickLabel();
}
