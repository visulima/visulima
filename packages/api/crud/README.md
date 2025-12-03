<div align="center">
  <h3>Visulima crud</h3>
  <p>
  Visulima crud is built on top of

[OpenAPI (Swagger) specification](https://swagger.io/specification/),
[node-rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible),
[@visulima/connect](https://github.com/visulima/visulima/tree/main/packages/connect)

With a more intuitive API for creating HTTP API endpoints.

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
npm install @visulima/crud prisma @prisma/client
```

```sh
yarn add @visulima/crud prisma @prisma/client
```

```sh
pnpm add @visulima/crud prisma @prisma/client
```

## Usage

To use the `@visulima/crud` package, you need to have a [Prisma](https://www.prisma.io/) schema.

```ts
// pages/api/[...crud].ts

// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaAdapter } from "@visulima/crud";
import { nodeHandler } from "@visulima/crud/next";
import type { User, Post, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma-client";

const prismaAdapter = new PrismaAdapter<User | Post, Prisma.ModelName>({
    prismaClient: prisma,
});

export default async (request, response) => {
    const handler = await nodeHandler<User | Post, any, NextApiRequest, NextApiResponse, Prisma.ModelName>(prismaAdapter);

    await handler(request, response);
};
```

To use it with `api-platform connect` you need to install the `@visulima/api-platform` package.

```ts
// pages/api/[...crud].ts

// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { createNodeRouter } from "@visulima/api-platform";
import { PrismaAdapter } from "@visulima/crud";
import { nodeHandler } from "@visulima/crud/next";
import type { User, Post, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma-client";

const prismaAdapter = new PrismaAdapter<User | Post, Prisma.ModelName>({
    prismaClient: prisma,
});

const router = createNodeRouter<NextApiRequest, NextApiResponse>().all(async (request, response) => {
    const handler = await nodeHandler<User | Post, any, NextApiRequest, NextApiResponse, Prisma.ModelName>(prismaAdapter);

    await handler(request, response);
});

export default router.handler();
```

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track
[Node.js’ release schedule](https://github.com/nodejs/release#release-schedule). Here’s [a
post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima crud is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript

[typescript-url]: https://www.typescriptlang.org/ "TypeScript" "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/crud?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/crud/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/crud/v/latest "npm"
