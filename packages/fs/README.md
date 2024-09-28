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

## walkSync

```typescript
import { walkSync } from "@visulima/fs";

const filesAndFolders: string[] = [];

for (const index of walkSync(`${__dirname}/fixtures`, {})) {
    filesAndFolders.push(index.path);
}

console.log(filesAndFolders);
```

### API for `walk` and `walkSync`

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

Type: `(RegExp | string)[]`

Default: `undefined`

Optional: `true`

Description: List of regular expression or [glob](<https://en.wikipedia.org/wiki/Glob_(programming)>) patterns used to filter entries. If specified, entries that do not match the patterns specified by this option are excluded.

#### skip

Type: `(RegExp | string)[]`

Default: `undefined`

Optional: `true`

Description: List of regular expression or [glob](<https://en.wikipedia.org/wiki/Glob_(programming)>) patterns used to filter entries. If specified, entries matching the patterns specified by this option are excluded.

## findUp

Find a file or directory by walking up parent directories.

```typescript
import { findUp } from "@visulima/fs";

// Returns a Promise for the found path or undefined if it could not be found.
const file = await findUp("package.json");

console.log(file);
```

## findUpSync

Find a file or directory by walking up parent directories.

```typescript
import { findUpSync } from "@visulima/fs";

// Returns the found path or undefined if it could not be found.
const file = findUpSync("package.json");

console.log(file);
```

### API for `findUp` and `findUpSync`

#### name

Type: `string[] | string | ((directory: PathLike) => PathLike | Promise<PathLike | typeof FIND_UP_STOP> | typeof FIND_UP_STOP)` \
Sync Type: `string[] | string | ((directory: PathLike) => PathLike | typeof FIND_UP_STOP)`

The name of the file or directory to find.

> If an array is specified, the first item that exists will be returned.

> A function that will be called with each directory until it returns a string with the path, which stops the search, or the root directory has been reached and nothing was found. Useful if you want to match files with certain patterns, set of permissions, or other advanced use-cases.
>
> When using async mode, the matcher may optionally be an async or promise-returning function that returns the path.

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

##### allowSymlinks

Type: `boolean`\
Default: `true`

Allow symbolic links to match if they point to the target file or directory.

## readFile

Read a file.

```typescript
import { readFile } from "@visulima/fs";

// Returns a Promise for the file contents.
const file = await readFile("package.json");

console.log(file);
```

## readFileSync

Read a file.

```typescript
import { readFileSync } from "@visulima/fs";

// Returns the file contents.

const file = readFileSync("package.json");

console.log(file);
```

### API for `readFile` and `readFileSync`

#### path

Type: `string`

The path to the file to read.

#### options

Type: `object`

##### buffer

Type: `boolean`

Default: `true`

Optional: `true`

Description: Indicates whether the file contents should be returned as a Buffer or a string.

##### compression

Type: `"brotli" | "gzip" | undefined`

Default: `undefined`

Optional: `true`

Description: The file compression.

##### encoding

Type: `"ascii" | "base64" | "base64url" | "hex" | "latin1" | "ucs-2" | "ucs2" | "utf-8" | "utf-16le" | "utf8" | "utf16le" | undefined`

Default: `utf8`

Optional: `true`

#### flag

Type: `number | string | undefined`

Default: `'r'`

Optional: `true`

## isAccessible

Check if a file or directory exists and is accessible.

```typescript
import { isAccessible } from "@visulima/fs";

// Returns a Promise for the result.
const file = await isAccessible("package.json");

console.log(file);
```

## isAccessibleSync

Check if a file or directory exists and is accessible.

```typescript
import { isAccessibleSync } from "@visulima/fs";

// Returns the result.

const file = isAccessibleSync("package.json");

console.log(file);
```

### API for `isAccessible` and `isAccessibleSync`

#### path

Type: `string`

The path to the file or directory to check.

#### mode

Type: `number`

Default: `fs.constants.F_OK`

Optional: `true`

Description: The accessibility mode.

---

# Utilities

## parseJson

Parse JSON with more helpful errors.

```typescript
import { parseJson, JSONError } from "@visulima/fs/utils";

const json = '{\n\t"foo": true,\n}';

JSON.parse(json);
/*
undefined:3
}
^
SyntaxError: Unexpected token }
*/

parseJson(json);
/*
JSONError: Unexpected token } in JSON at position 16 while parsing near '{      "foo": true,}'

  1 | {
  2 |   "foo": true,
> 3 | }
    | ^
*/

parseJson(json, "foo.json");
/*
JSONError: Unexpected token } in JSON at position 16 while parsing near '{      "foo": true,}' in foo.json

  1 | {
  2 |   "foo": true,
> 3 | }
    | ^
*/
```

### API for `parseJson`

#### json

Type: `string`

The JSON string to parse.

#### reviver

Type: `Function`

Prescribes how the value originally produced by parsing is transformed, before being returned. See [JSON.parse docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#Using_the_reviver_parameter) for more.

#### filename

Type: `string`

The filename to use in error messages.

### API for `JSONError`

Exposed for use in `instanceof` checks.

#### fileName

Type: `string`

The filename displayed in the error message.

#### codeFrame

Type: `string`

The printable section of the JSON which produces the error.

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

-   [Daniel Bannert](https://github.com/prisis)
-   [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## About

### Related Projects

-   [strip-json-comments](https://github.com/sindresorhus/strip-json-comments) - Strip comments from JSON. Lets you use comments in your JSON files!
-   [parse-json](https://github.com/sindresorhus/parse-json) - Parse JSON with more helpful errors.
-   [find-up](https://github.com/sindresorhus/find-up) - Find a file or directory by walking up parent directories.
-   [walk](https://deno.land/std/fs/walk.ts) - Walk a directory recursively and yield all files and directories.

## License

The visulima fs is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/fs?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/fs/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/fs/v/latest "npm"
