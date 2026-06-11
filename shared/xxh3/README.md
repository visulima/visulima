# @shared/xxh3

> Private, monorepo-internal pure-BigInt **xxh3-128** implementation. Not published.

This module is the JavaScript fallback for the task-runner native Rust hasher
(`packages/tooling/task-runner`). Its entire reason to exist is **bit-exact
parity**: a given input must produce the same 128-bit hash whether it is hashed
by the native addon or by this code, because task-runner derives cache keys from
these hashes and may run in either mode.

## API

```ts
import { createXxh3Hasher, xxh3Hash } from "@shared/xxh3";

// One-shot. Accepts a string (UTF-8) or a Buffer.
xxh3Hash("hello world"); // "df8d09e93f874900a99b8775cc15b6c7"
xxh3Hash(Buffer.from([0x80])); // "39f23593542c7e2b6b148c0872500941"

// Optional 64-bit seed (BigInt). Defaults to 0n.
xxh3Hash("hello world", 42n);

// Incremental. Chunks are buffered and hashed at digest() time.
const hasher = createXxh3Hasher(); // optional seed: createXxh3Hasher(42n)

hasher.update("hello").update(" ").update("world");
hasher.digest(); // same as xxh3Hash("hello world")
```

Output is always a 32-character lowercase hex string, big-endian, matching the
Rust `hex::encode(h.to_be_bytes())` format.

### `xxh3Hash(data, seed?)`

- `data: string | Buffer` — strings are UTF-8 encoded (mirrors the native
  `hashString`).
- `seed?: bigint` — defaults to `0n`.

### `createXxh3Hasher(seed?)` / `Xxh3Hasher`

- `update(data: string | Buffer): this` — appends a chunk. Chainable.
- `digest(): string` — hashes everything fed so far. **Non-terminal**: unlike
  `node:crypto` hashers, the instance stays usable — calling `update()` then
  `digest()` again produces a digest over all chunks (old and new).
- `reset(seed?: bigint): this` — clears accumulated chunks (and optionally sets a
  new seed) so the hasher can be reused from scratch. Chainable.

> xxh3 does not support true streaming; the incremental hasher buffers chunks and
> hashes the concatenation. Memory grows with total input size.

## Parity contract with the native addon

- With `seed = 0n` (the default) every length class — empty, 1–3, 4–8, 9–16,
  17–128, 129–240, and > 240 bytes — is **bit-exact** with
  `task-runner-native.*.node` (`hashString` / `hashFile`). This is enforced by
  the known-answer vectors in `__tests__/xxh3.test.ts` and, when a native binding
  is present locally, by a direct parity test.
- The native addon does **not** expose seeded hashing, so seeded output cannot be
  cross-checked against it. Seeded long inputs (> 240 bytes) derive a per-seed
  custom secret (`XXH3_initCustomSecret`), so the seed affects every length
  class; seeded vectors in the tests are self-referential (lock-in) only.

## Provenance

The core algorithm is vendored from
[`xxh3-ts` v2.0.1](https://github.com/i404788/xxh3-ts) (BSD-2-Clause) and
converted to TypeScript, using TC39 `BigInt` for 128-bit arithmetic.

### Regenerating / verifying test vectors

The known-answer vectors were produced from the native binding. To regenerate
them (requires a built `task-runner-native.*.node` for your platform):

```bash
node --input-type=module -e '
  import { createRequire } from "node:module";
  import { writeFileSync, mkdtempSync } from "node:fs";
  import { tmpdir } from "node:os";
  import { join } from "node:path";
  const require = createRequire(import.meta.url);
  const native = require("./packages/tooling/task-runner/task-runner-native.<platform>.node");
  const dir = mkdtempSync(join(tmpdir(), "xxh3-"));
  const bytes = [/* ... */];
  const f = join(dir, "v");
  writeFileSync(f, Buffer.from(bytes));
  console.log(native.hashFile(f));        // raw bytes
  console.log(native.hashString("é"));    // UTF-8 string
'
```

`hashFile` hashes raw bytes (use this for inputs with bytes ≥ 0x80);
`hashString` hashes the UTF-8 encoding of a string.
