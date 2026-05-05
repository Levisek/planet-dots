import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODY_DATA } from './bodyData.js';
import { PLANETS } from './planets.js';
import { MOONS } from './moons.js';

test('BODY_DATA obsahuje záznam pro každou planetu', () => {
  for (const p of PLANETS) {
    assert.ok(BODY_DATA[p.id], `Chybí bodyData pro ${p.id}`);
  }
});

test('BODY_DATA obsahuje záznam pro každý měsíc', () => {
  for (const m of MOONS) {
    assert.ok(BODY_DATA[m.id], `Chybí bodyData pro ${m.id}`);
  }
});

test('každý záznam má povinná pole', () => {
  const required = ['name', 'kind', 'tagline', 'fields', 'funFact'];
  for (const [id, data] of Object.entries(BODY_DATA)) {
    for (const key of required) {
      assert.ok(key in data, `${id} postrádá pole ${key}`);
    }
    assert.ok(data.tagline.length > 0, `${id} tagline je prázdný`);
    assert.ok(data.funFact.length > 0, `${id} funFact je prázdný`);
    assert.ok(['sun', 'planet', 'moon'].includes(data.kind), `${id} kind = ${data.kind}`);
    assert.ok(Array.isArray(data.fields) && data.fields.length >= 6, `${id} fields musí být pole s ≥6 řádky`);
    for (const row of data.fields) {
      assert.equal(typeof row.label, 'string');
      assert.equal(typeof row.value, 'string');
    }
  }
});

test('český text obsahuje diakritiku u alespoň 5 záznamů', () => {
  const hasDiacritics = (s) => /[áčďéěíňóřšťúůýž]/i.test(s);
  let count = 0;
  for (const d of Object.values(BODY_DATA)) {
    if (hasDiacritics(d.tagline) || hasDiacritics(d.funFact)) count++;
  }
  assert.ok(count >= 5, `diakritika nalezena jen u ${count} záznamů`);
});

test('všechny planety mají category=planet', () => {
  for (const p of PLANETS) {
    if (p.id === 'sun') continue;
    assert.equal(p.category, 'planet', `Planeta ${p.id} chybí category=planet`);
  }
});

test('všechny planety mají inclinationDeg', () => {
  for (const p of PLANETS) {
    if (p.id === 'sun') continue;
    assert.ok(typeof p.inclinationDeg === 'number',
      `Planeta ${p.id} chybí inclinationDeg`);
    assert.ok(p.inclinationDeg >= 0 && p.inclinationDeg < 180);
  }
});

test('všechny planety mají e a eReal', () => {
  for (const p of PLANETS) {
    if (p.id === 'sun') continue;
    assert.ok(typeof p.e === 'number', `Planeta ${p.id} chybí e`);
    assert.ok(typeof p.eReal === 'number', `Planeta ${p.id} chybí eReal`);
    assert.ok(p.e <= 0.08, `Planeta ${p.id} e > 0.08 (Pochopení clamp)`);
  }
});

test('všechny moony mají category', () => {
  for (const m of MOONS) {
    assert.ok(['moon', 'irregular'].includes(m.category),
      `Moon ${m.id} má neplatnou category: ${m.category}`);
  }
});

test('všechny moony mají inclinationDeg', () => {
  for (const m of MOONS) {
    assert.ok(typeof m.inclinationDeg === 'number',
      `Moon ${m.id} chybí inclinationDeg`);
  }
});

test('žádný moon nemá retrograde flag (zrušeno v V4.3)', () => {
  for (const m of MOONS) {
    assert.equal(m.retrograde, undefined,
      `Moon ${m.id} má zastaralý retrograde flag`);
  }
});

test('Hyperion existuje v MOONS', () => {
  const hyperion = MOONS.find(m => m.id === 'hyperion');
  assert.ok(hyperion, 'Hyperion missing');
  assert.equal(hyperion.parent, 'saturn');
  assert.equal(hyperion.category, 'irregular');
  assert.equal(hyperion.chaoticRotation, true);
});
