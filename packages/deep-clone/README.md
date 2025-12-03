<div align="center">
  <h3>Visulima Deep Clone</h3>
  <p>
  Really Fast Deep Clone.
  </p>
</div>



<div align="center">

[![TypeScript](https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/) [![npm](https://img.shields.io/npm/v/@visulima/deep-clone/latest.svg?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@visulima/deep-clone/v/latest) [![license](https://img.shields.io/npm/l/@visulima/deep-clone?color=blueviolet&style=for-the-badge)](https://github.com/visulima/visulima/blob/main/packages/deep-clone/LICENSE.md)

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
npm install @visulima/deep-clone
```

```sh
yarn add @visulima/deep-clone
```

```sh
pnpm add @visulima/deep-clone
```

## Usage

Copy or deep clone an input value to an arbitrary depth. The function accepts both objects and primitives.

```typescript
import deepClone from "@visulima/deep-clone";

const cloned = deepClone({ a: 1, b: { c: 2 } });

console.log(cloned); // => {a: 1, b: {c: 2}}
```

## API

### deepClone(input, options?)

#### input

Type: `any`

The input value to copy.

#### options

Type: `object`

##### strict

Type: `boolean`<br>

Default: `false`

If `true`, it will copy all properties, including non-enumerable ones and symbols.

##### handlers

Type: `object`

A set of custom handlers for specific type of value. Each handler is a function that takes the original value and returns a new value or throws an error if the value is not supported.

- Array: InternalHandler<unknown[]>;
- ArrayBuffer: InternalHandler<ArrayBuffer>;
- Blob: InternalHandler<Blob>;
- DataView: InternalHandler<DataView>;
- Date: InternalHandler<Date>;
- Error: InternalHandler<Error>;
- Float32Array: InternalHandler<Float32Array>;
- Float64Array: InternalHandler<Float64Array>;
- Int8Array: InternalHandler<Int8Array>;
- Int16Array: InternalHandler<Int16Array>;
- Int32Array: InternalHandler<Int32Array>;
- Map: InternalHandler<Map<unknown, unknown>>;
- Object: InternalHandler<Record<string, unknown>>;
- Promise: InternalHandler<Promise<unknown>>;
- RegExp: InternalHandler<RegExp>;
- Set: InternalHandler<Set<unknown>>;
- WeakMap: InternalHandler<WeakMap<any, unknown>>;
- WeakSet: InternalHandler<WeakSet<any>>;

## Utils

### copyOwnProperties(input)

Copy all properties contained on the object.

```typescript
import { copyOwnProperties } from "@visulima/deep-clone/utils";

const obj = { a: 1, b: 2 };

const copy = copyOwnProperties(obj);

console.log(copy); // => {a: 1, b: 2}
```

### getCleanClone(input)

Get an empty version of the object with the same prototype it has.

```typescript
import { getCleanClone } from "@visulima/deep-clone/utils";

const obj = { a: 1, b: 2 };

const clean = getCleanClone(obj);

console.log(clean); // => {}
```

## Notes

- List of **supported** values/types:
    - `undefined` (original value is returned)
    - `null` (original value is returned)
    - `boolean`/`Boolean` (original value is returned)
    - `string`/`String` (original value is returned)
    - `number`/`Number` (original value is returned)
    - `function`
    - `Object`
    - `Date`
    - `RegExp`
    - `Set`
    - `Map`
    - [`Error`][mdn-error]
    - [`URIError`][mdn-uri-error]
    - [`ReferenceError`][mdn-reference-error]
    - [`SyntaxError`][mdn-syntax-error]
    - [`RangeError`][mdn-range-error]
    - [`EvalError`][mdn-eval-error]
    - [`TypeError`][mdn-type-error]
    - [`System Error`][node-system-error] (Node.js)
    - `Array`
    - `Int8Array`
    - `Uint8Array`
    - `Uint8ClampedArray`
    - `Init16Array`
    - `Uint16Array`
    - `Int32Array`
    - `Uint32Array`
    - `Float32Array`
    - `Float64Array`
    - `Buffer` ([Node.js][node-buffer])
    - `DataView`
    - `Blob`

- List of **unsupported** values/types:
    - `DOMElement`: to copy DOM elements, use `element.cloneNode()`.
    - `Symbol`
    - `WeakMap`
    - `WeakSet`
    - `File`
    - `FileList`
    - `ImageData`
    - `ImageBitmap`
    - `Promise`
    - `SharedArrayBuffer`

- The implementation **can** handle circular references.
- If a `Number`, `String`, or `Boolean` object is encountered, the value is cloned as a **primitive**. This behavior is intentional. The implementation is opinionated in wanting to **avoid** creating `numbers`, `strings`, and `booleans` via the `new` operator and a constructor.
- The implementation **only** checks whether basic `Objects`, `Arrays`, and class instances are `extensible`, `sealed`, and/or `frozen`.
- `functions` are **not** cloned; their reference is copied.
- The implementation supports custom [`error`][mdn-error] types which are [`Error`][mdn-error] instances (e.g., ES2015 subclasses).

## Benchmarks

> **Note:** Run `pnpm --filter "deep-clone-bench" run test:bench` to run the benchmarks yourself.

### Shallow Clone Performance

Performance comparison for shallow object cloning `{ a: "a", b: "b", c: "c" }`:

| Library                          | Operations/sec | Relative Performance |
| -------------------------------- | -------------- | -------------------- |
| **plain-object-clone**           | 5,650,888      | **1.00x** (fastest)  |
| fast-copy                        | 5,056,607      | 0.89x                |
| rfdc - default                   | 4,674,249      | 0.83x                |
| deep-copy                        | 4,522,595      | 0.80x                |
| rfdc - proto                     | 4,371,388      | 0.77x                |
| nanoclone                        | 4,282,256      | 0.76x                |
| **@visulima/deep-clone - loose** | 3,551,940      | 0.63x                |
| clone-deep                       | 3,740,025      | 0.66x                |
| nano-copy                        | 3,673,002      | 0.65x                |
| rfdc - circles and proto         | 3,423,507      | 0.61x                |
| rfdc - circles                   | 3,235,513      | 0.57x                |
| ramda.clone                      | 2,514,785      | 0.44x                |
| lodash.clonedeep                 | 2,236,361      | 0.40x                |
| structured-clone                 | 1,503,190      | 0.27x                |
| @mfederczuk/deeptools            | 1,305,034      | 0.23x                |
| @ungap/structured-clone          | 1,231,364      | 0.22x                |
| fast-copy strict                 | 1,196,932      | 0.21x                |
| @visulima/deep-clone - strict    | 930,414        | 0.16x                |

### Deep Clone Performance

Performance comparison for deep object cloning (complex nested structure):

| Library                          | Operations/sec | Relative Performance |
| -------------------------------- | -------------- | -------------------- |
| **rfdc - proto**                 | 412,630        | **1.00x** (fastest)  |
| rfdc - default                   | 400,110        | 0.97x                |
| rfdc - circles                   | 369,861        | 0.90x                |
| rfdc - circles and proto         | 367,846        | 0.89x                |
| nanoclone                        | 314,105        | 0.76x                |
| deep-copy                        | 301,609        | 0.73x                |
| plain-object-clone               | 249,603        | 0.60x                |
| nano-copy                        | 248,646        | 0.60x                |
| fast-copy                        | 228,871        | 0.55x                |
| clone-deep                       | 217,880        | 0.53x                |
| **@visulima/deep-clone - loose** | 194,650        | 0.47x                |
| lodash.clonedeep                 | 130,934        | 0.32x                |
| structured-clone                 | 90,495         | 0.22x                |
| @ungap/structured-clone          | 88,710         | 0.21x                |
| ramda.clone                      | 58,385         | 0.14x                |
| fast-copy strict                 | 34,771         | 0.08x                |
| @visulima/deep-clone - strict    | 33,065         | 0.08x                |
| @mfederczuk/deeptools            | 15,357         | 0.04x                |

### Important Notes

- **@visulima/deep-clone** provides the best balance between performance and feature completeness
- **Loose mode** (default): Fast performance with standard cloning behavior
- **Strict mode**: Slower but clones all properties including non-enumerable ones and symbols
- Libraries like `plain-object-clone` and `fastest-json-copy` are faster but have significant limitations:
    - Cannot handle circular references
    - Treat complex objects (Date, Map, etc.) as plain objects
    - Limited type support
- **rfdc** is very fast but has fewer features than @visulima/deep-clone

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima deep-clone is open-sourced software licensed under the [MIT](https://github.com/visulima/visulima/blob/main/packages/deep-clone/LICENSE.md)


[mdn-error]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
[mdn-type-error]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypeError
[mdn-syntax-error]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SyntaxError
[mdn-range-error]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RangeError
[mdn-reference-error]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ReferenceError
[mdn-uri-error]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/URIError
[mdn-eval-error]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/EvalError
[node-system-error]: https://nodejs.org/api/errors.html#errors_class_system_error
[node-buffer]: http://nodejs.org/api/buffer.html
