<div align="center">
  <h3>Visulima fs</h3>
  <p>
  Human friendly file system utilities for Node.js
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
npm install @visulima/fs
```

```sh
yarn add @visulima/fs
```

```sh
pnpm add @visulima/fs
```

## Usage

## walk

```typescript
import { walk } from "@visulima/fs";

const filesAndFolders: string[] = [];

for await (const index of walk(`${__dirname}/fixtures`, {})) {
    filesAndFolders.push(index.path);
}

console.log(filesAndFolders);
```

### API for `walk`

#### path

Type: `string`

The directory to start from.

#### options

Type: `object`

#### maxDepth

Type: `number`

Default: `Infinity`

Optional: `true`

Description: The maximum depth of the file tree to be walked recursively.

#### includeFiles

Type: `boolean`

Default: `true`

Optional: `true`

Description: Indicates whether file entries should be included or not.

#### includeDirs

Type: `boolean`

Default: `true`

Optional: `true`

Description: Indicates whether directory entries should be included or not.

#### includeSymlinks

Type: `boolean`

Default: `true`

Optional: `true`

Description: Indicates whether symlink entries should be included or not. This option is meaningful only if followSymlinks is set to false.

#### followSymlinks

Type: `boolean`

Default: `false`

Optional: `true`

Description: Indicates whether symlinks should be resolved or not.

#### extensions

Type: `string[]`

Default: `undefined`

Optional: `true`

Description: List of file extensions used to filter entries. If specified, entries without the file extension specified by this option are excluded.

#### match

Type: `RegExp[]`

Default: `undefined`

Optional: `true`

Description: List of regular expression patterns used to filter entries. If specified, entries that do not match the patterns specified by this option are excluded.

#### skip

Type: `RegExp[]`

Default: `undefined`

Optional: `true`

Description: List of regular expression patterns used to filter entries. If specified, entries matching the patterns specified by this option are excluded.

## findUp

Find a file or directory by walking up parent directories.

```typescript
import { findUp } from "@visulima/fs";

// Returns a Promise for the found path or undefined if it could not be found.
const file = await findUp("package.json");

console.log(file);
```

## findUpSync

Find a file or directory by walking up parent directories

```typescript
import { findUpSync } from "@visulima/fs";

// Returns the found path or undefined if it could not be found.
const file = findUpSync("package.json");

console.log(file);
```

### API for `findUp` and `findUpSync`

#### name

Type: `string`

The name of the file or directory to find.

#### options

Type: `object`

##### cwd

Type: `URL | string`\
Default: `process.cwd()`

The directory to start from.

##### type

Type: `string`\
Default: `'file'`\
Values: `'file' | 'directory'`

The type of path to match.

##### stopAt

Type: `URL | string`\
Default: Root directory

A directory path where the search halts if no matches are found before reaching this point.

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

The visulima fs is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/fs?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/fs/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/fs/v/latest "npm"
