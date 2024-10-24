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

-   Tested against TypeScript for correctness
-   Supports comments & dangling commas in tsconfig.json
-   Resolves extends
-   Fully typed tsconfig.json
-   Validates and throws parsing errors

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
type TsConfigJson: object;
```

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

#### Defined in

node_modules/.pnpm/type-fest@4.26.1/node_modules/type-fest/source/tsconfig-json.d.ts:1

## Other

### findTsConfig()

```ts
function findTsConfig(cwd?, options?): Promise<TsConfigResult>;
```

An asynchronous function that retrieves the TSConfig by searching for the "tsconfig.json" first,
second attempt is to look for the "jsconfig.json" file from a given current working directory.

#### Parameters

• **cwd?**: `string` \| `URL`

Optional. The current working directory from which to search for the "tsconfig.json" file.
The type of `cwd` is `string`.

• **options?**: `Options` = `{}`

#### Returns

`Promise`\<[`TsConfigResult`](README.md#tsconfigresult)\>

A `Promise` that resolves to the TSConfig result object.
The return type of the function is `Promise<TsConfigResult>`.

#### Throws

An `Error` when the "tsconfig.json" file is not found.

#### Defined in

[packages/tsconfig/src/find-tsconfig.ts:29](https://github.com/visulima/visulima/blob/49d12d1acf10a7257d444199325e60b1ff3795d2/packages/tsconfig/src/find-tsconfig.ts#L29)

---

### findTsConfigSync()

```ts
function findTsConfigSync(cwd?, options?): TsConfigResult;
```

#### Parameters

• **cwd?**: `string` \| `URL`

• **options?**: `Options` = `{}`

#### Returns

[`TsConfigResult`](README.md#tsconfigresult)

#### Defined in

[packages/tsconfig/src/find-tsconfig.ts:66](https://github.com/visulima/visulima/blob/49d12d1acf10a7257d444199325e60b1ff3795d2/packages/tsconfig/src/find-tsconfig.ts#L66)

---

### readTsConfig()

```ts
function readTsConfig(tsconfigPath, options?): object;
```

#### Parameters

• **tsconfigPath**: `string`

• **options?**: `Options`

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

#### Defined in

[packages/tsconfig/src/read-tsconfig.ts:309](https://github.com/visulima/visulima/blob/49d12d1acf10a7257d444199325e60b1ff3795d2/packages/tsconfig/src/read-tsconfig.ts#L309)

---

### writeTsConfig()

```ts
function writeTsConfig(tsConfig, options): Promise<void>;
```

An asynchronous function that writes the provided TypeScript configuration object to a tsconfig.json file.

#### Parameters

• **tsConfig**: [`TsConfigJson`](README.md#tsconfigjson)

The TypeScript configuration object to write. The type of `tsConfig` is `TsConfigJson`.

• **options**: `WriteFileOptions` & `object` & `object` = `{}`

Optional. The write options and the current working directory. The type of `options` is an
intersection type of `WriteOptions` and a Record type with an optional `cwd` key of type `string`.

#### Returns

`Promise`\<`void`\>

A `Promise` that resolves when the tsconfig.json file has been written.
The return type of function is `Promise<void>`.

#### Defined in

[packages/tsconfig/src/write-tsconfig.ts:17](https://github.com/visulima/visulima/blob/49d12d1acf10a7257d444199325e60b1ff3795d2/packages/tsconfig/src/write-tsconfig.ts#L17)

---

### writeTsConfigSync()

```ts
function writeTsConfigSync(tsConfig, options): void;
```

A function that writes the provided TypeScript configuration object to a tsconfig.json file.

#### Parameters

• **tsConfig**: [`TsConfigJson`](README.md#tsconfigjson)

The TypeScript configuration object to write. The type of `tsConfig` is `TsConfigJson`.

• **options**: `WriteFileOptions` & `object` & `object` = `{}`

Optional. The write options and the current working directory. The type of `options` is an
intersection type of `WriteOptions` and a Record type with an optional `cwd` key of type `string`.

#### Returns

`void`

A `Promise` that resolves when the tsconfig.json file has been written.
The return type of function is `Promise<void>`.

#### Defined in

[packages/tsconfig/src/write-tsconfig.ts:35](https://github.com/visulima/visulima/blob/49d12d1acf10a7257d444199325e60b1ff3795d2/packages/tsconfig/src/write-tsconfig.ts#L35)

---

### implicitBaseUrlSymbol

```ts
const implicitBaseUrlSymbol: typeof implicitBaseUrlSymbol;
```

#### Defined in

[packages/tsconfig/src/read-tsconfig.ts:306](https://github.com/visulima/visulima/blob/49d12d1acf10a7257d444199325e60b1ff3795d2/packages/tsconfig/src/read-tsconfig.ts#L306)

---

### TsConfigJsonResolved

```ts
type TsConfigJsonResolved: Except<TsConfigJson, "extends">;
```

#### Defined in

[packages/tsconfig/src/types.ts:3](https://github.com/visulima/visulima/blob/49d12d1acf10a7257d444199325e60b1ff3795d2/packages/tsconfig/src/types.ts#L3)

---

### TsConfigResult

```ts
type TsConfigResult: object;
```

#### Type declaration

##### config

```ts
config: TsConfigJsonResolved;
```

##### path

```ts
path: string;
```

#### Defined in

[packages/tsconfig/src/find-tsconfig.ts:14](https://github.com/visulima/visulima/blob/49d12d1acf10a7257d444199325e60b1ff3795d2/packages/tsconfig/src/find-tsconfig.ts#L14)

## File

-   [TsConfigJson](README.md#tsconfigjson)

## Other

-   [findTsConfig](README.md#findtsconfig)
-   [findTsConfigSync](README.md#findtsconfigsync)
-   [readTsConfig](README.md#readtsconfig)
-   [writeTsConfig](README.md#writetsconfig)
-   [writeTsConfigSync](README.md#writetsconfigsync)
-   [TsConfigJson](namespaces/TsConfigJson/README.md)
-   [implicitBaseUrlSymbol](README.md#implicitbaseurlsymbol)
-   [TsConfigJsonResolved](README.md#tsconfigjsonresolved)
-   [TsConfigResult](README.md#tsconfigresult)

<!-- /TYPEDOC -->

## Related

-   [get-tsconfig](https://github.com/privatenumber/get-tsconfig) - Get the TypeScript configuration from a project.

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

-   [Daniel Bannert](https://github.com/prisis)
-   [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima tsconfig is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/tsconfig?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/tsconfig/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/tsconfig/v/latest "npm"
