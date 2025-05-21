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

> **Note:** If you want to parse or write YAML, you'll need to install `yaml` as well.

```sh
npm install yaml
```

```sh
yarn add yaml
```

```sh
pnpm add yaml
```

> After installing `yaml`, you can use the `readYaml`, `readYamlSync` and `writeYaml`, `writeYamlSync` functions from `@visulima/fs/yaml`.

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

## Api Docs

<!-- TYPEDOC -->

# error

## Classes

### AlreadyExistsError

Defined in: [packages/fs/src/error/already-exists-error.ts:4](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/already-exists-error.ts#L4)

Error thrown when file already exists.

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new AlreadyExistsError(message): AlreadyExistsError;
```

Defined in: [packages/fs/src/error/already-exists-error.ts:9](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/already-exists-error.ts#L9)

Creates a new instance.

###### Parameters

###### message

`string`

The error message.

###### Returns

[`AlreadyExistsError`](#alreadyexistserror)

###### Overrides

```ts
Error.constructor
```

#### Accessors

##### code

###### Get Signature

```ts
get code(): string;
```

Defined in: [packages/fs/src/error/already-exists-error.ts:14](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/already-exists-error.ts#L14)

###### Returns

`string`

###### Set Signature

```ts
set code(_name): void;
```

Defined in: [packages/fs/src/error/already-exists-error.ts:19](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/already-exists-error.ts#L19)

###### Parameters

###### \_name

`string`

###### Returns

`void`

##### name

###### Get Signature

```ts
get name(): string;
```

Defined in: [packages/fs/src/error/already-exists-error.ts:24](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/already-exists-error.ts#L24)

###### Returns

`string`

###### Set Signature

```ts
set name(_name): void;
```

Defined in: [packages/fs/src/error/already-exists-error.ts:29](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/already-exists-error.ts#L29)

###### Parameters

###### \_name

`string`

###### Returns

`void`

###### Overrides

```ts
Error.name
```

#### Methods

##### captureStackTrace()

```ts
static captureStackTrace(targetObject, constructorOpt?): void;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:91

Create .stack property on a target object

###### Parameters

###### targetObject

`object`

###### constructorOpt?

`Function`

###### Returns

`void`

###### Inherited from

```ts
Error.captureStackTrace
```

#### Properties

##### cause?

```ts
optional cause: unknown;
```

Defined in: node\_modules/.pnpm/typescript@5.8.3/node\_modules/typescript/lib/lib.es2022.error.d.ts:26

###### Inherited from

```ts
Error.cause
```

##### message

```ts
message: string;
```

Defined in: node\_modules/.pnpm/typescript@5.8.3/node\_modules/typescript/lib/lib.es5.d.ts:1077

###### Inherited from

```ts
Error.message
```

##### stack?

```ts
optional stack: string;
```

Defined in: node\_modules/.pnpm/typescript@5.8.3/node\_modules/typescript/lib/lib.es5.d.ts:1078

###### Inherited from

```ts
Error.stack
```

##### prepareStackTrace()?

```ts
static optional prepareStackTrace: (err, stackTraces) => any;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:98

Optional override for formatting stack traces

###### Parameters

###### err

`Error`

###### stackTraces

`CallSite`[]

###### Returns

`any`

###### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

###### Inherited from

```ts
Error.prepareStackTrace
```

##### stackTraceLimit

```ts
static stackTraceLimit: number;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:100

###### Inherited from

```ts
Error.stackTraceLimit
```

***

### DirectoryError

Defined in: [packages/fs/src/error/directory-error.ts:4](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/directory-error.ts#L4)

Error thrown when an operation is not allowed on a directory.

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new DirectoryError(message): DirectoryError;
```

Defined in: [packages/fs/src/error/directory-error.ts:9](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/directory-error.ts#L9)

Creates a new instance.

###### Parameters

###### message

`string`

The error message.

###### Returns

[`DirectoryError`](#directoryerror)

###### Overrides

```ts
Error.constructor
```

#### Accessors

##### code

###### Get Signature

```ts
get code(): string;
```

Defined in: [packages/fs/src/error/directory-error.ts:14](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/directory-error.ts#L14)

###### Returns

`string`

###### Set Signature

```ts
set code(_name): void;
```

Defined in: [packages/fs/src/error/directory-error.ts:19](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/directory-error.ts#L19)

###### Parameters

###### \_name

`string`

###### Returns

`void`

##### name

###### Get Signature

```ts
get name(): string;
```

Defined in: [packages/fs/src/error/directory-error.ts:24](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/directory-error.ts#L24)

###### Returns

`string`

###### Set Signature

```ts
set name(_name): void;
```

Defined in: [packages/fs/src/error/directory-error.ts:29](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/directory-error.ts#L29)

###### Parameters

###### \_name

`string`

###### Returns

`void`

###### Overrides

```ts
Error.name
```

#### Methods

##### captureStackTrace()

```ts
static captureStackTrace(targetObject, constructorOpt?): void;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:91

Create .stack property on a target object

###### Parameters

###### targetObject

`object`

###### constructorOpt?

`Function`

###### Returns

`void`

###### Inherited from

```ts
Error.captureStackTrace
```

#### Properties

##### cause?

```ts
optional cause: unknown;
```

Defined in: node\_modules/.pnpm/typescript@5.8.3/node\_modules/typescript/lib/lib.es2022.error.d.ts:26

###### Inherited from

```ts
Error.cause
```

##### message

```ts
message: string;
```

Defined in: node\_modules/.pnpm/typescript@5.8.3/node\_modules/typescript/lib/lib.es5.d.ts:1077

###### Inherited from

```ts
Error.message
```

##### stack?

```ts
optional stack: string;
```

Defined in: node\_modules/.pnpm/typescript@5.8.3/node\_modules/typescript/lib/lib.es5.d.ts:1078

###### Inherited from

```ts
Error.stack
```

##### prepareStackTrace()?

```ts
static optional prepareStackTrace: (err, stackTraces) => any;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:98

Optional override for formatting stack traces

###### Parameters

###### err

`Error`

###### stackTraces

`CallSite`[]

###### Returns

`any`

###### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

###### Inherited from

```ts
Error.prepareStackTrace
```

##### stackTraceLimit

```ts
static stackTraceLimit: number;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:100

###### Inherited from

```ts
Error.stackTraceLimit
```

***

### NotEmptyError

Defined in: [packages/fs/src/error/not-empty-error.ts:4](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/not-empty-error.ts#L4)

Error thrown when a directory is not empty.

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new NotEmptyError(message): NotEmptyError;
```

Defined in: [packages/fs/src/error/not-empty-error.ts:9](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/not-empty-error.ts#L9)

Creates a new instance.

###### Parameters

###### message

`string`

The error message.

###### Returns

[`NotEmptyError`](#notemptyerror)

###### Overrides

```ts
Error.constructor
```

#### Accessors

##### code

###### Get Signature

```ts
get code(): string;
```

Defined in: [packages/fs/src/error/not-empty-error.ts:14](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/not-empty-error.ts#L14)

###### Returns

`string`

###### Set Signature

```ts
set code(_name): void;
```

Defined in: [packages/fs/src/error/not-empty-error.ts:19](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/not-empty-error.ts#L19)

###### Parameters

###### \_name

`string`

###### Returns

`void`

##### name

###### Get Signature

```ts
get name(): string;
```

Defined in: [packages/fs/src/error/not-empty-error.ts:24](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/not-empty-error.ts#L24)

###### Returns

`string`

###### Set Signature

```ts
set name(_name): void;
```

Defined in: [packages/fs/src/error/not-empty-error.ts:29](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/not-empty-error.ts#L29)

###### Parameters

###### \_name

`string`

###### Returns

`void`

###### Overrides

```ts
Error.name
```

#### Methods

##### captureStackTrace()

```ts
static captureStackTrace(targetObject, constructorOpt?): void;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:91

Create .stack property on a target object

###### Parameters

###### targetObject

`object`

###### constructorOpt?

`Function`

###### Returns

`void`

###### Inherited from

```ts
Error.captureStackTrace
```

#### Properties

##### cause?

```ts
optional cause: unknown;
```

Defined in: node\_modules/.pnpm/typescript@5.8.3/node\_modules/typescript/lib/lib.es2022.error.d.ts:26

###### Inherited from

```ts
Error.cause
```

##### message

```ts
message: string;
```

Defined in: node\_modules/.pnpm/typescript@5.8.3/node\_modules/typescript/lib/lib.es5.d.ts:1077

###### Inherited from

```ts
Error.message
```

##### stack?

```ts
optional stack: string;
```

Defined in: node\_modules/.pnpm/typescript@5.8.3/node\_modules/typescript/lib/lib.es5.d.ts:1078

###### Inherited from

```ts
Error.stack
```

##### prepareStackTrace()?

```ts
static optional prepareStackTrace: (err, stackTraces) => any;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:98

Optional override for formatting stack traces

###### Parameters

###### err

`Error`

###### stackTraces

`CallSite`[]

###### Returns

`any`

###### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

###### Inherited from

```ts
Error.prepareStackTrace
```

##### stackTraceLimit

```ts
static stackTraceLimit: number;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:100

###### Inherited from

```ts
Error.stackTraceLimit
```

***

### NotFoundError

Defined in: [packages/fs/src/error/not-found-error.ts:4](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/not-found-error.ts#L4)

Error thrown when a file or directory is not found.

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new NotFoundError(message): NotFoundError;
```

Defined in: [packages/fs/src/error/not-found-error.ts:9](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/not-found-error.ts#L9)

Creates a new instance.

###### Parameters

###### message

`string`

The error message.

###### Returns

[`NotFoundError`](#notfounderror)

###### Overrides

```ts
Error.constructor
```

#### Accessors

##### code

###### Get Signature

```ts
get code(): string;
```

Defined in: [packages/fs/src/error/not-found-error.ts:14](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/not-found-error.ts#L14)

###### Returns

`string`

###### Set Signature

```ts
set code(_name): void;
```

Defined in: [packages/fs/src/error/not-found-error.ts:19](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/not-found-error.ts#L19)

###### Parameters

###### \_name

`string`

###### Returns

`void`

##### name

###### Get Signature

```ts
get name(): string;
```

Defined in: [packages/fs/src/error/not-found-error.ts:24](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/not-found-error.ts#L24)

###### Returns

`string`

###### Set Signature

```ts
set name(_name): void;
```

Defined in: [packages/fs/src/error/not-found-error.ts:29](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/not-found-error.ts#L29)

###### Parameters

###### \_name

`string`

###### Returns

`void`

###### Overrides

```ts
Error.name
```

#### Methods

##### captureStackTrace()

```ts
static captureStackTrace(targetObject, constructorOpt?): void;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:91

Create .stack property on a target object

###### Parameters

###### targetObject

`object`

###### constructorOpt?

`Function`

###### Returns

`void`

###### Inherited from

```ts
Error.captureStackTrace
```

#### Properties

##### cause?

```ts
optional cause: unknown;
```

Defined in: node\_modules/.pnpm/typescript@5.8.3/node\_modules/typescript/lib/lib.es2022.error.d.ts:26

###### Inherited from

```ts
Error.cause
```

##### message

```ts
message: string;
```

Defined in: node\_modules/.pnpm/typescript@5.8.3/node\_modules/typescript/lib/lib.es5.d.ts:1077

###### Inherited from

```ts
Error.message
```

##### stack?

```ts
optional stack: string;
```

Defined in: node\_modules/.pnpm/typescript@5.8.3/node\_modules/typescript/lib/lib.es5.d.ts:1078

###### Inherited from

```ts
Error.stack
```

##### prepareStackTrace()?

```ts
static optional prepareStackTrace: (err, stackTraces) => any;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:98

Optional override for formatting stack traces

###### Parameters

###### err

`Error`

###### stackTraces

`CallSite`[]

###### Returns

`any`

###### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

###### Inherited from

```ts
Error.prepareStackTrace
```

##### stackTraceLimit

```ts
static stackTraceLimit: number;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:100

###### Inherited from

```ts
Error.stackTraceLimit
```

***

### PermissionError

Defined in: [packages/fs/src/error/permission-error.ts:4](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/permission-error.ts#L4)

Error thrown when an operation is not permitted.

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new PermissionError(message): PermissionError;
```

Defined in: [packages/fs/src/error/permission-error.ts:9](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/permission-error.ts#L9)

Creates a new instance.

###### Parameters

###### message

`string`

The error message.

###### Returns

[`PermissionError`](#permissionerror)

###### Overrides

```ts
Error.constructor
```

#### Accessors

##### code

###### Get Signature

```ts
get code(): string;
```

Defined in: [packages/fs/src/error/permission-error.ts:14](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/permission-error.ts#L14)

###### Returns

`string`

###### Set Signature

```ts
set code(_name): void;
```

Defined in: [packages/fs/src/error/permission-error.ts:19](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/permission-error.ts#L19)

###### Parameters

###### \_name

`string`

###### Returns

`void`

##### name

###### Get Signature

```ts
get name(): string;
```

Defined in: [packages/fs/src/error/permission-error.ts:24](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/permission-error.ts#L24)

###### Returns

`string`

###### Set Signature

```ts
set name(_name): void;
```

Defined in: [packages/fs/src/error/permission-error.ts:29](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/permission-error.ts#L29)

###### Parameters

###### \_name

`string`

###### Returns

`void`

###### Overrides

```ts
Error.name
```

#### Methods

##### captureStackTrace()

```ts
static captureStackTrace(targetObject, constructorOpt?): void;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:91

Create .stack property on a target object

###### Parameters

###### targetObject

`object`

###### constructorOpt?

`Function`

###### Returns

`void`

###### Inherited from

```ts
Error.captureStackTrace
```

#### Properties

##### cause?

```ts
optional cause: unknown;
```

Defined in: node\_modules/.pnpm/typescript@5.8.3/node\_modules/typescript/lib/lib.es2022.error.d.ts:26

###### Inherited from

```ts
Error.cause
```

##### message

```ts
message: string;
```

Defined in: node\_modules/.pnpm/typescript@5.8.3/node\_modules/typescript/lib/lib.es5.d.ts:1077

###### Inherited from

```ts
Error.message
```

##### stack?

```ts
optional stack: string;
```

Defined in: node\_modules/.pnpm/typescript@5.8.3/node\_modules/typescript/lib/lib.es5.d.ts:1078

###### Inherited from

```ts
Error.stack
```

##### prepareStackTrace()?

```ts
static optional prepareStackTrace: (err, stackTraces) => any;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:98

Optional override for formatting stack traces

###### Parameters

###### err

`Error`

###### stackTraces

`CallSite`[]

###### Returns

`any`

###### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

###### Inherited from

```ts
Error.prepareStackTrace
```

##### stackTraceLimit

```ts
static stackTraceLimit: number;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:100

###### Inherited from

```ts
Error.stackTraceLimit
```

***

### WalkError

Defined in: [packages/fs/src/error/walk-error.ts:7](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/walk-error.ts#L7)

Error thrown in walk or walkSync during iteration.

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new WalkError(cause, root): WalkError;
```

Defined in: [packages/fs/src/error/walk-error.ts:12](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/walk-error.ts#L12)

Constructs a new instance.

###### Parameters

###### cause

`unknown`

###### root

`string`

###### Returns

[`WalkError`](#walkerror)

###### Overrides

```ts
Error.constructor
```

#### Accessors

##### name

###### Get Signature

```ts
get name(): string;
```

Defined in: [packages/fs/src/error/walk-error.ts:21](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/walk-error.ts#L21)

###### Returns

`string`

###### Set Signature

```ts
set name(_name): void;
```

Defined in: [packages/fs/src/error/walk-error.ts:26](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/walk-error.ts#L26)

###### Parameters

###### \_name

`string`

###### Returns

`void`

###### Overrides

```ts
Error.name
```

#### Methods

##### captureStackTrace()

```ts
static captureStackTrace(targetObject, constructorOpt?): void;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:91

Create .stack property on a target object

###### Parameters

###### targetObject

`object`

###### constructorOpt?

`Function`

###### Returns

`void`

###### Inherited from

```ts
Error.captureStackTrace
```

#### Properties

##### cause?

```ts
optional cause: unknown;
```

Defined in: node\_modules/.pnpm/typescript@5.8.3/node\_modules/typescript/lib/lib.es2022.error.d.ts:26

###### Inherited from

```ts
Error.cause
```

##### message

```ts
message: string;
```

Defined in: node\_modules/.pnpm/typescript@5.8.3/node\_modules/typescript/lib/lib.es5.d.ts:1077

###### Inherited from

```ts
Error.message
```

##### root

```ts
root: string;
```

Defined in: [packages/fs/src/error/walk-error.ts:9](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/walk-error.ts#L9)

File path of the root that's being walked.

##### stack?

```ts
optional stack: string;
```

Defined in: node\_modules/.pnpm/typescript@5.8.3/node\_modules/typescript/lib/lib.es5.d.ts:1078

###### Inherited from

```ts
Error.stack
```

##### prepareStackTrace()?

```ts
static optional prepareStackTrace: (err, stackTraces) => any;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:98

Optional override for formatting stack traces

###### Parameters

###### err

`Error`

###### stackTraces

`CallSite`[]

###### Returns

`any`

###### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

###### Inherited from

```ts
Error.prepareStackTrace
```

##### stackTraceLimit

```ts
static stackTraceLimit: number;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:100

###### Inherited from

```ts
Error.stackTraceLimit
```

## References

### JSONError

Re-exports [JSONError](utils.md#jsonerror)
# index

## Functions

### collect()

```ts
function collect(directory, options): Promise<string[]>;
```

Defined in: [packages/fs/src/find/collect.ts:4](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/find/collect.ts#L4)

#### Parameters

##### directory

`string`

##### options

[`WalkOptions`](#walkoptions) = `{}`

#### Returns

`Promise`\<`string`[]\>

***

### collectSync()

```ts
function collectSync(directory, options): string[];
```

Defined in: [packages/fs/src/find/collect-sync.ts:4](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/find/collect-sync.ts#L4)

#### Parameters

##### directory

`string`

##### options

[`WalkOptions`](#walkoptions) = `{}`

#### Returns

`string`[]

***

### detect()

```ts
function detect(content): "\n" | "\r\n";
```

Defined in: [packages/fs/src/eol.ts:20](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/eol.ts#L20)

Detect the EOL character for string input.
Returns null if no newline.

#### Parameters

##### content

`string`

#### Returns

"\n" \| "\r\n"

***

### emptyDir()

```ts
function emptyDir(dir, options?): Promise<void>;
```

Defined in: [packages/fs/src/remove/empty-dir.ts:19](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/remove/empty-dir.ts#L19)

Ensures that a directory is empty.
Deletes directory contents if the directory is not empty.
If the directory does not exist, it is created.
The directory itself is not deleted.

#### Parameters

##### dir

`string` | `URL`

##### options?

[`EmptyDirOptions`](#emptydiroptions)

#### Returns

`Promise`\<`void`\>

***

### emptyDirSync()

```ts
function emptyDirSync(dir, options?): void;
```

Defined in: [packages/fs/src/remove/empty-dir-sync.ts:18](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/remove/empty-dir-sync.ts#L18)

Ensures that a directory is empty.
Deletes directory contents if the directory is not empty.
If the directory does not exist, it is created.
The directory itself is not deleted.

#### Parameters

##### dir

`string` | `URL`

##### options?

[`EmptyDirOptions`](#emptydiroptions)

#### Returns

`void`

***

### ensureDir()

```ts
function ensureDir(directory): Promise<void>;
```

Defined in: [packages/fs/src/ensure/ensure-dir.ts:12](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/ensure/ensure-dir.ts#L12)

Ensures that the directory exists.
If the directory structure does not exist, it is created. Like mkdir -p.

#### Parameters

##### directory

`string` | `URL`

#### Returns

`Promise`\<`void`\>

***

### ensureDirSync()

```ts
function ensureDirSync(directory): void;
```

Defined in: [packages/fs/src/ensure/ensure-dir-sync.ts:12](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/ensure/ensure-dir-sync.ts#L12)

Ensures that the directory exists.
If the directory structure does not exist, it is created. Like mkdir -p.

#### Parameters

##### directory

`string` | `URL`

#### Returns

`void`

***

### ensureFile()

```ts
function ensureFile(filePath): Promise<void>;
```

Defined in: [packages/fs/src/ensure/ensure-file.ts:16](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/ensure/ensure-file.ts#L16)

Ensures that the file exists.
If the file that is requested to be created is in directories that do not exist,
these directories are created. If the file already exists, it is NOTMODIFIED.

#### Parameters

##### filePath

`string` | `URL`

#### Returns

`Promise`\<`void`\>

***

### ensureFileSync()

```ts
function ensureFileSync(filePath): void;
```

Defined in: [packages/fs/src/ensure/ensure-file-sync.ts:16](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/ensure/ensure-file-sync.ts#L16)

Ensures that the file exists.
If the file that is requested to be created is in directories that do not exist,
these directories are created. If the file already exists, it is NOTMODIFIED.

#### Parameters

##### filePath

`string` | `URL`

#### Returns

`void`

***

### ensureLink()

```ts
function ensureLink(source, destination): Promise<void>;
```

Defined in: [packages/fs/src/ensure/ensure-link.ts:15](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/ensure/ensure-link.ts#L15)

Ensures that the hard link exists.
If the directory structure does not exist, it is created.

#### Parameters

##### source

`string` | `URL`

##### destination

`string` | `URL`

#### Returns

`Promise`\<`void`\>

***

### ensureLinkSync()

```ts
function ensureLinkSync(source, destination): void;
```

Defined in: [packages/fs/src/ensure/ensure-link-sync.ts:15](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/ensure/ensure-link-sync.ts#L15)

Ensures that the hard link exists.
If the directory structure does not exist, it is created.

#### Parameters

##### source

`string` | `URL`

##### destination

`string` | `URL`

#### Returns

`void`

***

### ensureSymlink()

```ts
function ensureSymlink(
   target, 
   linkName, 
type?): Promise<void>;
```

Defined in: [packages/fs/src/ensure/ensure-symlink.ts:28](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/ensure/ensure-symlink.ts#L28)

Ensures that the link exists, and points to a valid file.
If the directory structure does not exist, it is created.
If the link already exists, it is not modified but error is thrown if it is not point to the given target.

#### Parameters

##### target

the source file path

`string` | `URL`

##### linkName

the destination link path

`string` | `URL`

##### type?

`Type`

the type of the symlink, or null to use automatic detection

#### Returns

`Promise`\<`void`\>

A void promise that resolves once the link exists.

***

### ensureSymlinkSync()

```ts
function ensureSymlinkSync(
   target, 
   linkName, 
   type?): void;
```

Defined in: [packages/fs/src/ensure/ensure-symlink-sync.ts:28](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/ensure/ensure-symlink-sync.ts#L28)

Ensures that the link exists, and points to a valid file.
If the directory structure does not exist, it is created.
If the link already exists, it is not modified but error is thrown if it is not point to the given target.

#### Parameters

##### target

the source file path

`string` | `URL`

##### linkName

the destination link path

`string` | `URL`

##### type?

`Type`

the type of the symlink, or null to use automatic detection

#### Returns

`void`

A void.

***

### findUp()

```ts
function findUp(name, options): Promise<string>;
```

Defined in: [packages/fs/src/find/find-up.ts:11](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/find/find-up.ts#L11)

#### Parameters

##### name

[`FindUpName`](#findupname)

##### options

[`FindUpOptions`](#findupoptions) = `{}`

#### Returns

`Promise`\<`string`\>

***

### findUpSync()

```ts
function findUpSync(name, options): string;
```

Defined in: [packages/fs/src/find/find-up-sync.ts:11](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/find/find-up-sync.ts#L11)

#### Parameters

##### name

[`FindUpNameSync`](#findupnamesync)

##### options

[`FindUpOptions`](#findupoptions) = `{}`

#### Returns

`string`

***

### format()

```ts
function format(content, eol): string;
```

Defined in: [packages/fs/src/eol.ts:36](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/eol.ts#L36)

Format the file to the targeted EOL.

#### Parameters

##### content

`string`

##### eol

"\n" | "\r\n"

#### Returns

`string`

***

### isAccessible()

```ts
function isAccessible(path, mode?): Promise<boolean>;
```

Defined in: [packages/fs/src/is-accessible.ts:9](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/is-accessible.ts#L9)

Returns a Promise that resolves to a boolean indicating if the path is accessible or not.

#### Parameters

##### path

`string` | `URL`

##### mode?

`number`

#### Returns

`Promise`\<`boolean`\>

***

### isAccessibleSync()

```ts
function isAccessibleSync(path, mode?): boolean;
```

Defined in: [packages/fs/src/is-accessible-sync.ts:9](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/is-accessible-sync.ts#L9)

Returns a boolean indicating if the path is accessible or not.

#### Parameters

##### path

`string` | `URL`

##### mode?

`number`

#### Returns

`boolean`

***

### move()

```ts
function move(
   sourcePath, 
   destinationPath, 
options): Promise<void>;
```

Defined in: [packages/fs/src/move/index.ts:35](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/move/index.ts#L35)

Move a file asynchronously.

#### Parameters

##### sourcePath

`string`

The file you want to move.

##### destinationPath

`string`

Where you want the file moved.

##### options

[`MoveOptions`](#moveoptions) = `{}`

Configuration options.

#### Returns

`Promise`\<`void`\>

A `Promise` that resolves when the file has been moved.

#### Example

```
import { moveFile } from '@visulima/fs';

await moveFile('source/test.png', 'destination/test.png');
console.log('The file has been moved');
```

***

### moveSync()

```ts
function moveSync(
   sourcePath, 
   destinationPath, 
   options?): void;
```

Defined in: [packages/fs/src/move/index.ts:61](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/move/index.ts#L61)

Move a file synchronously.

#### Parameters

##### sourcePath

`string`

The file you want to move.

##### destinationPath

`string`

Where you want the file moved.

##### options?

[`MoveOptions`](#moveoptions)

Configuration options.

#### Returns

`void`

Nothing is returned.

#### Example

```
import { moveFileSync } from '@visulima/fs';

moveFileSync('source/test.png', 'destination/test.png');
console.log('The file has been moved');
```

***

### readFile()

```ts
function readFile<O>(path, options?): Promise<ContentType<O>>;
```

Defined in: [packages/fs/src/read/read-file.ts:20](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/read/read-file.ts#L20)

#### Type Parameters

##### O

`O` *extends* [`ReadFileOptions`](#readfileoptions)\<`"brotli"` \| `"gzip"` \| `"none"`\> = `undefined`

#### Parameters

##### path

`string` | `URL`

##### options?

`O`

#### Returns

`Promise`\<`ContentType`\<`O`\>\>

***

### readFileSync()

```ts
function readFileSync<O>(path, options?): ContentType<O>;
```

Defined in: [packages/fs/src/read/read-file-sync.ts:18](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/read/read-file-sync.ts#L18)

#### Type Parameters

##### O

`O` *extends* [`ReadFileOptions`](#readfileoptions)\<`"brotli"` \| `"gzip"` \| `"none"`\> = `undefined`

#### Parameters

##### path

`string` | `URL`

##### options?

`O`

#### Returns

`ContentType`\<`O`\>

***

### readJson()

#### Call Signature

```ts
function readJson<T>(path, options?): Promise<T>;
```

Defined in: [packages/fs/src/read/read-json.ts:8](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/read/read-json.ts#L8)

##### Type Parameters

###### T

`T` *extends* `JsonValue`

##### Parameters

###### path

`string` | `URL`

###### options?

[`ReadJsonOptions`](#readjsonoptions)

##### Returns

`Promise`\<`T`\>

#### Call Signature

```ts
function readJson<T>(
   path, 
   reviver, 
options?): Promise<T>;
```

Defined in: [packages/fs/src/read/read-json.ts:10](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/read/read-json.ts#L10)

##### Type Parameters

###### T

`T` *extends* `JsonValue`

##### Parameters

###### path

`string` | `URL`

###### reviver

(`this`, `key`, `value`) => `any`

###### options?

[`ReadJsonOptions`](#readjsonoptions)

##### Returns

`Promise`\<`T`\>

***

### readJsonSync()

#### Call Signature

```ts
function readJsonSync<T>(path, options?): T;
```

Defined in: [packages/fs/src/read/read-json-sync.ts:8](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/read/read-json-sync.ts#L8)

##### Type Parameters

###### T

`T` *extends* `JsonValue`

##### Parameters

###### path

`string` | `URL`

###### options?

[`ReadJsonOptions`](#readjsonoptions)

##### Returns

`T`

#### Call Signature

```ts
function readJsonSync<T>(
   path, 
   reviver, 
   options?): T;
```

Defined in: [packages/fs/src/read/read-json-sync.ts:10](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/read/read-json-sync.ts#L10)

##### Type Parameters

###### T

`T` *extends* `JsonValue`

##### Parameters

###### path

`string` | `URL`

###### reviver

(`this`, `key`, `value`) => `any`

###### options?

[`ReadJsonOptions`](#readjsonoptions)

##### Returns

`T`

***

### remove()

```ts
function remove(path, options): Promise<void>;
```

Defined in: [packages/fs/src/remove/remove.ts:5](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/remove/remove.ts#L5)

#### Parameters

##### path

`string` | `URL`

##### options

###### maxRetries?

`number`

If an `EBUSY`, `EMFILE`, `ENFILE`, `ENOTEMPTY`, or
`EPERM` error is encountered, Node.js will retry the operation with a linear
backoff wait of `retryDelay` ms longer on each try. This option represents the
number of retries. This option is ignored if the `recursive` option is not
`true`.

**Default**

```ts
0
```

###### retryDelay?

`number`

The amount of time in milliseconds to wait between retries.
This option is ignored if the `recursive` option is not `true`.

**Default**

```ts
100
```

#### Returns

`Promise`\<`void`\>

***

### removeSync()

```ts
function removeSync(path, options): void;
```

Defined in: [packages/fs/src/remove/remove-sync.ts:5](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/remove/remove-sync.ts#L5)

#### Parameters

##### path

`string` | `URL`

##### options

###### maxRetries?

`number`

If an `EBUSY`, `EMFILE`, `ENFILE`, `ENOTEMPTY`, or
`EPERM` error is encountered, Node.js will retry the operation with a linear
backoff wait of `retryDelay` ms longer on each try. This option represents the
number of retries. This option is ignored if the `recursive` option is not
`true`.

**Default**

```ts
0
```

###### retryDelay?

`number`

The amount of time in milliseconds to wait between retries.
This option is ignored if the `recursive` option is not `true`.

**Default**

```ts
100
```

#### Returns

`void`

***

### rename()

```ts
function rename(
   source, 
   destination, 
options?): Promise<void>;
```

Defined in: [packages/fs/src/move/index.ts:85](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/move/index.ts#L85)

Rename a file asynchronously.

#### Parameters

##### source

`string`

The file you want to rename.

##### destination

`string`

The name of the renamed file.

##### options?

[`MoveOptions`](#moveoptions)

Configuration options.

#### Returns

`Promise`\<`void`\>

A `Promise` that resolves when the file has been renamed.

#### Example

```
import { renameFile } from '@visulima/fs';

await renameFile('test.png', 'tests.png', {cwd: 'source'});
console.log('The file has been renamed');
```

***

### renameSync()

```ts
function renameSync(
   source, 
   destination, 
   options?): void;
```

Defined in: [packages/fs/src/move/index.ts:109](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/move/index.ts#L109)

Rename a file synchronously.

#### Parameters

##### source

`string`

The file you want to rename.

##### destination

`string`

The name of the renamed file.

##### options?

[`MoveOptions`](#moveoptions)

Configuration options.

#### Returns

`void`

A `Promise` that resolves when the file has been renamed.

#### Example

```
import {renameFileSync} from '@visulima/fs';

renameFileSync('test.png', 'tests.png', {cwd: 'source'});
console.log('The file has been renamed');
```

***

### walk()

```ts
function walk(directory, __namedParameters): AsyncIterableIterator<WalkEntry>;
```

Defined in: [packages/fs/src/find/walk.ts:49](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/find/walk.ts#L49)

Walks the file tree rooted at root, yielding each file or directory in the
tree filtered according to the given options.
Options:
- maxDepth?: number = Infinity;
- includeFiles?: boolean = true;
- includeDirs?: boolean = true;
- includeSymlinks?: boolean = true;
- followSymlinks?: boolean = false;
- extensions?: string[];
- match?: string | ReadonlyArray<string>;
- skip?: string | ReadonlyArray<string>;

#### Parameters

##### directory

`string` | `URL`

##### \_\_namedParameters

[`WalkOptions`](#walkoptions) = `{}`

#### Returns

`AsyncIterableIterator`\<[`WalkEntry`](#walkentry)\>

***

### walkSync()

```ts
function walkSync(directory, __namedParameters): IterableIterator<WalkEntry>;
```

Defined in: [packages/fs/src/find/walk-sync.ts:40](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/find/walk-sync.ts#L40)

Same as [`walk`](#walk) but uses synchronous ops

#### Parameters

##### directory

`string` | `URL`

##### \_\_namedParameters

[`WalkOptions`](#walkoptions) = `{}`

#### Returns

`IterableIterator`\<[`WalkEntry`](#walkentry)\>

***

### writeFile()

```ts
function writeFile(
   path, 
   content, 
options?): Promise<void>;
```

Defined in: [packages/fs/src/write/write-file.ts:15](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/write/write-file.ts#L15)

#### Parameters

##### path

`string` | `URL`

##### content

`string` | `ArrayBuffer` | `ArrayBufferView`\<`ArrayBufferLike`\>

##### options?

[`WriteFileOptions`](#writefileoptions)

#### Returns

`Promise`\<`void`\>

***

### writeFileSync()

```ts
function writeFileSync(
   path, 
   content, 
   options?): void;
```

Defined in: [packages/fs/src/write/write-file-sync.ts:15](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/write/write-file-sync.ts#L15)

#### Parameters

##### path

`string` | `URL`

##### content

`string` | `ArrayBuffer` | `ArrayBufferView`\<`ArrayBufferLike`\>

##### options?

[`WriteFileOptions`](#writefileoptions)

#### Returns

`void`

***

### writeJson()

```ts
function writeJson(
   path, 
   data, 
options): Promise<void>;
```

Defined in: [packages/fs/src/write/write-json.ts:11](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/write/write-json.ts#L11)

#### Parameters

##### path

`string` | `URL`

##### data

`unknown`

##### options

[`WriteJsonOptions`](#writejsonoptions) = `{}`

#### Returns

`Promise`\<`void`\>

***

### writeJsonSync()

```ts
function writeJsonSync(
   path, 
   data, 
   options): void;
```

Defined in: [packages/fs/src/write/write-json-sync.ts:11](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/write/write-json-sync.ts#L11)

#### Parameters

##### path

`string` | `URL`

##### data

`unknown`

##### options

[`WriteJsonOptions`](#writejsonoptions) = `{}`

#### Returns

`void`

## Variables

### CRLF

```ts
const CRLF: "\r\n";
```

Defined in: [packages/fs/src/eol.ts:9](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/eol.ts#L9)

End-of-line character for Windows platforms.

***

### EOL

```ts
const EOL: "\n" | "\r\n";
```

Defined in: [packages/fs/src/eol.ts:14](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/eol.ts#L14)

End-of-line character evaluated for the current platform.

***

### F\_OK

```ts
const F_OK: 0 = 0;
```

Defined in: [packages/fs/src/constants.ts:2](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/constants.ts#L2)

Is the path visible to the calling process?

***

### FIND\_UP\_STOP

```ts
const FIND_UP_STOP: typeof FIND_UP_STOP;
```

Defined in: [packages/fs/src/constants.ts:13](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/constants.ts#L13)

***

### LF

```ts
const LF: "\n";
```

Defined in: [packages/fs/src/eol.ts:6](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/eol.ts#L6)

End-of-line character for POSIX platforms such as macOS and Linux.

***

### R\_OK

```ts
const R_OK: 4 = 4;
```

Defined in: [packages/fs/src/constants.ts:5](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/constants.ts#L5)

Is the path readable to the calling process?

***

### W\_OK

```ts
const W_OK: 2 = 2;
```

Defined in: [packages/fs/src/constants.ts:8](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/constants.ts#L8)

Is the path writable to the calling process?

***

### X\_OK

```ts
const X_OK: 1 = 1;
```

Defined in: [packages/fs/src/constants.ts:11](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/constants.ts#L11)

Is the path executable to the calling process?

## Interfaces

### WalkEntry

Defined in: [packages/fs/src/types.ts:56](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L56)

#### Extends

- `Pick`\<`Dirent`, `"isDirectory"` \| `"isFile"` \| `"isSymbolicLink"` \| `"name"`\>

#### Methods

##### isDirectory()

```ts
isDirectory(): boolean;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/fs.d.ts:190

Returns `true` if the `fs.Dirent` object describes a file system
directory.

###### Returns

`boolean`

###### Since

v10.10.0

###### Inherited from

```ts
Pick.isDirectory
```

##### isFile()

```ts
isFile(): boolean;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/fs.d.ts:184

Returns `true` if the `fs.Dirent` object describes a regular file.

###### Returns

`boolean`

###### Since

v10.10.0

###### Inherited from

```ts
Pick.isFile
```

##### isSymbolicLink()

```ts
isSymbolicLink(): boolean;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/fs.d.ts:205

Returns `true` if the `fs.Dirent` object describes a symbolic link.

###### Returns

`boolean`

###### Since

v10.10.0

###### Inherited from

```ts
Pick.isSymbolicLink
```

#### Properties

##### name

```ts
name: string;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/fs.d.ts:222

The file name that this `fs.Dirent` object refers to. The type of this
value is determined by the `options.encoding` passed to readdir or readdirSync.

###### Since

v10.10.0

###### Inherited from

```ts
Pick.name
```

##### path

```ts
path: string;
```

Defined in: [packages/fs/src/types.ts:57](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L57)

***

### WalkOptions

Defined in: [packages/fs/src/types.ts:9](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L9)

#### Properties

##### extensions?

```ts
optional extensions: string[];
```

Defined in: [packages/fs/src/types.ts:15](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L15)

List of file extensions used to filter entries.
If specified, entries without the file extension specified by this option are excluded.

###### Default

```ts
{undefined}
```

##### followSymlinks?

```ts
optional followSymlinks: boolean;
```

Defined in: [packages/fs/src/types.ts:20](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L20)

Indicates whether symlinks should be resolved or not.

###### Default

```ts
{false}
```

##### includeDirs?

```ts
optional includeDirs: boolean;
```

Defined in: [packages/fs/src/types.ts:25](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L25)

Indicates whether directory entries should be included or not.

###### Default

```ts
{true}
```

##### includeFiles?

```ts
optional includeFiles: boolean;
```

Defined in: [packages/fs/src/types.ts:30](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L30)

Indicates whether file entries should be included or not.

###### Default

```ts
{true}
```

##### includeSymlinks?

```ts
optional includeSymlinks: boolean;
```

Defined in: [packages/fs/src/types.ts:36](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L36)

Indicates whether symlink entries should be included or not.
This option is meaningful only if `followSymlinks` is set to `false`.

###### Default

```ts
{true}
```

##### match?

```ts
optional match: (string | RegExp)[];
```

Defined in: [packages/fs/src/types.ts:42](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L42)

List of regular expression or glob patterns used to filter entries.
If specified, entries that do not match the patterns specified by this option are excluded.

###### Default

```ts
{undefined}
```

##### maxDepth?

```ts
optional maxDepth: number;
```

Defined in: [packages/fs/src/types.ts:47](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L47)

The maximum depth of the file tree to be walked recursively.

###### Default

```ts
{Infinity}
```

##### skip?

```ts
optional skip: (string | RegExp)[];
```

Defined in: [packages/fs/src/types.ts:53](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L53)

List of regular expression or glob patterns used to filter entries.
If specified, entries matching the patterns specified by this option are excluded.

###### Default

```ts
{undefined}
```

## Type Aliases

### CodeFrameLocation

```ts
type CodeFrameLocation = object;
```

Defined in: [packages/fs/src/types.ts:91](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L91)

#### Properties

##### column?

```ts
optional column: number;
```

Defined in: [packages/fs/src/types.ts:92](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L92)

##### line

```ts
line: number;
```

Defined in: [packages/fs/src/types.ts:93](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L93)

***

### EmptyDirOptions

```ts
type EmptyDirOptions = object;
```

Defined in: [packages/fs/src/types.ts:188](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L188)

#### Properties

##### maxRetries?

```ts
optional maxRetries: number;
```

Defined in: [packages/fs/src/types.ts:197](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L197)

If an `EBUSY`, `EMFILE`, `ENFILE`, `ENOTEMPTY`, or
`EPERM` error is encountered, Node.js will retry the operation with a linear
backoff wait of `retryDelay` ms longer on each try. This option represents the
number of retries. This option is ignored if the `recursive` option is not
`true`.

###### Default

```ts
0
```

##### retryDelay?

```ts
optional retryDelay: number;
```

Defined in: [packages/fs/src/types.ts:203](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L203)

The amount of time in milliseconds to wait between retries.
This option is ignored if the `recursive` option is not `true`.

###### Default

```ts
100
```

***

### FindUpName

```ts
type FindUpName = 
  | string[]
  | string
  | (directory) => FindUpNameFnResult;
```

Defined in: [packages/fs/src/types.ts:180](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L180)

***

### FindUpNameFnResult

```ts
type FindUpNameFnResult = 
  | PathLike
  | Promise<PathLike | typeof FIND_UP_STOP>
  | typeof FIND_UP_STOP
  | undefined;
```

Defined in: [packages/fs/src/types.ts:178](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L178)

***

### FindUpNameSync

```ts
type FindUpNameSync = 
  | string[]
  | string
  | (directory) => FindUpNameSyncFnResult;
```

Defined in: [packages/fs/src/types.ts:185](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L185)

***

### FindUpNameSyncFnResult

```ts
type FindUpNameSyncFnResult = PathLike | typeof FIND_UP_STOP | undefined;
```

Defined in: [packages/fs/src/types.ts:183](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L183)

***

### FindUpOptions

```ts
type FindUpOptions = object;
```

Defined in: [packages/fs/src/types.ts:170](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L170)

#### Properties

##### allowSymlinks?

```ts
optional allowSymlinks: boolean;
```

Defined in: [packages/fs/src/types.ts:171](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L171)

##### cwd?

```ts
optional cwd: URL | string;
```

Defined in: [packages/fs/src/types.ts:172](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L172)

##### stopAt?

```ts
optional stopAt: URL | string;
```

Defined in: [packages/fs/src/types.ts:173](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L173)

##### type?

```ts
optional type: "directory" | "file";
```

Defined in: [packages/fs/src/types.ts:174](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L174)

***

### JsonReplacer

```ts
type JsonReplacer = (number | string)[] | (this, key, value) => unknown | null;
```

Defined in: [packages/fs/src/types.ts:143](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L143)

***

### JsonReviver

```ts
type JsonReviver = Parameters<typeof JSON["parse"]>["1"];
```

Defined in: [packages/fs/src/types.ts:89](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L89)

***

### MoveOptions

```ts
type MoveOptions = object;
```

Defined in: [packages/fs/src/move/types.ts:3](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/move/types.ts#L3)

#### Properties

##### cwd?

```ts
optional cwd: URL | string;
```

Defined in: [packages/fs/src/move/types.ts:10](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/move/types.ts#L10)

The working directory to find source files.
The source and destination path are relative to this.

###### Default

```ts
process.cwd()
```

##### directoryMode?

```ts
readonly optional directoryMode: FilePermissions;
```

Defined in: [packages/fs/src/move/types.ts:19](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/move/types.ts#L19)

[Permissions](https://en.wikipedia.org/wiki/File-system_permissions#Numeric_notation) for created directories.

It has no effect on Windows.

###### Default

```ts
0o777
```

##### overwrite?

```ts
readonly optional overwrite: boolean;
```

Defined in: [packages/fs/src/move/types.ts:26](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/move/types.ts#L26)

Overwrite existing destination file.

###### Default

```ts
true
```

***

### ReadFileEncoding

```ts
type ReadFileEncoding = 
  | "ascii"
  | "base64"
  | "base64url"
  | "hex"
  | "latin1"
  | "ucs-2"
  | "ucs2"
  | "utf-8"
  | "utf-16le"
  | "utf8"
  | "utf16le";
```

Defined in: [packages/fs/src/types.ts:61](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L61)

***

### ReadFileOptions\<C\>

```ts
type ReadFileOptions<C> = object;
```

Defined in: [packages/fs/src/types.ts:63](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L63)

#### Type Parameters

##### C

`C`

#### Properties

##### buffer?

```ts
optional buffer: boolean;
```

Defined in: [packages/fs/src/types.ts:67](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L67)

Return content as a Buffer. Default: `false`

##### compression?

```ts
optional compression: C;
```

Defined in: [packages/fs/src/types.ts:72](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L72)

Compression method to decompress the file against. Default: `none`

##### encoding?

```ts
optional encoding: ReadFileEncoding;
```

Defined in: [packages/fs/src/types.ts:78](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L78)

The encoding to use. Default: `utf8`

###### See

https://nodejs.org/api/buffer.html#buffer_buffers_and_character_encodings

##### flag?

```ts
optional flag: number | string;
```

Defined in: [packages/fs/src/types.ts:83](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L83)

The flag used to open the file. Default: `r`

***

### ReadJsonOptions

```ts
type ReadJsonOptions = CodeFrameOptions & object;
```

Defined in: [packages/fs/src/types.ts:104](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L104)

#### Type declaration

##### beforeParse()?

```ts
optional beforeParse: (source) => string;
```

###### Parameters

###### source

`string`

###### Returns

`string`

***

### WriteFileOptions

```ts
type WriteFileOptions = object;
```

Defined in: [packages/fs/src/types.ts:108](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L108)

#### Properties

##### chown?

```ts
optional chown: object;
```

Defined in: [packages/fs/src/types.ts:112](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L112)

The group and user ID used to set the file ownership. Default: `undefined`

###### gid

```ts
gid: number;
```

###### uid

```ts
uid: number;
```

##### encoding?

```ts
optional encoding: BufferEncoding | null;
```

Defined in: [packages/fs/src/types.ts:120](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L120)

The encoding to use. Default: `utf8`

##### flag?

```ts
optional flag: string;
```

Defined in: [packages/fs/src/types.ts:125](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L125)

The flag used to write the file. Default: `w`

##### mode?

```ts
optional mode: number;
```

Defined in: [packages/fs/src/types.ts:130](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L130)

The file mode (permission and sticky bits). Default: `0o666`

##### overwrite?

```ts
optional overwrite: boolean;
```

Defined in: [packages/fs/src/types.ts:135](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L135)

Indicates whether the file should be overwritten if it already exists. Default: `false`

##### recursive?

```ts
optional recursive: boolean;
```

Defined in: [packages/fs/src/types.ts:140](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L140)

Recursively create parent directories if needed. Default: `true`

***

### WriteJsonOptions

```ts
type WriteJsonOptions = WriteFileOptions & object;
```

Defined in: [packages/fs/src/types.ts:146](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L146)

#### Type declaration

##### detectIndent?

```ts
optional detectIndent: boolean;
```

Detect indentation automatically if the file exists. Default: `false`

##### indent?

```ts
optional indent: number | string;
```

The space used for pretty-printing.

Pass in `undefined` for no formatting.

##### replacer?

```ts
optional replacer: JsonReplacer;
```

Passed into `JSON.stringify`.

##### stringify()?

```ts
optional stringify: (data, replacer, space) => string;
```

Override the default `JSON.stringify` method.

###### Parameters

###### data

`unknown`

###### replacer

[`JsonReplacer`](#jsonreplacer)

###### space

`number` | `string` | `undefined`

###### Returns

`string`
# size

## Functions

### brotliSize()

```ts
function brotliSize(input, options?): Promise<number>;
```

Defined in: [packages/fs/src/size.ts:112](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/size.ts#L112)

Asynchronously calculates the Brotli compressed size of the input.
Uses memory-efficient streaming for large inputs.

#### Parameters

##### input

`string` | `URL` | `Buffer`\<`ArrayBufferLike`\> | `Readable`

##### options?

`BrotliOptions`

#### Returns

`Promise`\<`number`\>

***

### brotliSizeSync()

```ts
function brotliSizeSync(input, options?): number;
```

Defined in: [packages/fs/src/size.ts:155](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/size.ts#L155)

Synchronously calculates the Brotli compressed size of the input.
Note: For large files, consider using the async brotliSize function instead.

#### Parameters

##### input

`string` | `URL` | `Buffer`\<`ArrayBufferLike`\>

##### options?

`BrotliOptions`

#### Returns

`number`

***

### gzipSize()

```ts
function gzipSize(input, options?): Promise<number>;
```

Defined in: [packages/fs/src/size.ts:101](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/size.ts#L101)

Asynchronously calculates the gzipped size of the input.
Uses memory-efficient streaming for large inputs.

#### Parameters

##### input

`string` | `URL` | `Buffer`\<`ArrayBufferLike`\> | `Readable`

##### options?

`ZlibOptions`

#### Returns

`Promise`\<`number`\>

***

### gzipSizeSync()

```ts
function gzipSizeSync(input, options?): number;
```

Defined in: [packages/fs/src/size.ts:134](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/size.ts#L134)

Synchronously calculates the gzipped size of the input.
Note: For large files, consider using the async gzipSize function instead.

#### Parameters

##### input

`string` | `URL` | `Buffer`\<`ArrayBufferLike`\>

##### options?

`ZlibOptions`

#### Returns

`number`

***

### rawSize()

```ts
function rawSize(input): Promise<number>;
```

Defined in: [packages/fs/src/size.ts:123](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/size.ts#L123)

Asynchronously gets the raw size of the input without compression.
Uses memory-efficient streaming for large inputs.

#### Parameters

##### input

`string` | `URL` | `Buffer`\<`ArrayBufferLike`\> | `Readable`

#### Returns

`Promise`\<`number`\>

***

### rawSizeSync()

```ts
function rawSizeSync(input): number;
```

Defined in: [packages/fs/src/size.ts:176](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/size.ts#L176)

Synchronously gets the raw size of the input without compression.
Note: For large files, consider using the async rawSize function instead.

#### Parameters

##### input

`string` | `URL` | `Buffer`\<`ArrayBufferLike`\>

#### Returns

`number`
# utils

## Classes

### JSONError

Defined in: [packages/fs/src/error/json-error.ts:1](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/json-error.ts#L1)

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new JSONError(message): JSONError;
```

Defined in: [packages/fs/src/error/json-error.ts:11](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/json-error.ts#L11)

###### Parameters

###### message

`string`

###### Returns

[`JSONError`](#jsonerror)

###### Overrides

```ts
Error.constructor
```

#### Accessors

##### message

###### Get Signature

```ts
get message(): string;
```

Defined in: [packages/fs/src/error/json-error.ts:21](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/json-error.ts#L21)

###### Returns

`string`

###### Set Signature

```ts
set message(message): void;
```

Defined in: [packages/fs/src/error/json-error.ts:25](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/json-error.ts#L25)

###### Parameters

###### message

`string`

###### Returns

`void`

###### Overrides

```ts
Error.message
```

#### Methods

##### captureStackTrace()

```ts
static captureStackTrace(targetObject, constructorOpt?): void;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:91

Create .stack property on a target object

###### Parameters

###### targetObject

`object`

###### constructorOpt?

`Function`

###### Returns

`void`

###### Inherited from

```ts
Error.captureStackTrace
```

#### Properties

##### cause?

```ts
optional cause: unknown;
```

Defined in: node\_modules/.pnpm/typescript@5.8.3/node\_modules/typescript/lib/lib.es2022.error.d.ts:26

###### Inherited from

```ts
Error.cause
```

##### codeFrame

```ts
codeFrame: string;
```

Defined in: [packages/fs/src/error/json-error.ts:4](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/json-error.ts#L4)

##### fileName

```ts
fileName: string;
```

Defined in: [packages/fs/src/error/json-error.ts:2](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/json-error.ts#L2)

##### name

```ts
readonly name: "JSONError" = "JSONError";
```

Defined in: [packages/fs/src/error/json-error.ts:7](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/error/json-error.ts#L7)

###### Overrides

```ts
Error.name
```

##### stack?

```ts
optional stack: string;
```

Defined in: node\_modules/.pnpm/typescript@5.8.3/node\_modules/typescript/lib/lib.es5.d.ts:1078

###### Inherited from

```ts
Error.stack
```

##### prepareStackTrace()?

```ts
static optional prepareStackTrace: (err, stackTraces) => any;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:98

Optional override for formatting stack traces

###### Parameters

###### err

`Error`

###### stackTraces

`CallSite`[]

###### Returns

`any`

###### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

###### Inherited from

```ts
Error.prepareStackTrace
```

##### stackTraceLimit

```ts
static stackTraceLimit: number;
```

Defined in: node\_modules/.pnpm/@types+node@18.19.71/node\_modules/@types/node/globals.d.ts:100

###### Inherited from

```ts
Error.stackTraceLimit
```

## Functions

### assertValidFileContents()

```ts
function assertValidFileContents(contents): void;
```

Defined in: [packages/fs/src/utils/assert-valid-file-contents.ts:2](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/utils/assert-valid-file-contents.ts#L2)

#### Parameters

##### contents

`any`

#### Returns

`void`

***

### assertValidFileOrDirectoryPath()

```ts
function assertValidFileOrDirectoryPath(fileOrDirectoryPath): void;
```

Defined in: [packages/fs/src/utils/assert-valid-file-or-directory-path.ts:2](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/utils/assert-valid-file-or-directory-path.ts#L2)

#### Parameters

##### fileOrDirectoryPath

`any`

#### Returns

`void`

***

### parseJson()

#### Call Signature

```ts
function parseJson<T>(
   string, 
   filename?, 
   options?): T;
```

Defined in: [packages/fs/src/utils/parse-json.ts:60](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/utils/parse-json.ts#L60)

##### Type Parameters

###### T

`T` = `JsonValue`

##### Parameters

###### string

`string`

###### filename?

`string`

###### options?

`CodeFrameOptions`

##### Returns

`T`

#### Call Signature

```ts
function parseJson<T>(
   string, 
   reviver, 
   fileName?, 
   options?): T;
```

Defined in: [packages/fs/src/utils/parse-json.ts:61](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/utils/parse-json.ts#L61)

##### Type Parameters

###### T

`T` = `JsonValue`

##### Parameters

###### string

`string`

###### reviver

(`this`, `key`, `value`) => `any`

###### fileName?

`string`

###### options?

`CodeFrameOptions`

##### Returns

`T`

***

### stripJsonComments()

```ts
function stripJsonComments(jsonString, __namedParameters): string;
```

Defined in: [packages/fs/src/utils/strip-json-comments.ts:5](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/utils/strip-json-comments.ts#L5)

#### Parameters

##### jsonString

`string`

##### \_\_namedParameters

###### whitespace?

`boolean` = `true`

#### Returns

`string`

## Variables

### toPath()

```ts
const toPath: (urlOrPath) => string;
```

Defined in: node\_modules/.pnpm/@visulima+path@1.3.5/node\_modules/@visulima/path/dist/utils.d.mts:7

#### Parameters

##### urlOrPath

`URL` | `string`

#### Returns

`string`
# yaml

## Functions

### readYaml()

#### Call Signature

```ts
function readYaml<R>(path, options?): Promise<R>;
```

Defined in: [packages/fs/src/read/read-yaml.ts:6](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/read/read-yaml.ts#L6)

##### Type Parameters

###### R

`R` = `Record`\<`string`, `unknown`\>

##### Parameters

###### path

`string` | `URL`

###### options?

`ReadYamlOptions`\<`"brotli"` \| `"gzip"` \| `"none"`\>

##### Returns

`Promise`\<`R`\>

#### Call Signature

```ts
function readYaml<R>(
   path, 
   reviver?, 
options?): Promise<R>;
```

Defined in: [packages/fs/src/read/read-yaml.ts:7](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/read/read-yaml.ts#L7)

##### Type Parameters

###### R

`R` = `Record`\<`string`, `unknown`\>

##### Parameters

###### path

`string` | `URL`

###### reviver?

`YamlReviver`

###### options?

`ReadYamlOptions`\<`"brotli"` \| `"gzip"` \| `"none"`\>

##### Returns

`Promise`\<`R`\>

***

### readYamlSync()

#### Call Signature

```ts
function readYamlSync<R>(path, options?): R;
```

Defined in: [packages/fs/src/read/read-yaml-sync.ts:6](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/read/read-yaml-sync.ts#L6)

##### Type Parameters

###### R

`R` = `Record`\<`string`, `unknown`\>

##### Parameters

###### path

`string` | `URL`

###### options?

`ReadYamlOptions`\<`"brotli"` \| `"gzip"` \| `"none"`\>

##### Returns

`R`

#### Call Signature

```ts
function readYamlSync<R>(
   path, 
   reviver?, 
   options?): R;
```

Defined in: [packages/fs/src/read/read-yaml-sync.ts:7](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/read/read-yaml-sync.ts#L7)

##### Type Parameters

###### R

`R` = `Record`\<`string`, `unknown`\>

##### Parameters

###### path

`string` | `URL`

###### reviver?

`YamlReviver`

###### options?

`ReadYamlOptions`\<`"brotli"` \| `"gzip"` \| `"none"`\>

##### Returns

`R`

***

### writeYaml()

#### Call Signature

```ts
function writeYaml(
   path, 
   data, 
options?): Promise<void>;
```

Defined in: [packages/fs/src/write/write-yaml.ts:10](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/write/write-yaml.ts#L10)

##### Parameters

###### path

`string` | `URL`

###### data

`any`

###### options?

`Options`

##### Returns

`Promise`\<`void`\>

#### Call Signature

```ts
function writeYaml(
   path, 
   data, 
   replacer?, 
options?): Promise<void>;
```

Defined in: [packages/fs/src/write/write-yaml.ts:16](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/write/write-yaml.ts#L16)

##### Parameters

###### path

`string` | `URL`

###### data

`any`

###### replacer?

[`JsonReplacer`](index.md#jsonreplacer)

###### options?

`string` | `number` | `Options`

##### Returns

`Promise`\<`void`\>

***

### writeYamlSync()

#### Call Signature

```ts
function writeYamlSync(
   path, 
   data, 
   options?): void;
```

Defined in: [packages/fs/src/write/write-yaml-sync.ts:10](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/write/write-yaml-sync.ts#L10)

##### Parameters

###### path

`string` | `URL`

###### data

`any`

###### options?

`Options`

##### Returns

`void`

#### Call Signature

```ts
function writeYamlSync(
   path, 
   data, 
   replacer?, 
   options?): void;
```

Defined in: [packages/fs/src/write/write-yaml-sync.ts:16](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/write/write-yaml-sync.ts#L16)

##### Parameters

###### path

`string` | `URL`

###### data

`any`

###### replacer?

[`JsonReplacer`](index.md#jsonreplacer)

###### options?

`string` | `number` | `Options`

##### Returns

`void`

## Type Aliases

### YamlReplacer

```ts
type YamlReplacer = JsonReplacer;
```

Defined in: [packages/fs/src/types.ts:144](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/fs/src/types.ts#L144)

<!-- /TYPEDOC -->

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

- [strip-json-comments](https://github.com/sindresorhus/strip-json-comments) - Strip comments from JSON. Lets you use comments in your JSON files!
- [parse-json](https://github.com/sindresorhus/parse-json) - Parse JSON with more helpful errors.
- [find-up](https://github.com/sindresorhus/find-up) - Find a file or directory by walking up parent directories.
- [walk](https://deno.land/std/fs/walk.ts) - Walk a directory recursively and yield all files and directories.

## License

The visulima fs is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript

[typescript-url]: https://www.typescriptlang.org/ "TypeScript" "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/fs?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/fs/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/fs/v/latest "npm"
