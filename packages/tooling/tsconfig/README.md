<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="tsconfig" />

</a>

<h3 align="center">Find and/or parse the tsconfig.json file from a directory path.</h3>

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

## Features

- Tested against TypeScript for correctness
- Supports comments & dangling commas in tsconfig.json (JSONC)
- Resolves `extends` (relative paths, package names, and Yarn PnP)
- Resolves `${configDir}` template variables
- Fully typed tsconfig.json
- Synchronous and asynchronous search helpers

## Install

```sh
npm install @visulima/tsconfig
```

```sh
yarn add @visulima/tsconfig
```

```sh
pnpm add @visulima/tsconfig
```

## Usage

### findTsConfig / findTsConfigSync

Retrieves the TsConfig by searching upward for a `tsconfig.json` file (falling back to `jsconfig.json`) from a given directory. `findTsConfig` is asynchronous; `findTsConfigSync` is the synchronous variant.

```ts
import { findTsConfig, findTsConfigSync } from "@visulima/tsconfig";

const tsconfig = await findTsConfig();
// => { path: "/Users/.../visulima/packages/tsconfig/tsconfig.json", config: { compilerOptions: { ... } } }

// Synchronous, with a custom start directory
const tsconfigSync = findTsConfigSync("/path/to/project");
```

Options (`findTsConfig`/`findTsConfigSync`):

