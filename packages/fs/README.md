<div align="center">
  <h3>Visulima fs</h3>
  <p>
  Human friendly file system utilities for Node.js
  </p>
</div>



<div align="center">

[![TypeScript](https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/) [![npm](https://img.shields.io/npm/v/@visulima/fs/latest.svg?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@visulima/fs/v/latest) [![license](https://img.shields.io/npm/l/@visulima/fs?color=blueviolet&style=for-the-badge)](https://github.com/visulima/visulima/blob/main/packages/fs/LICENSE.md)

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

# eol

## Functions

### detect()

```ts
function detect(content): "\n" | "\r\n";
```

Defined in: [packages/fs/src/eol.ts:29](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/eol.ts#L29)

Detect the EOL character for string input.
Returns null if no newline.

#### Parameters

##### content

`string`

The string content to detect the EOL from.

#### Returns

"\n" \| "\r\n"

#### Example

```javascript
import { detect } from "@visulima/fs/eol";

detect("Hello\r\nWorld"); // "\r\n"
detect("Hello\nWorld"); // "\n"
detect("HelloWorld"); // null
```

---

### format()

```ts
function format(content, eol): string;
```

Defined in: [packages/fs/src/eol.ts:54](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/eol.ts#L54)

Format the file to the targeted EOL.

#### Parameters

##### content

`string`

The string content to format.

##### eol

The target EOL character.

"\n" | "\r\n"

#### Returns

`string`

#### Example

```javascript
import { format, LF, CRLF } from "@visulima/fs/eol";

format("Hello\r\nWorld\nUnix", LF); // "Hello\nWorld\nUnix"
format("Hello\nWorld\r\nWindows", CRLF); // "Hello\r\nWorld\r\nWindows"
```

## Variables

### CRLF

```ts
const CRLF: "\r\n";
```

Defined in: [packages/fs/src/eol.ts:9](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/eol.ts#L9)

End-of-line character for Windows platforms.

---

### EOL

```ts
const EOL: "\n" | "\r\n";
```

Defined in: [packages/fs/src/eol.ts:14](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/eol.ts#L14)

End-of-line character evaluated for the current platform.

---

### LF

```ts
const LF: "\n";
```

Defined in: [packages/fs/src/eol.ts:6](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/eol.ts#L6)

End-of-line character for POSIX platforms such as macOS and Linux.

# error

## Classes

### AlreadyExistsError

Defined in: [packages/fs/src/error/already-exists-error.ts:28](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/already-exists-error.ts#L28)

Error thrown when a file or directory already exists at a specified path, and an operation was expecting it not to.

#### Example

```javascript
import { AlreadyExistsError } from "@visulima/fs/error"; // Assuming it's exported from an index or directly
import { ensureSymlinkSync } from "@visulima/fs"; // Or any function that might throw this
import { join } from "node:path";

try {
    // Example: ensureSymlinkSync might throw this if a file (not a symlink) already exists at linkName
    // For demonstration, let's assume someFunction internally throws it:
    const someFunctionThatMightThrow = (path) => {
        if (path === "/tmp/existing-file.txt") {
            // Simulate a check
            throw new AlreadyExistsError(`file already exists at '/tmp/existing-file.txt'`);
        }
    };
    someFunctionThatMightThrow("/tmp/existing-file.txt");
} catch (error) {
    if (error instanceof AlreadyExistsError) {
        console.error(`Operation failed because path exists: ${error.message}`);
        console.error(`Error code: ${error.code}`); // EEXIST
    } else {
        console.error("An unexpected error occurred:", error);
    }
}
```

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new AlreadyExistsError(message): AlreadyExistsError;
```

Defined in: [packages/fs/src/error/already-exists-error.ts:33](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/already-exists-error.ts#L33)

Creates a new instance.

###### Parameters

###### message

`string`

The error message.

###### Returns

[`AlreadyExistsError`](#alreadyexistserror)

###### Overrides

```ts
Error.constructor;
```

#### Accessors

##### code

###### Get Signature

```ts
get code(): string;
```

Defined in: [packages/fs/src/error/already-exists-error.ts:38](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/already-exists-error.ts#L38)

###### Returns

`string`

###### Set Signature

```ts
set code(_name): void;
```

Defined in: [packages/fs/src/error/already-exists-error.ts:43](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/already-exists-error.ts#L43)

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

Defined in: [packages/fs/src/error/already-exists-error.ts:48](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/already-exists-error.ts#L48)

###### Returns

`string`

###### Set Signature

```ts
set name(_name): void;
```

Defined in: [packages/fs/src/error/already-exists-error.ts:53](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/already-exists-error.ts#L53)

###### Parameters

###### \_name

`string`

###### Returns

`void`

###### Overrides

```ts
Error.name;
```

#### Methods

##### captureStackTrace()

```ts
static captureStackTrace(targetObject, constructorOpt?): void;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:91

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
Error.captureStackTrace;
```

#### Properties

##### cause?

```ts
optional cause: unknown;
```

Defined in: node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/lib.es2022.error.d.ts:26

###### Inherited from

```ts
Error.cause;
```

##### message

```ts
message: string;
```

Defined in: node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/lib.es5.d.ts:1077

###### Inherited from

```ts
Error.message;
```

##### stack?

```ts
optional stack: string;
```

Defined in: node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/lib.es5.d.ts:1078

###### Inherited from

```ts
Error.stack;
```

##### prepareStackTrace()?

```ts
static optional prepareStackTrace: (err, stackTraces) => any;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:98

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
Error.prepareStackTrace;
```

##### stackTraceLimit

```ts
static stackTraceLimit: number;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:100

###### Inherited from

```ts
Error.stackTraceLimit;
```

---

### DirectoryError

Defined in: [packages/fs/src/error/directory-error.ts:36](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/directory-error.ts#L36)

Error thrown when an operation that is not allowed on a directory is attempted.
This typically occurs when a file-specific operation is used on a directory path.

#### Example

```javascript
import { DirectoryError } from "@visulima/fs/error";
import { readFile } from "@visulima/fs"; // Or any function that might throw this
import { join } from "node:path";

const attemptToReadFileFromDir = async () => {
    try {
        // Attempting to read a directory as if it were a file
        // This is a conceptual example; readFile might throw a different error first
        // depending on its internal checks, but EISDIR is the underlying system error.
        // Forcing the scenario:
        const pretendReadFileOnDir = (path) => {
            if (path === "/tmp/my-directory") {
                // Simulate a directory path
                throw new DirectoryError(`read '/tmp/my-directory'`);
            }
        };
        pretendReadFileOnDir("/tmp/my-directory");
        // await readFile(join("/tmp", "my-directory"));
    } catch (error) {
        if (error instanceof DirectoryError) {
            console.error(`Operation failed, path is a directory: ${error.message}`);
            console.error(`Error code: ${error.code}`); // EISDIR
        } else {
            console.error("An unexpected error occurred:", error);
        }
    }
};

attemptToReadFileFromDir();
```

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new DirectoryError(message): DirectoryError;
```

Defined in: [packages/fs/src/error/directory-error.ts:41](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/directory-error.ts#L41)

Creates a new instance.

###### Parameters

###### message

`string`

The error message.

###### Returns

[`DirectoryError`](#directoryerror)

###### Overrides

```ts
Error.constructor;
```

#### Accessors

##### code

###### Get Signature

```ts
get code(): string;
```

Defined in: [packages/fs/src/error/directory-error.ts:46](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/directory-error.ts#L46)

###### Returns

`string`

###### Set Signature

```ts
set code(_name): void;
```

Defined in: [packages/fs/src/error/directory-error.ts:51](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/directory-error.ts#L51)

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

Defined in: [packages/fs/src/error/directory-error.ts:56](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/directory-error.ts#L56)

###### Returns

`string`

###### Set Signature

```ts
set name(_name): void;
```

Defined in: [packages/fs/src/error/directory-error.ts:61](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/directory-error.ts#L61)

###### Parameters

###### \_name

`string`

###### Returns

`void`

###### Overrides

```ts
Error.name;
```

#### Methods

##### captureStackTrace()

```ts
static captureStackTrace(targetObject, constructorOpt?): void;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:91

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
Error.captureStackTrace;
```

#### Properties

##### cause?

```ts
optional cause: unknown;
```

Defined in: node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/lib.es2022.error.d.ts:26

###### Inherited from

```ts
Error.cause;
```

##### message

```ts
message: string;
```

Defined in: node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/lib.es5.d.ts:1077

###### Inherited from

```ts
Error.message;
```

##### stack?

```ts
optional stack: string;
```

Defined in: node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/lib.es5.d.ts:1078

###### Inherited from

```ts
Error.stack;
```

##### prepareStackTrace()?

```ts
static optional prepareStackTrace: (err, stackTraces) => any;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:98

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
Error.prepareStackTrace;
```

##### stackTraceLimit

```ts
static stackTraceLimit: number;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:100

###### Inherited from

```ts
Error.stackTraceLimit;
```

---

### NotEmptyError

Defined in: [packages/fs/src/error/not-empty-error.ts:40](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/not-empty-error.ts#L40)

Error thrown when a directory is not empty.

#### Example

```javascript
import { NotEmptyError } from "@visulima/fs/error";
import { rmdir } from "node:fs/promises"; // Or any fs function that might throw this system error
import { join } from "node:path";

const attemptToRemoveNonEmptyDir = async () => {
    const dirPath = join("/tmp", "my-non-empty-dir"); // Assume this directory exists and has files
    try {
        // Forcing the scenario for demonstration, as rmdir might throw its own specific error.
        // Node.js fs operations that encounter a non-empty directory when expecting an empty one
        // typically throw an error with code ENOTEMPTY.
        const simulateNotEmpty = (path) => {
            if (path === dirPath) {
                // Simulate check for non-empty
                throw new NotEmptyError(`rmdir '${dirPath}'`);
            }
        };
        simulateNotEmpty(dirPath);
        // await rmdir(dirPath); // This would likely throw an error with code ENOTEMPTY
    } catch (error) {
        if (error instanceof NotEmptyError) {
            console.error(`Operation failed, directory is not empty: ${error.message}`);
            console.error(`Error code: ${error.code}`); // ENOTEMPTY
        } else {
            console.error("An unexpected error occurred:", error);
        }
    }
};

// You would need to set up a non-empty directory at /tmp/my-non-empty-dir for a real test
// import { ensureDirSync, writeFileSync } from "@visulima/fs";
// ensureDirSync(dirPath);
// writeFileSync(join(dirPath, "somefile.txt"), "content");

attemptToRemoveNonEmptyDir();
```

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new NotEmptyError(message): NotEmptyError;
```

Defined in: [packages/fs/src/error/not-empty-error.ts:45](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/not-empty-error.ts#L45)

Creates a new instance.

###### Parameters

###### message

`string`

The error message.

###### Returns

[`NotEmptyError`](#notemptyerror)

###### Overrides

```ts
Error.constructor;
```

#### Accessors

##### code

###### Get Signature

```ts
get code(): string;
```

Defined in: [packages/fs/src/error/not-empty-error.ts:50](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/not-empty-error.ts#L50)

###### Returns

`string`

###### Set Signature

```ts
set code(_name): void;
```

Defined in: [packages/fs/src/error/not-empty-error.ts:55](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/not-empty-error.ts#L55)

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

Defined in: [packages/fs/src/error/not-empty-error.ts:60](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/not-empty-error.ts#L60)

###### Returns

`string`

###### Set Signature

```ts
set name(_name): void;
```

Defined in: [packages/fs/src/error/not-empty-error.ts:65](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/not-empty-error.ts#L65)

###### Parameters

###### \_name

`string`

###### Returns

`void`

###### Overrides

```ts
Error.name;
```

#### Methods

##### captureStackTrace()

```ts
static captureStackTrace(targetObject, constructorOpt?): void;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:91

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
Error.captureStackTrace;
```

#### Properties

##### cause?

```ts
optional cause: unknown;
```

Defined in: node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/lib.es2022.error.d.ts:26

###### Inherited from

```ts
Error.cause;
```

##### message

```ts
message: string;
```

Defined in: node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/lib.es5.d.ts:1077

###### Inherited from

```ts
Error.message;
```

##### stack?

```ts
optional stack: string;
```

Defined in: node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/lib.es5.d.ts:1078

###### Inherited from

```ts
Error.stack;
```

##### prepareStackTrace()?

```ts
static optional prepareStackTrace: (err, stackTraces) => any;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:98

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
Error.prepareStackTrace;
```

##### stackTraceLimit

```ts
static stackTraceLimit: number;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:100

###### Inherited from

```ts
Error.stackTraceLimit;
```

---

### NotFoundError

Defined in: [packages/fs/src/error/not-found-error.ts:33](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/not-found-error.ts#L33)

Error thrown when a file or directory is not found at a specified path.

#### Example

```javascript
import { NotFoundError } from "@visulima/fs/error";
import { readFile } from "@visulima/fs"; // Or any function that might throw this
import { join } from "node:path";

const tryReadingNonExistentFile = async () => {
    const filePath = join("/tmp", "this-file-does-not-exist.txt");
    try {
        // Forcing the scenario for demonstration, as readFile itself would throw this.
        const simulateNotFound = (path) => {
            if (path === filePath) {
                throw new NotFoundError(`no such file or directory, open '${filePath}'`);
            }
        };
        simulateNotFound(filePath);
        // await readFile(filePath);
    } catch (error) {
        if (error instanceof NotFoundError) {
            console.error(`Operation failed, path not found: ${error.message}`);
            console.error(`Error code: ${error.code}`); // ENOENT
        } else {
            console.error("An unexpected error occurred:", error);
        }
    }
};

tryReadingNonExistentFile();
```

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new NotFoundError(message): NotFoundError;
```

Defined in: [packages/fs/src/error/not-found-error.ts:38](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/not-found-error.ts#L38)

Creates a new instance.

###### Parameters

###### message

`string`

The error message.

###### Returns

[`NotFoundError`](#notfounderror)

###### Overrides

```ts
Error.constructor;
```

#### Accessors

##### code

###### Get Signature

```ts
get code(): string;
```

Defined in: [packages/fs/src/error/not-found-error.ts:43](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/not-found-error.ts#L43)

###### Returns

`string`

###### Set Signature

```ts
set code(_name): void;
```

Defined in: [packages/fs/src/error/not-found-error.ts:48](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/not-found-error.ts#L48)

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

Defined in: [packages/fs/src/error/not-found-error.ts:53](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/not-found-error.ts#L53)

###### Returns

`string`

###### Set Signature

```ts
set name(_name): void;
```

Defined in: [packages/fs/src/error/not-found-error.ts:58](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/not-found-error.ts#L58)

###### Parameters

###### \_name

`string`

###### Returns

`void`

###### Overrides

```ts
Error.name;
```

#### Methods

##### captureStackTrace()

```ts
static captureStackTrace(targetObject, constructorOpt?): void;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:91

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
Error.captureStackTrace;
```

#### Properties

##### cause?

```ts
optional cause: unknown;
```

Defined in: node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/lib.es2022.error.d.ts:26

###### Inherited from

```ts
Error.cause;
```

##### message

```ts
message: string;
```

Defined in: node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/lib.es5.d.ts:1077

###### Inherited from

```ts
Error.message;
```

##### stack?

```ts
optional stack: string;
```

Defined in: node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/lib.es5.d.ts:1078

###### Inherited from

```ts
Error.stack;
```

##### prepareStackTrace()?

```ts
static optional prepareStackTrace: (err, stackTraces) => any;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:98

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
Error.prepareStackTrace;
```

##### stackTraceLimit

```ts
static stackTraceLimit: number;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:100

###### Inherited from

```ts
Error.stackTraceLimit;
```

---

### PermissionError

Defined in: [packages/fs/src/error/permission-error.ts:34](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/permission-error.ts#L34)

Error thrown when an operation is not permitted due to insufficient privileges
or other access control restrictions.

#### Example

```javascript
import { PermissionError } from "@visulima/fs/error";
import { writeFile } from "@visulima/fs"; // Or any function that might throw this
import { join } from "node:path";

const tryWritingToProtectedFile = async () => {
    const filePath = join("/root", "protected-file.txt"); // A path that typically requires root privileges
    try {
        // Forcing the scenario for demonstration, as writeFile itself would throw this.
        const simulatePermissionError = (path) => {
            if (path === filePath) {
                throw new PermissionError(`open '${filePath}'`);
            }
        };
        simulatePermissionError(filePath);
        // await writeFile(filePath, "test content");
    } catch (error) {
        if (error instanceof PermissionError) {
            console.error(`Operation not permitted: ${error.message}`);
            console.error(`Error code: ${error.code}`); // EPERM
        } else {
            console.error("An unexpected error occurred:", error);
        }
    }
};

tryWritingToProtectedFile();
```

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new PermissionError(message): PermissionError;
```

Defined in: [packages/fs/src/error/permission-error.ts:39](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/permission-error.ts#L39)

Creates a new instance.

###### Parameters

###### message

`string`

The error message.

###### Returns

[`PermissionError`](#permissionerror)

###### Overrides

```ts
Error.constructor;
```

#### Accessors

##### code

###### Get Signature

```ts
get code(): string;
```

Defined in: [packages/fs/src/error/permission-error.ts:44](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/permission-error.ts#L44)

###### Returns

`string`

###### Set Signature

```ts
set code(_name): void;
```

Defined in: [packages/fs/src/error/permission-error.ts:49](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/permission-error.ts#L49)

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

Defined in: [packages/fs/src/error/permission-error.ts:54](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/permission-error.ts#L54)

###### Returns

`string`

###### Set Signature

```ts
set name(_name): void;
```

Defined in: [packages/fs/src/error/permission-error.ts:59](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/permission-error.ts#L59)

###### Parameters

###### \_name

`string`

###### Returns

`void`

###### Overrides

```ts
Error.name;
```

#### Methods

##### captureStackTrace()

```ts
static captureStackTrace(targetObject, constructorOpt?): void;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:91

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
Error.captureStackTrace;
```

#### Properties

##### cause?

```ts
optional cause: unknown;
```

Defined in: node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/lib.es2022.error.d.ts:26

###### Inherited from

```ts
Error.cause;
```

##### message

```ts
message: string;
```

Defined in: node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/lib.es5.d.ts:1077

###### Inherited from

```ts
Error.message;
```

##### stack?

```ts
optional stack: string;
```

Defined in: node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/lib.es5.d.ts:1078

###### Inherited from

```ts
Error.stack;
```

##### prepareStackTrace()?

```ts
static optional prepareStackTrace: (err, stackTraces) => any;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:98

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
Error.prepareStackTrace;
```

##### stackTraceLimit

```ts
static stackTraceLimit: number;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:100

###### Inherited from

```ts
Error.stackTraceLimit;
```

---

### WalkError

Defined in: [packages/fs/src/error/walk-error.ts:43](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/walk-error.ts#L43)

Error thrown in walk or walkSync during iteration.

#### Example

```javascript
import { WalkError } from "@visulima/fs/error";
import { walk } from "@visulima/fs";
import { join } from "node:path";

const processDirectory = async () => {
    const dirToWalk = join("/tmp", "non-existent-or-permission-denied-dir");
    try {
        // Forcing the scenario: walk might throw a WalkError if it encounters an issue
        // like a directory it cannot read during the walk process.
        const simulateWalkError = async (rootDir) => {
            // Let's say readdir inside walk fails for a subdirectory.
            const underlyingError = new Error("Permission denied reading subdirectory");
            throw new WalkError(underlyingError, rootDir);
        };
        // This is conceptual. In a real scenario, 'walk' itself would throw.
        // for await (const entry of walk(dirToWalk)) {
        //   console.log(entry.path);
        // }
        await simulateWalkError(dirToWalk);
    } catch (error) {
        if (error instanceof WalkError) {
            console.error(`Error during directory walk of "${error.root}": ${error.message}`);
            if (error.cause) {
                console.error(`Underlying cause: ${error.cause}`);
            }
        } else {
            console.error("An unexpected error occurred:", error);
        }
    }
};

processDirectory();
```

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new WalkError(cause, root): WalkError;
```

Defined in: [packages/fs/src/error/walk-error.ts:52](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/walk-error.ts#L52)

Constructs a new instance.

###### Parameters

###### cause

`unknown`

The underlying error or reason for the walk failure.

###### root

`string`

The root directory path where the walk operation started or encountered the error.

###### Returns

[`WalkError`](#walkerror)

###### Overrides

```ts
Error.constructor;
```

#### Accessors

##### name

###### Get Signature

```ts
get name(): string;
```

Defined in: [packages/fs/src/error/walk-error.ts:61](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/walk-error.ts#L61)

###### Returns

`string`

###### Set Signature

```ts
set name(_name): void;
```

Defined in: [packages/fs/src/error/walk-error.ts:66](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/walk-error.ts#L66)

###### Parameters

###### \_name

`string`

###### Returns

`void`

###### Overrides

```ts
Error.name;
```

#### Methods

##### captureStackTrace()

```ts
static captureStackTrace(targetObject, constructorOpt?): void;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:91

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
Error.captureStackTrace;
```

#### Properties

##### cause?

```ts
optional cause: unknown;
```

Defined in: node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/lib.es2022.error.d.ts:26

###### Inherited from

```ts
Error.cause;
```

##### message

```ts
message: string;
```

Defined in: node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/lib.es5.d.ts:1077

###### Inherited from

```ts
Error.message;
```

##### root

```ts
root: string;
```

Defined in: [packages/fs/src/error/walk-error.ts:45](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/walk-error.ts#L45)

File path of the root that's being walked.

##### stack?

```ts
optional stack: string;
```

Defined in: node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/lib.es5.d.ts:1078

###### Inherited from

```ts
Error.stack;
```

##### prepareStackTrace()?

```ts
static optional prepareStackTrace: (err, stackTraces) => any;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:98

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
Error.prepareStackTrace;
```

##### stackTraceLimit

```ts
static stackTraceLimit: number;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:100

###### Inherited from

```ts
Error.stackTraceLimit;
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

Defined in: [packages/fs/src/find/collect.ts:37](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/find/collect.ts#L37)

Asynchronously collects all file paths within a directory that match the specified criteria.
By default, it searches for JavaScript and TypeScript file extensions.

#### Parameters

##### directory

`string`

The root directory to start collecting files from.

##### options

[`WalkOptions`](#walkoptions) = `{}`

Optional configuration to control the collection process. See [WalkOptions](#walkoptions).

#### Returns

`Promise`\<`string`[]\>

A promise that resolves to an array of absolute file paths.

#### Example

```javascript
import { collect } from "@visulima/fs";
import { join } from "node:path";

const collectFiles = async () => {
    // Collect all .txt and .md files in /tmp/docs, up to 2 levels deep
    const files = await collect(join("/tmp", "docs"), {
        extensions: ["txt", "md"],
        maxDepth: 2,
        includeDirs: false, // Only collect files
    });
    console.log(files);
    // Example output: ['/tmp/docs/file1.txt', '/tmp/docs/subdir/report.md']

    // Collect all .js files, excluding anything in node_modules
    const jsFiles = await collect(join("/tmp", "project"), {
        extensions: ["js"],
        skip: [/node_modules/],
    });
    console.log(jsFiles);
};

collectFiles();
```

---

### collectSync()

```ts
function collectSync(directory, options): string[];
```

Defined in: [packages/fs/src/find/collect-sync.ts:33](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/find/collect-sync.ts#L33)

Synchronously collects all file paths within a directory that match the specified criteria.
By default, it searches for JavaScript and TypeScript file extensions.

#### Parameters

##### directory

`string`

The root directory to start collecting files from.

##### options

[`WalkOptions`](#walkoptions) = `{}`

Optional configuration to control the collection process. See [WalkOptions](#walkoptions).

#### Returns

`string`[]

An array of absolute file paths.

#### Example

```javascript
import { collectSync } from "@visulima/fs";
import { join } from "node:path";

// Collect all .txt and .md files in /tmp/docs, up to 2 levels deep
const files = collectSync(join("/tmp", "docs"), {
    extensions: ["txt", "md"],
    maxDepth: 2,
    includeDirs: false, // Only collect files
});
console.log(files);
// Example output: ['/tmp/docs/file1.txt', '/tmp/docs/subdir/report.md']

// Collect all .js files, excluding anything in node_modules
const jsFiles = collectSync(join("/tmp", "project"), {
    extensions: ["js"],
    skip: [/node_modules/],
});
console.log(jsFiles);
```

---

### emptyDir()

```ts
function emptyDir(dir, options?): Promise<void>;
```

Defined in: [packages/fs/src/remove/empty-dir.ts:38](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/remove/empty-dir.ts#L38)

Ensures that a directory is empty.
Deletes directory contents if the directory is not empty.
If the directory does not exist, it is created.
The directory itself is not deleted.

#### Parameters

##### dir

The path to the directory to empty.

`string` | `URL`

##### options?

`RetryOptions`

Optional configuration for the operation. See RetryOptions.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the directory is empty.

#### Example

```javascript
import { emptyDir } from "@visulima/fs";
import { join } from "node:path";

const clearTempDir = async () => {
    try {
        await emptyDir(join("/tmp", "my-app-temp"));
        console.log("Temporary directory emptied or created.");
    } catch (error) {
        console.error("Failed to empty directory:", error);
    }
};

clearTempDir();
```

---

### emptyDirSync()

```ts
function emptyDirSync(dir, options?): void;
```

Defined in: [packages/fs/src/remove/empty-dir-sync.ts:33](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/remove/empty-dir-sync.ts#L33)

Ensures that a directory is empty.
Deletes directory contents if the directory is not empty.
If the directory does not exist, it is created.
The directory itself is not deleted.

#### Parameters

##### dir

The path to the directory to empty.

`string` | `URL`

##### options?

`RetryOptions`

Optional configuration for the operation. See RetryOptions.

#### Returns

`void`

void

#### Example

```javascript
import { emptyDirSync } from "@visulima/fs";
import { join } from "node:path";

try {
    emptyDirSync(join("/tmp", "my-app-temp"));
    console.log("Temporary directory emptied or created.");
} catch (error) {
    console.error("Failed to empty directory:", error);
}
```

---

### ensureDir()

```ts
function ensureDir(directory): Promise<void>;
```

Defined in: [packages/fs/src/ensure/ensure-dir.ts:20](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/ensure/ensure-dir.ts#L20)

Ensures that the directory exists.
If the directory structure does not exist, it is created. Like mkdir -p.

#### Parameters

##### directory

The path to the directory to ensure exists.

`string` | `URL`

#### Returns

`Promise`\<`void`\>

#### Example

```javascript
import ensureDir from "@visulima/fs/ensure/ensure-dir";

await ensureDir("/tmp/foo/bar/baz");
// Creates the directory structure /tmp/foo/bar/baz if it doesn't exist
```

---

### ensureDirSync()

```ts
function ensureDirSync(directory): void;
```

Defined in: [packages/fs/src/ensure/ensure-dir-sync.ts:20](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/ensure/ensure-dir-sync.ts#L20)

Ensures that the directory exists.
If the directory structure does not exist, it is created. Like mkdir -p.

#### Parameters

##### directory

The path to the directory to ensure exists.

`string` | `URL`

#### Returns

`void`

#### Example

```javascript
import ensureDirSync from "@visulima/fs/ensure/ensure-dir-sync";

ensureDirSync("/tmp/foo/bar/baz");
// Creates the directory structure /tmp/foo/bar/baz if it doesn't exist
```

---

### ensureFile()

```ts
function ensureFile(filePath): Promise<void>;
```

Defined in: [packages/fs/src/ensure/ensure-file.ts:37](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/ensure/ensure-file.ts#L37)

Asynchronously ensures that a file exists.
If the directory structure for the file does not exist, it is created.
If the file already exists, it is not modified.

#### Parameters

##### filePath

The path to the file. Can be a string or a URL object.

`string` | `URL`

#### Returns

`Promise`\<`void`\>

A Promise that resolves when the file has been created or confirmed to exist.

#### Throws

Will throw an error if the path exists and is not a file.

#### Throws

Will throw an error if directory or file creation fails for reasons other than the path not existing initially.

#### Example

```typescript
import { ensureFile } from "@visulima/fs";

(async () => {
    try {
        await ensureFile("path/to/my/file.txt");
        console.log("File ensured!");

        await ensureFile(new URL("file:///path/to/another/file.log"));
        console.log("Another file ensured!");
    } catch (error) {
        console.error("Failed to ensure file:", error);
    }
})();
```

---

### ensureFileSync()

```ts
function ensureFileSync(filePath): void;
```

Defined in: [packages/fs/src/ensure/ensure-file-sync.ts:24](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/ensure/ensure-file-sync.ts#L24)

Ensures that the file exists.
If the file that is requested to be created is in directories that do not exist,
these directories are created. If the file already exists, it is NOT MODIFIED.

#### Parameters

##### filePath

The path to the file to ensure exists.

`string` | `URL`

#### Returns

`void`

#### Example

```javascript
import { ensureFileSync } from "@visulima/fs";

ensureFileSync("/tmp/foo/bar/baz.txt");
// Creates the file /tmp/foo/bar/baz.txt and any missing parent directories if they don't exist
```

---

### ensureLink()

```ts
function ensureLink(source, destination): Promise<void>;
```

Defined in: [packages/fs/src/ensure/ensure-link.ts:25](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/ensure/ensure-link.ts#L25)

Ensures that the hard link exists.
If the directory structure does not exist, it is created.

#### Parameters

##### source

The path to the source file or directory.

`string` | `URL`

##### destination

The path to the destination link.

`string` | `URL`

#### Returns

`Promise`\<`void`\>

#### Example

```javascript
import { ensureLink } from "@visulima/fs";
import { join } from "node:path";

// ensure the link /tmp/foo/bar-link.txt points to /tmp/foo/bar.txt
await ensureLink(join("/tmp", "foo", "bar.txt"), join("/tmp", "foo", "bar-link.txt"));
```

---

### ensureLinkSync()

```ts
function ensureLinkSync(source, destination): void;
```

Defined in: [packages/fs/src/ensure/ensure-link-sync.ts:25](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/ensure/ensure-link-sync.ts#L25)

Ensures that the hard link exists.
If the directory structure does not exist, it is created.

#### Parameters

##### source

The path to the source file or directory.

`string` | `URL`

##### destination

The path to the destination link.

`string` | `URL`

#### Returns

`void`

#### Example

```javascript
import { ensureLinkSync } from "@visulima/fs";
import { join } from "node:path";

// ensure the link /tmp/foo/bar-link.txt points to /tmp/foo/bar.txt
ensureLinkSync(join("/tmp", "foo", "bar.txt"), join("/tmp", "foo", "bar-link.txt"));
```

---

### ensureSymlink()

```ts
function ensureSymlink(target, linkName, type?): Promise<void>;
```

Defined in: [packages/fs/src/ensure/ensure-symlink.ts:39](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/ensure/ensure-symlink.ts#L39)

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

#### Example

```javascript
import { ensureSymlink } from "@visulima/fs";
import { join } from "node:path";

// Ensure a symlink /tmp/foo/link-to-bar.txt points to /tmp/foo/bar.txt
await ensureSymlink(join("/tmp", "foo", "bar.txt"), join("/tmp", "foo", "link-to-bar.txt"));

// Ensure a directory symlink /tmp/foo/link-to-baz-dir points to /tmp/foo/baz-dir
await ensureSymlink(join("/tmp", "foo", "baz-dir"), join("/tmp", "foo", "link-to-baz-dir"), "dir");
```

---

### ensureSymlinkSync()

```ts
function ensureSymlinkSync(target, linkName, type?): void;
```

Defined in: [packages/fs/src/ensure/ensure-symlink-sync.ts:39](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/ensure/ensure-symlink-sync.ts#L39)

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

#### Example

```javascript
import { ensureSymlinkSync } from "@visulima/fs";
import { join } from "node:path";

// Ensure a symlink /tmp/foo/link-to-bar.txt points to /tmp/foo/bar.txt
ensureSymlinkSync(join("/tmp", "foo", "bar.txt"), join("/tmp", "foo", "link-to-bar.txt"));

// Ensure a directory symlink /tmp/foo/link-to-baz-dir points to /tmp/foo/baz-dir
ensureSymlinkSync(join("/tmp", "foo", "baz-dir"), join("/tmp", "foo", "link-to-baz-dir"), "dir");
```

---

### findUp()

```ts
function findUp(name, options): Promise<string>;
```

Defined in: [packages/fs/src/find/find-up.ts:55](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/find/find-up.ts#L55)

Asynchronously finds a file or directory by walking up parent directories.

#### Parameters

##### name

[`FindUpName`](#findupname)

The name(s) of the file or directory to find. Can be a string, an array of strings, or a function that returns a name or `FIND_UP_STOP`.

##### options

[`FindUpOptions`](#findupoptions) = `{}`

Optional configuration for the search. See [FindUpOptions](#findupoptions).

#### Returns

`Promise`\<`string`\>

A promise that resolves to the absolute path of the first found file/directory, or `undefined` if not found.

#### Example

```javascript
import { findUp } from "@visulima/fs";
import { join } from "node:path";

const findProjectRoot = async () => {
    // Find the closest package.json, starting from /tmp/foo/bar/baz
    const projectRoot = await findUp("package.json", {
        cwd: join("/tmp", "foo", "bar", "baz"),
        type: "file",
    });
    console.log(projectRoot); // e.g., /tmp/foo/package.json or undefined

    // Find the closest .git directory or a README.md file
    const gitDirOrReadme = await findUp([".git", "README.md"], {
        cwd: join("/tmp", "foo", "bar"),
    });
    console.log(gitDirOrReadme);

    // Find using a custom function, stopping at /tmp
    const customFound = await findUp(
        (directory) => {
            if (directory === join("/tmp", "foo")) {
                return "found-it-here.txt"; // Pretend this file exists in /tmp/foo
            }
            return undefined;
        },
        {
            cwd: join("/tmp", "foo", "bar", "baz"),
            stopAt: join("/tmp"),
        },
    );
    console.log(customFound);
};

findProjectRoot();
```

---

### findUpSync()

```ts
function findUpSync(name, options): string;
```

Defined in: [packages/fs/src/find/find-up-sync.ts:51](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/find/find-up-sync.ts#L51)

Synchronously finds a file or directory by walking up parent directories.

#### Parameters

##### name

[`FindUpNameSync`](#findupnamesync)

The name(s) of the file or directory to find. Can be a string, an array of strings, or a function that returns a name or `FIND_UP_STOP`.

##### options

[`FindUpOptions`](#findupoptions) = `{}`

Optional configuration for the search. See [FindUpOptions](#findupoptions).

#### Returns

`string`

The absolute path of the first found file/directory, or `undefined` if not found.

#### Example

```javascript
import { findUpSync } from "@visulima/fs";
import { join } from "node:path";

// Find the closest package.json, starting from /tmp/foo/bar/baz
const projectRoot = findUpSync("package.json", {
    cwd: join("/tmp", "foo", "bar", "baz"),
    type: "file",
});
console.log(projectRoot); // e.g., /tmp/foo/package.json or undefined

// Find the closest .git directory or a README.md file
const gitDirOrReadme = findUpSync([".git", "README.md"], {
    cwd: join("/tmp", "foo", "bar"),
});
console.log(gitDirOrReadme);

// Find using a custom function, stopping at /tmp
const customFound = findUpSync(
    (directory) => {
        if (directory === join("/tmp", "foo")) {
            return "found-it-here.txt"; // Pretend this file exists in /tmp/foo
        }
        return undefined;
    },
    {
        cwd: join("/tmp", "foo", "bar", "baz"),
        stopAt: join("/tmp"),
    },
);
console.log(customFound);
```

---

### isAccessible()

```ts
function isAccessible(path, mode?): Promise<boolean>;
```

Defined in: [packages/fs/src/is-accessible.ts:36](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/is-accessible.ts#L36)

Asynchronously tests a user's permissions for the file or directory specified by path.
Returns a Promise that resolves to `true` if the accessibility check is successful, `false` otherwise.

#### Parameters

##### path

The path to the file or directory. Can be a string or a URL object.

`string` | `URL`

##### mode?

`number`

The accessibility checks to perform. Defaults to `F_OK` (check for existence).
Other possible values include `R_OK` (check for read access), `W_OK` (check for write access),
and `X_OK` (check for execute/search access). Multiple modes can be combined using bitwise OR.

#### Returns

`Promise`\<`boolean`\>

A Promise that resolves to a boolean indicating if the path is accessible with the specified mode.

#### Example

```typescript
import { isAccessible, F_OK, R_OK } from "@visulima/fs";

(async () => {
    if (await isAccessible("myFile.txt")) {
        console.log("myFile.txt exists");
    }

    if (await isAccessible("myFile.txt", R_OK)) {
        console.log("myFile.txt is readable");
    }

    if (await isAccessible("myDirectory", F_OK | R_OK | W_OK)) {
        console.log("myDirectory exists, is readable and writable");
    }
})();
```

---

### isAccessibleSync()

```ts
function isAccessibleSync(path, mode?): boolean;
```

Defined in: [packages/fs/src/is-accessible-sync.ts:9](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/is-accessible-sync.ts#L9)

Synchronously tests a user's permissions for the file or directory specified by `path`.
If the accessibility check is successful, `true` is returned. Otherwise, `false` is returned.

#### Parameters

##### path

`string` | `URL`

##### mode?

`number`

#### Returns

`boolean`

`true` if the accessibility check is successful, `false` otherwise.

#### Param

A path to a file or directory. If a URL is provided, it must use the `file:` protocol.

#### Param

The accessibility checks to perform. Default: `F_OK` (tests for existence of the file).
Other possible values are `R_OK` (tests for read permission), `W_OK` (tests for write permission),
and `X_OK` (tests for execute permissions). Multiple modes can be combined using bitwise OR.

#### Example

```javascript
import { isAccessibleSync, F_OK, R_OK, W_OK } from "@visulima/fs";
import { writeFileSync, unlinkSync, chmodSync } from "node:fs";
import { join } from "node:path";

const filePath = join("temp-access-test.txt");

// Test for existence (default mode)
writeFileSync(filePath, "content");
console.log(`File exists: ${isAccessibleSync(filePath)}`); // true
unlinkSync(filePath);
console.log(`File exists after delete: ${isAccessibleSync(filePath)}`); // false

// Test for read and write permissions
writeFileSync(filePath, "content");
chmodSync(filePath, 0o600); // Read/Write for owner
console.log(`Readable: ${isAccessibleSync(filePath, R_OK)}`); // true
console.log(`Writable: ${isAccessibleSync(filePath, W_OK)}`); // true
console.log(`Readable & Writable: ${isAccessibleSync(filePath, R_OK | W_OK)}`); // true

chmodSync(filePath, 0o400); // Read-only for owner
console.log(`Readable (after chmod): ${isAccessibleSync(filePath, R_OK)}`); // true
console.log(`Writable (after chmod): ${isAccessibleSync(filePath, W_OK)}`); // false

unlinkSync(filePath); // Clean up

// Example with URL
writeFileSync(filePath, "content for URL test");
const fileUrl = new URL(`file://${join(process.cwd(), filePath)}`);
console.log(`URL exists: ${isAccessibleSync(fileUrl)}`); // true
unlinkSync(filePath);
```

---

### move()

```ts
function move(sourcePath, destinationPath, options): Promise<void>;
```

Defined in: [packages/fs/src/move/index.ts:35](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/move/index.ts#L35)

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
import { move } from '@visulima/fs';

await move('source/test.png', 'destination/test.png');
console.log('The file has been moved');
```

---

### moveSync()

```ts
function moveSync(sourcePath, destinationPath, options?): void;
```

Defined in: [packages/fs/src/move/index.ts:61](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/move/index.ts#L61)

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
import { moveSync } from '@visulima/fs';

moveSync('source/test.png', 'destination/test.png');
console.log('The file has been moved');
```

---

### readFile()

```ts
function readFile<O>(path, options?): Promise<ContentType<O>>;
```

Defined in: [packages/fs/src/read/read-file.ts:57](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/read/read-file.ts#L57)

Asynchronously reads the entire contents of a file.
It can also decompress the file content if a `compression` option is provided.

#### Type Parameters

##### O

`O` _extends_ [`ReadFileOptions`](#readfileoptions)\<`"brotli"` \| `"gzip"` \| `"none"`\> = `undefined`

The type of the options object, extending [ReadFileOptions](#readfileoptions).

#### Parameters

##### path

The path to the file to read. Can be a file URL or a string path.

`string` | `URL`

##### options?

`O`

Optional configuration for reading the file. See [ReadFileOptions](#readfileoptions).
Available `compression` methods: "brotli", "gzip", "none" (default).

#### Returns

`Promise`\<[`ContentType`](#contenttype)\<`O`\>\>

A promise that resolves with the file content. The type of the content (string or Buffer)
depends on the `buffer` option (defaults to string if `buffer` is false or not set).

#### Example

```javascript
import { readFile } from "@visulima/fs";
import { join } from "node:path";

const readMyFile = async () => {
    try {
        // Read a regular text file
        const content = await readFile(join("path", "to", "my-file.txt"));
        console.log("File content:", content);

        // Read a file as a Buffer
        const bufferContent = await readFile(join("path", "to", "another-file.bin"), { buffer: true });
        console.log("Buffer length:", bufferContent.length);

        // Read and decompress a gzipped file
        // Assume my-archive.txt.gz exists
        // const decompressedContent = await readFile(join("path", "to", "my-archive.txt.gz"), { compression: "gzip", encoding: "utf8" });
        // console.log("Decompressed content:", decompressedContent);
    } catch (error) {
        console.error("Failed to read file:", error);
    }
};

readMyFile();
```

---

### readFileSync()

```ts
function readFileSync<O>(path, options?): ContentType<O>;
```

Defined in: [packages/fs/src/read/read-file-sync.ts:51](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/read/read-file-sync.ts#L51)

Synchronously reads the entire contents of a file.
It can also decompress the file content if a `compression` option is provided.

#### Type Parameters

##### O

`O` _extends_ [`ReadFileOptions`](#readfileoptions)\<`"brotli"` \| `"gzip"` \| `"none"`\> = `undefined`

The type of the options object, extending [ReadFileOptions](#readfileoptions).

#### Parameters

##### path

The path to the file to read. Can be a file URL or a string path.

`string` | `URL`

##### options?

`O`

Optional configuration for reading the file. See [ReadFileOptions](#readfileoptions).
Available `compression` methods: "brotli", "gzip", "none" (default).

#### Returns

[`ContentType`](#contenttype)\<`O`\>

The file content. The type of the content (string or Buffer)
depends on the `buffer` option (defaults to string if `buffer` is false or not set).

#### Example

```javascript
import { readFileSync } from "@visulima/fs";
import { join } from "node:path";

try {
    // Read a regular text file
    const content = readFileSync(join("path", "to", "my-file.txt"));
    console.log("File content:", content);

    // Read a file as a Buffer
    const bufferContent = readFileSync(join("path", "to", "another-file.bin"), { buffer: true });
    console.log("Buffer length:", bufferContent.length);

    // Read and decompress a gzipped file
    // Assume my-archive.txt.gz exists
    // const decompressedContent = readFileSync(join("path", "to", "my-archive.txt.gz"), { compression: "gzip", encoding: "utf8" });
    // console.log("Decompressed content:", decompressedContent);
} catch (error) {
    console.error("Failed to read file:", error);
}
```

---

### readJson()

Asynchronously reads a JSON file and then parses it into an object.

#### Template

The expected type of the parsed JSON object.

#### Param

The path to the JSON file to read. Can be a file URL or a string path.

#### Param

A function to transform the results. This function is called for each member of the object.
Alternatively, this can be the `options` object if no reviver function is provided.

#### Param

Optional configuration for reading and parsing the JSON file. See [ReadJsonOptions](#readjsonoptions).
If `reviver` is an object, this argument is ignored.

#### Example

```javascript
import { readJson } from "@visulima/fs";
import { join } from "node:path";

const readMyJson = async () => {
    try {
        const data = await readJson(join("path", "to", "my-config.json"));
        console.log("Config data:", data);

        // With a reviver function
        const dataWithReviver = await readJson(join("path", "to", "another.json"), (key, value) => {
            if (key === "date") return new Date(value);
            return value;
        });
        console.log("Date field is now a Date object:", dataWithReviver.date);

        // With options (e.g., for custom error reporting)
        const dataWithOptions = await readJson(join("path", "to", "options.json"), { color: { message: (str) => `\x1b[31m${str}\x1b[0m` } });
        console.log(dataWithOptions);
    } catch (error) {
        console.error("Failed to read or parse JSON file:", error);
    }
};

readMyJson();
```

#### Call Signature

```ts
function readJson<T>(path, options?): Promise<T>;
```

Defined in: [packages/fs/src/read/read-json.ts:8](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/read/read-json.ts#L8)

##### Type Parameters

###### T

`T` _extends_ `JsonValue`

##### Parameters

###### path

`string` | `URL`

###### options?

[`ReadJsonOptions`](#readjsonoptions)

##### Returns

`Promise`\<`T`\>

#### Call Signature

```ts
function readJson<T>(path, reviver, options?): Promise<T>;
```

Defined in: [packages/fs/src/read/read-json.ts:10](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/read/read-json.ts#L10)

##### Type Parameters

###### T

`T` _extends_ `JsonValue`

##### Parameters

###### path

`string` | `URL`

###### reviver

(`this`, `key`, `value`) => `any`

###### options?

[`ReadJsonOptions`](#readjsonoptions)

##### Returns

`Promise`\<`T`\>

---

### readJsonSync()

Synchronously reads a JSON file and then parses it into an object.

#### Template

The expected type of the parsed JSON object.

#### Param

The path to the JSON file to read. Can be a file URL or a string path.

#### Param

A function to transform the results. This function is called for each member of the object.
Alternatively, this can be the `options` object if no reviver function is provided.

#### Param

Optional configuration for reading and parsing the JSON file. See [ReadJsonOptions](#readjsonoptions).
If `reviver` is an object, this argument is ignored.

#### Example

```javascript
import { readJsonSync } from "@visulima/fs";
import { join } from "node:path";

try {
    const data = readJsonSync(join("path", "to", "my-config.json"));
    console.log("Config data:", data);

    // With a reviver function
    const dataWithReviver = readJsonSync(join("path", "to", "another.json"), (key, value) => {
        if (key === "date") return new Date(value);
        return value;
    });
    console.log("Date field is now a Date object:", dataWithReviver.date);

    // With options (e.g., for custom error reporting)
    const dataWithOptions = readJsonSync(join("path", "to", "options.json"), { color: { message: (str) => `\x1b[31m${str}\x1b[0m` } });
    console.log(dataWithOptions);
} catch (error) {
    console.error("Failed to read or parse JSON file:", error);
}
```

#### Call Signature

```ts
function readJsonSync<T>(path, options?): T;
```

Defined in: [packages/fs/src/read/read-json-sync.ts:8](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/read/read-json-sync.ts#L8)

##### Type Parameters

###### T

`T` _extends_ `JsonValue`

##### Parameters

###### path

`string` | `URL`

###### options?

[`ReadJsonOptions`](#readjsonoptions)

##### Returns

`T`

#### Call Signature

```ts
function readJsonSync<T>(path, reviver, options?): T;
```

Defined in: [packages/fs/src/read/read-json-sync.ts:10](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/read/read-json-sync.ts#L10)

##### Type Parameters

###### T

`T` _extends_ `JsonValue`

##### Parameters

###### path

`string` | `URL`

###### reviver

(`this`, `key`, `value`) => `any`

###### options?

[`ReadJsonOptions`](#readjsonoptions)

##### Returns

`T`

---

### remove()

```ts
function remove(path, options): Promise<void>;
```

Defined in: [packages/fs/src/remove/remove.ts:36](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/remove/remove.ts#L36)

Asynchronously removes a file or directory (recursively).
If the path does not exist, it does nothing.

#### Parameters

##### path

The path to the file or directory to remove.

`string` | `URL`

##### options

`RetryOptions` = `{}`

Optional configuration for the operation. See RetryOptions.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the path has been removed.

#### Example

```javascript
import { remove } from "@visulima/fs";
import { join } from "node:path";

const deleteFileOrDir = async () => {
    try {
        await remove(join("/tmp", "my-file.txt"));
        console.log("File /tmp/my-file.txt removed.");

        await remove(join("/tmp", "my-empty-dir"));
        console.log("Directory /tmp/my-empty-dir removed.");

        await remove(join("/tmp", "my-dir-with-contents"));
        console.log("Directory /tmp/my-dir-with-contents and its contents removed.");
    } catch (error) {
        console.error("Failed to remove path:", error);
    }
};

deleteFileOrDir();
```

---

### removeSync()

```ts
function removeSync(path, options): void;
```

Defined in: [packages/fs/src/remove/remove-sync.ts:32](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/remove/remove-sync.ts#L32)

Synchronously removes a file or directory (recursively).
If the path does not exist, it does nothing.

#### Parameters

##### path

The path to the file or directory to remove.

`string` | `URL`

##### options

`RetryOptions` = `{}`

Optional configuration for the operation. See RetryOptions.

#### Returns

`void`

void

#### Example

```javascript
import { removeSync } from "@visulima/fs";
import { join } from "node:path";

try {
    removeSync(join("/tmp", "my-file.txt"));
    console.log("File /tmp/my-file.txt removed.");

    removeSync(join("/tmp", "my-empty-dir"));
    console.log("Directory /tmp/my-empty-dir removed.");

    removeSync(join("/tmp", "my-dir-with-contents"));
    console.log("Directory /tmp/my-dir-with-contents and its contents removed.");
} catch (error) {
    console.error("Failed to remove path:", error);
}
```

---

### rename()

```ts
function rename(source, destination, options?): Promise<void>;
```

Defined in: [packages/fs/src/move/index.ts:85](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/move/index.ts#L85)

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
import { rename } from '@visulima/fs';

await rename('test.png', 'tests.png', {cwd: 'source'});
console.log('The file has been renamed');
```

---

### renameSync()

```ts
function renameSync(source, destination, options?): void;
```

Defined in: [packages/fs/src/move/index.ts:109](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/move/index.ts#L109)

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
import { renameSync } from '@visulima/fs';

renameSync('test.png', 'tests.png', {cwd: 'source'});
console.log('The file has been renamed');
```

---

### walk()

```ts
function walk(directory, options): AsyncIterableIterator<WalkEntry>;
```

Defined in: [packages/fs/src/find/walk.ts:64](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/find/walk.ts#L64)

Asynchronously walks the file tree rooted at `directory`, yielding each file or directory that matches the criteria specified in `options`.

#### Parameters

##### directory

The root directory to start walking from.

`string` | `URL`

##### options

[`WalkOptions`](#walkoptions) = `{}`

Optional configuration to control the walking process. See [WalkOptions](#walkoptions).

#### Returns

`AsyncIterableIterator`\<[`WalkEntry`](#walkentry)\>

An async iterable iterator yielding [WalkEntry](#walkentry) objects for each matching file or directory.

#### Example

```javascript
import { walk } from "@visulima/fs";
import { join } from "node:path";

const printEntries = async () => {
    // Walk through /tmp/my-project, looking for .ts files, max depth 2
    for await (const entry of walk(join("/tmp", "my-project"), { extensions: ["ts"], maxDepth: 2 })) {
        console.log(`Found: ${entry.path} (Type: ${entry.isFile() ? "file" : "directory"})`);
    }

    // Walk, including only directories, and skip any node_modules folders
    for await (const entry of walk(join("/tmp", "another-project"), { includeFiles: false, skip: [/node_modules/] })) {
        if (entry.isDirectory()) {
            console.log(`Directory: ${entry.path}`);
        }
    }
};

printEntries();
```

---

### walkSync()

```ts
function walkSync(directory, options): IterableIterator<WalkEntry>;
```

Defined in: [packages/fs/src/find/walk-sync.ts:64](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/find/walk-sync.ts#L64)

Synchronously walks the file tree rooted at `directory`, yielding each file or directory that matches the criteria specified in `options`.
This is the synchronous version of the [walk](#walk) function.

#### Parameters

##### directory

The root directory to start walking from.

`string` | `URL`

##### options

[`WalkOptions`](#walkoptions) = `{}`

Optional configuration to control the walking process. See [WalkOptions](#walkoptions).

#### Returns

`IterableIterator`\<[`WalkEntry`](#walkentry)\>

An iterable iterator yielding [WalkEntry](#walkentry) objects for each matching file or directory.

#### Example

```javascript
import { walkSync } from "@visulima/fs";
import { join } from "node:path";

// Walk through /tmp/my-project, looking for .ts files, max depth 2
for (const entry of walkSync(join("/tmp", "my-project"), { extensions: ["ts"], maxDepth: 2 })) {
    console.log(`Found: ${entry.path} (Type: ${entry.isFile() ? "file" : "directory"})`);
}

// Walk, including only directories, and skip any node_modules folders
for (const entry of walkSync(join("/tmp", "another-project"), { includeFiles: false, skip: [/node_modules/] })) {
    if (entry.isDirectory()) {
        console.log(`Directory: ${entry.path}`);
    }
}
```

---

### writeFile()

```ts
function writeFile(path, content, options?): Promise<void>;
```

Defined in: [packages/fs/src/write/write-file.ts:43](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/write/write-file.ts#L43)

Asynchronously writes data to a file, replacing the file if it already exists.
This function includes safeguards like writing to a temporary file first and then renaming, and handling permissions.

#### Parameters

##### path

The path to the file to write. Can be a file URL or a string path.

`string` | `URL`

##### content

The data to write. Can be a string, Buffer, ArrayBuffer, or ArrayBufferView.

`string` | `ArrayBuffer` | `ArrayBufferView`\<`ArrayBufferLike`\>

##### options?

[`WriteFileOptions`](#writefileoptions)

Optional configuration for writing the file. See [WriteFileOptions](#writefileoptions).

#### Returns

`Promise`\<`void`\>

A promise that resolves when the file has been written.

#### Example

```javascript
import { writeFile } from "@visulima/fs";
import { join } from "node:path";

const writeMyFile = async () => {
    try {
        await writeFile(join("/tmp", "my-new-file.txt"), "Hello World!");
        console.log("File written successfully.");

        await writeFile(join("/tmp", "another-file.txt"), "Some other content", { encoding: "utf16le", mode: 0o600 });
        console.log("Another file written with specific options.");
    } catch (error) {
        console.error("Failed to write file:", error);
    }
};

writeMyFile();
```

---

### writeFileSync()

```ts
function writeFileSync(path, content, options?): void;
```

Defined in: [packages/fs/src/write/write-file-sync.ts:43](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/write/write-file-sync.ts#L43)

Synchronously writes data to a file, replacing the file if it already exists.
This function includes safeguards like writing to a temporary file first and then renaming, and handling permissions.

#### Parameters

##### path

The path to the file to write. Can be a file URL or a string path.

`string` | `URL`

##### content

The data to write. Can be a string, Buffer, ArrayBuffer, or ArrayBufferView.

`string` | `ArrayBuffer` | `ArrayBufferView`\<`ArrayBufferLike`\>

##### options?

[`WriteFileOptions`](#writefileoptions)

Optional configuration for writing the file. See [WriteFileOptions](#writefileoptions).

#### Returns

`void`

void

#### Example

```javascript
import { writeFileSync } from "@visulima/fs";
import { join } from "node:path";

const writeMyFileSync = () => {
    try {
        writeFileSync(join("/tmp", "my-new-file-sync.txt"), "Hello World Synchronously!");
        console.log("File written successfully (sync).");

        writeFileSync(join("/tmp", "another-file-sync.txt"), "Some other sync content", { encoding: "utf16le", mode: 0o600 });
        console.log("Another file written with specific options (sync).");
    } catch (error) {
        console.error("Failed to write file (sync):", error);
    }
};

writeMyFileSync();
```

---

### writeJson()

```ts
function writeJson(path, data, options): Promise<void>;
```

Defined in: [packages/fs/src/write/write-json.ts:39](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/write/write-json.ts#L39)

Asynchronously writes an object to a JSON file.
Handles indentation detection, custom stringifiers, and gracefully manages existing files.

#### Parameters

##### path

The path to the JSON file to write. Can be a file URL or a string path.

`string` | `URL`

##### data

`unknown`

The data to serialize and write. Can be any JavaScript value that can be stringified by `JSON.stringify` or a custom stringifier.

##### options

[`WriteJsonOptions`](#writejsonoptions) = `{}`

Optional configuration for writing the JSON file. See [WriteJsonOptions](#writejsonoptions).

#### Returns

`Promise`\<`void`\>

A promise that resolves when the JSON file has been written.

#### Example

```javascript
import { writeJson } from "@visulima/fs";
import { join } from "node:path";

const writeMyJson = async () => {
    try {
        await writeJson(join("/tmp", "my-config.json"), { setting: "enabled", value: 123 });
        console.log("JSON file written successfully.");

        await writeJson(join("/tmp", "another-config.json"), { user: "test", id: "abc" }, { indent: 2, replacer: ["user"] });
        console.log("Another JSON file written with specific options (indent 2, only 'user' key).");
    } catch (error) {
        console.error("Failed to write JSON file:", error);
    }
};

writeMyJson();
```

---

### writeJsonSync()

```ts
function writeJsonSync(path, data, options): void;
```

Defined in: [packages/fs/src/write/write-json-sync.ts:39](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/write/write-json-sync.ts#L39)

Synchronously writes an object to a JSON file.
Handles indentation detection, custom stringifiers, and gracefully manages existing files.

#### Parameters

##### path

The path to the JSON file to write. Can be a file URL or a string path.

`string` | `URL`

##### data

`unknown`

The data to serialize and write. Can be any JavaScript value that can be stringified by `JSON.stringify` or a custom stringifier.

##### options

[`WriteJsonOptions`](#writejsonoptions) = `{}`

Optional configuration for writing the JSON file. See [WriteJsonOptions](#writejsonoptions).

#### Returns

`void`

void

#### Example

```javascript
import { writeJsonSync } from "@visulima/fs";
import { join } from "node:path";

const writeMyJsonSync = () => {
    try {
        writeJsonSync(join("/tmp", "my-config-sync.json"), { setting: "enabled", value: 456 });
        console.log("JSON file written successfully (sync).");

        writeJsonSync(join("/tmp", "another-config-sync.json"), { user: "testSync", id: "def" }, { indent: 4, replacer: ["id"] });
        console.log("Another JSON file written with specific options (sync, indent 4, only 'id' key).");
    } catch (error) {
        console.error("Failed to write JSON file (sync):", error);
    }
};

writeMyJsonSync();
```

## Variables

### F_OK

```ts
const F_OK: 0 = 0;
```

Defined in: [packages/fs/src/constants.ts:5](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/constants.ts#L5)

Constant to check if the path is visible to the calling process.
Corresponds to `node:fs.constants.F_OK`.

---

### FIND_UP_STOP

```ts
const FIND_UP_STOP: typeof FIND_UP_STOP;
```

Defined in: [packages/fs/src/constants.ts:29](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/constants.ts#L29)

A special symbol that can be returned by the matcher function in `findUp` or `findUpSync`
to stop the search process prematurely.

---

### R_OK

```ts
const R_OK: 4 = 4;
```

Defined in: [packages/fs/src/constants.ts:11](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/constants.ts#L11)

Constant to check if the path is readable to the calling process.
Corresponds to `node:fs.constants.R_OK`.

---

### W_OK

```ts
const W_OK: 2 = 2;
```

Defined in: [packages/fs/src/constants.ts:17](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/constants.ts#L17)

Constant to check if the path is writable to the calling process.
Corresponds to `node:fs.constants.W_OK`.

---

### X_OK

```ts
const X_OK: 1 = 1;
```

Defined in: [packages/fs/src/constants.ts:23](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/constants.ts#L23)

Constant to check if the path is executable by the calling process.
Corresponds to `node:fs.constants.X_OK`.

## Interfaces

### WalkEntry

Defined in: [packages/fs/src/types.ts:62](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L62)

Represents an entry found by `walk` or `walkSync`.

#### Extends

- `Pick`\<`Dirent`, `"isDirectory"` \| `"isFile"` \| `"isSymbolicLink"` \| `"name"`\>

#### Methods

##### isDirectory()

```ts
isDirectory(): boolean;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/fs.d.ts:190

Returns `true` if the `fs.Dirent` object describes a file system
directory.

###### Returns

`boolean`

###### Since

v10.10.0

###### Inherited from

```ts
Pick.isDirectory;
```

##### isFile()

```ts
isFile(): boolean;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/fs.d.ts:184

Returns `true` if the `fs.Dirent` object describes a regular file.

###### Returns

`boolean`

###### Since

v10.10.0

###### Inherited from

```ts
Pick.isFile;
```

##### isSymbolicLink()

```ts
isSymbolicLink(): boolean;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/fs.d.ts:205

Returns `true` if the `fs.Dirent` object describes a symbolic link.

###### Returns

`boolean`

###### Since

v10.10.0

###### Inherited from

```ts
Pick.isSymbolicLink;
```

#### Properties

##### name

```ts
name: string;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/fs.d.ts:222

The file name that this `fs.Dirent` object refers to. The type of this
value is determined by the `options.encoding` passed to readdir or readdirSync.

###### Since

v10.10.0

###### Inherited from

```ts
Pick.name;
```

##### path

```ts
path: string;
```

Defined in: [packages/fs/src/types.ts:64](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L64)

The full path to the entry.

---

### WalkOptions

Defined in: [packages/fs/src/types.ts:12](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L12)

Options for the `walk` and `walkSync` functions.

#### Properties

##### extensions?

```ts
optional extensions: string[];
```

Defined in: [packages/fs/src/types.ts:18](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L18)

List of file extensions used to filter entries.
If specified, entries without the file extension specified by this option are excluded.

###### Default

```ts
{
    undefined;
}
```

##### followSymlinks?

```ts
optional followSymlinks: boolean;
```

Defined in: [packages/fs/src/types.ts:23](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L23)

Indicates whether symlinks should be resolved or not.

###### Default

```ts
{
    false;
}
```

##### includeDirs?

```ts
optional includeDirs: boolean;
```

Defined in: [packages/fs/src/types.ts:28](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L28)

Indicates whether directory entries should be included or not.

###### Default

```ts
{
    true;
}
```

##### includeFiles?

```ts
optional includeFiles: boolean;
```

Defined in: [packages/fs/src/types.ts:33](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L33)

Indicates whether file entries should be included or not.

###### Default

```ts
{
    true;
}
```

##### includeSymlinks?

```ts
optional includeSymlinks: boolean;
```

Defined in: [packages/fs/src/types.ts:39](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L39)

Indicates whether symlink entries should be included or not.
This option is meaningful only if `followSymlinks` is set to `false`.

###### Default

```ts
{
    true;
}
```

##### match?

```ts
optional match: (string | RegExp)[];
```

Defined in: [packages/fs/src/types.ts:45](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L45)

List of regular expression or glob patterns used to filter entries.
If specified, entries that do not match the patterns specified by this option are excluded.

###### Default

```ts
{
    undefined;
}
```

##### maxDepth?

```ts
optional maxDepth: number;
```

Defined in: [packages/fs/src/types.ts:50](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L50)

The maximum depth of the file tree to be walked recursively.

###### Default

```ts
{
    Infinity;
}
```

##### skip?

```ts
optional skip: (string | RegExp)[];
```

Defined in: [packages/fs/src/types.ts:56](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L56)

List of regular expression or glob patterns used to filter entries.
If specified, entries matching the patterns specified by this option are excluded.

###### Default

```ts
{
    undefined;
}
```

## Type Aliases

### CodeFrameLocation

```ts
type CodeFrameLocation = object;
```

Defined in: [packages/fs/src/types.ts:117](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L117)

Specifies a location (line and column) in a file for code frame generation.

#### Properties

##### column?

```ts
optional column: number;
```

Defined in: [packages/fs/src/types.ts:119](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L119)

The column number.

##### line

```ts
line: number;
```

Defined in: [packages/fs/src/types.ts:121](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L121)

The line number.

---

### CodeFrameOptions

```ts
type CodeFrameOptions = object;
```

Defined in: [packages/fs/src/types.ts:127](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L127)

Options for customizing the appearance of code frames.

#### Properties

##### color?

```ts
optional color: object;
```

Defined in: [packages/fs/src/types.ts:129](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L129)

Colorization methods for different parts of the code frame.

###### gutter?

```ts
optional gutter: ColorizeMethod;
```

Color for the gutter (line numbers).

###### marker?

```ts
optional marker: ColorizeMethod;
```

Color for the marker (pointing to the error).

###### message?

```ts
optional message: ColorizeMethod;
```

Color for the message.

---

### ContentType\<O\>

```ts
type ContentType<O> = O extends object ? Buffer : string;
```

Defined in: [packages/fs/src/types.ts:104](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L104)

Represents the content type of a read file, which can be a Buffer or a string based on options.

#### Type Parameters

##### O

`O` = `undefined`

The ReadFileOptions type.

---

### FindUpName

```ts
type FindUpName =
  | string[]
  | string
  | (directory) => FindUpNameFnResult;
```

Defined in: [packages/fs/src/types.ts:270](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L270)

Specifies the name(s) of the file or directory to search for in `findUp`.
Can be a single name, an array of names, or a function that returns a name or `FIND_UP_STOP`.

---

### FindUpNameFnResult

```ts
type FindUpNameFnResult = PathLike | Promise<PathLike | typeof FIND_UP_STOP> | typeof FIND_UP_STOP | undefined;
```

Defined in: [packages/fs/src/types.ts:264](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L264)

The result type for the name matcher function used in `findUp`.
It can be a `PathLike` (string, Buffer, or URL), a Promise resolving to `PathLike` or `FIND_UP_STOP`,
`FIND_UP_STOP` to stop the search, or `undefined` to continue.

---

### FindUpNameSync

```ts
type FindUpNameSync =
  | string[]
  | string
  | (directory) => FindUpNameSyncFnResult;
```

Defined in: [packages/fs/src/types.ts:284](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L284)

Specifies the name(s) of the file or directory to search for in `findUpSync`.
Can be a single name, an array of names, or a function that returns a name or `FIND_UP_STOP`.

---

### FindUpNameSyncFnResult

```ts
type FindUpNameSyncFnResult = PathLike | typeof FIND_UP_STOP | undefined;
```

Defined in: [packages/fs/src/types.ts:278](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L278)

The result type for the name matcher function used in `findUpSync`.
It can be a `PathLike` (string, Buffer, or URL), `FIND_UP_STOP` to stop the search,
or `undefined` to continue.

---

### FindUpOptions

```ts
type FindUpOptions = object;
```

Defined in: [packages/fs/src/types.ts:235](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L235)

Options for the `findUp` and `findUpSync` functions.

#### Properties

##### allowSymlinks?

```ts
optional allowSymlinks: boolean;
```

Defined in: [packages/fs/src/types.ts:240](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L240)

Whether to follow symbolic links.

###### Default

undefined (behaves like `true` for `findUp`, `false` for `findUpSync` due to `fs.stat` vs `fs.lstat`)

##### cwd?

```ts
optional cwd: URL | string;
```

Defined in: [packages/fs/src/types.ts:245](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L245)

The current working directory.

###### Default

```ts
process.cwd();
```

##### stopAt?

```ts
optional stopAt: URL | string;
```

Defined in: [packages/fs/src/types.ts:250](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L250)

The directory to stop searching at.

###### Default

```ts
path.parse(cwd).root;
```

##### type?

```ts
optional type: "directory" | "file";
```

Defined in: [packages/fs/src/types.ts:255](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L255)

The type of path to find.

###### Default

```ts
"file";
```

---

### JsonReplacer

```ts
type JsonReplacer = (number | string)[] | (this, key, value) => unknown | null;
```

Defined in: [packages/fs/src/types.ts:197](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L197)

Type for the `replacer` parameter of `JSON.stringify()`.
Can be a function that alters the behavior of the stringification process,
or an array of strings and numbers that acts as a whitelist for selecting
the properties of the value object to be included in the JSON string.
If this value is null or not provided, all properties of the object are included in the resulting JSON string.

---

### JsonReviver

```ts
type JsonReviver = Parameters<(typeof JSON)["parse"]>["1"];
```

Defined in: [packages/fs/src/types.ts:112](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L112)

Type for the `reviver` parameter of `JSON.parse()`.
A function that transforms the results. This function is called for each member of the object.
If a member contains nested objects, the nested objects are transformed before the parent object is.

---

### MoveOptions

```ts
type MoveOptions = object;
```

Defined in: [packages/fs/src/move/types.ts:3](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/move/types.ts#L3)

#### Properties

##### cwd?

```ts
optional cwd: URL | string;
```

Defined in: [packages/fs/src/move/types.ts:10](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/move/types.ts#L10)

The working directory to find source files.
The source and destination path are relative to this.

###### Default

```ts
process.cwd();
```

##### directoryMode?

```ts
readonly optional directoryMode: FilePermissions;
```

Defined in: [packages/fs/src/move/types.ts:19](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/move/types.ts#L19)

[Permissions](https://en.wikipedia.org/wiki/File-system_permissions#Numeric_notation) for created directories.

It has no effect on Windows.

###### Default

```ts
0o777;
```

##### overwrite?

```ts
readonly optional overwrite: boolean;
```

Defined in: [packages/fs/src/move/types.ts:26](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/move/types.ts#L26)

Overwrite existing destination file.

###### Default

```ts
true;
```

---

### ReadFileEncoding

```ts
type ReadFileEncoding = "ascii" | "base64" | "base64url" | "hex" | "latin1" | "ucs-2" | "ucs2" | "utf-8" | "utf-16le" | "utf8" | "utf16le";
```

Defined in: [packages/fs/src/types.ts:71](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L71)

Supported file encodings for reading files.

---

### ReadFileOptions\<C\>

```ts
type ReadFileOptions<C> = object;
```

Defined in: [packages/fs/src/types.ts:77](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L77)

Options for reading files.

#### Type Parameters

##### C

`C`

The type of compression used.

#### Properties

##### buffer?

```ts
optional buffer: boolean;
```

Defined in: [packages/fs/src/types.ts:81](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L81)

Return content as a Buffer. Default: `false`

##### compression?

```ts
optional compression: C;
```

Defined in: [packages/fs/src/types.ts:86](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L86)

Compression method to decompress the file against. Default: `none`

##### encoding?

```ts
optional encoding: ReadFileEncoding;
```

Defined in: [packages/fs/src/types.ts:92](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L92)

The encoding to use. Default: `utf8`

###### See

https://nodejs.org/api/buffer.html#buffer_buffers_and_character_encodings

##### flag?

```ts
optional flag: number | string;
```

Defined in: [packages/fs/src/types.ts:97](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L97)

The flag used to open the file. Default: `r`

---

### ReadJsonOptions

```ts
type ReadJsonOptions = CodeFrameOptions & object;
```

Defined in: [packages/fs/src/types.ts:143](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L143)

Options for reading and parsing JSON files.
Extends [CodeFrameOptions](#codeframeoptions).

#### Type declaration

##### beforeParse()?

```ts
optional beforeParse: (source) => string;
```

A function to transform the string content before parsing.

###### Parameters

###### source

`string`

The raw string content of the file.

###### Returns

`string`

The transformed string content.

---

### WriteFileOptions

```ts
type WriteFileOptions = object;
```

Defined in: [packages/fs/src/types.ts:155](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L155)

Options for writing files.

#### Properties

##### chown?

```ts
optional chown: object;
```

Defined in: [packages/fs/src/types.ts:159](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L159)

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

Defined in: [packages/fs/src/types.ts:167](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L167)

The encoding to use. Default: `utf8`

##### flag?

```ts
optional flag: string;
```

Defined in: [packages/fs/src/types.ts:172](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L172)

The flag used to write the file. Default: `w`

##### mode?

```ts
optional mode: number;
```

Defined in: [packages/fs/src/types.ts:177](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L177)

The file mode (permission and sticky bits). Default: `0o666`

##### overwrite?

```ts
optional overwrite: boolean;
```

Defined in: [packages/fs/src/types.ts:182](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L182)

Indicates whether the file should be overwritten if it already exists. Default: `false`

##### recursive?

```ts
optional recursive: boolean;
```

Defined in: [packages/fs/src/types.ts:187](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L187)

Recursively create parent directories if needed. Default: `true`

---

### WriteJsonOptions

```ts
type WriteJsonOptions = WriteFileOptions & object;
```

Defined in: [packages/fs/src/types.ts:208](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L208)

Options for writing JSON files.
Extends [WriteFileOptions](#writefileoptions).

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

## References

### CRLF

Re-exports [CRLF](eol.md#crlf)

---

### detect

Re-exports [detect](eol.md#detect)

---

### EOL

Re-exports [EOL](eol.md#eol)

---

### format

Re-exports [format](eol.md#format)

---

### LF

Re-exports [LF](eol.md#lf)

# size

## Functions

### brotliSize()

```ts
function brotliSize(input, options?): Promise<number>;
```

Defined in: [packages/fs/src/size.ts:222](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/size.ts#L222)

Asynchronously calculates the Brotli compressed size of the given input.
The input can be a Buffer, a Readable stream, a URL object pointing to a file, or a string (file path or content).
Uses memory-efficient streaming for files and streams to avoid loading entire contents into memory.

#### Parameters

##### input

The input data to compress with Brotli and measure.

`string` | `URL` | `Buffer`\<`ArrayBufferLike`\> | `Readable`

##### options?

`BrotliOptions`

Optional Zlib options for Brotli compression.

#### Returns

`Promise`\<`number`\>

A promise that resolves with the Brotli compressed size in bytes.

#### Example

```javascript
import { brotliSize } from "@visulima/fs";
import { Readable } from "node:stream";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";

const text = "This is a test string for Brotli compression efficiency.";
const filePath = join("temp-brotli-file.txt");

async function main() {
    // From Buffer
    const buffer = Buffer.from(text);
    console.log(`Brotli size of buffer: ${await brotliSize(buffer)} bytes`);

    // From string (content)
    console.log(`Brotli size of string content: ${await brotliSize(text)} bytes`);

    // From file path
    await writeFile(filePath, text);
    console.log(`Brotli size of file: ${await brotliSize(filePath)} bytes`);

    // From URL
    const fileUrl = new URL(`file://${filePath}`);
    console.log(`Brotli size of URL: ${await brotliSize(fileUrl)} bytes`);

    // From Readable stream
    const stream = Readable.from(text);
    console.log(`Brotli size of stream: ${await brotliSize(stream)} bytes`);

    await unlink(filePath); // Clean up temp file
}

main().catch(console.error);
```

---

### brotliSizeSync()

```ts
function brotliSizeSync(input, options?): number;
```

Defined in: [packages/fs/src/size.ts:370](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/size.ts#L370)

Synchronously calculates the Brotli compressed size of the given input.
The input can be a Buffer, a URL object pointing to a file, or a string (file path or content).
Note: For Readable streams or very large files, consider using the asynchronous `brotliSize` function for better performance and to avoid blocking.

#### Parameters

##### input

The input data to compress with Brotli and measure.

`string` | `URL` | `Buffer`\<`ArrayBufferLike`\>

##### options?

`BrotliOptions`

Optional Zlib options for Brotli compression.

#### Returns

`number`

The Brotli compressed size in bytes.

#### Example

```javascript
import { brotliSizeSync } from "@visulima/fs";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const text = "This is a test string for Brotli compression efficiency, synchronously.";
const filePath = join("temp-brotli-sync-file.txt");

// From Buffer
const buffer = Buffer.from(text);
console.log(`Sync Brotli size of buffer: ${brotliSizeSync(buffer)} bytes`);

// From string (content)
console.log(`Sync Brotli size of string content: ${brotliSizeSync(text)} bytes`);

// From file path
try {
    writeFileSync(filePath, text);
    console.log(`Sync Brotli size of file: ${brotliSizeSync(filePath)} bytes`);

    // From URL
    const fileUrl = new URL(`file://${filePath}`);
    console.log(`Sync Brotli size of URL: ${brotliSizeSync(fileUrl)} bytes`);
} finally {
    try {
        unlinkSync(filePath);
    } catch {} // Clean up temp file
}
```

---

### gzipSize()

```ts
function gzipSize(input, options?): Promise<number>;
```

Defined in: [packages/fs/src/size.ts:171](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/size.ts#L171)

Asynchronously calculates the gzipped size of the given input.
The input can be a Buffer, a Readable stream, a URL object pointing to a file, or a string (file path or content).
Uses memory-efficient streaming for files and streams to avoid loading entire contents into memory.

#### Parameters

##### input

The input data to gzip and measure.

`string` | `URL` | `Buffer`\<`ArrayBufferLike`\> | `Readable`

##### options?

`ZlibOptions`

Optional Zlib options for gzip compression.

#### Returns

`Promise`\<`number`\>

A promise that resolves with the gzipped size in bytes.

#### Example

```javascript
import { gzipSize } from "@visulima/fs";
import { Readable } from "node:stream";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";

const text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
const filePath = join("temp-file.txt");

async function main() {
    // From Buffer
    const buffer = Buffer.from(text);
    console.log(`Gzip size of buffer: ${await gzipSize(buffer)} bytes`);

    // From string (content)
    console.log(`Gzip size of string content: ${await gzipSize(text)} bytes`);

    // From file path
    await writeFile(filePath, text);
    console.log(`Gzip size of file: ${await gzipSize(filePath)} bytes`);

    // From URL
    const fileUrl = new URL(`file://${filePath}`);
    console.log(`Gzip size of URL: ${await gzipSize(fileUrl)} bytes`);

    // From Readable stream
    const stream = Readable.from(text);
    console.log(`Gzip size of stream: ${await gzipSize(stream)} bytes`);

    await unlink(filePath); // Clean up temp file
}

main().catch(console.error);
```

---

### gzipSizeSync()

```ts
function gzipSizeSync(input, options?): number;
```

Defined in: [packages/fs/src/size.ts:316](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/size.ts#L316)

Synchronously calculates the gzipped size of the given input.
The input can be a Buffer, a URL object pointing to a file, or a string (file path or content).
Note: For Readable streams or very large files, consider using the asynchronous `gzipSize` function for better performance and to avoid blocking.

#### Parameters

##### input

The input data to gzip and measure.

`string` | `URL` | `Buffer`\<`ArrayBufferLike`\>

##### options?

`ZlibOptions`

Optional Zlib options for gzip compression.

#### Returns

`number`

The gzipped size in bytes.

#### Example

```javascript
import { gzipSizeSync } from "@visulima/fs";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
const filePath = join("temp-sync-file.txt");

// From Buffer
const buffer = Buffer.from(text);
console.log(`Sync Gzip size of buffer: ${gzipSizeSync(buffer)} bytes`);

// From string (content)
console.log(`Sync Gzip size of string content: ${gzipSizeSync(text)} bytes`);

// From file path
try {
    writeFileSync(filePath, text);
    console.log(`Sync Gzip size of file: ${gzipSizeSync(filePath)} bytes`);

    // From URL
    const fileUrl = new URL(`file://${filePath}`);
    console.log(`Sync Gzip size of URL: ${gzipSizeSync(fileUrl)} bytes`);
} finally {
    try {
        unlinkSync(filePath);
    } catch {} // Clean up temp file
}
```

---

### rawSize()

```ts
function rawSize(input): Promise<number>;
```

Defined in: [packages/fs/src/size.ts:272](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/size.ts#L272)

Asynchronously calculates the raw (uncompressed) size of the given input.
The input can be a Buffer, a Readable stream, a URL object pointing to a file, or a string (file path or content).
Uses memory-efficient streaming for files and streams to avoid loading entire contents into memory.

#### Parameters

##### input

The input data to measure.

`string` | `URL` | `Buffer`\<`ArrayBufferLike`\> | `Readable`

#### Returns

`Promise`\<`number`\>

A promise that resolves with the raw size in bytes.

#### Example

```javascript
import { rawSize } from "@visulima/fs";
import { Readable } from "node:stream";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";

const text = "Hello, World!";
const filePath = join("temp-raw-file.txt");

async function main() {
    // From Buffer
    const buffer = Buffer.from(text);
    console.log(`Raw size of buffer: ${await rawSize(buffer)} bytes`);

    // From string (content)
    console.log(`Raw size of string content: ${await rawSize(text)} bytes`);

    // From file path
    await writeFile(filePath, text);
    console.log(`Raw size of file: ${await rawSize(filePath)} bytes`);

    // From URL
    const fileUrl = new URL(`file://${filePath}`);
    console.log(`Raw size of URL: ${await rawSize(fileUrl)} bytes`);

    // From Readable stream
    const stream = Readable.from(text);
    console.log(`Raw size of stream: ${await rawSize(stream)} bytes`);

    await unlink(filePath); // Clean up temp file
}

main().catch(console.error);
```

---

### rawSizeSync()

```ts
function rawSizeSync(input): number;
```

Defined in: [packages/fs/src/size.ts:424](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/size.ts#L424)

Synchronously calculates the raw (uncompressed) size of the given input.
The input can be a Buffer, a URL object pointing to a file, or a string (file path or content).
For file paths, it uses `statSync` to get the file size.
Note: For Readable streams or very large files, consider using the asynchronous `rawSize` function for better performance and to avoid blocking.

#### Parameters

##### input

The input data to measure.

`string` | `URL` | `Buffer`\<`ArrayBufferLike`\>

#### Returns

`number`

The raw size in bytes.

#### Example

```javascript
import { rawSizeSync } from "@visulima/fs";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const text = "Hello, Synchronous World!";
const filePath = join("temp-raw-sync-file.txt");

// From Buffer
const buffer = Buffer.from(text);
console.log(`Sync Raw size of buffer: ${rawSizeSync(buffer)} bytes`);

// From string (content)
console.log(`Sync Raw size of string content: ${rawSizeSync(text)} bytes`);

// From file path
try {
    writeFileSync(filePath, text);
    console.log(`Sync Raw size of file: ${rawSizeSync(filePath)} bytes`);

    // From URL
    const fileUrl = new URL(`file://${filePath}`);
    console.log(`Sync Raw size of URL: ${rawSizeSync(fileUrl)} bytes`);
} finally {
    try {
        unlinkSync(filePath);
    } catch {} // Clean up temp file
}
```

# utils

## Classes

### JSONError

Defined in: [packages/fs/src/error/json-error.ts:39](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/json-error.ts#L39)

Custom error class for handling JSON parsing or related errors.
It can optionally include a file name and a code frame for better debugging.

#### Example

```javascript
import { JSONError } from "@visulima/fs/error";
import { readJsonSync } from "@visulima/fs"; // Or any function that might throw this
import { join } from "node:path";

try {
    // Imagine readJsonSync encounters a malformed JSON file and throws JSONError
    // Forcing the scenario for demonstration:
    const simulateJsonError = (filePath, content) => {
        const err = new JSONError(`Unexpected token '}' at position 15`);
        err.fileName = filePath;
        // A real implementation might generate a code frame using a library
        err.codeFrame = `  13 |   "key": "value",
> 14 |   "anotherKey": "anotherValue",}
    |                             ^
 15 |   "lastKey": "end"
`;
        throw err;
    };

    simulateJsonError(join("path", "to", "corrupted.json"), '{ "key": "value", "anotherKey": "anotherValue",} ');
    // const jsonData = readJsonSync(join("path", "to", "corrupted.json"));
} catch (error) {
    if (error instanceof JSONError) {
        console.error(`JSON Error: ${error.message}`);
        // message property will include fileName and codeFrame if they were set.
        // console.error(`File: ${error.fileName}`);
        // console.error(`Code Frame:\n${error.codeFrame}`);
    } else {
        console.error("An unexpected error occurred:", error);
    }
}
```

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new JSONError(message): JSONError;
```

Defined in: [packages/fs/src/error/json-error.ts:53](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/json-error.ts#L53)

Creates a new JSONError instance.

###### Parameters

###### message

`string`

The primary error message.

###### Returns

[`JSONError`](#jsonerror)

###### Overrides

```ts
Error.constructor;
```

#### Accessors

##### message

###### Get Signature

```ts
get message(): string;
```

Defined in: [packages/fs/src/error/json-error.ts:63](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/json-error.ts#L63)

###### Returns

`string`

###### Set Signature

```ts
set message(message): void;
```

Defined in: [packages/fs/src/error/json-error.ts:67](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/json-error.ts#L67)

###### Parameters

###### message

`string`

###### Returns

`void`

###### Overrides

```ts
Error.message;
```

#### Methods

##### captureStackTrace()

```ts
static captureStackTrace(targetObject, constructorOpt?): void;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:91

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
Error.captureStackTrace;
```

#### Properties

##### cause?

```ts
optional cause: unknown;
```

Defined in: node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/lib.es2022.error.d.ts:26

###### Inherited from

```ts
Error.cause;
```

##### codeFrame

```ts
codeFrame: string;
```

Defined in: [packages/fs/src/error/json-error.ts:42](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/json-error.ts#L42)

##### fileName

```ts
fileName: string;
```

Defined in: [packages/fs/src/error/json-error.ts:40](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/json-error.ts#L40)

##### name

```ts
readonly name: "JSONError" = "JSONError";
```

Defined in: [packages/fs/src/error/json-error.ts:45](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/error/json-error.ts#L45)

###### Overrides

```ts
Error.name;
```

##### stack?

```ts
optional stack: string;
```

Defined in: node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/lib.es5.d.ts:1078

###### Inherited from

```ts
Error.stack;
```

##### prepareStackTrace()?

```ts
static optional prepareStackTrace: (err, stackTraces) => any;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:98

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
Error.prepareStackTrace;
```

##### stackTraceLimit

```ts
static stackTraceLimit: number;
```

Defined in: node_modules/.pnpm/@types+node@18.19.71/node_modules/@types/node/globals.d.ts:100

###### Inherited from

```ts
Error.stackTraceLimit;
```

## Functions

### assertValidFileContents()

```ts
function assertValidFileContents(contents): void;
```

Defined in: [packages/fs/src/utils/assert-valid-file-contents.ts:28](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/utils/assert-valid-file-contents.ts#L28)

Asserts that the provided contents are valid for writing to a file.
Valid contents can be a string, an ArrayBuffer, or an ArrayBuffer view (e.g., Uint8Array).

#### Parameters

##### contents

`any`

The file contents to validate.

#### Returns

`void`

#### Throws

If the contents are not a string, ArrayBuffer, or ArrayBuffer view.

#### Example

```javascript
import { assertValidFileContents } from "@visulima/fs"; // Assuming this util is exported

try {
    assertValidFileContents("Hello, world!");
    assertValidFileContents(new Uint8Array([72, 101, 108, 108, 111])); // "Hello"
    assertValidFileContents(new ArrayBuffer(8));
    console.log("File contents are valid.");
} catch (error) {
    console.error(error.message); // File contents must be a string, ArrayBuffer, or ArrayBuffer view.
}

try {
    assertValidFileContents(123); // Invalid content type
} catch (error) {
    console.error(error.message); // File contents must be a string, ArrayBuffer, or ArrayBuffer view.
}
```

---

### assertValidFileOrDirectoryPath()

```ts
function assertValidFileOrDirectoryPath(fileOrDirectoryPath): void;
```

Defined in: [packages/fs/src/utils/assert-valid-file-or-directory-path.ts:27](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/utils/assert-valid-file-or-directory-path.ts#L27)

Asserts that the provided path is a valid file or directory path.
A valid path must be a non-empty string or a URL instance.

#### Parameters

##### fileOrDirectoryPath

`any`

The path to validate.

#### Returns

`void`

#### Throws

If the path is not a non-empty string or a URL.

#### Example

```javascript
import { assertValidFileOrDirectoryPath } from "@visulima/fs"; // Assuming this util is exported

try {
    assertValidFileOrDirectoryPath("/path/to/file.txt");
    assertValidFileOrDirectoryPath(new URL("file:///path/to/file.txt"));
    console.log("Path is valid.");
} catch (error) {
    console.error(error.message); // Path must be a non-empty string or URL.
}

try {
    assertValidFileOrDirectoryPath(""); // Invalid path
} catch (error) {
    console.error(error.message); // Path must be a non-empty string or URL.
}
```

---

### parseJson()

Parses a JSON string, constructing the JavaScript value or object described by the string.
This is a modified version of `parse-json` from `https://github.com/sindresorhus/parse-json/blob/main/index.js`.
It provides more detailed error messages including code frames.

#### Template

The type of the parsed JSON value.

#### Param

The JSON string to parse.

#### Param

An optional reviver function that can transform the results, or a filename string if no reviver is used.

#### Param

An optional filename string (if reviver is provided), or CodeFrameOptions (if reviver is not provided and this is the third argument).

#### Param

Optional options for generating the code frame on error.

#### Throws

If the string to parse is not valid JSON, or if any other parsing error occurs.

#### Example

```javascript
import { parseJson } from "@visulima/fs"; // Assuming this util is exported or re-exported

const jsonString = '{"name": "John Doe", "age": 30, "city": "New York"}';
const malformedJson = '{"name": "Jane Doe", "age": "thirty}'; // Missing quote

try {
    const data = parseJson(jsonString);
    console.log(data.name); // Output: John Doe

    const dataWithReviver = parseJson(jsonString, (key, value) => {
        if (key === "age") {
            return value + 5;
        }
        return value;
    });
    console.log(dataWithReviver.age); // Output: 35

    // With filename for better error reporting
    const user = parseJson(malformedJson, "user-data.json");
} catch (error) {
    // error will be an instance of JsonError
    console.error(error.message);
    // Example error message:
    // Unexpected token } in JSON at position 37 in user-data.json
    //
    //   35 |   "name": "Jane Doe",
    // > 36 |   "age": "thirty}
    //      |                 ^
    //   37 |
    if (error.fileName) {
        console.error(`Error in file: ${error.fileName}`);
    }
    if (error.codeFrame) {
        console.error(error.codeFrame);
    }
}
```

#### Call Signature

```ts
function parseJson<T>(string, filename?, options?): T;
```

Defined in: [packages/fs/src/utils/parse-json.ts:60](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/utils/parse-json.ts#L60)

##### Type Parameters

###### T

`T` = `JsonValue`

##### Parameters

###### string

`string`

###### filename?

`string`

###### options?

[`CodeFrameOptions`](index.md#codeframeoptions)

##### Returns

`T`

#### Call Signature

```ts
function parseJson<T>(string, reviver, fileName?, options?): T;
```

Defined in: [packages/fs/src/utils/parse-json.ts:61](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/utils/parse-json.ts#L61)

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

[`CodeFrameOptions`](index.md#codeframeoptions)

##### Returns

`T`

---

### stripJsonComments()

```ts
function stripJsonComments(jsonString, options?): string;
```

Defined in: [packages/fs/src/utils/strip-json-comments.ts:46](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/utils/strip-json-comments.ts#L46)

Strips comments from a JSON string.
Handles both single-line (//) and multi-line (/_ ... _&#47;) comments.

#### Parameters

##### jsonString

`string`

The JSON string possibly containing comments.

##### options?

Optional configuration for stripping comments.

###### whitespace?

`boolean` = `true`

If `true` (default), comments are replaced with whitespace to preserve line numbers and character positions. If `false`, comments are removed entirely.

#### Returns

`string`

The JSON string with comments stripped.

#### Example

```javascript
import { stripJsonComments } from "@visulima/fs"; // Assuming this util is exported

const jsonWithComments = `{
  // This is a single-line comment
  "name": "John Doe",
  "age": 30, /* This is a
  multi-line comment *&#47;
  "city": "New York"
}`;

const stripped = stripJsonComments(jsonWithComments);
console.log(stripped);
// Output (with whitespace=true):
// {
//
//   "name": "John Doe",
//   "age": 30, /*
//
//   "city": "New York"
// }

const strippedWithoutWhitespace = stripJsonComments(jsonWithComments, { whitespace: false });
console.log(strippedWithoutWhitespace);
// Output (with whitespace=false):
// {
//   "name": "John Doe",
//   "age": 30,
//   "city": "New York"
// }
```

## Variables

### toPath()

```ts
const toPath: (urlOrPath) => string;
```

Defined in: node_modules/.pnpm/@visulima+path@1.3.6/node_modules/@visulima/path/dist/utils.d.mts:7

#### Parameters

##### urlOrPath

`URL` | `string`

#### Returns

`string`

# yaml

## Functions

### readYaml()

Asynchronously reads a YAML file and then parses it into an object.

#### Template

The expected type of the parsed YAML object. Defaults to `Record<string, unknown>`.

#### Param

The path to the YAML file to read. Can be a file URL or a string path.

#### Param

An optional reviver function (similar to `JSON.parse` reviver) or the options object.

#### Param

Optional configuration for reading and parsing the YAML file. See ReadYamlOptions.
If `reviver` is an object, this argument is ignored.

#### Example

```javascript
import { readYaml } from "@visulima/fs";
import { join } from "node:path";

const readMyYaml = async () => {
    try {
        const data = await readYaml(join("path", "to", "my-config.yaml"));
        console.log("Config data:", data);

        // With a reviver function
        const dataWithReviver = await readYaml(join("path", "to", "another.yaml"), (key, value) => {
            if (key === "date") return new Date(value);
            return value;
        });
        console.log("Date field is now a Date object:", dataWithReviver.date);

        // With options (e.g., for schema validation - assuming yaml options are passed correctly)
        // const dataWithOptions = await readYaml(join("path", "to", "options.yaml"), { schema: 'failsafe' });
        // console.log(dataWithOptions);
    } catch (error) {
        console.error("Failed to read or parse YAML file:", error);
    }
};

readMyYaml();
```

#### Call Signature

```ts
function readYaml<R>(path, options?): Promise<R>;
```

Defined in: [packages/fs/src/read/read-yaml.ts:6](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/read/read-yaml.ts#L6)

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
function readYaml<R>(path, reviver?, options?): Promise<R>;
```

Defined in: [packages/fs/src/read/read-yaml.ts:7](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/read/read-yaml.ts#L7)

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

---

### readYamlSync()

Synchronously reads a YAML file and then parses it into an object.

#### Template

The expected type of the parsed YAML object. Defaults to `Record<string, unknown>`.

#### Param

The path to the YAML file to read. Can be a file URL or a string path.

#### Param

An optional reviver function (similar to `JSON.parse` reviver) or the options object.

#### Param

Optional configuration for reading and parsing the YAML file. See ReadYamlOptions.
If `reviver` is an object, this argument is ignored.

#### Example

```javascript
import { readYamlSync } from "@visulima/fs";
import { join } from "node:path";

try {
    const data = readYamlSync(join("path", "to", "my-config.yaml"));
    console.log("Config data:", data);

    // With a reviver function
    const dataWithReviver = readYamlSync(join("path", "to", "another.yaml"), (key, value) => {
        if (key === "date") return new Date(value);
        return value;
    });
    console.log("Date field is now a Date object:", dataWithReviver.date);

    // With options (e.g., for schema validation - assuming yaml options are passed correctly)
    // const dataWithOptions = readYamlSync(join("path", "to", "options.yaml"), { schema: 'failsafe' });
    // console.log(dataWithOptions);
} catch (error) {
    console.error("Failed to read or parse YAML file:", error);
}
```

#### Call Signature

```ts
function readYamlSync<R>(path, options?): R;
```

Defined in: [packages/fs/src/read/read-yaml-sync.ts:6](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/read/read-yaml-sync.ts#L6)

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
function readYamlSync<R>(path, reviver?, options?): R;
```

Defined in: [packages/fs/src/read/read-yaml-sync.ts:7](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/read/read-yaml-sync.ts#L7)

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

---

### writeYaml()

Asynchronously writes an object to a YAML file.

#### Param

The path to the YAML file to write. Can be a file URL or a string path.

#### Param

The data to serialize and write. Can be any JavaScript value that can be stringified by `yaml.stringify`.

#### Param

Optional. A replacer function or an array of keys to include, or the options object itself.
See `yaml.stringify` documentation for more details.

#### Param

Optional. Configuration for writing and stringifying the YAML file. See WriteYamlOptions.
If `replacer` is an object and not a function/array, it's treated as `options`.
The `space` property within options can be a number for spaces or a string for tabs/etc.

#### Example

```javascript
import { writeYaml } from "@visulima/fs";
import { join } from "node:path";

const writeMyYaml = async () => {
    try {
        await writeYaml(join("/tmp", "my-data.yaml"), { name: "John Doe", age: 30, city: "New York" });
        console.log("YAML file written successfully.");

        await writeYaml(join("/tmp", "another-data.yaml"), { user: "jane", details: { id: 1, status: "active" } }, null, 2);
        console.log("Another YAML file written with 2 spaces indentation.");

        const customReplacer = (key, value) => (key === "age" ? undefined : value);
        await writeYaml(join("/tmp", "filtered-data.yaml"), { name: "Smith", age: 45, occupation: "Engineer" }, customReplacer, { space: "\t" });
        console.log("Filtered YAML file written with tab indentation.");
    } catch (error) {
        console.error("Failed to write YAML file:", error);
    }
};

writeMyYaml();
```

#### Call Signature

```ts
function writeYaml(path, data, options?): Promise<void>;
```

Defined in: [packages/fs/src/write/write-yaml.ts:6](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/write/write-yaml.ts#L6)

##### Parameters

###### path

`string` | `URL`

###### data

`any`

###### options?

`WriteYamlOptions`

##### Returns

`Promise`\<`void`\>

#### Call Signature

```ts
function writeYaml(path, data, replacer?, options?): Promise<void>;
```

Defined in: [packages/fs/src/write/write-yaml.ts:12](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/write/write-yaml.ts#L12)

##### Parameters

###### path

`string` | `URL`

###### data

`any`

###### replacer?

[`JsonReplacer`](index.md#jsonreplacer)

###### options?

`string` | `number` | `WriteYamlOptions`

##### Returns

`Promise`\<`void`\>

---

### writeYamlSync()

Synchronously writes an object to a YAML file.

#### Param

The path to the YAML file to write. Can be a file URL or a string path.

#### Param

The data to serialize and write. Can be any JavaScript value that can be stringified by `yaml.stringify`.

#### Param

Optional. A replacer function or an array of keys to include, or the options object itself.
See `yaml.stringify` documentation for more details.

#### Param

Optional. Configuration for writing and stringifying the YAML file. See WriteYamlOptions.
If `replacer` is an object and not a function/array, it's treated as `options`.
The `space` property within options can be a number for spaces or a string for tabs/etc.

#### Example

```javascript
import { writeYamlSync } from "@visulima/fs";
import { join } from "node:path";

const writeMyYamlSync = () => {
    try {
        writeYamlSync(join("/tmp", "my-data-sync.yaml"), { name: "Jane Doe", age: 28, city: "London" });
        console.log("YAML file written successfully (sync).");

        writeYamlSync(join("/tmp", "another-data-sync.yaml"), { user: "john_sync", details: { id: 2, status: "inactive" } }, null, 4);
        console.log("Another YAML file written with 4 spaces indentation (sync).");

        const customReplacer = (key, value) => (key === "city" ? "REDACTED" : value);
        writeYamlSync(join("/tmp", "filtered-data-sync.yaml"), { name: "Peter", age: 50, city: "Paris" }, customReplacer, { space: 2 });
        console.log("Filtered YAML file written with 2 spaces indentation (sync).");
    } catch (error) {
        console.error("Failed to write YAML file (sync):", error);
    }
};

writeMyYamlSync();
```

#### Call Signature

```ts
function writeYamlSync(path, data, options?): void;
```

Defined in: [packages/fs/src/write/write-yaml-sync.ts:6](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/write/write-yaml-sync.ts#L6)

##### Parameters

###### path

`string` | `URL`

###### data

`any`

###### options?

`WriteYamlOptions`

##### Returns

`void`

#### Call Signature

```ts
function writeYamlSync(path, data, replacer?, options?): void;
```

Defined in: [packages/fs/src/write/write-yaml-sync.ts:12](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/write/write-yaml-sync.ts#L12)

##### Parameters

###### path

`string` | `URL`

###### data

`any`

###### replacer?

[`JsonReplacer`](index.md#jsonreplacer)

###### options?

`string` | `number` | `WriteYamlOptions`

##### Returns

`void`

## Type Aliases

### YamlReplacer

```ts
type YamlReplacer = JsonReplacer;
```

Defined in: [packages/fs/src/types.ts:202](https://github.com/visulima/visulima/blob/07f43a001a4f33a3ebcce9072d404a8975539608/packages/fs/src/types.ts#L202)

Type for the `replacer` parameter used in YAML serialization, similar to `JSON.stringify`'s replacer.

<!-- /TYPEDOC -->

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

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

The visulima fs is open-sourced software licensed under the [MIT](https://github.com/visulima/visulima/blob/main/packages/fs/LICENSE.md)


