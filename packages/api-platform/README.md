<div align="center">
  <h3>Visulima Api platform</h3>
  <p>
  Visulima api platform is built on top of

[OpenAPI (Swagger) specification](https://swagger.io/specification/),
[node-rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible),
[@visulima/connect](https://github.com/visulima/visulima/tree/main/packages/connect)

With a more intuitive API for creating HTTP API endpoints.

  </p>
</div>

<br />

<div align="center">

[![TypeScript](https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/) [![npm](https://img.shields.io/npm/v/@visulima/api-platform/latest.svg?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@visulima/api-platform/v/latest) [![license](https://img.shields.io/npm/l/@visulima/api-platform?color=blueviolet&style=for-the-badge)](LICENSE.md)

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

## Install

### Npm

```sh
npm install @visulima/api-platform zod
```

#### Installation for Next.js

```sh
npm install @visulima/api-platform zod @visulima/fs
```

### Yarn

```sh
yarn add @visulima/api-platform zod
```

#### Installation for Next.js

```sh
yarn add @visulima/api-platform zod @visulima/fs
```

### Pnpm

```sh
pnpm add @visulima/api-platform zod
```

#### Installation for Next.js

```sh
pnpm add @visulima/api-platform zod @visulima/fs
```

### To use the swagger-ui or the redoc-ui you need to install the following packages:

```sh
npm install swagger-ui-react
```

To have a styled version of the swagger-ui you need to add the following css to your project:

```ts
import "swagger-ui-react/swagger-ui.css";
```

> Note: For `next.js` you can add it to your `_app.tsx` file

Or

```sh
npm install redoc
```

## Usage

### CLI:

#### To use the CLI, you need to install this missing packages:

```sh
npm install cli-progress commander chalk
```

```sh
yarn add cli-progress commander chalk
```

```sh
pnpm add cli-progress commander chalk
```

#### Then you can use the CLI like this:

```bash
// Shows the help with all available commands

pnpm api-platform --help
```

### connect

This package has an extended version of the `@visulima/connect` package.
That means you can use all the features of the `@visulima/connect` package, in addition to the features of this package.

```ts
// pages/api/hello.js
import type { NextApiRequest, NextApiResponse } from "next";
import { createNodeRouter } from "@visulima/api-platform";
import cors from "cors";

// Default Req and Res are IncomingMessage and ServerResponse
// You may want to pass in NextApiRequest and NextApiResponse
const router = createNodeRouter<NextApiRequest, NextApiResponse>();

router.get((req, res) => {
    res.send("Hello world");
});

export default router.nodeHandler();
```

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track
[Node.js’ release schedule](https://github.com/nodejs/release#release-schedule). Here’s [a
post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima api-platform is open-sourced software licensed under the [MIT](LICENSE.md)


