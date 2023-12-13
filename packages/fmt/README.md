<div align="center">
  <h3>Visulima fmt (util.format)</h3>
  <p>
  Util.format-like unescaped string formatting utility based on <a href="https://github.com/pinojs/quick-format-unescaped">quick-format-unescaped</a>.
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

| Specifier | Description                                                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| %s        | Converts all values except for `BigInt`, `-0` and `Object` to a string.                                                                  |
| %d        | Used to convert any value to `Number` of any type other than `BigInt` and `Symbol`.                                                      |
| %i        | Used for all values except `BigInt` and `Symbol`.                                                                                        |
| %f        | Used to convert a value to type `Float`. It does not support conversion of values of type `Symbol`.                                      |
| %j        | Used to add JSON data. If a circular reference is present, the string ‘[Circular]’ is added instead.                                     |
| %o        | Adds the string representation of an object. Note that it does not contain non-enumerable characteristics of the object.                 |
| %O        | Adds the string representation of an object. Note that it will contain all characteristics of the object, including non-enumerable ones. |
| %%        | Used to add the % sign.                                                                                                                  |

## Benchmark

```sh
   ✓ format simple (3) 4209ms
     name                              hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · util.format             2,443,716.24  0.0003  0.8279  0.0004  0.0004  0.0007  0.0008  0.0013  ±0.35%  1221859   fastest
   · @visulima/fmt           2,425,903.43  0.0004  0.1525  0.0004  0.0004  0.0005  0.0006  0.0008  ±0.25%  1212952
   · quick-format-unescaped  1,770,792.34  0.0005  0.3075  0.0006  0.0006  0.0006  0.0006  0.0009  ±0.30%   885397   slowest

   ✓ format tail object (3) 4922ms
     name                              hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · util.format             1,005,974.84  0.0009  0.1501  0.0010  0.0010  0.0013  0.0018  0.0022  ±0.28%   502988   slowest
   · @visulima/fmt           3,082,590.54  0.0003  0.1489  0.0003  0.0003  0.0004  0.0005  0.0006  ±0.30%  1541296   fastest
   · quick-format-unescaped  2,164,780.43  0.0004  0.1654  0.0005  0.0005  0.0005  0.0006  0.0008  ±0.25%  1082391
```

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

-   [quick-format-unescaped](https://github.com/pinojs/quick-format-unescaped)
-   [Daniel Bannert](https://github.com/prisis)
-   [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima fmt is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/fmt?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/fmt/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/fmt/v/latest "npm"
