<div align="center">
  <h3>visulima bytes</h3>
  <p>
  Utility functions to make dealing with Uint8Arrays easier
  </p>
</div>

<br />

<div align="center">

[![TypeScript](https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/) [![npm](https://img.shields.io/npm/v/@visulima/bytes/latest.svg?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@visulima/bytes/v/latest) [![license](https://img.shields.io/npm/l/@visulima/bytes?color=blueviolet&style=for-the-badge)](LICENSE.md)

</div>

---

<div align="center">
    <p>
        <sup>
            Daniel Bannert's open source work is supported by the community on <a href="https://github.com/sponsors/prisis">GitHub Sponsors</a>
        </sup>
    </p>
</div>

---

## Install

```sh
npm install @visulima/bytes
```

```sh
yarn add @visulima/bytes
```

```sh
pnpm add @visulima/bytes
```

## Usage

Here's how you can use the functions from the `@visulima/bytes` package:

### `concat`

Concatenates an array of byte slices into a single slice.

```typescript
import { concat } from "@visulima/bytes";
import assert from "node:assert";

const a = new Uint8Array([0, 1, 2]);
const b = new Uint8Array([3, 4, 5]);

assert.deepStrictEqual(concat([a, b]), new Uint8Array([0, 1, 2, 3, 4, 5]));
```

### `copy`

Copies bytes from the source array to the destination array.

**Basic usage:**

```typescript
import { copy } from "@visulima/bytes";
import assert from "node:assert";

const src = new Uint8Array([9, 8, 7]);
const dst = new Uint8Array([0, 1, 2, 3, 4, 5]);

assert.deepStrictEqual(copy(src, dst), 3);
assert.deepStrictEqual(dst, new Uint8Array([9, 8, 7, 3, 4, 5]));
```

**Copy with offset:**

```typescript
import { copy } from "@visulima/bytes";
import assert from "node:assert";

const src = new Uint8Array([1, 1, 1, 1]);
const dst = new Uint8Array([0, 0, 0, 0]);

assert.deepStrictEqual(copy(src, dst, 1), 3);
assert.deepStrictEqual(dst, new Uint8Array([0, 1, 1, 1]));
```

### `endsWith`

Checks if a byte slice ends with a given suffix.

```typescript
import { endsWith } from "@visulima/bytes";
import assert from "node:assert";

const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
const suffix = new Uint8Array([1, 2, 3]);

assert.deepStrictEqual(endsWith(source, suffix), true);
```

### `equals`

Checks if two byte slices are equal.

```typescript
import { equals } from "@visulima/bytes";
import assert from "node:assert";

const a = new Uint8Array([1, 2, 3]);
const b = new Uint8Array([1, 2, 3]);
const c = new Uint8Array([4, 5, 6]);

assert.deepStrictEqual(equals(a, b), true);
assert.deepStrictEqual(equals(a, c), false);
```

### `includesNeedle`

Determines whether a byte slice contains a specific sequence of bytes.

**Basic usage:**

```typescript
import { includesNeedle } from "@visulima/bytes";
import assert from "node:assert";

const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
const needle = new Uint8Array([1, 2]);

assert.deepStrictEqual(includesNeedle(source, needle), true);
```

**With start index:**

```typescript
import { includesNeedle } from "@visulima/bytes";
import assert from "node:assert";

const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
const needle = new Uint8Array([1, 2]);

assert.deepStrictEqual(includesNeedle(source, needle, 3), true);
assert.deepStrictEqual(includesNeedle(source, needle, 6), false);
```

### `indexOfNeedle`

Finds the first index of a specific sequence of bytes within a byte slice.

**Basic usage:**

```typescript
import { indexOfNeedle } from "@visulima/bytes";
import assert from "node:assert";

const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
const needle = new Uint8Array([1, 2]);
const notNeedle = new Uint8Array([5, 0]);

assert.deepStrictEqual(indexOfNeedle(source, needle), 1);
assert.deepStrictEqual(indexOfNeedle(source, notNeedle), -1);
```

**With start index:**

```typescript
import { indexOfNeedle } from "@visulima/bytes";
import assert from "node:assert";

const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
const needle = new Uint8Array([1, 2]);

assert.deepStrictEqual(indexOfNeedle(source, needle, 2), 3);
assert.deepStrictEqual(indexOfNeedle(source, needle, 6), -1);
```

### `lastIndexOfNeedle`

Finds the last index of a specific sequence of bytes within a byte slice.

**Basic usage:**

```typescript
import { lastIndexOfNeedle } from "@visulima/bytes";
import assert from "node:assert";

const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
const needle = new Uint8Array([1, 2]);
const notNeedle = new Uint8Array([5, 0]);

assert.deepStrictEqual(lastIndexOfNeedle(source, needle), 5);
assert.deepStrictEqual(lastIndexOfNeedle(source, notNeedle), -1);
```

**With start index:**

```typescript
import { lastIndexOfNeedle } from "@visulima/bytes";
import assert from "node:assert";

const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
const needle = new Uint8Array([1, 2]);

assert.deepStrictEqual(lastIndexOfNeedle(source, needle, 2), 1);
assert.deepStrictEqual(lastIndexOfNeedle(source, needle, 6), 5);
```

### `repeat`

Repeats a byte slice a specified number of times.

**Basic usage:**

```typescript
import { repeat } from "@visulima/bytes";
import assert from "node:assert";

const source = new Uint8Array([0, 1, 2]);

assert.deepStrictEqual(repeat(source, 3), new Uint8Array([0, 1, 2, 0, 1, 2, 0, 1, 2]));
```

**Zero count:**

```typescript
import { repeat } from "@visulima/bytes";
import assert from "node:assert";

const source = new Uint8Array([0, 1, 2]);

assert.deepStrictEqual(repeat(source, 0), new Uint8Array([]));
```

### `startsWith`

Checks if a byte slice starts with a given prefix.

```typescript
import { startsWith } from "@visulima/bytes";
import assert from "node:assert";

const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
const prefix = new Uint8Array([0, 1, 2]);

assert.deepStrictEqual(startsWith(source, prefix), true);
```

## API / Features

This package provides the following utility functions for working with `Uint8Array`s, similar to the Deno standard library module [`@std/bytes`](https://github.com/denoland/std/tree/main/bytes):

- **`concat`**: Concatenate an array of byte slices into a single slice.
- **`copy`**: Copy bytes from the source array to the destination array and returns the number of bytes copied.
- **`endsWith`**: Returns true if the suffix array appears at the end of the source array, false otherwise.
- **`equals`**: Check whether byte slices are equal to each other.
- **`includesNeedle`**: Determines whether the source array contains the needle array.
- **`indexOfNeedle`**: Returns the index of the first occurrence of the needle array in the source array, or -1 if it is not present.
- **`lastIndexOfNeedle`**: Returns the index of the last occurrence of the needle array in the source array, or -1 if it is not present.
- **`repeat`**: Returns a new byte slice composed of count repetitions of the source array.
- **`startsWith`**: Returns true if the prefix array appears at the start of the source array, false otherwise.
- **`bufferToUint8Array(buf: Buffer): Uint8Array`**: Converts a Node.js `Buffer` to a `Uint8Array`.
- **`isUint8Array(x: unknown): x is Uint8Array`**: Checks if a value is a `Uint8Array` or (in Node.js) a `Buffer`.
- **`asciiToUint8Array(txt: TemplateStringsArray | string | [string]): Uint8Array`**: Converts an ASCII string to a `Uint8Array`.
- **`utf8ToUint8Array(txt: TemplateStringsArray | string | [string]): Uint8Array`**: Converts a UTF-8 string to a `Uint8Array` (requires Node.js `Buffer` support).
- **`toUint8Array(data: unknown): Uint8Array`**: Attempts to convert various data types (like `ArrayBuffer`, `Array` of numbers, `Buffer`, strings via `Buffer.from`) to a `Uint8Array`.

## Related

### `bufferToUint8Array`

Converts a Node.js `Buffer` to a `Uint8Array`.

```typescript
import { bufferToUint8Array } from "@visulima/bytes";
import { Buffer } from "buffer"; // Or from 'node:buffer'
import assert from "node:assert";

const nodeBuffer = Buffer.from("Hello");
const u8Array = bufferToUint8Array(nodeBuffer);

assert.ok(u8Array instanceof Uint8Array);
assert.deepStrictEqual(u8Array, new Uint8Array([72, 101, 108, 108, 111]));
```

### `isUint8Array`

Checks if a value is a `Uint8Array` or a Node.js `Buffer`.

```typescript
import { isUint8Array } from "@visulima/bytes";
import { Buffer } from "buffer";
import assert from "node:assert";

assert.ok(isUint8Array(new Uint8Array([1, 2])));
assert.ok(isUint8Array(Buffer.from("test")));
assert.ok(!isUint8Array("not a Uint8Array"));
assert.ok(!isUint8Array([1, 2])); // Plain array is not
```

### `asciiToUint8Array`

Converts an ASCII string to a `Uint8Array`.

```typescript
import { asciiToUint8Array } from "@visulima/bytes";
import assert from "node:assert";

const asciiArray = asciiToUint8Array("Hello!");
assert.deepStrictEqual(asciiArray, new Uint8Array([72, 101, 108, 108, 111, 33]));

const templateAscii = asciiToUint8Array`World`;
assert.deepStrictEqual(templateAscii, new Uint8Array([87, 111, 114, 108, 100]));
```

### `utf8ToUint8Array`

Converts a UTF-8 string to a `Uint8Array`.

````typescript
import { utf8ToUint8Array } from "@visulima/bytes";
import assert from "node:assert";

const utf8Array = utf8ToUint8Array("你好"); // "Hello" in Chinese
assert.deepStrictEqual(utf8Array, new Uint8Array([228, 189, 160, 229, 165, 189]));

const templateUtf8 = utf8ToUint8Array`🌍`; // Globe emoji
assert.deepStrictEqual(templateUtf8, new Uint8Array([240, 159, 140, 141]));

Attempts to convert various data types to a `Uint8Array`.

```typescript
import { toUint8Array } from "@visulima/bytes";
import { Buffer } from "buffer";
import assert from "node:assert";

// From Uint8Array
const u8 = new Uint8Array([1, 2, 3]);
assert.deepStrictEqual(toUint8Array(u8), u8);

// From ArrayBuffer
const buffer = new ArrayBuffer(3);
const view = new Uint8Array(buffer);
view[0] = 1; view[1] = 2; view[2] = 3;
assert.deepStrictEqual(toUint8Array(buffer), new Uint8Array([1, 2, 3]));

// From Array of numbers
assert.deepStrictEqual(toUint8Array([4, 5, 6]), new Uint8Array([4, 5, 6]));

// From Node.js Buffer
const nodeBuf = Buffer.from("Node");
assert.deepStrictEqual(toUint8Array(nodeBuf), new Uint8Array([78, 111, 100, 101]));

// From string (via Buffer.from in Node.js)
assert.deepStrictEqual(toUint8Array("String"), new Uint8Array([83, 116, 114, 105, 110, 103]));

try {
  toUint8Array(123); // Not convertible
} catch (e: any) {
  assert.strictEqual(e.message, "UINT8ARRAY_INCOMPATIBLE: Cannot convert data to Uint8Array");
}
````

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).
Here's [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- The Deno Standard Library authors and contributors for their work on `@std/bytes`.
- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima bytes is open-sourced software licensed under the [MIT](LICENSE.md)

