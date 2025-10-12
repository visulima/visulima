# Examples

Real-world examples of using `@visulima/error-handler` in various frameworks and environments.

## Table of Contents

- [Node.js Frameworks](#nodejs-frameworks)
  - [Express](#express)
  - [Fastify](#fastify)
  - [Koa](#koa)
  - [Vanilla HTTP](#vanilla-http)
- [Edge Runtimes](#edge-runtimes)
  - [Hono](#hono)
  - [Cloudflare Workers](#cloudflare-workers)
  - [Deno](#deno)
  - [Bun](#bun)
  - [Vercel Edge](#vercel-edge)
- [CLI Applications](#cli-applications)
- [Advanced Examples](#advanced-examples)

## Node.js Frameworks

### Express

#### Basic Setup

```typescript
import express from "express";
import httpHandler from "@visulima/error-handler/handler/http/node";

const app = express();

app.use(express.json());

// Your routes
app.get("/", (req, res) => {
    res.json({ message: "Hello World" });
});

app.get("/users/:id", async (req, res) => {
    const user = await getUserById(req.params.id);
    
    if (!user) {
        throw new Error("User not found");
    }
    
    res.json(user);
});

// Error handler middleware (must be last)
app.use(async (err, req, res, next) => {
    const handler = await httpHandler(err, {
        showTrace: process.env.NODE_ENV !== "production",
    });
    return handler(req, res);
});

app.listen(3000);
```

#### With Custom Error Page

```typescript
import express from "express";
import httpHandler from "@visulima/error-handler/handler/http/node";

const app = express();

app.use(async (err, req, res, next) => {
    const handler = await httpHandler(err, {
        showTrace: process.env.NODE_ENV !== "production",
        errorPage: ({ error, statusCode }) => `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Error ${statusCode}</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; }
                    .error { background: #fee; padding: 20px; border-radius: 8px; }
                </style>
            </head>
            <body>
                <div class="error">
                    <h1>Oops! Something went wrong</h1>
                    <p>${error.message}</p>
                </div>
            </body>
            </html>
        `,
    });
    return handler(req, res);
});

app.listen(3000);
```

#### With Logging

```typescript
import express from "express";
import httpHandler from "@visulima/error-handler/handler/http/node";

const app = express();

app.use(async (err, req, res, next) => {
    const handler = await httpHandler(err, {
        showTrace: process.env.NODE_ENV !== "production",
        onError: async (error, request, response) => {
            // Log to your logging service
            console.error({
                timestamp: new Date().toISOString(),
                method: request.method,
                url: request.url,
                error: error.message,
                stack: error.stack,
            });
            
            // Or send to external service
            // await logService.error({ error, request });
        },
    });
    return handler(req, res);
});

app.listen(3000);
```

### Fastify

#### Basic Setup

```typescript
import Fastify from "fastify";
import httpHandler from "@visulima/error-handler/handler/http/node";

const fastify = Fastify({
    logger: true,
});

// Your routes
fastify.get("/", async (request, reply) => {
    return { hello: "world" };
});

fastify.get("/error", async (request, reply) => {
    throw new Error("Test error");
});

// Error handler
fastify.setErrorHandler(async (error, request, reply) => {
    const handler = await httpHandler(error, {
        showTrace: process.env.NODE_ENV !== "production",
    });
    return handler(request.raw, reply.raw);
});

await fastify.listen({ port: 3000 });
```

#### With Custom Serialization

```typescript
import Fastify from "fastify";
import httpHandler from "@visulima/error-handler/handler/http/node";

const fastify = Fastify();

fastify.setErrorHandler(async (error, request, reply) => {
    const handler = await httpHandler(error, {
        showTrace: false,
        onError: async (err, req, res) => {
            // Add request ID to response headers
            res.setHeader("X-Request-ID", request.id);
        },
    });
    return handler(request.raw, reply.raw);
});

await fastify.listen({ port: 3000 });
```

### Koa

#### Basic Setup

```typescript
import Koa from "koa";
import httpHandler from "@visulima/error-handler/handler/http/node";

const app = new Koa();

// Error handling middleware
app.use(async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        const handler = await httpHandler(err as Error, {
            showTrace: process.env.NODE_ENV !== "production",
        });
        await handler(ctx.req, ctx.res);
    }
});

// Your routes
app.use(async (ctx) => {
    if (ctx.path === "/error") {
        throw new Error("Test error");
    }
    
    ctx.body = { message: "Hello Koa" };
});

app.listen(3000);
```

### Vanilla HTTP

#### Basic Server

```typescript
import { createServer } from "node:http";
import httpHandler from "@visulima/error-handler/handler/http/node";

const server = createServer(async (req, res) => {
    try {
        const url = new URL(req.url || "/", `http://localhost:3000`);
        
        if (url.pathname === "/") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "Hello World" }));
        } else if (url.pathname === "/error") {
            throw new Error("Test error");
        } else {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not Found");
        }
    } catch (error) {
        const handler = await httpHandler(error as Error, {
            showTrace: process.env.NODE_ENV !== "production",
        });
        return handler(req, res);
    }
});

server.listen(3000);
```

#### With Router

```typescript
import { createServer } from "node:http";
import httpHandler from "@visulima/error-handler/handler/http/node";

// Simple router
const routes = new Map<string, (req, res) => Promise<void>>();

routes.set("/", async (req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Hello World" }));
});

routes.set("/users", async (req, res) => {
    const users = await fetchUsers();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(users));
});

const server = createServer(async (req, res) => {
    try {
        const url = new URL(req.url || "/", `http://localhost:3000`);
        const handler = routes.get(url.pathname);
        
        if (!handler) {
            throw new Error(`Route not found: ${url.pathname}`);
        }
        
        await handler(req, res);
    } catch (error) {
        const errorHandler = await httpHandler(error as Error, {
            showTrace: process.env.NODE_ENV !== "production",
        });
        return errorHandler(req, res);
    }
});

server.listen(3000);
```

## Edge Runtimes

### Hono

#### Basic Setup

```typescript
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import fetchHandler from "@visulima/error-handler/handler/fetch";

const app = new Hono();

// Your routes
app.get("/", (c) => c.json({ message: "Hello Hono" }));

app.get("/users/:id", async (c) => {
    const id = c.req.param("id");
    const user = await getUserById(id);
    
    if (!user) {
        throw new Error("User not found");
    }
    
    return c.json(user);
});

// Error handler
app.onError(async (error, c) => {
    const handler = await fetchHandler(error, {
        showTrace: process.env.NODE_ENV !== "production",
    });
    return handler(c.req.raw);
});

serve({ fetch: app.fetch, port: 3000 });
```

#### With Middleware

```typescript
import { Hono } from "hono";
import { logger } from "hono/logger";
import fetchHandler from "@visulima/error-handler/handler/fetch";

const app = new Hono();

// Logging middleware
app.use("*", logger());

// Routes
app.get("/", (c) => c.text("Hello!"));

// Error handler with logging
app.onError(async (error, c) => {
    const handler = await fetchHandler(error, {
        showTrace: false,
        onError: async (err, request) => {
            console.error({
                url: request.url,
                method: request.method,
                error: err.message,
            });
        },
    });
    return handler(c.req.raw);
});

serve({ fetch: app.fetch, port: 3000 });
```

### Cloudflare Workers

#### Basic Setup

```typescript
import fetchHandler from "@visulima/error-handler/handler/http/cloudflare";

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        try {
            const url = new URL(request.url);
            
            if (url.pathname === "/") {
                return new Response("Hello from Cloudflare!");
            }
            
            if (url.pathname === "/api/data") {
                const data = await fetchData(env);
                return Response.json(data);
            }
            
            throw new Error("Route not found");
        } catch (error) {
            const handler = await fetchHandler(error as Error, {
                showTrace: false, // Never in production
            });
            return handler(request);
        }
    },
};
```

#### With KV Storage

```typescript
import fetchHandler from "@visulima/error-handler/handler/http/cloudflare";

interface Env {
    MY_KV: KVNamespace;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        try {
            const url = new URL(request.url);
            
            if (url.pathname.startsWith("/users/")) {
                const userId = url.pathname.split("/")[2];
                const user = await env.MY_KV.get(userId);
                
                if (!user) {
                    throw new Error(`User ${userId} not found`);
                }
                
                return new Response(user, {
                    headers: { "Content-Type": "application/json" },
                });
            }
            
            return new Response("Not Found", { status: 404 });
        } catch (error) {
            const handler = await fetchHandler(error as Error, {
                showTrace: false,
            });
            return handler(request);
        }
    },
};
```

### Deno

#### Basic Setup

```typescript
import fetchHandler from "@visulima/error-handler/handler/http/deno";

Deno.serve(async (request: Request) => {
    try {
        const url = new URL(request.url);
        
        if (url.pathname === "/") {
            return new Response("Hello from Deno!");
        }
        
        if (url.pathname === "/api/data") {
            const data = await fetchData();
            return Response.json(data);
        }
        
        throw new Error("Route not found");
    } catch (error) {
        const handler = await fetchHandler(error as Error, {
            showTrace: Deno.env.get("DENO_ENV") !== "production",
        });
        return handler(request);
    }
});
```

#### With File System

```typescript
import fetchHandler from "@visulima/error-handler/handler/http/deno";

Deno.serve(async (request: Request) => {
    try {
        const url = new URL(request.url);
        
        if (url.pathname === "/read-file") {
            const content = await Deno.readTextFile("./data.json");
            return new Response(content, {
                headers: { "Content-Type": "application/json" },
            });
        }
        
        return new Response("Hello from Deno!");
    } catch (error) {
        const handler = await fetchHandler(error as Error, {
            showTrace: true,
            onError: async (err, req) => {
                // Log to Deno's console
                console.error(`[${new Date().toISOString()}]`, err);
            },
        });
        return handler(request);
    }
});
```

### Bun

#### Basic Setup

```typescript
import fetchHandler from "@visulima/error-handler/handler/http/bun";

Bun.serve({
    port: 3000,
    async fetch(request: Request) {
        try {
            const url = new URL(request.url);
            
            if (url.pathname === "/") {
                return new Response("Hello from Bun!");
            }
            
            if (url.pathname === "/api/data") {
                const data = await fetchData();
                return Response.json(data);
            }
            
            throw new Error("Route not found");
        } catch (error) {
            const handler = await fetchHandler(error as Error, {
                showTrace: Bun.env.NODE_ENV !== "production",
            });
            return handler(request);
        }
    },
});
```

### Vercel Edge

#### Basic Setup

```typescript
import fetchHandler from "@visulima/error-handler/handler/http/edge";

export const config = {
    runtime: "edge",
};

export default async function handler(request: Request) {
    try {
        const url = new URL(request.url);
        
        if (url.pathname === "/api/hello") {
            return Response.json({ message: "Hello from Edge!" });
        }
        
        throw new Error("Route not found");
    } catch (error) {
        const errorHandler = await fetchHandler(error as Error, {
            showTrace: false,
        });
        return errorHandler(request);
    }
}
```

## CLI Applications

### Basic CLI Error Handler

```typescript
import { cliHandler } from "@visulima/error-handler/handler/cli";

async function main() {
    try {
        const config = await loadConfig();
        await processData(config);
    } catch (error) {
        await cliHandler(error as Error, {
            displayShortPath: true,
        });
        process.exit(1);
    }
}

main();
```

### CLI with Custom Colors

```typescript
import { cliHandler } from "@visulima/error-handler/handler/cli";

async function main() {
    try {
        await runCommand();
    } catch (error) {
        await cliHandler(error as Error, {
            displayShortPath: true,
            color: {
                boxen: {
                    borderColor: (text) => `\x1b[31m${text}\x1b[0m`, // Red
                    headerTextColor: (text) => `\x1b[1;31m${text}\x1b[0m`, // Bold red
                    textColor: (text) => text,
                },
            },
        });
        process.exit(1);
    }
}

main();
```

### CLI with Hints

```typescript
import { cliHandler } from "@visulima/error-handler/handler/cli";

async function main() {
    try {
        const configPath = "./config.json";
        
        if (!fs.existsSync(configPath)) {
            const error = new Error(`Configuration file not found: ${configPath}`);
            error.hint = "Create a config.json file in the project root with your settings";
            throw error;
        }
        
        await runApp();
    } catch (error) {
        await cliHandler(error as Error);
        process.exit(1);
    }
}

main();
```

## Advanced Examples

### Custom YAML Handler

```typescript
import httpHandler from "@visulima/error-handler/handler/http/node";

const handler = await httpHandler(error, {
    extraHandlers: [
        {
            regex: /application\/yaml/,
            handler: (error, req, res) => {
                res.setHeader("Content-Type", "application/yaml");
                
                const yaml = `
error:
  message: ${error.message}
  status: 500
  timestamp: ${new Date().toISOString()}
                `.trim();
                
                res.statusCode = 500;
                res.end(yaml);
            },
        },
    ],
});
```

### CSP Nonce Support

```typescript
import httpHandler from "@visulima/error-handler/handler/http/node";
import crypto from "node:crypto";

app.use(async (req, res, next) => {
    // Generate CSP nonce
    const nonce = crypto.randomBytes(16).toString("base64");
    
    // Set CSP header
    res.setHeader(
        "Content-Security-Policy",
        `default-src 'self'; style-src 'self' 'nonce-${nonce}'`
    );
    
    req.cspNonce = nonce;
    next();
});

app.use(async (err, req, res, next) => {
    const handler = await httpHandler(err, {
        showTrace: true,
        cspNonce: req.cspNonce, // Pass nonce to error handler
    });
    return handler(req, res);
});
```

### Error Tracking Integration

```typescript
import httpHandler from "@visulima/error-handler/handler/http/node";
import * as Sentry from "@sentry/node";

app.use(async (err, req, res, next) => {
    const handler = await httpHandler(err, {
        showTrace: process.env.NODE_ENV !== "production",
        onError: async (error, request, response) => {
            // Send to Sentry
            Sentry.captureException(error, {
                tags: {
                    url: request.url,
                    method: request.method,
                },
            });
        },
    });
    return handler(req, res);
});
```

### Custom Error Page with Template

```typescript
import httpHandler from "@visulima/error-handler/handler/http/node";
import fs from "node:fs/promises";

const errorTemplate = await fs.readFile("./error-template.html", "utf-8");

app.use(async (err, req, res, next) => {
    const handler = await httpHandler(err, {
        showTrace: false,
        errorPage: ({ error, statusCode }) => {
            return errorTemplate
                .replace("{{statusCode}}", String(statusCode))
                .replace("{{message}}", error.message)
                .replace("{{timestamp}}", new Date().toISOString());
        },
    });
    return handler(req, res);
});
```

### Async Error Page Generation

```typescript
import httpHandler from "@visulima/error-handler/handler/http/node";

app.use(async (err, req, res, next) => {
    const handler = await httpHandler(err, {
        showTrace: false,
        errorPage: async ({ error, statusCode, request }) => {
            // Fetch additional context from database
            const errorLog = await saveErrorToDatabase(error, request);
            
            return `
                <!DOCTYPE html>
                <html>
                <head><title>Error ${statusCode}</title></head>
                <body>
                    <h1>Error ${statusCode}</h1>
                    <p>${error.message}</p>
                    <p>Error ID: ${errorLog.id}</p>
                    <p>Contact support with this ID for assistance.</p>
                </body>
                </html>
            `;
        },
    });
    return handler(req, res);
});
```
