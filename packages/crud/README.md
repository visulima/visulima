<div align="center">
  <h3>Visulima crud</h3>
  <p>
  Visulima crud is built on top of

[OpenAPI (Swagger) specification](https://swagger.io/specification/)
and [Prisma](https://www.prisma.io/)

With a more intuitive API for creating HTTP [CRUD API routes](https://de.wikipedia.org/wiki/CRUD).

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

### Npm

```sh
npm install @visulima/crud
```

Prisma adapter

```sh
npm install prisma @prisma/client @visulima/prisma-dmmf-transformer
```

### Yarn

```sh
yarn add @visulima/crud
```

Prisma adapter

```sh
yarn install prisma @prisma/client @visulima/prisma-dmmf-transformer
```

### Pnpm

```sh
pnpm add @visulima/crud
```

Prisma adapter

```sh
pnpm install prisma @prisma/client @visulima/prisma-dmmf-transformer
```

## Usage

To use the `@visulima/crud` package, you need to have a [Prisma](https://www.prisma.io/) schema.

Given the following Prisma schema:

```sql
model User {
  id              Int        @id @default(autoincrement())
  name            String?
  email           String?
}
```

Next.js CRUD API routes can be created with the following:

Create the file `/pages/api/[...crud].ts` with:

```ts
// pages/api/[...crud].ts

// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import PrismaAdapter from "@visulima/crud/adapter/prisma";
import { nodeHandler } from "@visulima/crud/framework/next";
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
import PrismaAdapter from "@visulima/crud/adapter/prisma";
import { nodeHandler } from "@visulima/crud/framework/next";
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

And get your full-featured CRUD routes!

|              | Endpoint                | Description               |
| ------------ | ----------------------- | ------------------------- |
| List         | GET `/api/users`        | Get all the users         |
| Get          | GET `/api/users/[id]`   | Get one user              |
| Add          | POST `/api/users`       | Create one user           |
| Edit         | PUT `/api/users/[id]`   | Update one user           |
| Partial edit | PATCH `/api/users/[id]` | Update one user (partial) |
| Delete       | DELETE`/api/users/[id]` | Delete one user           |

You can add multiple query parameters in the URL to make your request more precise, especially for requests where you get data.

You can then try a simple request using a tool like Postman, Insomnia or just your web browser on one of those routes.

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track
[Node.js’ release schedule](https://github.com/nodejs/release#release-schedule). Here’s [a
post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

-   [Daniel Bannert](https://github.com/prisis)
-   [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima crud is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/crud?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/crud/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/crud/v/latest "npm"
