import { test } from 'node:test';
import assert from 'node:assert/strict';
import { superscriptToSup } from './infoPanel.js';
import { escapeHtml } from './escapeHtml.js';

test('superscriptToSup: exponent → <sup> s běžnými číslicemi', () => {
  assert.equal(superscriptToSup('5,97×10²⁴ kg'), '5,97×10<sup>24</sup> kg');
  assert.equal(superscriptToSup('10⁻³'), '10<sup>-3</sup>');
  assert.equal(superscriptToSup('bez exponentu'), 'bez exponentu');
  assert.equal(superscriptToSup('SO₂, velmi řídká'), 'SO<sub>2</sub>, velmi řídká');
});

test('superscriptToSup po escapeHtml nepropustí HTML z dat', () => {
  const out = superscriptToSup(escapeHtml('<b>10²⁰</b>'));
  assert.equal(out, '&lt;b&gt;10<sup>20</sup>&lt;/b&gt;');
});
