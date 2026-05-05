import { makeSeededSimplex } from './displacement.js';

const noise = makeSeededSimplex('hyperion-chaos');

const _state = {
  omega: [0.13, 0.21, 0.07],
  theta: [0, 0, 0],
  lastSimT: null,
};

export function resetHyperion() {
  _state.omega = [0.13, 0.21, 0.07];
  _state.theta = [0, 0, 0];
  _state.lastSimT = null;
}

export function tickHyperion(simElapsed, mesh) {
  if (_state.lastSimT === null) {
    _state.lastSimT = simElapsed;
    mesh.rotation.set(_state.theta[0], _state.theta[1], _state.theta[2]);
    return;
  }
  const dt = simElapsed - _state.lastSimT;
  if (dt < 0) return; // freeze on reverse playback
  _state.lastSimT = simElapsed;

  for (let i = 0; i < 3; i++) {
    const modulation = noise(simElapsed * 0.3, i, 0) * 0.05;
    _state.omega[i] += modulation * dt;
    _state.theta[i] += _state.omega[i] * dt;
  }
  mesh.rotation.set(_state.theta[0], _state.theta[1], _state.theta[2]);
}
