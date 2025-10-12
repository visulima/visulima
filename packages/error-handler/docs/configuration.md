# Configuration Guide

Comprehensive guide to configuring `@visulima/error-handler` for your specific needs.

## Table of Contents

- [Common Options](#common-options)
- [HTTP Handler Options](#http-handler-options)
- [Fetch Handler Options](#fetch-handler-options)
- [CLI Handler Options](#cli-handler-options)
- [Error Format Customization](#error-format-customization)
- [Environment-Based Configuration](#environment-based-configuration)

## Common Options

These options are available for both HTTP and Fetch handlers.

### showTrace

Controls whether stack traces and detailed error information are displayed.

```typescript
{
    showTrace: boolean; // default: true
}
```

**Usage:**

```typescript
const handler = await httpHandler(error, {
    showTrace: process.env.NODE_ENV !== "production",
});
```

**Development** (`showTrace: true`):
- Full stack traces with file paths and line numbers
- Code frames showing the error location
- All error properties
- Cause chain visualization
- Source map support

**Production** (`showTrace: false`):
- Generic error messages
- Status code only
- No stack traces
- No file paths
- No sensitive information

### extraHandlers

Add custom error handlers for specific content types using regex matching on the `Accept` header.

```typescript
{
    extraHandlers: Array<{
        regex: RegExp;
        handler: ErrorHandler;
    }>;
}
```

**Usage:**

```typescript
const handler = await httpHandler(error, {
    extraHandlers: [
        {
            regex: /application\/yaml/,
            handler: (error, req, res) => {
                res.setHeader("Content-Type", "application/yaml");
                res.statusCode = 500;
                res.end(`error:\n  message: ${error.message}\n  code: 500`);
            },
        },
        {
            regex: /text\/csv/,
            handler: (error, req, res) => {
                res.setHeader("Content-Type", "text/csv");
                res.statusCode = 500;
                res.end(`"Error","Message"\n"500","${error.message}"`);
            },
        },
    ],
});
```

### errorPage

Custom HTML error page as a string or function.

```typescript
{
    errorPage?: 
        | string 
        | ((params: ErrorPageParams) => string | Promise<string>);
}
```

**As String:**

```typescript
const handler = await httpHandler(error, {
    errorPage: `
        <!DOCTYPE html>
        <html>
        <head><title>Error</title></head>
        <body><h1>Something went wrong</h1></body>
        </html>
    `,
});
```

**As Function:**

```typescript
const handler = await httpHandler(error, {
    errorPage: ({ error, statusCode, reasonPhrase }) => `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Error ${statusCode}</title>
            <style>
                body { font-family: sans-serif; padding: 40px; }
                .container { max-width: 600px; margin: 0 auto; }
                .error-code { font-size: 72px; color: #dc3545; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="error-code">${statusCode}</div>
                <h1>${reasonPhrase}</h1>
                <p>${error.message}</p>
            </div>
        </body>
        </html>
    `,
});
```

**As Async Function:**

```typescript
const handler = await httpHandler(error, {
    errorPage: async ({ error, statusCode, request }) => {
        const template = await fs.readFile("./error-template.html", "utf-8");
        
        return template
            .replace("{{statusCode}}", String(statusCode))
            .replace("{{message}}", error.message)
            .replace("{{url}}", request.url || "");
    },
});
```

**ErrorPageParams:**

```typescript
interface ErrorPageParams {
    error: Error;
    request: IncomingMessage;
    response: ServerResponse;
    reasonPhrase: string; // e.g., "Internal Server Error"
    statusCode: number;   // e.g., 500
}
```

### cspNonce

Content Security Policy nonce for inline styles in HTML error pages.

```typescript
{
    cspNonce?: string;
}
```

**Usage:**

```typescript
import crypto from "node:crypto";

// Generate nonce for each request
const nonce = crypto.randomBytes(16).toString("base64");

// Set CSP header
res.setHeader(
    "Content-Security-Policy",
    `default-src 'self'; style-src 'self' 'nonce-${nonce}'`
);

// Pass to error handler
const handler = await httpHandler(error, {
    cspNonce: nonce,
});
```

The nonce will be automatically added to all `<style>` tags in the HTML error page.

### onError

Callback function for custom error logging or processing.

```typescript
{
    onError?: (error: Error, request: Request, response: Response) => void | Promise<void>;
}
```

**Usage:**

```typescript
const handler = await httpHandler(error, {
    onError: async (error, request, response) => {
        // Log to console
        console.error({
            timestamp: new Date().toISOString(),
            method: request.method,
            url: request.url,
            error: error.message,
            stack: error.stack,
        });
        
        // Send to logging service
        await logService.error({
            error: error.message,
            stack: error.stack,
            request: {
                method: request.method,
                url: request.url,
                headers: request.headers,
            },
        });
        
        // Add custom response headers
        response.setHeader("X-Error-ID", generateErrorId());
    },
});
```

## HTTP Handler Options

Complete options type for Node.js HTTP handlers:

```typescript
interface HttpHandlerOptions {
    showTrace?: boolean;
    extraHandlers?: Array<{
        regex: RegExp;
        handler: (
            error: Error,
            request: IncomingMessage,
            response: ServerResponse
        ) => void | Promise<void>;
    }>;
    errorPage?: string | ((params: ErrorPageParams) => string | Promise<string>);
    cspNonce?: string;
    onError?: (
        error: Error,
        request: IncomingMessage,
        response: ServerResponse
    ) => void | Promise<void>;
}
```

## Fetch Handler Options

Complete options type for Fetch-based handlers:

```typescript
interface FetchHandlerOptions {
    showTrace?: boolean;
    extraHandlers?: Array<{
        regex: RegExp;
        handler: (
            error: Error,
            request: Request
        ) => Response | Promise<Response>;
    }>;
    errorPage?: string | ((params: FetchErrorPageParams) => string | Promise<string>);
    cspNonce?: string;
    onError?: (
        error: Error,
        request: Request,
        response: Response
    ) => void | Promise<void>;
}

interface FetchErrorPageParams {
    error: Error;
    request: Request;
    reasonPhrase: string;
    statusCode: number;
}
```

**Example:**

```typescript
const handler = await fetchHandler(error, {
    showTrace: false,
    extraHandlers: [
        {
            regex: /application\/yaml/,
            handler: (error, request) => {
                return new Response(
                    `error:\n  message: ${error.message}`,
                    {
                        status: 500,
                        headers: { "Content-Type": "application/yaml" },
                    }
                );
            },
        },
    ],
    onError: async (error, request) => {
        console.error(`Error on ${request.url}:`, error);
    },
});
```

## CLI Handler Options

Configuration options for CLI error handlers:

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

### displayShortPath

Show relative paths instead of absolute paths in error output.

```typescript
await cliHandler(error, {
    displayShortPath: true,
});
```

**Output with `false`:**
```
/home/user/projects/myapp/src/utils/config.ts:42:10
```

**Output with `true`:**
```
src/utils/config.ts:42:10
```

### frameContextLines

Number of context lines to show before and after the error line.

```typescript
await cliHandler(error, {
    frameContextLines: 3, // Show 3 lines before and after
});
```

### color

Custom color functions for the error output box.

```typescript
await cliHandler(error, {
    color: {
        boxen: {
            // Red border
            borderColor: (text) => `\x1b[31m${text}\x1b[0m`,
            
            // Bold red header
            headerTextColor: (text) => `\x1b[1;31m${text}\x1b[0m`,
            
            // Default text color
            textColor: (text) => text,
        },
    },
});
```

**ANSI Color Codes:**

```typescript
const colors = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
};

// Example: Cyan border
borderColor: (text) => `${colors.cyan}${text}${colors.reset}`,

// Example: Bold yellow header
headerTextColor: (text) => `${colors.bold}${colors.yellow}${text}${colors.reset}`,
```

## Error Format Customization

Individual error handlers can be customized with formatters.

### JSON Error Handler

```typescript
import { jsonErrorHandler } from "@visulima/error-handler/error-handler/json";

const handler = jsonErrorHandler(error, req, res, {
    formatter: (error, statusCode) => ({
        success: false,
        error: {
            message: error.message,
            code: statusCode,
            timestamp: new Date().toISOString(),
        },
    }),
});
```

### JSONP Error Handler

```typescript
import { jsonpErrorHandler } from "@visulima/error-handler/error-handler/jsonp";

const handler = jsonpErrorHandler(error, req, res, {
    callbackName: "callback", // default
    formatter: (error, statusCode) => ({
        error: error.message,
        status: statusCode,
    }),
});
```

### Text Error Handler

```typescript
import { textErrorHandler } from "@visulima/error-handler/error-handler/text";

const handler = textErrorHandler(error, req, res, {
    formatter: (error, statusCode, stackTrace) => {
        return `ERROR ${statusCode}: ${error.message}\n\n${stackTrace || ""}`;
    },
});
```

### XML Error Handler

```typescript
import { xmlErrorHandler } from "@visulima/error-handler/error-handler/xml";

const handler = xmlErrorHandler(error, req, res, {
    formatter: (error, statusCode) => ({
        error: {
            code: statusCode,
            message: error.message,
            timestamp: new Date().toISOString(),
        },
    }),
    xmlOptions: {
        header: true,
        indent: "  ",
    },
});
```

## Environment-Based Configuration

### Basic Environment Detection

```typescript
const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";

const handler = await httpHandler(error, {
    showTrace: isDevelopment,
    errorPage: isProduction ? await loadProductionTemplate() : undefined,
});
```

### Advanced Environment Configuration

```typescript
interface ErrorHandlerConfig {
    showTrace: boolean;
    logErrors: boolean;
    customPage: boolean;
}

const configs: Record<string, ErrorHandlerConfig> = {
    development: {
        showTrace: true,
        logErrors: true,
        customPage: false,
    },
    staging: {
        showTrace: true,
        logErrors: true,
        customPage: true,
    },
    production: {
        showTrace: false,
        logErrors: true,
        customPage: true,
    },
};

const env = process.env.NODE_ENV || "development";
const config = configs[env];

const handler = await httpHandler(error, {
    showTrace: config.showTrace,
    errorPage: config.customPage ? await loadCustomPage() : undefined,
    onError: config.logErrors ? logError : undefined,
});
```

### Configuration File

Create a configuration file:

```typescript
// error-handler.config.ts
import type { HttpHandlerOptions } from "@visulima/error-handler";

export const errorHandlerConfig: HttpHandlerOptions = {
    showTrace: process.env.NODE_ENV !== "production",
    onError: async (error, request, response) => {
        // Your logging logic
        console.error({
            timestamp: new Date().toISOString(),
            error: error.message,
            url: request.url,
        });
    },
};
```

Use in your application:

```typescript
import httpHandler from "@visulima/error-handler/handler/http/node";
import { errorHandlerConfig } from "./error-handler.config";

app.use(async (err, req, res, next) => {
    const handler = await httpHandler(err, errorHandlerConfig);
    return handler(req, res);
});
```

### Per-Route Configuration

```typescript
const routeConfigs = {
    api: {
        showTrace: false, // Never show traces for API routes
    },
    admin: {
        showTrace: true, // Always show traces for admin routes
    },
    public: {
        showTrace: process.env.NODE_ENV !== "production",
    },
};

app.use("/api/*", async (err, req, res, next) => {
    const handler = await httpHandler(err, routeConfigs.api);
    return handler(req, res);
});

app.use("/admin/*", async (err, req, res, next) => {
    const handler = await httpHandler(err, routeConfigs.admin);
    return handler(req, res);
});

app.use(async (err, req, res, next) => {
    const handler = await httpHandler(err, routeConfigs.public);
    return handler(req, res);
});
```

## Best Practices

### 1. Never Show Traces in Production

```typescript
const handler = await httpHandler(error, {
    showTrace: process.env.NODE_ENV !== "production",
});
```

### 2. Always Log Errors

```typescript
const handler = await httpHandler(error, {
    onError: async (error, request, response) => {
        await logger.error({
            error: error.message,
            stack: error.stack,
            url: request.url,
        });
    },
});
```

### 3. Use CSP for Security

```typescript
// Generate nonce per request
const nonce = crypto.randomBytes(16).toString("base64");

// Set CSP header
res.setHeader(
    "Content-Security-Policy",
    `style-src 'self' 'nonce-${nonce}'`
);

// Pass to handler
const handler = await httpHandler(error, {
    cspNonce: nonce,
});
```

### 4. Customize Error Pages for Production

```typescript
const handler = await httpHandler(error, {
    showTrace: false,
    errorPage: async ({ statusCode }) => {
        return await loadBrandedErrorPage(statusCode);
    },
});
```

### 5. Add Request Context to Errors

```typescript
const handler = await httpHandler(error, {
    onError: async (error, request, response) => {
        response.setHeader("X-Request-ID", generateRequestId());
        response.setHeader("X-Error-Timestamp", new Date().toISOString());
    },
});
```
