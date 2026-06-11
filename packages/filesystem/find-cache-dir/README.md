<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="find-cache-dir" />

</a>

<h3 align="center">Finds the common standard cache directory</h3>

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

// findCacheDir is async and returns a Promise — remember to await it.
const cacheDir = await findCacheDir("my-app");

console.log(cacheDir); //=> '/path/to/project/node_modules/.cache/my-app'

const syncCacheDir = findCacheDirSync("my-app");

console.log(syncCacheDir); //=> '/path/to/project/node_modules/.cache/my-app'
```

The same can be done for cjs (note that `findCacheDir` returns a `Promise`, so it
must be awaited inside an async function):

```javascript
const { findCacheDir, findCacheDirSync } = require("@visulima/find-cache-dir");

(async () => {
    const cacheDir = await findCacheDir("my-app");

    console.log(cacheDir); //=> '/path/to/project/node_modules/.cache/my-app'
})();

const syncCacheDir = findCacheDirSync("my-app");

console.log(syncCacheDir); //=> '/path/to/project/node_modules/.cache/my-app'
```

### `thunk`

Pass `thunk: true` to get back a function that joins paths onto the resolved
cache directory, so you don't have to re-join the base path every time:

```typescript
const thunk = await findCacheDir("my-app", { thunk: true });

thunk?.("manifest.json"); //=> '/path/to/project/node_modules/.cache/my-app/manifest.json'
```

## API

### name

_Required_\
Type: `string`

Should be the same as your project name in `package.json`. Must not contain path
separators — it is joined onto the resolved cache root as a single segment.

### options

Type: `object`

The options shape is exported as `Options` (also aliased `FindCacheDirOptions`):

```typescript
import type { Options } from "@visulima/find-cache-dir";
```

##### cwd

Type: `URL | string`\
Default `process.cwd()`

The directory to start searching for a `package.json` from. Ignored when `files`
is provided or when the `CACHE_DIR` environment variable is set.

##### files

Type: `(URL | string)[]`

A set of files whose closest common ancestor directory is used as the starting
point for the `package.json` lookup instead of `cwd`. Useful for monorepo tooling
that wants the cache next to the workspace package owning the processed files.

##### create

Type: `boolean`\
Default `false`

Create the resolved directory before returning. The async `findCacheDir` uses a
non-blocking `ensureDir`; `findCacheDirSync` uses `ensureDirSync`.

##### thunk

Type: `boolean`\
Default `false`

Return a function `(...paths: string[]) => string` that joins path segments onto
the resolved cache directory instead of returning the directory string. Returns
`undefined` when no cache directory could be resolved.

##### throwError

Type: `boolean`\
Default `false`

Throw a `NotFoundError` (from `@visulima/fs/error`) when no ancestor
`package.json` can be found, instead of returning `undefined`. Ignored when
`useGlobalCacheFallback` is enabled (the fallback is returned first).

##### useGlobalCacheFallback

Type: `boolean`\
Default `false`

Fall back to the OS user cache directory (honouring `$XDG_CACHE_HOME` on Linux)
when no writable `node_modules` exists — e.g. read-only installs, globally
installed tools, or CI images. When enabled, a missing/unwritable `node_modules`
yields `<os-cache>/<name>` instead of `undefined`.

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

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima find-cache-dir is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/find-cache-dir?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/find-cache-dir?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/find-cache-dir
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
