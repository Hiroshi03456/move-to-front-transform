/**
 * Move To Front Transform.
 *
 * The MTF transform encodes a sequence of symbols (any array of values
 * where each value can be compared by strict equality, plus strings for the
 * convenience entry points) into a sequence of zero-based indices, and
 * decodes the indices back to the original symbols. At each step the most
 * recently emitted symbol is moved to the front of a reference table, so
 * frequently repeated neighbouring symbols produce small indices.
 *
 * The encoder and decoder are stateless functions: the symbol table is
 * rebuilt from scratch on every call so the result depends only on the
 * input. This keeps round-tripping simple and avoids the classes of bugs
 * that come from reusing tables across calls.
 */

/**
 * Build the initial reference table for a sequence of symbols.
 *
 * The table is the set of distinct symbols in their first-seen order.
 * First-seen order (rather than, say, sorted order) is used because it is
 * the order the decoder will reconstruct as it processes the indices: both
 * sides must agree on an order, and first-seen is the one that needs no
 * separate, out-of-band table definition.
 *
 * Equality is strict (===). The symbols must therefore be primitives, or
 * objects that share identity between encode and decode. The string and
 * array entry points pass primitive character code units / array elements,
 * so this caveat only matters to callers who build the symbol table
 * themselves.
 */
function buildTable(symbols) {
  const seen = new Set();
  const table = [];
  for (const s of symbols) {
    if (!seen.has(s)) {
      seen.add(s);
      table.push(s);
    }
  }
  return table;
}

/**
 * Encode an array of symbols into MTF indices.
 *
 * Returns a fresh Int32Array of indices, one per input symbol. The choice
 * of Int32Array (rather than a plain Array) is deliberate: MTF indices are
 * bounded by the alphabet size, which fits comfortably in int32, and a
 * typed array carries that fact in its type.
 */
export function encodeArray(symbols) {
  const table = buildTable(symbols);
  const out = new Int32Array(symbols.length);
  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i];
    let idx = table.indexOf(sym);
    if (idx === -1) {
      // Cannot happen: buildTable guarantees every input symbol is present.
      throw new Error(`mtf: symbol missing from table: ${String(sym)}`);
    }
    out[i] = idx;
    if (idx !== 0) {
      // Move-to-front: splice out and unshift. Splice is O(n) in the table
      // size, which is fine because MTF is only useful for small alphabets.
      table.splice(idx, 1);
      table.unshift(sym);
    }
  }
  return out;
}

/**
 * Decode MTF indices back into symbols given the original alphabet order.
 *
 * The alphabet MUST be exactly the distinct symbols of the original input in
 * first-seen order. It is the caller's responsibility to supply it; the
 * transform does not transmit the alphabet. This mirrors how MTF is used in
 * real compression pipelines (the alphabet is known from context, e.g. the
 * BWT output alphabet) and keeps the library honest about its own scope.
 */
export function decodeArray(indices, alphabet) {
  const table = alphabet.slice();
  const out = new Array(indices.length);
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    if (idx < 0 || idx >= table.length) {
      throw new RangeError(`mtf: index ${idx} out of bounds for alphabet of size ${table.length}`);
    }
    const sym = table[idx];
    out[i] = sym;
    if (idx !== 0) {
      table.splice(idx, 1);
      table.unshift(sym);
    }
  }
  return out;
}

/**
 * Convenience: encode a string to MTF indices over its UTF-16 code units.
 *
 * Operating on UTF-16 code units (rather than code points or grapheme
 * clusters) is a deliberate simplification: it keeps the symbol set finite
 * and small (at most 0x110000 entries, and in practice tiny), and matches
 * how JS strings are indexed. Callers who need code-point semantics should
 * split the string themselves and call encodeArray.
 */
export function encodeString(text) {
  const symbols = [];
  for (let i = 0; i < text.length; i++) {
    symbols.push(text.charCodeAt(i));
  }
  return encodeArray(symbols);
}

/**
 * Convenience: decode MTF indices (over UTF-16 code units) back to a string.
 *
 * The alphabet here is the array of code-unit values that appeared in the
 * original string, in first-seen order. It is the thing encodeString would
 * have fed to buildTable; the caller is responsible for tracking it.
 */
export function decodeString(indices, alphabet) {
  const symbols = decodeArray(indices, alphabet);
  let s = '';
  for (let i = 0; i < symbols.length; i++) {
    const c = symbols[i];
    // Alphabet values come from charCodeAt, so they are ints in [0, 0x10FFFF].
    // fromCodePoint handles all of them; the surrogate range is covered by
    // the code-unit path above, so no separate surrogate handling is needed.
    s += String.fromCodePoint(c);
  }
  return s;
}

/**
 * Derive the first-seen alphabet for a sequence of symbols.
 *
 * Exported so that callers who use encodeArray/decodeArray directly can
 * obtain the exact alphabet the encoder assumed, without having to
 * reimplement buildTable's first-seen ordering.
 */
export function alphabetOf(symbols) {
  return buildTable(symbols);
}
