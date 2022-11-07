<div align="center">
  <h3>Visulima Api platform</h3>
  <p>
  Visulima api platform is built on top of

   [OpenAPI (Swagger) specification](https://swagger.io/specification/),
   [node-rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible),
   [@visulima/connect](https://github.com/visulima/visulima/tree/main/packages/connect)

with a more intuitive API for creating HTTP API endpoints.

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

## Installation

```sh
npm install @visulima/api-platform
```

```sh
yarn add @visulima/api-platform
```

```sh
pnpm add @visulima/api-platform
```

## Usage

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

router
  .get((req, res) => {
    res.send("Hello world");
  });

export default router.handler();
```

```

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track
[Node.js' release schedule](https://nodejs.org/en/about/releases/). Here's [a
post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

-   [Daniel Bannert](https://github.com/prisis)
-   [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima api-platform is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/api-platform?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/api-platform/alpha.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/api-platform/v/alpha "npm"

