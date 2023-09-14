<div align="center">
  <h3>Visulima OpenApi</h3>
  <p>

Visulima OpenApi generator and validator its built on top of [JSON Schema Dereferencer](https://github.com/json-schema-tools/dereferencer), [ajv](https://ajv.js.org) and [unplugin](https://github.com/unjs/unplugin), for speed and minimal runtime overhead.

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

## Installation

```sh
npm install @visulima/openapi
```

```sh
yarn add @visulima/openapi
```

```sh
pnpm add @visulima/openapi
```

## Usage

<details>
<summary>Vite</summary><br>

```ts
// vite.config.ts
import openapiPlugin from "@visulima/openapi/vite";

export default defineConfig({
    plugins: [
        openapiPlugin({
            include: ["src"],
            outputFilePath: "swagger/swagger.json",
            swaggerDefinition: {
                openapi: "3.0.0",
                info: {
                    description: "test",
                    title: "Swagger",
                    version: "1.0.0",
                },
            },
        }),
    ],
});
```

<br></details>

<details>
<summary>Rollup</summary><br>

```ts
// rollup.config.js
import openapiPlugin from "@visulima/openapi/rollup";

export default {
    plugins: [
        openapiPlugin({
            include: ["src"],
            outputFilePath: "swagger/swagger.json",
            swaggerDefinition: {
                openapi: "3.0.0",
                info: {
                    description: "test",
                    title: "Swagger",
                    version: "1.0.0",
                },
            },
        }),
    ],
};
```

<br></details>

<details>
<summary>esbuild</summary><br>

```ts
// esbuild.config.js
import { build } from "esbuild";

build({
    plugins: [
        require("@visulima/openapi/esbuild")({
            include: ["src"],
            outputFilePath: "swagger/swagger.json",
            swaggerDefinition: {
                openapi: "3.0.0",
                info: {
                    description: "test",
                    title: "Swagger",
                    version: "1.0.0",
                },
            },
        }),
    ],
});
```

<br></details>

<details>
<summary>Webpack</summary><br>

```ts
// webpack.config.js
module.exports = {
    /* ... */
    plugins: [
        require("@visulima/openapi/webpack")({
            include: ["src"],
            outputFilePath: "swagger/swagger.json",
            swaggerDefinition: {
                openapi: "3.0.0",
                info: {
                    description: "test",
                    title: "Swagger",
                    version: "1.0.0",
                },
            },
        }),
    ],
};
```

<br></details>

<details>
<summary>Vue CLI</summary><br>

```ts
// vue.config.js
module.exports = {
    configureWebpack: {
        plugins: [
            require("@visulima/openapi/webpack")({
                include: ["src"],
                outputFilePath: "swagger/swagger.json",
                swaggerDefinition: {
                    openapi: "3.0.0",
                    info: {
                        description: "test",
                        title: "Swagger",
                        version: "1.0.0",
                    },
                },
            }),
        ],
    },
};
```

<br></details>

<details>
<summary>CLI</summary><br>

#### To use the CLI, you need to install this missing packages:

```sh
npm install commander
```

```sh
yarn add commander
```

```sh
pnpm add commander
```

#### Then you can use the CLI like this:

```bash
# This generate the .openapirc.js config file, this command is only needed on the first run
openapi init

# This will generate the swagger.json file
openapi generate src/
```

<br></details>

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/openapi?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/openapi/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/openapi/v/latest "npm"
