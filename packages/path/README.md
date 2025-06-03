<div align="center">
  <h3>Visulima path</h3>
  <p>
  Drop-in replacement of the Node.js's path module.
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

## Why

For [historical reasons](https://docs.microsoft.com/en-us/archive/blogs/larryosterman/why-is-the-dos-path-character), windows followed MS-DOS and using backslash for separating paths rather than slash used for macOS, Linux, and other Posix operating systems. Nowadays, [Windows](https://docs.microsoft.com/en-us/windows/win32/fileio/naming-a-file?redirectedfrom=MSDN) supports both Slash and Backslash for paths. [Node.js's built in `path` module](https://nodejs.org/api/path.html) in the default operation of the path module varies based on the operating system on which a Node.js application is running. Specifically, when running on a Windows operating system, the path module will assume that Windows-style paths are being used. **This makes inconsistent code behavior between Windows and POSIX.**

Compared to popular [upath](https://github.com/anodynos/upath), pathe is providing **identical exports** of Node.js with normalization on **all operations** and written in modern **ESM/Typescript** and has **no dependency on Node.js**!

## Install

```sh
npm install @visulima/path
```

```sh
yarn add @visulima/path
```

```sh
pnpm add @visulima/path
```

## Usage

```js
// ESM / Typescript
import { resolve } from "@visulima/path";
// or
import path from "@visulima/path";

// CommonJS
const { resolve } = require("@visulima/path");
// or
const path = require("@visulima/path");
```

> Check https://nodejs.org/api/path.html about the exported functions.
> Note: path.win32 and path.posix are not exported.

### Extra utilities

`@visulima/path` exports some extra utilities that do not exist in standard Node.js [path module](https://nodejs.org/api/path.html).
In order to use them, you can import from `@visulima/path/utils` subpath:

```js
// ESM / Typescript
import { filename, normalizeAliases, resolveAlias, reverseResolveAlias, isRelative, isBinaryPath, toPath, isWindows } from "@visulima/path/utils";

// CommonJS
const { filename, normalizeAliases, resolveAlias, reverseResolveAlias, isRelative, isBinaryPath, toPath, isWindows } = require("@visulima/path/utils");
```

## Related

- [upath](https://github.com/anodynos/upath) - A proxy to `path`, replacing `\` with `/` for all results & methods to add, change, default, trim file extensions.
- [pathe](https://github.com/unjs/pathe) - 🛣️ Drop-in replacement of the Node.js's path module, module that ensures paths are normalized.

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

The visulima path is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript

[typescript-url]: https://www.typescriptlang.org/ "TypeScript" "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/path?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/path/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/path/v/latest "npm"
