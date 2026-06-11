<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="api-platform" />

</a>

<h3 align="center">Visulima API platform is a set of tools to build and consume web APIs</h3>

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

- **Connect-style router** — an extended `createNodeRouter` (built on [`@visulima/connect`](https://www.npmjs.com/package/@visulima/connect)) with content negotiation, header normalization and error handling pre-wired.
- **Content-negotiating serializers** — `serializersMiddleware` plus standalone `serialize`, `xmlTransformer` and `yamlTransformer` to render JSON / XML / YAML based on the `Accept` header.
- **Standards-based error handling** — RFC 7807 (`problemErrorHandler`) and JSON:API (`jsonapiErrorHandler`) error handlers, selected automatically per `Accept` header, with typed `ErrorHandler` / `ErrorHandlers` building blocks for custom handlers.
- **Security & ergonomics middleware** — `rateLimiterMiddleware` (brute-force protection with `keyGenerator`, `trustProxy` and IETF standard headers), `corsMiddleware`, and `httpHeaderNormalizerMiddleware`.
- **OpenAPI / Swagger** — `swaggerHandler` (pages router / Node) and `swaggerRouteHandler` (Next.js App Router, fetch API) that assemble, cache and serve your OpenAPI document, including auto-generated CRUD paths.
- **Swagger UI & Redoc pages** for Next.js, plus a `withOpenApi` webpack plugin.
- **Zod helpers** — `dateIn` / `dateOut` schemas for safe ISO-date coercion in and out of your API.
- **Re-exported `http-errors`** — every error class (`NotFound`, `BadRequest`, `TooManyRequests`, …) plus `createHttpError`, ESM/CJS safe.
- **CLI** — list routes across Express, Koa, Hapi, Fastify and Next.js projects.

## Installation

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

`createNodeRouter` accepts options to configure error handling and the built-in middlewares:

```ts
import { createNodeRouter } from "@visulima/api-platform";

const router = createNodeRouter({
    // expose stack traces in error responses (default: false)
    showTrace: process.env.NODE_ENV !== "production",
    errorHandlers: [],
    middlewares: {
        "http-header-normalizer": { canonical: true },
        serializers: { defaultContentType: "application/json; charset=utf-8" },
    },
});
```

### Error handling (RFC 7807 / JSON:API)

The router automatically picks the error format from the request `Accept` header:
`application/vnd.api+json` is rendered as [JSON:API](https://jsonapi.org/), everything else
as an [RFC 7807](https://www.rfc-editor.org/rfc/rfc7807) "problem+json" document. Internal
messages are only exposed when `http-errors` marks the error as safe to expose (4xx), so
5xx internals (SQL errors, file paths, …) never leak to clients.

You can also use the handlers directly, e.g. for a custom framework integration:

```ts
import { problemErrorHandler, jsonapiErrorHandler, NotFound } from "@visulima/api-platform";
import type { ErrorHandler, ErrorHandlers } from "@visulima/api-platform";

await problemErrorHandler(new NotFound("User not found"), req, res);

// Register a custom handler for a specific content type:
const errorHandlers: ErrorHandlers = [{ regex: /application\/xml/u, handler: myXmlErrorHandler satisfies ErrorHandler }];
```

### Serializers

```ts
import { serializersMiddleware, serialize, xmlTransformer, yamlTransformer } from "@visulima/api-platform";

// As middleware (content-negotiated by the Accept header):
router.use(
    serializersMiddleware(
        [
            { regex: /application\/xml/u, serializer: xmlTransformer },
            { regex: /application\/x-yaml/u, serializer: yamlTransformer },
        ],
        "application/json; charset=utf-8",
    ),
);

// Or standalone:
const xml = serialize({ hello: "world" }, "application/xml");
```

### Rate limiting

`rateLimiterMiddleware` wraps [`rate-limiter-flexible`](https://www.npmjs.com/package/rate-limiter-flexible).
By default it keys on `socket.remoteAddress` only — spoofable `X-Forwarded-For` / `X-Real-IP`
headers are **ignored** so a client cannot bypass brute-force protection by forging them.

```ts
import { rateLimiterMiddleware } from "@visulima/api-platform";
import { RateLimiterMemory } from "rate-limiter-flexible";

const limiter = new RateLimiterMemory({ points: 10, duration: 60 });

// Default (secure): keyed on the socket address.
router.use(rateLimiterMiddleware(limiter));

// Behind a trusted reverse proxy that overwrites the forwarding headers:
router.use(rateLimiterMiddleware(limiter, { trustProxy: true, standardHeaders: true }));

// Limit by API key / user id instead of IP:
router.use(
    rateLimiterMiddleware(limiter, {
        keyGenerator: (request) => request.headers["x-api-key"] as string | undefined,
    }),
);
```

Options: `trustProxy` (honor `X-Forwarded-For`/`X-Real-IP`, only behind a trusted proxy),
`keyGenerator` (custom key), and `standardHeaders` (emit IETF `RateLimit-*` headers in
addition to the legacy `X-RateLimit-*` ones). A downstream handler throwing is propagated
unchanged — it is **not** turned into a `429`.

### CORS & header normalization

```ts
import { corsMiddleware, httpHeaderNormalizerMiddleware } from "@visulima/api-platform";

router.use(httpHeaderNormalizerMiddleware({ canonical: true }));
router.use(corsMiddleware({ origin: "https://example.com" }));
```

### Swagger / OpenAPI handler

```ts
// pages/api/swagger.ts (Next.js pages router / any Node server)
import { swaggerHandler } from "@visulima/api-platform";

export default swaggerHandler({ swaggerFilePath: "swagger/swagger.json" });
```

The assembled spec is cached on the source file's mtime and served with an `ETag`
(conditional `If-None-Match` requests get a `304`). `Accept: application/x-yaml` returns YAML.

For the **Next.js App Router**, use the fetch-API route handler:

```ts
// app/api/docs/route.ts
import { swaggerRouteHandler } from "@visulima/api-platform/next";

export const GET = swaggerRouteHandler({ swaggerFilePath: "swagger/swagger.json" });
```

### Zod date helpers

```ts
import { dateIn, dateOut } from "@visulima/api-platform";
import * as z from "zod";

const schema = z.object({
    // parses an ISO string from the client into a Date
    startsAt: dateIn(),
    // serializes a Date back to an ISO string in the response
    createdAt: dateOut(),
});
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

The visulima api-platform is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/api-platform?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/api-platform?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/api-platform
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
