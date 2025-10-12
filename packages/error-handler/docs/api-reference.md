# API Reference

Complete API documentation for `@visulima/error-handler`.

## Table of Contents

- [Handlers](#handlers)
  - [httpHandler](#httphandler)
  - [fetchHandler](#fetchhandler)
  - [cliHandler](#clihandler)
- [Error Handlers](#error-handlers)
- [Types](#types)
- [Utilities](#utilities)

## Handlers

### httpHandler

Node.js HTTP handler for Express, Fastify, Koa, and similar frameworks.

```typescript
import httpHandler from "@visulima/error-handler/handler/http/node";

const handler = await httpHandler(error, options);
```

#### Signature

```typescript
function httpHandler(
    error: Error,
    options?: HttpHandlerOptions
): Promise<(req: IncomingMessage, res: ServerResponse) => Promise<void>>
```

#### Parameters

- `error: Error` - The error to handle
- `options?: HttpHandlerOptions` - Configuration options

#### Options

```typescript
interface HttpHandlerOptions {
    // Show stack traces and detailed error information
    showTrace?: boolean; // default: true
    
    // Custom error handlers for specific content types
    extraHandlers?: ErrorHandlers;
    
    // Custom HTML error page
    errorPage?: string | ((params: ErrorPageParams) => string | Promise<string>);
    
    // Content Security Policy nonce for inline styles
    cspNonce?: string;
    
    // Custom error logging callback
    onError?: (error: Error, request: IncomingMessage, response: ServerResponse) => void | Promise<void>;
}

interface ErrorPageParams {
    error: Error;
    request: IncomingMessage;
    response: ServerResponse;
    reasonPhrase: string;
    statusCode: number;
}

type ErrorHandlers = Array<{
    regex: RegExp;
    handler: ErrorHandler;
}>;

type ErrorHandler = (
    error: Error,
    request: IncomingMessage,
    response: ServerResponse
) => void | Promise<void>;
```

#### Example

```typescript
const handler = await httpHandler(error, {
    showTrace: process.env.NODE_ENV !== "production",
    cspNonce: "abc123",
    onError: async (error, request, response) => {
        console.error(`Error on ${request.url}:`, error.message);
    },
    extraHandlers: [
        {
            regex: /application\/yaml/,
            handler: (error, req, res) => {
                res.setHeader("Content-Type", "application/yaml");
                res.end(`error: ${error.message}`);
            },
        },
    ],
});

await handler(req, res);
```

### fetchHandler

Fetch API handler for Cloudflare Workers, Deno, Bun, Hono, and other Fetch-based runtimes.

```typescript
import fetchHandler from "@visulima/error-handler/handler/fetch";

const handler = await fetchHandler(error, options);
```

#### Signature

```typescript
function fetchHandler(
    error: Error,
    options?: FetchHandlerOptions
): Promise<(request: Request) => Promise<Response>>
```

#### Parameters

- `error: Error` - The error to handle
- `options?: FetchHandlerOptions` - Configuration options

#### Options

```typescript
interface FetchHandlerOptions {
    // Show stack traces and detailed error information
    showTrace?: boolean; // default: true
    
    // Custom error handlers for specific content types
    extraHandlers?: FetchErrorHandlers;
    
    // Custom HTML error page
    errorPage?: string | ((params: FetchErrorPageParams) => string | Promise<string>);
    
    // Content Security Policy nonce for inline styles
    cspNonce?: string;
    
    // Custom error logging callback
    onError?: (error: Error, request: Request, response: Response) => void | Promise<void>;
}

interface FetchErrorPageParams {
    error: Error;
    request: Request;
    reasonPhrase: string;
    statusCode: number;
}

type FetchErrorHandlers = Array<{
    regex: RegExp;
    handler: FetchErrorHandler;
}>;

type FetchErrorHandler = (
    error: Error,
    request: Request
) => Response | Promise<Response>;
```

#### Example

```typescript
const handler = await fetchHandler(error, {
    showTrace: false,
    onError: async (error, request) => {
        console.error(`Error on ${request.url}:`, error.message);
    },
    extraHandlers: [
        {
            regex: /application\/yaml/,
            handler: (error, request) => {
                return new Response(`error: ${error.message}`, {
                    status: 500,
                    headers: { "Content-Type": "application/yaml" },
                });
            },
        },
    ],
});

return handler(request);
```

### cliHandler

CLI error handler for command-line applications.

```typescript
import { cliHandler } from "@visulima/error-handler/handler/cli";

await cliHandler(error, options);
```

#### Signature

```typescript
function cliHandler(
    error: Error,
    options?: CliHandlerOptions
): Promise<void>
```

#### Parameters

- `error: Error` - The error to handle
- `options?: CliHandlerOptions` - Configuration options

#### Options

```typescript
interface CliHandlerOptions {
    // Display short paths instead of absolute paths
    displayShortPath?: boolean; // default: false
    
    // Number of lines to show before the error line
    frameContextLines?: number; // default: 2
    
    // Custom color configuration
    color?: {
        boxen?: {
            borderColor?: (text: string) => string;
            headerTextColor?: (text: string) => string;
            textColor?: (text: string) => string;
        };
    };
}
```

#### Example

```typescript
try {
    throw new Error("Configuration error");
} catch (error) {
    await cliHandler(error as Error, {
        displayShortPath: true,
        frameContextLines: 3,
        color: {
            boxen: {
                borderColor: (text) => `\x1b[32m${text}\x1b[0m`, // Green
                headerTextColor: (text) => `\x1b[1;32m${text}\x1b[0m`, // Bold green
            },
        },
    });
    process.exit(1);
}
```

### ansiHandler

Returns ANSI-formatted error string without printing to console.

```typescript
import { ansiHandler } from "@visulima/error-handler/handler/cli";

const errorString = await ansiHandler(error, options);
```

#### Signature

```typescript
function ansiHandler(
    error: Error,
    options?: BaseCliOptions
): Promise<string>
```

#### Example

```typescript
const errorOutput = await ansiHandler(error, {
    displayShortPath: true,
});

// Log to a file or send to a logging service
fs.writeFileSync("error.log", errorOutput);
```

## Error Handlers

Individual error handlers for specific content types can be imported and used directly.

### htmlErrorHandler

```typescript
import { htmlErrorHandler } from "@visulima/error-handler/error-handler/html";

const handler = htmlErrorHandler(error, req, res, options);
```

### jsonErrorHandler

```typescript
import { jsonErrorHandler } from "@visulima/error-handler/error-handler/json";

const handler = jsonErrorHandler(error, req, res, options);
```

### problemErrorHandler

RFC 7807 Problem Details handler.

```typescript
import problemErrorHandler from "@visulima/error-handler/error-handler/problem";

const handler = problemErrorHandler(error, req, res, options);
```

### jsonapiErrorHandler

JSON:API format error handler.

```typescript
import jsonapiErrorHandler from "@visulima/error-handler/error-handler/jsonapi";

const handler = jsonapiErrorHandler(error, req, res, options);
```

### textErrorHandler

Plain text error handler.

```typescript
import { textErrorHandler } from "@visulima/error-handler/error-handler/text";

const handler = textErrorHandler(error, req, res, options);
```

### jsonpErrorHandler

JSONP callback error handler.

```typescript
import { jsonpErrorHandler } from "@visulima/error-handler/error-handler/jsonp";

const handler = jsonpErrorHandler(error, req, res, options);
```

### xmlErrorHandler

XML format error handler.

```typescript
import { xmlErrorHandler } from "@visulima/error-handler/error-handler/xml";

const handler = xmlErrorHandler(error, req, res, options);
```

## Types

### ErrorHandlers

```typescript
type ErrorHandlers = Array<{
    regex: RegExp;
    handler: ErrorHandler;
}>;

type ErrorHandler = (
    error: Error,
    request: IncomingMessage,
    response: ServerResponse
) => void | Promise<void>;
```

### FetchErrorHandlers

```typescript
type FetchErrorHandlers = Array<{
    regex: RegExp;
    handler: FetchErrorHandler;
}>;

type FetchErrorHandler = (
    error: Error,
    request: Request
) => Response | Promise<Response>;
```

### HtmlErrorHandlerOptions

```typescript
interface HtmlErrorHandlerOptions {
    errorPage?:
        | string
        | ((params: {
              error: Error;
              request: IncomingMessage;
              response: ServerResponse;
              reasonPhrase: string;
              statusCode: number;
          }) => string | Promise<string>);
    cspNonce?: string;
    onError?: (error: Error, request: IncomingMessage, response: ServerResponse) => void | Promise<void>;
}
```

### JsonErrorHandlerOptions

```typescript
interface JsonErrorHandlerOptions {
    formatter?: JsonErrorFormatter;
}

type JsonErrorFormatter = (error: Error, statusCode: number) => JsonErrorBody;

interface JsonErrorBody {
    message: string;
    statusCode: number;
    [key: string]: unknown;
}
```

### JsonpErrorHandlerOptions

```typescript
interface JsonpErrorHandlerOptions {
    formatter?: JsonpErrorFormatter;
    callbackName?: string; // default: "callback"
}

type JsonpErrorFormatter = (error: Error, statusCode: number) => JsonpErrorBody;

interface JsonpErrorBody {
    message: string;
    statusCode: number;
    [key: string]: unknown;
}
```

### TextErrorHandlerOptions

```typescript
interface TextErrorHandlerOptions {
    formatter?: TextErrorFormatter;
}

type TextErrorFormatter = (error: Error, statusCode: number, stackTrace?: string) => string;
```

### XmlErrorHandlerOptions

```typescript
interface XmlErrorHandlerOptions {
    formatter?: XmlErrorFormatter;
    xmlOptions?: ToXmlOptions;
}

type XmlErrorFormatter = (error: Error, statusCode: number) => XmlErrorBody;

interface XmlErrorBody {
    error: {
        message: string;
        statusCode: number;
        [key: string]: unknown;
    };
}

interface ToXmlOptions {
    header?: boolean;
    indent?: string;
    [key: string]: unknown;
}
```

## Utilities

### createNegotiatedErrorHandler

Creates a content-negotiated error handler with custom handlers.

```typescript
import { createNegotiatedErrorHandler } from "@visulima/error-handler";

const handler = createNegotiatedErrorHandler(extraHandlers, options);
```

#### Signature

```typescript
function createNegotiatedErrorHandler(
    extraHandlers?: ErrorHandlers,
    options?: HtmlErrorHandlerOptions & { showTrace?: boolean }
): (error: Error, req: IncomingMessage, res: ServerResponse) => Promise<void>
```

#### Example

```typescript
const negotiatedHandler = createNegotiatedErrorHandler(
    [
        {
            regex: /application\/yaml/,
            handler: (error, req, res) => {
                res.setHeader("Content-Type", "application/yaml");
                res.end(`error: ${error.message}`);
            },
        },
    ],
    {
        showTrace: true,
        cspNonce: "abc123",
    }
);

// Use in your application
app.use(async (err, req, res, next) => {
    await negotiatedHandler(err, req, res);
});
```

## Runtime-Specific Imports

For convenience, runtime-specific handlers can be imported:

```typescript
// Deno
import fetchHandler from "@visulima/error-handler/handler/http/deno";

// Bun
import fetchHandler from "@visulima/error-handler/handler/http/bun";

// Cloudflare Workers
import fetchHandler from "@visulima/error-handler/handler/http/cloudflare";

// Edge Runtime (Vercel, Netlify, etc.)
import fetchHandler from "@visulima/error-handler/handler/http/edge";

// Hono
import fetchHandler from "@visulima/error-handler/handler/http/hono";

// Node.js
import httpHandler from "@visulima/error-handler/handler/http/node";
```

All fetch-based handlers are identical internally and export the same handler.
