import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timelineAt } from './formationTimeline.js';

test('timelineAt vrací fáze dle času', () => {
  assert.equal(timelineAt(0).label, 'Sluneční mlhovina se hroutí');
  assert.equal(timelineAt(3.99).age, 'před 4,6 mld let');
  assert.equal(timelineAt(4).label, 'Zažehnutí Slunce — hvězda T Tauri');
  assert.equal(timelineAt(6.5).label, 'Prach se slepuje do planetesimál');
  assert.equal(timelineAt(10).label, 'Planetesimály narůstají v planety');
  assert.equal(timelineAt(14).label, 'Systém se stabilizuje na dnešní dráhy');
  assert.equal(timelineAt(14).age, 'před ~4 mld let');
  assert.equal(timelineAt(22).label, 'Dnes');
  assert.equal(timelineAt(9999).label, 'Dnes');
});
