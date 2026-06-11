<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="crud" />

</a>

<h3 align="center">A comprehensive CRUD library for building RESTful APIs with Prisma, providing automatic CRUD operations, filtering, sorting, and pagination.</h3>

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

- Auto-generated RESTful CRUD routes (`list`, `read`, `create`, `update`, `delete`) from your Prisma models.
- Rich query syntax over the URL: `select`, `include`, `where` (with `$eq`/`$cont`/`$in`/… operators), `orderBy`, `limit`/`page` pagination, `cursor`, `distinct`.
- Framework-agnostic core (`baseHandler` + the `Adapter` interface) with a ready-made Prisma adapter and Next.js (`nodeHandler`/`edgeHandler`) bindings.
- OpenAPI 3 generation from your Prisma DMMF via `modelsToOpenApi`.
- Built-in guardrails: per-model field allowlists (`writableFields`/`selectableFields`/`filterableFields`/`includableRelations`/`readableFields`), body validation schemas (`createSchema`/`updateSchema`, e.g. zod), an `onRequest` access hook, and a `maxPerPage` cap.
- Prisma 3, 4, 5 and 6 support.

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

> **Important:** build the handler **once** (at module scope), not inside the request callback.
> `nodeHandler`/`edgeHandler` are async factories that run `adapter.init()`, map the DMMF and open
> the connection pool — doing that per request is slow. Reuse the returned handler across requests.

```ts
// pages/api/[...crud].ts

// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import type { User, Post } from "@prisma/client";
import { PrismaAdapter } from "@visulima/crud";
import { nodeHandler } from "@visulima/crud/next";

import { prisma } from "../../lib/prisma-client";

const prismaAdapter = new PrismaAdapter<User | Post, Prisma.ModelName>({
    prismaClient: prisma,
    // Required for Prisma 5/6 (the private DMMF internals were removed):
    dmmf: Prisma.dmmf,
});

// Created once — `nodeHandler` runs adapter.init() and connects the pool here.
const handlerPromise = nodeHandler<User | Post, any, NextApiRequest, NextApiResponse, Prisma.ModelName>(prismaAdapter);

export default async (request: NextApiRequest, response: NextApiResponse) => {
    const handler = await handlerPromise;

    await handler(request, response);
};
```

For the **App Router / edge runtime**, use `edgeHandler`, which returns the `Response`:

```ts
// app/api/[...crud]/route.ts
import { Prisma } from "@prisma/client";
import { PrismaAdapter } from "@visulima/crud";
import { edgeHandler } from "@visulima/crud/next";

import { prisma } from "../../../lib/prisma-client";

const adapter = new PrismaAdapter({ prismaClient: prisma, dmmf: Prisma.dmmf });
const handlerPromise = edgeHandler(adapter);

const route = async (request: Request) => {
    const handler = await handlerPromise;

    return handler(request, undefined);
};

export { route as GET, route as POST, route as PUT, route as PATCH, route as DELETE };
```

To use it with `api-platform connect` you need to install the `@visulima/api-platform` package.

```ts
// pages/api/[...crud].ts

// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import type { User, Post } from "@prisma/client";
import { createNodeRouter } from "@visulima/api-platform";
import { PrismaAdapter } from "@visulima/crud";
import { nodeHandler } from "@visulima/crud/next";

import { prisma } from "../../lib/prisma-client";

const prismaAdapter = new PrismaAdapter<User | Post, Prisma.ModelName>({
    prismaClient: prisma,
    dmmf: Prisma.dmmf,
});

const handlerPromise = nodeHandler<User | Post, any, NextApiRequest, NextApiResponse, Prisma.ModelName>(prismaAdapter);

const router = createNodeRouter<NextApiRequest, NextApiResponse>().all(async (request, response) => {
    const handler = await handlerPromise;

    await handler(request, response);
});

export default router.handler();
```

### Query syntax

CRUD endpoints accept the following query-string parameters (all optional):

| Param      | Example                                                | Description                                                                                 |
| ---------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `select`   | `?select=id,name,profile.bio`                          | Comma-separated fields to return. Dotted paths select nested fields.                         |
| `include`  | `?include=posts,profile`                               | Comma-separated relations to expand.                                                         |
| `where`    | `?where={"name":{"$cont":"ada"}}`                      | JSON filter object (see operators below). URL-encode it.                                     |
| `orderBy`  | `?orderBy={"createdAt":"$desc"}`                       | JSON object with exactly one field and `$asc`/`$desc`.                                       |
| `limit`    | `?limit=20`                                            | Page size / `take`. Capped by `maxPerPage` when configured.                                  |
| `page`     | `?page=2`                                              | 1-based page number; enables paginated (`@visulima/pagination`) responses.                   |
| `skip`     | `?skip=40`                                             | Offset (`skip`) for non-paginated reads.                                                     |
| `cursor`   | `?cursor={"id":42}`                                    | JSON cursor for cursor-based pagination.                                                     |
| `distinct` | `?distinct=email`                                      | Field name to apply `distinct` on.                                                           |

#### `where` operators

| Operator   | Prisma equivalent | Meaning                |
| ---------- | ----------------- | ---------------------- |
| `$eq`      | `equals`          | equals                 |
| `$neq`     | `not`             | not equal              |
| `$in`      | `in`              | in list                |
| `$notin`   | `notIn`           | not in list            |
| `$lt`      | `lt`              | less than              |
| `$lte`     | `lte`             | less than or equal     |
| `$gt`      | `gt`              | greater than           |
| `$gte`     | `gte`             | greater than or equal  |
| `$cont`    | `contains`        | string contains        |
| `$starts`  | `startsWith`      | string starts with     |
| `$ends`    | `endsWith`        | string ends with       |
| `$isnull`  | `null`            | is null                |

`where` also supports the `$and`, `$or` and `$not` combinators. By default ISO-date-looking
strings are coerced to `Date` instances so they match `DateTime` columns; pass
`coerceWhereDates: false` to the `PrismaAdapter` constructor to keep them as strings (needed when
filtering a *string* column whose values look like dates).

### Security & access control

CRUD exposes every model with no field-level restrictions by default. Lock it down per model:

```ts
import { RouteType } from "@visulima/crud";

const handlerPromise = nodeHandler(adapter, {
    // Global cap so `?limit=100000000` can't dump a whole table.
    maxPerPage: 100,
    // Throw to deny a request (row/field access guard).
    onRequest: async ({ routeType, resourceName }) => {
        if (routeType === RouteType.DELETE) throw createHttpError(403, "forbidden");
    },
    models: {
        User: {
            only: [RouteType.READ_ALL, RouteType.READ_ONE, RouteType.UPDATE],
            // Mass-assignment guard: clients can only write these columns.
            writableFields: ["name", "email"],
            // Never return these even if a client requests ?select=passwordHash.
            readableFields: ["passwordHash"],
            // Allowlist what may be filtered/sorted and selected/included.
            filterableFields: ["id", "name", "email"],
            selectableFields: ["id", "name", "email"],
            includableRelations: ["posts"],
            // Validate/transform the body (any zod-like schema works).
            updateSchema: userUpdateSchema,
        },
    },
});
```

### Framework-agnostic usage

The `baseHandler` and `Adapter` interface are exported from the root entry, so you can wire CRUD to
Express, Fastify, Hono or any runtime without Next.js:

```ts
import { baseHandler, PrismaAdapter } from "@visulima/crud";
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

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima crud is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/crud?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/crud?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/crud
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
