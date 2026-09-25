import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './helpers.mjs';

const PV = loadCore();

test('500 generated codes are valid 4-char codes from the safe alphabet', () => {
  for (let i = 0; i < 500; i++) {
    const code = PV.roomCode();
    assert.equal(code.length, 4);
    assert.ok([...code].every(c => PV.CODE_ALPHABET.includes(c)));
    assert.equal(PV.isValidCode(code), true);
  }
});

test('normalizeCode uppercases and strips non-alnum', () => {
  assert.equal(PV.normalizeCode('ab cd'), 'ABCD');
});

test('isValidCode rejects codes with disallowed characters', () => {
  assert.equal(PV.isValidCode('AB0D'), false);
});
