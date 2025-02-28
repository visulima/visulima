<div align="center">
  <h3>Visulima package</h3>
  <p>
  One Package to rule them all, finds your root-dir, monorepo or package manager is built on top of

[@visulima/fs](https://github.com/visulima/visulima/tree/main/packages/fs),
[@visulima/path](https://github.com/visulima/visulima/tree/main/packages/path),
[normalize-package-data](https://github.com/npm/normalize-package-data),
[pathe](https://github.com/unjs/pathe),and
[type-fest](https://github.com/sindresorhus/type-fest)

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
npm install @visulima/package
```

```sh
yarn add @visulima/package
```

```sh
pnpm add @visulima/package
```

## Usage

### findMonorepoRoot

Find the root directory path and strategy for a monorepo based on the given current working directory (cwd).

```ts
import { findMonorepoRoot } from "@visulima/package";
// or import { findMonorepoRoot } from '@visulima/package/monorepo';

const root = findMonorepoRoot(); // => /Users/../Projects/visulima
```

### findPackageRoot

Find the root directory path and strategy for a package based on the given current working directory (cwd).

```ts
import { findPackageRoot } from "@visulima/package";
// or import { findPackageRoot } from '@visulima/package/package';

const root = findPackageRoot(); // => /Users/../Projects/visulima/packages/package
```

### findPackageJson

Find the package.json file in the specified directory or its parent directories.

```ts
import { findPackageJson } from "@visulima/package";
// or import { findPackageJson } from '@visulima/package/package-json';

const root = findPackageJson(); // => /Users/../Projects/visulima/packages/package/package.json
```

### writePackageJson

Writes the package.json file with the given data.

```ts
import { writePackageJson } from "@visulima/package";
// or import { writePackageJson } from '@visulima/package/package-json';

writePackageJson({ name: "visulima" } /* ,{ cwd: "./" }*/);
```

### parsePackageJson

Parse the package.json file.

```ts
import { parsePackageJson } from "@visulima/package";

const packageJson = parsePackageJson(/* object or package.json as string */);
```

### findLockFile

Asynchronously finds a lock file in the specified directory or any of its parent directories.

```ts
import { findLockFile } from "@visulima/package";
// or import { findLockFile } from '@visulima/package/package-manager';

const lockFile = await findLockFile(); // => /Users/../Projects/visulima/packages/package/package-lock.json
```

### findPackageManager

Finds the package manager used in a project based on the presence of lock files or package.json configuration.

If found, returns the package manager and the path to the lock file or package.json.

Throws an error if no lock file or package.json is found.

```ts
import { findPackageManager } from "@visulima/package";
// or import { findPackageManager } from '@visulima/package/package-manager';

const { packageManager, path } = findPackageManager(); // => { packageManager: 'npm', path: '/Users/../Projects/visulima/packages/package' }
```

### getPackageManagerVersion

Retrieves the version of the specified package manager.

```ts
import { getPackageManagerVersion } from "@visulima/package";
// or import { getPackageManagerVersion } from '@visulima/package/package-manager';

const version = await getPackageManagerVersion("npm"); // => 7.5.4
```

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## About

### Related Projects

- [read-pkg](https://github.com/sindresorhus/read-pkg) - Read a package.json file.

## License

The visulima package is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript

[typescript-url]: https://www.typescriptlang.org/ "TypeScript" "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/package?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/package/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/package/v/latest "npm"
