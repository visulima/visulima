# Getting Started

This guide will help you get started with `@visulima/error-handler` in your project.

## Installation

Choose your preferred package manager:

### npm

```bash
npm install @visulima/error-handler
```

### yarn

```bash
yarn add @visulima/error-handler
```

### pnpm

```bash
pnpm add @visulima/error-handler
```

### bun

```bash
bun add @visulima/error-handler
```

## Requirements

- **Node.js**: v20.19 or higher (for Node.js environments)
- **TypeScript**: v5.0 or higher (optional, but recommended)

## Basic Usage

The error handler provides different handlers based on your runtime environment:

- `handler/http/node` - For Node.js HTTP servers (Express, Fastify, etc.)
- `handler/fetch` - For Fetch-based runtimes (Hono, Cloudflare Workers, Deno, Bun)
- `handler/cli` - For command-line applications

## Your First Error Handler

### Node.js HTTP Server

Create a simple HTTP server with error handling:

```typescript
import { createServer } from "node:http";
import httpHandler from "@visulima/error-handler/handler/http/node";

const server = createServer(async (req, res) => {
    try {
        // Your application logic
        if (req.url === "/error") {
            throw new Error("This is a test error!");
        }
        
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Hello World!");
    } catch (error) {
        // Handle the error with automatic content negotiation
        const handler = await httpHandler(error as Error, {
            showTrace: process.env.NODE_ENV !== "production",
        });
        return handler(req, res);
    }
});

server.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});
```

### Express Application

Add error handling to an Express app:

```typescript
import express from "express";
import httpHandler from "@visulima/error-handler/handler/http/node";

const app = express();

// Your routes
app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.get("/error", (req, res) => {
    throw new Error("This is a test error!");
});

// Error handling middleware (must be last)
app.use(async (err, req, res, next) => {
    const handler = await httpHandler(err, {
        showTrace: process.env.NODE_ENV !== "production",
    });
    return handler(req, res);
});

app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});
```

### Fastify Application

Add error handling to a Fastify app:

```typescript
import Fastify from "fastify";
import httpHandler from "@visulima/error-handler/handler/http/node";

const fastify = Fastify();

// Your routes
fastify.get("/", async (request, reply) => {
    return { hello: "world" };
});

// Error handler
fastify.setErrorHandler(async (error, request, reply) => {
    const handler = await httpHandler(error, {
        showTrace: process.env.NODE_ENV !== "production",
    });
    return handler(request.raw, reply.raw);
});

fastify.listen({ port: 3000 }, (err, address) => {
    if (err) throw err;
    console.log(`Server running at ${address}`);
});
```

### Hono Application

Add error handling to a Hono app:

```typescript
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import fetchHandler from "@visulima/error-handler/handler/fetch";

const app = new Hono();

// Your routes
app.get("/", (c) => c.text("Hello Hono!"));

app.get("/error", () => {
    throw new Error("This is a test error!");
});

// Error handler
app.onError(async (error, c) => {
    const handler = await fetchHandler(error, {
        showTrace: process.env.NODE_ENV !== "production",
    });
    return handler(c.req.raw);
});

serve({ fetch: app.fetch, port: 3000 }, (info) => {
    console.log(`Server running at http://localhost:${info.port}`);
});
```

### Cloudflare Workers

Add error handling to a Cloudflare Worker:

```typescript
import fetchHandler from "@visulima/error-handler/handler/http/cloudflare";

export default {
    async fetch(request: Request): Promise<Response> {
        try {
            // Your application logic
            if (new URL(request.url).pathname === "/error") {
                throw new Error("This is a test error!");
            }
            
            return new Response("Hello from Cloudflare Workers!");
        } catch (error) {
            const handler = await fetchHandler(error as Error, {
                showTrace: false, // Never show traces in production
            });
            return handler(request);
        }
    },
};
```

### Deno

Add error handling to a Deno application:

```typescript
import fetchHandler from "@visulima/error-handler/handler/http/deno";

Deno.serve(async (request: Request) => {
    try {
        // Your application logic
        if (new URL(request.url).pathname === "/error") {
            throw new Error("This is a test error!");
        }
        
        return new Response("Hello from Deno!");
    } catch (error) {
        const handler = await fetchHandler(error as Error, {
            showTrace: Deno.env.get("DENO_ENV") !== "production",
        });
        return handler(request);
    }
});
```

### Command-Line Application

Add error handling to a CLI application:

```typescript
import { cliHandler } from "@visulima/error-handler/handler/cli";

async function main() {
    try {
        // Your CLI logic
        throw new Error("Configuration file not found!");
    } catch (error) {
        await cliHandler(error as Error, {
            displayShortPath: true,
        });
        process.exit(1);
    }
}

main();
```

## Understanding Content Negotiation

The error handler automatically detects what format to return based on the `Accept` header:

```typescript
// Client sends: Accept: application/json
// Response: { "message": "Error message", "statusCode": 500 }

// Client sends: Accept: text/html
// Response: Beautiful HTML error page

// Client sends: Accept: application/problem+json
// Response: RFC 7807 Problem Details
```

You can test this with curl:

```bash
# Get HTML error page
curl http://localhost:3000/error -H "Accept: text/html"

# Get JSON error
curl http://localhost:3000/error -H "Accept: application/json"

# Get Problem JSON (RFC 7807)
curl http://localhost:3000/error -H "Accept: application/problem+json"

# Get JSON:API format
curl http://localhost:3000/error -H "Accept: application/vnd.api+json"
```

## Development vs Production

Control the amount of information shown based on your environment:

```typescript
const handler = await httpHandler(error, {
    // Show stack traces and code frames in development
    showTrace: process.env.NODE_ENV !== "production",
});
```

In development (`showTrace: true`):
- Full stack traces
- Code frames showing the error location
- All error details
- Source maps support

In production (`showTrace: false`):
- Generic error message
- Status code
- No stack traces
- No sensitive information

## Next Steps

Now that you have basic error handling set up, explore:

- [Configuration](./configuration.md) - Learn about all available options
- [Examples](./examples.md) - See more real-world examples
- [API Reference](./api-reference.md) - Detailed API documentation
- [Advanced Usage](./advanced-usage.md) - Custom handlers and advanced patterns