| Option              | Type                                     | Default           | Description                                                                                                                                                                         |
| ------------------- | ---------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `configFileName`    | `string`                                 | `"tsconfig.json"` | Name of the file to search for. Supplying a custom name disables the `jsconfig.json` fallback.                                                                                      |
| `cache`             | `boolean \| Map<string, TsConfigResult>` | `undefined`       | Cache parsed configs. `true` uses a process-wide cache; pass a `Map` for a caller-owned cache. Keys embed the file mtime, so on-disk edits invalidate cached entries automatically. |
| `tscCompatible`     | see [readTsConfig](#readtsconfig)        | `undefined`       | Forwarded to `readTsConfig`.                                                                                                                                                        |
| `typescriptVersion` | see [readTsConfig](#readtsconfig)        | `undefined`       | Forwarded to `readTsConfig`.                                                                                                                                                        |

> Note: only the upward file search is async. Parsing (including the full `extends` chain) is synchronous, so a very deep `extends` chain still blocks the event loop during parse.

### readTsConfig

Reads and parses the TypeScript configuration from a `tsconfig.json` path. **This function is synchronous** — it returns the resolved config object directly (no `await`).

```ts
import { readTsConfig } from "@visulima/tsconfig";

const tsconfig = readTsConfig("/path/to/tsconfig.json");

// Make derived defaults match a specific TypeScript version
const compatible = readTsConfig("/path/to/tsconfig.json", { tscCompatible: "5.8" });

// Apply the unconditional compiler-option defaults of the installed TypeScript
const withDefaults = readTsConfig("/path/to/tsconfig.json", { typescriptVersion: "auto" });
```

Options (`ReadTsConfigOptions`):

| Option              | Type                                                                  | Default     | Description                                                                                                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tscCompatible`     | `"5.4" \| "5.5" \| "5.6" \| "5.7" \| "5.8" \| "5.9" \| "6.0" \| true` | `undefined` | Synthesize the _derived_ defaults TypeScript would imply from other options for the given version (e.g. `module: nodenext` ⇒ `moduleResolution: nodenext`). `true` targets the latest supported version.                                |
| `typescriptVersion` | `"auto" \| false \| string`                                           | `false`     | Apply the _unconditional_ compiler-option defaults of a TypeScript version. `"auto"` detects the installed version (including Yarn PnP); a string pins an explicit version; `false` applies none. Can be combined with `tscCompatible`. |

### writeTsConfig / writeTsConfigSync

Writes the provided TypeScript configuration object to a `tsconfig.json` file. `writeTsConfig` is asynchronous; `writeTsConfigSync` is the synchronous variant.

```ts
import { writeTsConfig, writeTsConfigSync } from "@visulima/tsconfig";

await writeTsConfig({ compilerOptions: { strict: true } }, { cwd: "./" });

writeTsConfigSync({ compilerOptions: { strict: true } }, { cwd: "./" });
```

### configDirectoryPlaceholder

The literal `${configDir}` template string used by TypeScript. Re-exported so consumers can detect un-interpolated values without deep-importing internals.

```ts
import { configDirectoryPlaceholder } from "@visulima/tsconfig";

if (someValue.startsWith(configDirectoryPlaceholder)) {
    // value still references ${configDir}
}
```

## Api Docs

<!-- TYPEDOC -->

# @visulima/tsconfig

## File

### TsConfigJson

```ts
type TsConfigJson = object;
```

Defined in: node_modules/.pnpm/type-fest@4.41.0/node_modules/type-fest/source/tsconfig-json.d.ts:1

Type for [TypeScript's `tsconfig.json` file](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html) (TypeScript 3.7).

#### Properties

##### compileOnSave?

```ts
optional compileOnSave: boolean;
```

Defined in: node_modules/.pnpm/type-fest@4.41.0/node_modules/type-fest/source/tsconfig-json.d.ts:1264

Enable Compile-on-Save for this project.

##### compilerOptions?

```ts
optional compilerOptions: CompilerOptions;
```

Defined in: node_modules/.pnpm/type-fest@4.41.0/node_modules/type-fest/source/tsconfig-json.d.ts:1249

Instructs the TypeScript compiler how to compile `.ts` files.

##### exclude?

```ts
optional exclude: string[];
```

Defined in: node_modules/.pnpm/type-fest@4.41.0/node_modules/type-fest/source/tsconfig-json.d.ts:1281

Specifies a list of files to be excluded from compilation. The `exclude` property only affects the files included via the `include` property and not the `files` property.

Glob patterns require TypeScript version 2.0 or later.

##### extends?

```ts
optional extends: string | string[];
```

Defined in: node_modules/.pnpm/type-fest@4.41.0/node_modules/type-fest/source/tsconfig-json.d.ts:1269

Path to base configuration file to inherit from.

##### files?

```ts
optional files: string[];
```

Defined in: node_modules/.pnpm/type-fest@4.41.0/node_modules/type-fest/source/tsconfig-json.d.ts:1274

If no `files` or `include` property is present in a `tsconfig.json`, the compiler defaults to including all files in the containing directory and subdirectories except those specified by `exclude`. When a `files` property is specified, only those files and those specified by `include` are included.

##### include?

```ts
optional include: string[];
```

Defined in: node_modules/.pnpm/type-fest@4.41.0/node_modules/type-fest/source/tsconfig-json.d.ts:1288

Specifies a list of glob patterns that match files to be included in compilation.

If no `files` or `include` property is present in a `tsconfig.json`, the compiler defaults to including all files in the containing directory and subdirectories except those specified by `exclude`.

##### references?

```ts
optional references: References[];
```

Defined in: node_modules/.pnpm/type-fest@4.41.0/node_modules/type-fest/source/tsconfig-json.d.ts:1293

Referenced projects.

##### typeAcquisition?

```ts
optional typeAcquisition: TypeAcquisition;
```

Defined in: node_modules/.pnpm/type-fest@4.41.0/node_modules/type-fest/source/tsconfig-json.d.ts:1259

Auto type (.d.ts) acquisition options for this project.

##### watchOptions?

```ts
optional watchOptions: WatchOptions;
```

Defined in: node_modules/.pnpm/type-fest@4.41.0/node_modules/type-fest/source/tsconfig-json.d.ts:1254

Instructs the TypeScript compiler how to watch files.

## Other

### findTsConfig()

```ts
function findTsConfig(cwd?, options?): Promise<TsConfigResult>;
```

Defined in: [packages/tsconfig/src/find-tsconfig.ts:30](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tsconfig/src/find-tsconfig.ts#L30)

An asynchronous function that retrieves the TSConfig by searching for the "tsconfig.json" first,
second attempt is to look for the "jsconfig.json" file from a given current working directory.

#### Parameters

##### cwd?

Optional. The current working directory from which to search for the "tsconfig.json" file.
The type of `cwd` is `string`.

`string` | `URL`

##### options?

[`FindTsConfigOptions`](#findtsconfigoptions) = `{}`

#### Returns

`Promise`\<[`TsConfigResult`](#tsconfigresult)\>

A `Promise` that resolves to the TSConfig result object.
The return type of the function is `Promise<TsConfigResult>`.

#### Throws

An `Error` when the "tsconfig.json" file is not found.

---

### findTsConfigSync()

```ts
function findTsConfigSync(cwd?, options?): TsConfigResult;
```

Defined in: [packages/tsconfig/src/find-tsconfig.ts:69](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tsconfig/src/find-tsconfig.ts#L69)

#### Parameters

##### cwd?

`string` | `URL`

##### options?

[`FindTsConfigOptions`](#findtsconfigoptions) = `{}`

#### Returns

[`TsConfigResult`](#tsconfigresult)

---

### readTsConfig()

```ts
function readTsConfig(tsconfigPath, options?): object;
```

Defined in: [packages/tsconfig/src/read-tsconfig.ts:460](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tsconfig/src/read-tsconfig.ts#L460)

#### Parameters

##### tsconfigPath

`string`

##### options?

[`ReadTsConfigOptions`](#readtsconfigoptions)

#### Returns

##### compileOnSave?

```ts
optional compileOnSave: boolean;
```

Enable Compile-on-Save for this project.

##### compilerOptions?

```ts
optional compilerOptions: CompilerOptions;
```

Instructs the TypeScript compiler how to compile `.ts` files.

##### exclude?

```ts
optional exclude: string[];
```

Specifies a list of files to be excluded from compilation. The `exclude` property only affects the files included via the `include` property and not the `files` property.

Glob patterns require TypeScript version 2.0 or later.

##### files?

```ts
optional files: string[];
```

If no `files` or `include` property is present in a `tsconfig.json`, the compiler defaults to including all files in the containing directory and subdirectories except those specified by `exclude`. When a `files` property is specified, only those files and those specified by `include` are included.

##### include?

```ts
optional include: string[];
```

Specifies a list of glob patterns that match files to be included in compilation.

If no `files` or `include` property is present in a `tsconfig.json`, the compiler defaults to including all files in the containing directory and subdirectories except those specified by `exclude`.

##### references?

```ts
optional references: References[];
```

Referenced projects.

##### typeAcquisition?

```ts
optional typeAcquisition: TypeAcquisition;
```

Auto type (.d.ts) acquisition options for this project.

##### watchOptions?

```ts
optional watchOptions: WatchOptions;
```

Instructs the TypeScript compiler how to watch files.

---

### writeTsConfig()

```ts
function writeTsConfig(tsConfig, options): Promise<void>;
```

Defined in: [packages/tsconfig/src/write-tsconfig.ts:17](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tsconfig/src/write-tsconfig.ts#L17)

An asynchronous function that writes the provided TypeScript configuration object to a tsconfig.json file.

#### Parameters

##### tsConfig

[`TsConfigJson`](#tsconfigjson)

The TypeScript configuration object to write. The type of `tsConfig` is `TsConfigJson`.

##### options

`WriteFileOptions` & `object` & `object` = `{}`

Optional. The write options and the current working directory. The type of `options` is an
intersection type of `WriteOptions` and a Record type with an optional `cwd` key of type `string`.

#### Returns

`Promise`\<`void`\>

A `Promise` that resolves when the tsconfig.json file has been written.
The return type of function is `Promise<void>`.

---

### writeTsConfigSync()

```ts
function writeTsConfigSync(tsConfig, options): void;
```

Defined in: [packages/tsconfig/src/write-tsconfig.ts:35](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tsconfig/src/write-tsconfig.ts#L35)

A function that writes the provided TypeScript configuration object to a tsconfig.json file.

#### Parameters

##### tsConfig

[`TsConfigJson`](#tsconfigjson)

The TypeScript configuration object to write. The type of `tsConfig` is `TsConfigJson`.

##### options

`WriteFileOptions` & `object` & `object` = `{}`

Optional. The write options and the current working directory. The type of `options` is an
intersection type of `WriteOptions` and a Record type with an optional `cwd` key of type `string`.

#### Returns

`void`

A `Promise` that resolves when the tsconfig.json file has been written.
The return type of function is `Promise<void>`.

---

### implicitBaseUrlSymbol

```ts
const implicitBaseUrlSymbol: typeof implicitBaseUrlSymbol;
```

Defined in: [packages/tsconfig/src/read-tsconfig.ts:457](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tsconfig/src/read-tsconfig.ts#L457)

---

### FindTsConfigOptions

```ts
type FindTsConfigOptions = ReadTsConfigOptions & object;
```

Defined in: [packages/tsconfig/src/find-tsconfig.ts:10](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tsconfig/src/find-tsconfig.ts#L10)

#### Type declaration

##### cache?

```ts
optional cache:
  | Map<string, TsConfigResult>
  | boolean;
```

##### configFileName?

```ts
optional configFileName: string;
```

---

### ReadTsConfigOptions

```ts
type ReadTsConfigOptions = object;
```

Defined in: [packages/tsconfig/src/read-tsconfig.ts:444](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tsconfig/src/read-tsconfig.ts#L444)

#### Properties

##### tscCompatible?

```ts
optional tscCompatible: "5.4" | "5.5" | "5.6" | "5.7" | "5.8" | "5.9" | "6.0" | true;
```

Defined in: [packages/tsconfig/src/read-tsconfig.ts:703](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tsconfig/src/read-tsconfig.ts#L703)

Make the configuration compatible with the specified TypeScript version.

Controls _derived_ defaults — fields TypeScript synthesizes when other fields are set (e.g. `module: nodenext` ⇒ `moduleResolution: nodenext`).

When `true`, it will make the configuration compatible with the latest TypeScript version.

###### Default

```ts
undefined;
```

##### typescriptVersion?

```ts
optional typescriptVersion: "auto" | false | string;
```

Defined in: [packages/tsconfig/src/read-tsconfig.ts:718](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tsconfig/src/read-tsconfig.ts#L718)

Apply the _unconditional_ compiler-option defaults TypeScript would synthesize for the given version. `"auto"` detects the installed TypeScript version (including Yarn PnP); a string pins an explicit version; `false` applies none. Distinct from `tscCompatible`, and both can be combined.

###### Default

```ts
false;
```

---

### TsConfigJsonResolved

```ts
type TsConfigJsonResolved = Except<TsConfigJson, "extends">;
```

Defined in: [packages/tsconfig/src/types.ts:3](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tsconfig/src/types.ts#L3)

---

### TsConfigResult

```ts
type TsConfigResult = object;
```

Defined in: [packages/tsconfig/src/find-tsconfig.ts:15](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tsconfig/src/find-tsconfig.ts#L15)

#### Properties

##### config

```ts
config: TsConfigJsonResolved;
```

Defined in: [packages/tsconfig/src/find-tsconfig.ts:16](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tsconfig/src/find-tsconfig.ts#L16)

##### path

```ts
path: string;
```

Defined in: [packages/tsconfig/src/find-tsconfig.ts:17](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tsconfig/src/find-tsconfig.ts#L17)

<!-- /TYPEDOC -->

## Related

- [get-tsconfig](https://github.com/privatenumber/get-tsconfig) - Get the TypeScript configuration from a project.

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

The visulima tsconfig is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/tsconfig?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/tsconfig?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/tsconfig
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
