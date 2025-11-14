<div align="center">
  <h3>visulima find-cache-dir</h3>
  <p>
  Finds the common standard cache directory, a commonjs and esm version of <a href="https://github.com/sindresorhus/find-cache-dir"> find-cache-dir</a>.
  </p>
</div>

<br />

<div align="center">

[![TypeScript](https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/) [![npm](https://img.shields.io/npm/v/@visulima/find-cache-dir/latest.svg?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@visulima/find-cache-dir/v/latest) [![license](https://img.shields.io/npm/l/@visulima/find-cache-dir?color=blueviolet&style=for-the-badge)](LICENSE.md)

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
npm install @visulima/find-cache-dir
```

```sh
yarn add @visulima/find-cache-dir
```

```sh
pnpm add @visulima/find-cache-dir
```

## Usage

```typescript
import { findCacheDir, findCacheDirSync } from "@visulima/find-cache-dir";

const cacheDir = await findCacheDir("my-app");

console.log(cacheDir); //=> '/Users/test/Library/node_mdules/.cache/my-app'

const syncCacheDir = findCacheDirSync("my-app");

console.log(syncCacheDir); //=> '/Users/test/Library/node_mdules/.cache/my-app'
```

The same can be done for cjs:

```javascript
const { findCacheDir, findCacheDirSync } = require("@visulima/find-cache-dir");

const cacheDir = findCacheDir("my-app");

console.log(cacheDir); //=> '/Users/test/Library/node_mdules/.cache/my-app'

const syncCacheDir = findCacheDirSync("my-app");

console.log(syncCacheDir); //=> '/Users/test/Library/node_mdules/.cache/my-app'
```

## API

### name

_Required_\
Type: `string`

Should be the same as your project name in `package.json`.

### options

Type: `object`

##### cwd

Type: `string`\
Default `process.cwd()`

The directory to start searching for a `package.json` from.

##### create

Type: `boolean`\
Default `false`

Create the directory synchronously before returning.

##### throwError

Type: `boolean`\
Default `false`

Throw an error if a `.cache` folder can't be found.

## Tips

- To test modules using `@visulima/find-cache-dir`, set the `CACHE_DIR` environment variable to temporarily override the directory that is resolved.

## Related

- [find-cache-dir](https://github.com/sindresorhus/find-cache-dir) - Find the cache directory.

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

The visulima find-cache-dir is open-sourced software licensed under the [MIT](LICENSE.md)


