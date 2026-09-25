import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './helpers.mjs';

const PV = loadCore();

function words(n) {
  return Array.from({ length: n }, (_, i) => ({ text: 'word' + i, count: n - i }));
}

function overlaps(a, b) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

test('same input+seed produces deterministic layout', () => {
  const w = words(20);
  const a = PV.layoutWordCloud(w, 720, 400, 42);
  const b = PV.layoutWordCloud(w, 720, 400, 42);
  assert.deepEqual(a, b);
});

test('different seed produces a different placement', () => {
  const w = words(20);
  const a = PV.layoutWordCloud(w, 720, 400, 1);
  const b = PV.layoutWordCloud(w, 720, 400, 2);
  const differs = a.some((p, i) => !b[i] || p.x !== b[i].x || p.y !== b[i].y);
  assert.ok(differs);
});

test('no two placed rectangles overlap', () => {
  const layout = PV.layoutWordCloud(words(40), 720, 400, 7);
  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      assert.ok(!overlaps(layout[i], layout[j]), `rects ${i} and ${j} overlap`);
    }
  }
});

test('50 distinct words in 720x400 place at least 40', () => {
  const layout = PV.layoutWordCloud(words(50), 720, 400, 99);
  assert.ok(layout.length >= 40, `only placed ${layout.length}`);
});

test('svgCloud output is deterministic and contains <svg', () => {
  const w = words(15);
  const a = PV.svgCloud(w, 720, 400, 5);
  const b = PV.svgCloud(w, 720, 400, 5);
  assert.equal(a, b);
  assert.ok(a.includes('<svg'));
});
