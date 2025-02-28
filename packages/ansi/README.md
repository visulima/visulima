<div align="center">
  <h3>visulima ansi</h3>
  <p>
  ANSI escape codes for some terminal swag.
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
npm install @visulima/ansi
```

```sh
yarn add @visulima/ansi
```

```sh
pnpm add @visulima/ansi
```

## Usage

```js
import { cursorUp, cursorLeft } from "@visulima/ansi";

// Moves the cursor two rows up and to the left
process.stdout.write(cursorUp(2) + cursorLeft);
//=> '\u001B[2A\u001B[1000D'
```

or

```js
import { cursorUp, cursorLeft } from "@visulima/ansi/cursor";

// etc, as above...
```

And for commonjs:

```js
const { cursorUp, cursorLeft } = require("@visulima/ansi");

// etc, as above...
```

## Related

- [ansi-escapes](https://github.com/sindresorhus/ansi-escapes) - ANSI escape codes for manipulating the terminal
- [sisteransi](https://github.com/terkelg/sisteransi) - ANSI escape codes for some terminal swag.
- [console-clear](https://github.com/lukeed/console-clear) - Clear the console, cross-platform

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

The visulima ansi is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript

[typescript-url]: https://www.typescriptlang.org/ "TypeScript" "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/ansi?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/ansi/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/ansi/v/latest "npm"
