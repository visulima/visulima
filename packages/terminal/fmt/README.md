<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="fmt" />

</a>

<h3 align="center">Util.format-like string formatting utility.</h3>

<!-- END_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<br />

<div align="center">

[![typescript-image][typescript-badge]][typescript-url]
[![mit licence][license-badge]][license]
[![npm downloads][npm-downloads-badge]][npm-downloads]
[![Chat][chat-badge]][chat]
[![PRs Welcome][prs-welcome-badge]][prs-welcome]

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
npm install @visulima/fmt
```

```sh
yarn add @visulima/fmt
```

```sh
pnpm add @visulima/fmt
```

## Usage

```typescript
import { format } from "@visulima/fmt";

const formatted = format("hello %s %j %d", ["world", [{ obj: true }, 4, { another: "obj" }]]);

console.log(formatted); // hello world [{"obj":true},4,{"another":"obj"}] NaN
```

### format(fmt, parameters, [options])

#### fmt

A `printf`-like format string. Example: `'hello %s %j %d'`

#### parameters

Array of values to be inserted into the `format` string. Example: `['world', {obj:true}]`

#### options.stringify

Passing an options object as the third parameter with a `stringify` will mean
any objects will be passed to the supplied function instead of an the
internal `tryStringify` function. This can be useful when using augmented
capability serializers such as [`fast-safe-stringify`](http://github.com/davidmarkclements/fast-safe-stringify) or [`fast-redact`](http://github.com/davidmarkclements/fast-redact).

> uses `JSON.stringify` instead of `util.inspect`, this means functions _will not be serialized_.

#### options.appendExtraArguments

By default any arguments that are not consumed by a specifier are dropped. Set
`appendExtraArguments: true` to append them to the end of the output,
space-separated, the way Node's `util.format("hi", err)` appends leftover
values. Objects are passed through `stringify`.

```typescript
format("hi", [{ code: 1 }], { appendExtraArguments: true }); // 'hi {"code":1}'
format("%s done", ["task", "extra"], { appendExtraArguments: true }); // 'task done extra'
```

#### options.colors

Controls whether `%c` emits ANSI styling. When omitted, styling is emitted only
outside of a browser-like environment (i.e. when `globalThis.window` is
`undefined`). Pass `colors: false` to strip `%c` styling unconditionally (useful
for CI logs or files), or `colors: true` to force it on.

> Note: `%c` always emits 24-bit truecolor (`38;2;R;G;B`) sequences; there is no
> automatic downsampling to 256/16 colors. The `colors` option is an on/off gate
> only.

### Formatting an object as the format argument

If the first argument is an object instead of a format string, the object and
every additional argument are JSON-stringified and joined with a single space:

```typescript
format({ a: 1 }, ["b", 2]); // '{"a":1} "b" 2'
format({}, []); // '{}'
```

### build

With the `build` function you can generate a `format` function that is optimized for your use case.

```typescript
import { build } from "@visulima/fmt";

const format = build({
    formatters: {
        // Pass in whatever % interpolator you want, as long as it's a single character;
        // in this case, it's `t`.
        // The formatter should be a function that takes in a value and returns the formatted value.
        t: (time) => new Date(time).toLocaleString(),
    },
});

const formatted = format("hello %s at %t", ["world", Date.now()]);

console.log(formatted); // hello world at 1/1/1970, 1:00:00 AM
```

## Format Specifiers

Format specifiers are dependent on the type of data-elements that are to be added to the string.
The most commonly used format specifiers supported are:

| Specifier | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| %s        | Converts all values except for `BigInt`, `-0` and `Object` to a string.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| %d        | Used to convert any value to `Number` of any type other than `BigInt` and `Symbol`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| %i        | Used for all values except `BigInt` and `Symbol`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| %f        | Used to convert a value to type `Float`. It does not support conversion of values of type `Symbol`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| %j        | Used to add JSON data. If a circular reference is present, the string ‘[Circular]’ is added instead.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| %o        | JSON serialization of the value (alias of `%j`). Unlike Node's `util.inspect`-based `%o`, it does **not** produce an inspect-style representation. Strings are quoted; functions become `[Function: name]`.                                                                                                                                                                                                                                                                                                                                                        |
| %O        | JSON serialization of the value (alias of `%j`/`%o`). Unlike Node, it does **not** include non-enumerable properties — `%j`, `%o` and `%O` share a single JSON code path.                                                                                                                                                                                                                                                                                                                                                                                          |
| %c        | Will parse basic CSS from the substitution subject like `color: red` into ANSI color codes. These codes will then be placed where the `%c` specifier is. Supported CSS properties are `color`, `background-color`, `font-weight`, `font-style`, `text-decoration`, `text-decoration-color`, and `text-decoration-line`. Unsupported CSS properties are ignored. An empty `%c` CSS string substitution will become an ANSI style reset. Styling can be toggled via `options.colors` (see above); when omitted it is emitted only outside browser-like environments. |
| %%        | Used to add the % sign.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

> Unknown specifiers (e.g. `%x`) are passed through verbatim and do **not** consume an argument, matching Node's `util.format`. Use [`build`](#build) to register custom single-character specifiers.
>
> `printf`-style width/precision (e.g. `%5d`, `%.2f`) is **not** supported; only single-character specifiers are recognized.

## Benchmark

[See benchmark](./__bench__/README.md)

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [quick-format-unescaped](https://github.com/pinojs/quick-format-unescaped)
- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima fmt is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/fmt?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/fmt?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/fmt
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
