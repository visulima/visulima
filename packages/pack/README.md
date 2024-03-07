<div align="center">
  <h3>Visulima pack</h3>
  <p>
  Detect whether a terminal, browser or edge supports ansi colors.
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
npm install @visulima/pack
```

```sh
yarn add @visulima/pack
```

```sh
pnpm add @visulima/pack
```

## Usage

```typescript
import { isColorSupported } from "@visulima/pack";

/**
 * Levels:
 * - `0` - All colors disabled.
 * - `1` - Basic 16 colors support.
 * - `2` - ANSI 256 colors support.
 * - `3` - Truecolor 16 million colors support.
 */
console.log(isColorSupported()); // 3
```

## Environment variables

To force disable or enable colored output use environment variables `NO_COLOR` and `FORCE_COLOR`.

The `NO_COLOR` variable should be presents with any not empty value.
The value is not important, e.g., `NO_COLOR=1` `NO_COLOR=true` disable colors.
See standard description by [NO_COLOR](https://no-color.org/).

The `FORCE_COLOR` variable should be presents with one of values:\
`FORCE_COLOR=0` force disable colors\
`FORCE_COLOR=1` force enable colors

## CLI arguments

Use arguments `--no-color` or `--color=false` to disable colors and `--color` to enable ones.

For example, an executable script _colors.js_:

```js
#!/usr/bin/env node
import { isColorSupported } from "@visulima/pack";

console.log(isColorSupported());
```

Execute the script in a terminal:

```
$ ./colors.js                        # colored output in terminal
$ ./colors.js --no-color             # non colored output in terminal
$ ./colors.js --color=false          # non colored output in terminal

$ ./colors.js > log.txt              # output in file without ANSI codes
$ ./colors.js --color > log.txt      # output in file with ANSI codes
$ ./colors.js --color=true > log.txt # output in file with ANSI codes
```

> **Warning**
>
> The command line arguments have a higher priority than environment variable.

## Info

For situations where using `--color` is not possible, use the environment variable `FORCE_COLOR=1` (level 1), `FORCE_COLOR=2` (level 2), or `FORCE_COLOR=3` (level 3) to forcefully enable color, or `FORCE_COLOR=0` to forcefully disable. The use of `FORCE_COLOR` overrides all other color support checks.

Explicit 256/Truecolor mode can be enabled using the `--color=256` and `--color=16m` flags, respectively.

## Related

-   [supports-color](https://github.com/chalk/supports-color) - Detect whether a terminal supports color
-   [supports-color-cli](https://github.com/chalk/supports-color-cli) - CLI for this module

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

The visulima pack is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/pack?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/pack/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/pack/v/latest "npm"
