<div align="center">
  <h3>visulima error-handler</h3>
  <p>
  Error handlers for use in development and production environments.
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
npm install @visulima/error-handler
```

```sh
yarn add @visulima/error-handler
```

```sh
pnpm add @visulima/error-handler
```

## Features

- **Content Negotiation** - Automatically serves HTML, JSON, Problem JSON, or JSON:API based on `Accept` header
- **Framework Agnostic** - Works with Node.js HTTP, Express, Fastify, Koa, Hono, and any Fetch-based runtime
- **Production Ready** - Configurable error pages, trace control, and custom handlers
- **TypeScript Support** - Full type safety with comprehensive TypeScript definitions
- **Extensible** - Custom error handlers via regex matching on Accept headers
- **CSP Support** - Built-in Content Security Policy nonce support for inline styles

## Quick Start

### Node.js HTTP Server

```ts
import { createServer } from "node:http";
import httpHandler from "@visulima/error-handler/handler/http/node";

const server = createServer(async (req, res) => {
    try {
        // your app logic...
        throw new Error("Boom!");
    } catch (error) {
        const handler = await httpHandler(error as Error, {
            showTrace: process.env.NODE_ENV !== "production"
        });
        return handler(req, res);
    }
});

server.listen(3000);
```

### Express Setup

```ts
import express from "express";
import httpHandler from "@visulima/error-handler/handler/http/node";

const app = express();
app.use(express.json());

app.get("/", async (req, res) => {
    try {
        throw new Error("Example error");
    } catch (error) {
        const handler = await httpHandler(error as Error, {
            showTrace: process.env.NODE_ENV !== "production"
        });
        return handler(req, res);
    }
});

app.listen(3000);
```

### Hono (Fetch Runtime)

```ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import fetchHandler from "@visulima/error-handler/handler/fetch";

const app = new Hono();

app.get("/", (c) => c.text("OK"));
app.get("/error", () => {
    throw new Error("Boom from Hono");
});

app.onError(async (error, c) => {
    const handler = await fetchHandler(error as Error, {
        showTrace: process.env.NODE_ENV !== "production"
    });
    return handler(c.req.raw);
});

serve({ fetch: app.fetch, port: 3000 });
```

### Fetch-based Runtimes

```ts
// Cloudflare Workers
import fetchHandler from "@visulima/error-handler/handler/fetch";

export default {
    async fetch(request: Request): Promise<Response> {
        try {
            throw new Error("Boom");
        } catch (error) {
            const handler = await fetchHandler(error as Error, {
                showTrace: process.env.NODE_ENV !== "production"
            });
            return handler(request);
        }
    },
};
```

```ts
// Deno
import fetchHandler from "@visulima/error-handler/handler/fetch";

Deno.serve(async (request: Request) => {
    try {
        throw new Error("Boom");
    } catch (error) {
        const handler = await fetchHandler(error as Error, {
            showTrace: process.env.NODE_ENV !== "production"
        });
        return handler(request);
    }
});
```

## Content Negotiation

The error handler automatically serves different content types based on the `Accept` header:

- `text/html` → HTML error page
- `application/problem+json` → Problem JSON (RFC 7807)
- `application/json` → Simple JSON response
- `application/vnd.api+json` → JSON:API format
- `text/plain` → Plain text
- `application/javascript` → JavaScript error throw

### Custom Handlers

Add custom handlers for specific content types:

```ts
import httpHandler from "@visulima/error-handler/handler/http/node";

const handler = await httpHandler(error, {
    extraHandlers: [
        {
            regex: /application\/yaml/u,
            handler: (error, req, res) => {
                res.setHeader("content-type", "application/yaml");
                res.end(`error: ${error.message}`);
            },
        },
    ],
});
```

## API

### httpHandler(error, options?) => Promise<(req, res) => Promise<void>>

Node.js HTTP handler for Express, Connect, Fastify, Koa, and similar frameworks.

**Parameters:**
- `error: Error` - The error to handle
- `options?: HtmlErrorHandlerOptions & { showTrace?: boolean; extraHandlers?: ErrorHandlers }`

**Options:**
- `showTrace?: boolean` - Include stack trace in responses (default: `true`)
- `extraHandlers?: ErrorHandlers` - Custom handlers for specific Accept headers
- `errorPage?: string | ((params) => string | Promise<string>)` - Custom HTML error page
- `cspNonce?: string` - Content Security Policy nonce for inline styles
- `onError?: (error, request, response) => void | Promise<void>` - Callback for custom error logging

### fetchHandler(error, options?) => Promise<(request) => Promise<Response>>

Fetch API handler for Cloudflare Workers, Deno, Bun, and other Fetch-based runtimes.

**Parameters:**
- `error: Error` - The error to handle
- `options?: HtmlErrorHandlerOptions & { showTrace?: boolean; extraHandlers?: FetchErrorHandlers }`

**Options:**
- Same as `httpHandler` but uses `FetchErrorHandlers` for custom handlers
- `onError?: (error, request, response) => void | Promise<void>` - Callback for custom error logging

### Error Handler Types

```ts
type ErrorHandlers = {
    handler: ErrorHandler;
    regex: RegExp;
}[];

