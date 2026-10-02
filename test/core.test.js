import { test } from 'node:test';
import assert from 'node:assert/strict';

import { encodeArray, decodeArray, encodeString, decodeString, alphabetOf } from '../src/index.js';

// Round-tripping a sequence with heavy local repetition should yield small
// indices — the whole point of MTF. We assert the exact indices because the
// transform is deterministic and this is the behaviour we actually provide.
test('encodeArray maps repeated neighbours to 0', () => {
  const symbols = ['a', 'a', 'a', 'b', 'b', 'a'];
  // ['a','a','a','b','b','a']
  //  a -> table [a]      idx 0
  //  a -> table [a]      idx 0
  //  a -> table [a]      idx 0
  //  b -> table [a,b]    idx 1; table becomes [b,a]
  //  b -> table [b,a]    idx 0
  //  a -> table [b,a]    idx 1; table becomes [a,b]
  const indices = encodeArray(symbols);
  assert.deepEqual(Array.from(indices), [0, 0, 0, 1, 0, 1]);
});

test('decodeArray inverts encodeArray on mixed symbols', () => {
  const symbols = ['b', 'a', 'n', 'a', 'n', 'a'];
  const indices = encodeArray(symbols);
  const alphabet = alphabetOf(symbols);
  const decoded = decodeArray(indices, alphabet);
  assert.deepEqual(decoded, symbols);
});

test('encodeArray returns Int32Array', () => {
  const indices = encodeArray(['x', 'y']);
  assert.ok(indices instanceof Int32Array, 'expected Int32Array');
});

test('encodeArray on empty input returns empty Int32Array', () => {
  const indices = encodeArray([]);
  assert.equal(indices.length, 0);
  assert.ok(indices instanceof Int32Array);
});

test('decodeArray on empty input returns empty array', () => {
  const out = decodeArray(new Int32Array(0), []);
  assert.deepEqual(out, []);
});

test('alphabetOf returns first-seen order with no duplicates', () => {
  assert.deepEqual(alphabetOf(['b', 'a', 'b', 'a', 'c']), ['b', 'a', 'c']);
});

test('alphabetOf on empty input returns empty array', () => {
  assert.deepEqual(alphabetOf([]), []);
});

// A single-symbol alphabet is a useful degenerate case: every index is 0 and
// the move-to-front is a no-op.
test('single-symbol input yields all-zero indices', () => {
  const indices = encodeArray(['z', 'z', 'z']);
  assert.deepEqual(Array.from(indices), [0, 0, 0]);
});

test('decodeArray with single-symbol alphabet reproduces input', () => {
  const symbols = ['z', 'z', 'z'];
  const indices = encodeArray(symbols);
  const decoded = decodeArray(indices, alphabetOf(symbols));
  assert.deepEqual(decoded, symbols);
});

// Symbols are compared by strict equality, so distinct object identities are
// distinct symbols even if they look alike. This documents the contract.
test('distinct objects with same content are distinct symbols', () => {
  const o1 = { k: 1 };
  const o2 = { k: 1 };
  const symbols = [o1, o2, o1];
  // table starts [o1, o2]; o1 -> 0; o2 -> 1 (table [o2,o1]); o1 -> 1.
  const indices = encodeArray(symbols);
  assert.deepEqual(Array.from(indices), [0, 1, 1]);
  const decoded = decodeArray(indices, alphabetOf(symbols));
  assert.deepEqual(decoded, symbols);
});

// Numbers vs strings that stringify the same are NOT equal under ===, so the
// transform treats them as distinct. This is a deliberate consequence of the
// equality model and is worth pinning down.
test('1 and "1" are distinct symbols', () => {
  const symbols = [1, '1', 1];
  const indices = encodeArray(symbols);
  // table starts [1, '1']; 1 -> 0; '1' -> 1 (table ['1',1]); 1 -> 1.
  assert.deepEqual(Array.from(indices), [0, 1, 1]);
});

// Decoder must reject indices that fall outside the alphabet. This is the
// one defensive check decodeArray performs, so it gets a test.
test('decodeArray throws RangeError on out-of-bounds index', () => {
  assert.throws(
    () => decodeArray(new Int32Array([0, 5]), ['a', 'b']),
    /out of bounds/,
  );
});

test('decodeArray throws RangeError on negative index', () => {
  assert.throws(
    () => decodeArray(new Int32Array([-1]), ['a']),
    /out of bounds/,
  );
});

// String round-trip. The alphabet here is code-unit values in first-seen
// order, which encodeString/decodeString both use.
test('encodeString / decodeString round-trip an ASCII string', () => {
  const text = 'banana';
  const indices = encodeString(text);
  // Build the code-unit alphabet the same way encodeString does.
  const codeUnits = [];
  for (let i = 0; i < text.length; i++) codeUnits.push(text.charCodeAt(i));
  const rebuilt = decodeString(indices, alphabetOf(codeUnits));
  assert.equal(rebuilt, text);
});

test('encodeString produces 0 for runs in a string', () => {
  const indices = encodeString('aaabb');
  // a->0, a->0, a->0, b->1 (table [b,a]), b->0.
  assert.deepEqual(Array.from(indices), [0, 0, 0, 1, 0]);
});

test('encodeString on empty string returns empty Int32Array', () => {
  const indices = encodeString('');
  assert.equal(indices.length, 0);
  assert.ok(indices instanceof Int32Array);
});

// Surrogates: a code point outside the BMP is two UTF-16 code units, both in
// the surrogate range. encodeString operates per code unit, so the alphabet
// contains those two surrogate values and the round trip holds. This is the
// edge the README warns about.
test('encodeString round-trips a surrogate pair by code unit', () => {
  const text = '𝄞'; // U+1D11E, two code units: 0xD834, 0xDD1E
  const indices = encodeString(text);
  assert.equal(indices.length, 2);
  const codeUnits = [text.charCodeAt(0), text.charCodeAt(1)];
  const rebuilt = decodeString(indices, alphabetOf(codeUnits));
  assert.equal(rebuilt, text);
});
