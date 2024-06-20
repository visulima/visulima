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