type FetchErrorHandlers = {
    handler: FetchErrorHandler;
    regex: RegExp;
}[];

type HtmlErrorHandlerOptions = {
    errorPage?: string | ((params: {
        error: Error;
        request: IncomingMessage;
        response: ServerResponse;
        reasonPhrase: string;
        statusCode: number;
    }) => string | Promise<string>);
    cspNonce?: string;
    onError?: (error: Error, request: IncomingMessage, response: ServerResponse) => void | Promise<void>;
};
```

## Content Negotiation Examples

### Basic Usage

```ts
import { createServer } from "node:http";
import httpHandler from "@visulima/error-handler/handler/http/node";

const server = createServer(async (req, res) => {
    try {
        throw new Error("Test error");
    } catch (error) {
        const handler = await httpHandler(error as Error, {
            showTrace: process.env.NODE_ENV !== "production"
        });
        return handler(req, res);
    }
}).listen(3000);
```

### With Custom HTML Error Page

```ts
import httpHandler from "@visulima/error-handler/handler/http/node";

const handler = await httpHandler(error, {
    errorPage: ({ error, statusCode }) =>
        `<!DOCTYPE html>
        <html>
        <head><title>Error ${statusCode}</title></head>
        <body>
            <h1>Error ${statusCode}</h1>
            <p>${error.message}</p>
        </body>
        </html>`,
    showTrace: false
});
```

### With CSP Nonce Support

```ts
import httpHandler from "@visulima/error-handler/handler/http/node";

const handler = await httpHandler(error, {
    cspNonce: "nonce-abc123", // Will be added to <style> tags
    showTrace: process.env.NODE_ENV !== "production"
});
```

### With Custom Error Logging

```ts
import httpHandler from "@visulima/error-handler/handler/http/node";

const handler = await httpHandler(error, {
    onError: (error, request, response) => {
        // Log to your preferred logging service
        console.error(`[${new Date().toISOString()}] ${request.method} ${request.url} - ${error.message}`);

        // Or send to external logging service
        // logToService({ error: error.message, url: request.url, method: request.method });
    },
    showTrace: process.env.NODE_ENV !== "production"
});
```

## Additional Exports

This package provides additional exports for different use cases:

### Runtime-Specific Handlers

For convenience, you can also import runtime-specific handlers:

```ts
// Deno
import fetchHandler from "@visulima/error-handler/handler/http/deno";

// Bun
import fetchHandler from "@visulima/error-handler/handler/http/bun";

// Cloudflare Workers
import fetchHandler from "@visulima/error-handler/handler/http/cloudflare";

// Edge Runtime
import fetchHandler from "@visulima/error-handler/handler/http/edge";

// Hono
import fetchHandler from "@visulima/error-handler/handler/http/hono";

// CLI applications
import cliHandler from "@visulima/error-handler/handler/cli";
```

### Individual Error Handlers

You can also import individual error handlers for specific content types:

```ts
import { htmlErrorHandler } from "@visulima/error-handler/error-handler/html";
import { problemErrorHandler } from "@visulima/error-handler/error-handler/problem";
import { jsonErrorHandler } from "@visulima/error-handler/error-handler/json";
import { jsonapiErrorHandler } from "@visulima/error-handler/error-handler/jsonapi";
import { textErrorHandler } from "@visulima/error-handler/error-handler/text";
import { jsonpErrorHandler } from "@visulima/error-handler/error-handler/jsonp";
import { xmlErrorHandler } from "@visulima/error-handler/error-handler/xml";
```

### Main Export

```ts
import { createNegotiatedErrorHandler } from "@visulima/error-handler";
```

## Related

- [@visulima/flare](https://github.com/visulima/visulima/tree/main/packages/flare) - Full-featured error overlay with inspector
- [@visulima/error](https://github.com/visulima/visulima/tree/main/packages/error) - Error utilities and solution finders

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

The visulima error-handler is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/ "TypeScript"
[license-image]: https://img.shields.io/npm/l/@visulima/error-handler?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/error-handler/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/error-handler/v/latest "npm"
