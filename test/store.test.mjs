import { test } from 'node:test';
// AIDEV-NOTE: loadCore() runs PV in a separate vm realm, so JSON.parse results
// have a different Object prototype than this file's literals; deepStrictEqual
// (assert/strict's deepEqual) rejects that cross-realm structural match, so we
// use the loose `node:assert` deepEqual here instead.
import assert from 'node:assert';
import { loadCore } from './helpers.mjs';

const PV = loadCore();

class FakeLS {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, v); }
  removeItem(k) { this.map.delete(k); }
}

test('roundtrips objects under pv.-prefixed keys', () => {
  const ls = new FakeLS();
  const store = PV.createStore(ls);
  store.set('foo', { a: 1 });
  assert.ok(ls.map.has('pv.foo'));
  assert.deepEqual(store.get('foo'), { a: 1 });
});

test('null backend uses memory and still roundtrips', () => {
  const store = PV.createStore(null);
  assert.equal(store.usingMemory, true);
  store.set('bar', [1, 2, 3]);
  assert.deepEqual(store.get('bar'), [1, 2, 3]);
});

test('backend whose setItem throws falls back to memory without throwing', () => {
  const badLs = {
    getItem() { return null; },
    setItem() { throw new Error('quota exceeded'); },
    removeItem() {},
  };
  assert.doesNotThrow(() => {
    const store = PV.createStore(badLs);
    assert.equal(store.usingMemory, true);
    store.set('baz', { ok: true });
    assert.deepEqual(store.get('baz'), { ok: true });
  });
});
