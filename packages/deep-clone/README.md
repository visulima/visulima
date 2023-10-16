<div align="center">
  <h3>Visulima Deep Clone</h3>
  <p>
  Really Fast Deep Clone.
  </p>
</div>

<br />

<div align="center">

[![typescript-image]][typescript-url] [![npm-image]][npm-url] [![license-image]][license-url]

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

## Notes

-   List of **supported** values/types:

    -   `undefined`
    -   `null`
    -   `boolean`/`Boolean`
    -   `string`/`String`
    -   `number`/`Number`
    -   `function`
    -   `Object`
    -   `Date`
    -   `RegExp`
    -   `Set`
    -   `Map`
    -   [`Error`][mdn-error]
    -   [`URIError`][mdn-uri-error]
    -   [`ReferenceError`][mdn-reference-error]
    -   [`SyntaxError`][mdn-syntax-error]
    -   [`RangeError`][mdn-range-error]
    -   [`EvalError`][mdn-eval-error]
    -   [`TypeError`][mdn-type-error]
    -   [`System Error`][node-system-error] (Node.js)
    -   `Array`
    -   `Int8Array`
    -   `Uint8Array`
    -   `Uint8ClampedArray`
    -   `Init16Array`
    -   `Uint16Array`
    -   `Int32Array`
    -   `Uint32Array`
    -   `Float32Array`
    -   `Float64Array`
    -   `Buffer` ([Node.js][node-buffer])

-   List of **unsupported** values/types:

    -   `DOMElement`: to copy DOM elements, use `element.cloneNode()`.
    -   `Symbol`
    -   `WeakMap`
    -   `WeakSet`
    -   `Blob`
    -   `File`
    -   `FileList`
    -   `ImageData`
    -   `ImageBitmap`
    -   `DataView`
    -   `Promise`
    -   `SharedArrayBuffer`

-   The implementation **can** handle circular references.
-   If a `Number`, `String`, or `Boolean` object is encountered, the value is cloned as a **primitive**. This behavior is intentional. The implementation is opinionated in wanting to **avoid** creating `numbers`, `strings`, and `booleans` via the `new` operator and a constructor.
-   The implementation **only** checks whether basic `Objects`, `Arrays`, and class instances are `extensible`, `sealed`, and/or `frozen`.
-   `functions` are **not** cloned; their reference is copied.
-   The implementation supports custom [`error`][mdn-error] types which are [`Error`][mdn-error] instances (e.g., ES2015 subclasses).

## Benchmarks

Note:

It is true that `jsondiffpatch.clone()` from [jsondiffpatch](https://www.npmjs.com/package/jsondiffpatch) is faster than `@visulima/deep-clonse` in this particular benchmark, but it cannot handle as many situations as `@visulima/deep-clonse` can.

It is true that [fastest-json-copy](https://www.npmjs.com/package/fastest-json-copy) is faster than `@visulima/deep-clonse` in this particular benchmark. Also, fastest-json-copy has such huge limitations that it is rarely useful. For example, it treats things like `Date` and `Map` instances the same as empty `{}`. It can't handle circular references.

[plain-object-clone](https://www.npmjs.com/package/plain-object-clone) is also really limited in capability.

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

-   [Daniel Bannert](https://github.com/prisis)
-   [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima readdir is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/readdir?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/readdir/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/readdir/v/latest "npm"
[mdn-error]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
[mdn-type-error]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypeError
[mdn-syntax-error]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SyntaxError
[mdn-range-error]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RangeError
[mdn-reference-error]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ReferenceError
[mdn-uri-error]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/URIError
[mdn-eval-error]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/EvalError
[node-system-error]: https://nodejs.org/api/errors.html#errors_class_system_error
[node-buffer]: http://nodejs.org/api/buffer.html
