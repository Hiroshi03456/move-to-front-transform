# Move To Front Transform

Reversibly map a sequence of symbols to a sequence of indices by moving each emitted symbol to the front of a reference table. Repeated neighbouring symbols become small indices, which is what makes MTF a useful pre-pass before entropy coding.

```js
import { encodeArray, decodeArray, alphabetOf } from './src/index.js';

const symbols = ['b', 'a', 'n', 'a', 'n', 'a'];
const indices = encodeArray(symbols);   // Int32Array [0, 1, 2, 1, 1, 1]
const back = decodeArray(indices, alphabetOf(symbols));
// back === symbols
```

There are also `encodeString(text)` / `decodeString(indices, alphabet)` convenience wrappers that treat a string as a sequence of UTF-16 code units and use code-unit numbers as symbols.

## Why this exists

MTF is a standard building block in compression pipelines (it sits between the Burrows–Wheeler Transform and an entropy coder in `bzip2`). The trade-off here is simplicity over speed: the reference table is rebuilt from scratch on every call, and `splice`/`unshift` are used for the move-to-front step. That is fine for the small alphabets where MTF is actually useful and keeps the code easy to audit. The alphabet is **not** transmitted by the transform — callers must track it themselves and pass it back to `decodeArray` / `decodeString`.

## The awkward edge

Symbols are compared with `===`. For the array API this means two objects with identical contents are **different symbols** unless they are the same object reference. For the string API the unit is the UTF-16 code unit, so a code point outside the BMP (e.g. `𝄞`) is two symbols — two surrogate code units. Both behaviours are deliberate and are covered by the test suite.

## Exports

- `encodeArray(symbols)` → `Int32Array` of indices.
- `decodeArray(indices, alphabet)` → array of symbols.
- `encodeString(text)` → `Int32Array` of indices over UTF-16 code units.
- `decodeString(indices, alphabet)` → string.
- `alphabetOf(symbols)` → the first-seen-order alphabet `encodeArray` assumes.
