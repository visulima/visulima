<div align="center">
  <h3>visulima tsconfig</h3>
  <p>
  Find and / or parse the tsconfig.json file from a directory path, this package is built on top of

[@visulima/fs](https://github.com/visulima/visulima/tree/main/packages/fs),
[@visulima/path](https://github.com/visulima/visulima/tree/main/packages/path),
[jsonc-parser](https://github.com/microsoft/node-jsonc-parser) and
[resolve-pkg-maps](https://github.com/privatenumber/resolve-pkg-maps)

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

## Features

- Tested against TypeScript for correctness
- Supports comments & dangling commas in tsconfig.json
- Resolves extends
- Fully typed tsconfig.json
- Validates and throws parsing errors

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

### findTsConfig

Retrieves the TsConfig by searching for the "tsconfig.json" file from a given current working directory.

```ts
import { findTsConfig } from "@visulima/tsconfig";

const tsconfig = await findTsConfig(); // => { path: "/Users/../Projects/visulima/packages/tsconfig/tsconfig.json", config: { compilerOptions: { ... } } }
```

### writeTsConfig

Writes the provided TypeScript configuration object to a tsconfig.json file.

```ts
import { writeTsConfig } from '@visulima/package';

writeTsConfig({ compilerOptions: { ... } }/* ,{ cwd: "./" }*/);
```

### readTsConfig

Reads the TypeScript configuration from a tsconfig.json file.

```ts
import { readTsConfig } from "@visulima/package";

const tsconfig = await readTsConfig("/Users/../Projects/visulima/packages/tsconfig.json" /* { tscCompatible: false } */);
```

> tscCompatible: If true, the configuration will be parsed in a way that is compatible with the TypeScript compiler.

## Api Docs

<!-- TYPEDOC -->

# @visulima/tsconfig

## File

### TsConfigJson

```ts
type TsConfigJson = object;
```

Defined in: node_modules/.pnpm/type-fest@4.35.0/node_modules/type-fest/source/tsconfig-json.d.ts:1

Type for [TypeScript's `tsconfig.json` file](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html) (TypeScript 3.7).

#### Type declaration

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

##### extends?

```ts
optional extends: string | string[];
```

Path to base configuration file to inherit from.

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

## Other

### findTsConfig()

```ts
function findTsConfig(cwd?, options?): Promise<TsConfigResult>;
```

Defined in: [packages/tsconfig/src/find-tsconfig.ts:30](https://github.com/visulima/visulima/blob/dd8f07a7c6ec723e6c84d3b3881ff2c027d14019/packages/tsconfig/src/find-tsconfig.ts#L30)

An asynchronous function that retrieves the TSConfig by searching for the "tsconfig.json" first,
second attempt is to look for the "jsconfig.json" file from a given current working directory.

#### Parameters

##### cwd?

Optional. The current working directory from which to search for the "tsconfig.json" file.
The type of `cwd` is `string`.

`string` | `URL`

##### options?

[`FindTsConfigOptions`](README.md#findtsconfigoptions) = `{}`

#### Returns

`Promise`\<[`TsConfigResult`](README.md#tsconfigresult)\>

A `Promise` that resolves to the TSConfig result object.
The return type of the function is `Promise<TsConfigResult>`.

#### Throws

An `Error` when the "tsconfig.json" file is not found.

---

### findTsConfigSync()

```ts
function findTsConfigSync(cwd?, options?): TsConfigResult;
```

Defined in: [packages/tsconfig/src/find-tsconfig.ts:69](https://github.com/visulima/visulima/blob/dd8f07a7c6ec723e6c84d3b3881ff2c027d14019/packages/tsconfig/src/find-tsconfig.ts#L69)

#### Parameters

##### cwd?

`string` | `URL`

##### options?

[`FindTsConfigOptions`](README.md#findtsconfigoptions) = `{}`

#### Returns

[`TsConfigResult`](README.md#tsconfigresult)

---

### readTsConfig()

```ts
function readTsConfig(tsconfigPath, options?): object;
```

Defined in: [packages/tsconfig/src/read-tsconfig.ts:460](https://github.com/visulima/visulima/blob/dd8f07a7c6ec723e6c84d3b3881ff2c027d14019/packages/tsconfig/src/read-tsconfig.ts#L460)

#### Parameters

##### tsconfigPath

`string`

##### options?

[`ReadTsConfigOptions`](README.md#readtsconfigoptions)

#### Returns

`object`

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

Defined in: [packages/tsconfig/src/write-tsconfig.ts:17](https://github.com/visulima/visulima/blob/dd8f07a7c6ec723e6c84d3b3881ff2c027d14019/packages/tsconfig/src/write-tsconfig.ts#L17)

An asynchronous function that writes the provided TypeScript configuration object to a tsconfig.json file.

#### Parameters

##### tsConfig

[`TsConfigJson`](README.md#tsconfigjson)

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

Defined in: [packages/tsconfig/src/write-tsconfig.ts:35](https://github.com/visulima/visulima/blob/dd8f07a7c6ec723e6c84d3b3881ff2c027d14019/packages/tsconfig/src/write-tsconfig.ts#L35)

A function that writes the provided TypeScript configuration object to a tsconfig.json file.

#### Parameters

##### tsConfig

[`TsConfigJson`](README.md#tsconfigjson)

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

Defined in: [packages/tsconfig/src/read-tsconfig.ts:457](https://github.com/visulima/visulima/blob/dd8f07a7c6ec723e6c84d3b3881ff2c027d14019/packages/tsconfig/src/read-tsconfig.ts#L457)

---

### FindTsConfigOptions

```ts
type FindTsConfigOptions = ReadTsConfigOptions & object;
```

Defined in: [packages/tsconfig/src/find-tsconfig.ts:10](https://github.com/visulima/visulima/blob/dd8f07a7c6ec723e6c84d3b3881ff2c027d14019/packages/tsconfig/src/find-tsconfig.ts#L10)

#### Type declaration

##### cache?

```ts
optional cache:
  | Map<string, TsConfigJsonResolved>
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

Defined in: [packages/tsconfig/src/read-tsconfig.ts:444](https://github.com/visulima/visulima/blob/dd8f07a7c6ec723e6c84d3b3881ff2c027d14019/packages/tsconfig/src/read-tsconfig.ts#L444)

#### Type declaration

##### tscCompatible?

```ts
optional tscCompatible: "5.3" | "5.4" | "5.5" | "5.6" | true;
```

Make the configuration compatible with the specified TypeScript version.

When `true`, it will make the configuration compatible with the latest TypeScript version.

###### Default

```ts
undefined;
```

---

### TsConfigJsonResolved

```ts
type TsConfigJsonResolved = Except<TsConfigJson, "extends">;
```

Defined in: [packages/tsconfig/src/types.ts:3](https://github.com/visulima/visulima/blob/dd8f07a7c6ec723e6c84d3b3881ff2c027d14019/packages/tsconfig/src/types.ts#L3)

---

### TsConfigResult

```ts
type TsConfigResult = object;
```

Defined in: [packages/tsconfig/src/find-tsconfig.ts:15](https://github.com/visulima/visulima/blob/dd8f07a7c6ec723e6c84d3b3881ff2c027d14019/packages/tsconfig/src/find-tsconfig.ts#L15)

#### Type declaration

##### config

```ts
config: TsConfigJsonResolved;
```

##### path

```ts
path: string;
```

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

## License

The visulima tsconfig is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript

[typescript-url]: https://www.typescriptlang.org/ "TypeScript" "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/tsconfig?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/tsconfig/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/tsconfig/v/latest "npm"
