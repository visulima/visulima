# Advanced Usage

Advanced patterns and techniques for `@visulima/error-handler`.

## Table of Contents

- [Custom Error Handlers](#custom-error-handlers)
- [Content Negotiation](#content-negotiation)
- [Error Context and Metadata](#error-context-and-metadata)
- [Error Tracking Integration](#error-tracking-integration)
- [Multi-Tenant Error Handling](#multi-tenant-error-handling)
- [Rate Limiting and Throttling](#rate-limiting-and-throttling)
- [Error Recovery Strategies](#error-recovery-strategies)
- [Testing Error Handlers](#testing-error-handlers)
- [Performance Optimization](#performance-optimization)

## Custom Error Handlers

Create custom error handlers for specialized content types or business logic.

### Custom Format Handler

```typescript
import httpHandler from "@visulima/error-handler/handler/http/node";

const handler = await httpHandler(error, {
    extraHandlers: [
        {
            // Custom protocol buffer handler
            regex: /application\/x-protobuf/,
            handler: async (error, req, res) => {
                const protoMessage = encodeErrorToProtobuf(error);
                
                res.setHeader("Content-Type", "application/x-protobuf");
                res.statusCode = 500;
                res.end(protoMessage);
            },
        },
        {
            // Custom MessagePack handler
            regex: /application\/msgpack/,
            handler: async (error, req, res) => {
                const packed = msgpack.encode({
                    error: error.message,
                    code: 500,
                    timestamp: Date.now(),
                });
                
                res.setHeader("Content-Type", "application/msgpack");
                res.statusCode = 500;
                res.end(packed);
            },
        },
    ],
});
```

### Conditional Error Responses

```typescript
const handler = await httpHandler(error, {
    extraHandlers: [
        {
            regex: /application\/json/,
            handler: async (error, req, res) => {
                // Check if request is from API client
                const isApiClient = req.headers["x-api-client"] === "true";
                
                const response = isApiClient
                    ? {
                        // Detailed API response
                        success: false,
                        error: {
                            message: error.message,
                            code: error.code || "INTERNAL_ERROR",
                            details: error.details,
                            requestId: req.headers["x-request-id"],
                        },
                    }
                    : {
                        // Simple response for other clients
                        error: error.message,
                    };
                
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 500;
                res.end(JSON.stringify(response));
            },
        },
    ],
});
```

### Handler Priority and Fallbacks

```typescript
const handlers = [
    {
        // Most specific handler first
        regex: /application\/vnd\.myapp\.v2\+json/,
        handler: async (error, req, res) => {
            res.setHeader("Content-Type", "application/vnd.myapp.v2+json");
            res.end(JSON.stringify({
                apiVersion: "2.0",
                error: formatErrorV2(error),
            }));
        },
    },
    {
        // Fallback to v1 format
        regex: /application\/vnd\.myapp\.v1\+json/,
        handler: async (error, req, res) => {
            res.setHeader("Content-Type", "application/vnd.myapp.v1+json");
            res.end(JSON.stringify({
                apiVersion: "1.0",
                error: formatErrorV1(error),
            }));
        },
    },
    {
        // Generic JSON fallback
        regex: /application\/json/,
        handler: async (error, req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: error.message }));
        },
    },
];

const handler = await httpHandler(error, {
    extraHandlers: handlers,
});
```

## Content Negotiation

Advanced content negotiation patterns.

### Quality Factor (q-value) Support

```typescript
import accepts from "@tinyhttp/accepts";

const handler = await httpHandler(error, {
    extraHandlers: [
        {
            regex: /.*/,
            handler: async (error, req, res) => {
                const accept = accepts(req);
                
                // Get preferred type based on quality factors
                const type = accept.types([
                    "application/json",
                    "text/html",
                    "application/xml",
                ]);
                
                switch (type) {
                    case "application/json":
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify({ error: error.message }));
                        break;
                    case "text/html":
                        res.setHeader("Content-Type", "text/html");
                        res.end(`<h1>Error</h1><p>${error.message}</p>`);
                        break;
                    case "application/xml":
                        res.setHeader("Content-Type", "application/xml");
                        res.end(`<error><message>${error.message}</message></error>`);
                        break;
                    default:
                        res.setHeader("Content-Type", "text/plain");
                        res.end(error.message);
                }
            },
        },
    ],
});
```

### Language Negotiation

```typescript
const handler = await httpHandler(error, {
    extraHandlers: [
        {
            regex: /application\/json/,
            handler: async (error, req, res) => {
                const acceptLanguage = req.headers["accept-language"] || "en";
                const language = acceptLanguage.split(",")[0].split("-")[0];
                
                const messages = {
                    en: "An error occurred",
                    es: "Ocurrió un error",
                    fr: "Une erreur s'est produite",
                    de: "Ein Fehler ist aufgetreten",
                };
                
                const message = messages[language] || messages.en;
                
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Content-Language", language);
                res.end(JSON.stringify({
                    message,
                    details: error.message,
                }));
            },
        },
    ],
});
```

## Error Context and Metadata

Add rich context and metadata to error responses.

### Request Context

```typescript
const handler = await httpHandler(error, {
    onError: async (error, request, response) => {
        // Attach request context to error
        error.context = {
            method: request.method,
            url: request.url,
            headers: request.headers,
            userAgent: request.headers["user-agent"],
            ip: request.socket.remoteAddress,
            timestamp: new Date().toISOString(),
        };
        
        // Add to response headers
        response.setHeader("X-Request-ID", generateRequestId());
        response.setHeader("X-Error-Timestamp", error.context.timestamp);
    },
});
```

### User Context

```typescript
const handler = await httpHandler(error, {
    onError: async (error, request, response) => {
        // Extract user from session/token
        const user = await getUserFromRequest(request);
        
        error.userContext = {
            userId: user?.id,
            email: user?.email,
            role: user?.role,
            tenant: user?.tenant,
        };
        
        // Log with user context
        await logger.error({
            error: error.message,
            user: error.userContext,
            request: {
                method: request.method,
                url: request.url,
            },
        });
    },
});
```

### Application Context

```typescript
const handler = await httpHandler(error, {
    onError: async (error, request, response) => {
        error.appContext = {
            environment: process.env.NODE_ENV,
            version: process.env.APP_VERSION,
            hostname: os.hostname(),
            pid: process.pid,
            memory: process.memoryUsage(),
            uptime: process.uptime(),
        };
    },
});
```

## Error Tracking Integration

Integrate with error tracking services.

### Sentry Integration

```typescript
import * as Sentry from "@sentry/node";

const handler = await httpHandler(error, {
    onError: async (error, request, response) => {
        const eventId = Sentry.captureException(error, {
            contexts: {
                request: {
                    method: request.method,
                    url: request.url,
                    headers: request.headers,
                },
            },
            tags: {
                endpoint: request.url,
                statusCode: response.statusCode,
            },
            user: {
                id: request.user?.id,
                email: request.user?.email,
            },
        });
        
        // Add Sentry event ID to response
        response.setHeader("X-Sentry-Event-ID", eventId);
    },
});
```

### Custom Error Tracking

```typescript
class ErrorTracker {
    async track(error: Error, context: any): Promise<string> {
        const errorId = generateUUID();
        
        await database.errors.insert({
            id: errorId,
            message: error.message,
            stack: error.stack,
            context,
            timestamp: new Date(),
        });
        
        return errorId;
    }
}

const tracker = new ErrorTracker();

const handler = await httpHandler(error, {
    onError: async (error, request, response) => {
        const errorId = await tracker.track(error, {
            request: {
                method: request.method,
                url: request.url,
            },
        });
        
        response.setHeader("X-Error-ID", errorId);
    },
});
```

### Aggregated Error Reporting

```typescript
class ErrorAggregator {
    private errors: Map<string, number> = new Map();
    
    track(error: Error) {
        const key = `${error.name}:${error.message}`;
        const count = this.errors.get(key) || 0;
        this.errors.set(key, count + 1);
    }
    
    async flush() {
        // Send aggregated errors to monitoring service
        const stats = Array.from(this.errors.entries()).map(([key, count]) => ({
            error: key,
            count,
            timestamp: new Date(),
        }));
        
        await monitoringService.sendBatch(stats);
        this.errors.clear();
    }
}

const aggregator = new ErrorAggregator();

// Flush every 60 seconds
setInterval(() => aggregator.flush(), 60000);

const handler = await httpHandler(error, {
    onError: async (error) => {
        aggregator.track(error);
    },
});
```

## Multi-Tenant Error Handling

Handle errors differently based on tenant context.

### Tenant-Specific Error Pages

```typescript
const handler = await httpHandler(error, {
    errorPage: async ({ error, statusCode, request }) => {
        const tenant = await getTenantFromRequest(request);
        
        // Load tenant-specific error page
        const template = await loadTenantTemplate(tenant.id);
        
        return template
            .replace("{{logo}}", tenant.logoUrl)
            .replace("{{brandColor}}", tenant.brandColor)
            .replace("{{statusCode}}", String(statusCode))
            .replace("{{message}}", error.message);
    },
});
```

### Tenant-Specific Error Policies

```typescript
const handler = await httpHandler(error, {
    onError: async (error, request, response) => {
        const tenant = await getTenantFromRequest(request);
        
        // Apply tenant-specific policies
        if (tenant.settings.logErrors) {
            await logger.error({ error, tenant: tenant.id });
        }
        
        if (tenant.settings.sendEmailOnError) {
            await sendErrorEmail(tenant.adminEmail, error);
        }
        
        if (tenant.settings.showDetailedErrors) {
            response.setHeader("X-Show-Details", "true");
        }
    },
});
```

## Rate Limiting and Throttling

Prevent error flooding and abuse.

### Error Rate Limiting

```typescript
class ErrorRateLimiter {
    private attempts: Map<string, number[]> = new Map();
    private readonly maxAttempts = 10;
    private readonly windowMs = 60000; // 1 minute
    
    isRateLimited(key: string): boolean {
        const now = Date.now();
        const attempts = this.attempts.get(key) || [];
        
        // Remove old attempts outside the window
        const recentAttempts = attempts.filter(
            (time) => now - time < this.windowMs
        );
        
        this.attempts.set(key, recentAttempts);
        
        return recentAttempts.length >= this.maxAttempts;
    }
    
    recordAttempt(key: string) {
        const attempts = this.attempts.get(key) || [];
        attempts.push(Date.now());
        this.attempts.set(key, attempts);
    }
}

const limiter = new ErrorRateLimiter();

const handler = await httpHandler(error, {
    onError: async (error, request, response) => {
        const ip = request.socket.remoteAddress || "unknown";
        
        if (limiter.isRateLimited(ip)) {
            response.statusCode = 429;
            response.setHeader("Retry-After", "60");
            response.end("Too many errors. Please try again later.");
            return;
        }
        
        limiter.recordAttempt(ip);
        
        // Normal error logging
        await logger.error({ error, ip });
    },
});
```

## Error Recovery Strategies

Implement automatic recovery and retry mechanisms.

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
    private failures = 0;
    private readonly threshold = 5;
    private readonly timeout = 60000; // 1 minute
    private state: "closed" | "open" | "half-open" = "closed";
    private nextAttempt = 0;
    
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === "open") {
            if (Date.now() < this.nextAttempt) {
                throw new Error("Circuit breaker is open");
            }
            this.state = "half-open";
        }
        
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }
    
    private onSuccess() {
        this.failures = 0;
        this.state = "closed";
    }
    
    private onFailure() {
        this.failures++;
        
        if (this.failures >= this.threshold) {
            this.state = "open";
            this.nextAttempt = Date.now() + this.timeout;
        }
    }
}

const breaker = new CircuitBreaker();

const handler = await httpHandler(error, {
    onError: async (error, request, response) => {
        try {
            await breaker.execute(async () => {
                await logger.error({ error });
            });
        } catch (breakerError) {
            // Circuit breaker is open, skip logging
            console.warn("Circuit breaker open, skipping error logging");
        }
    },
});
```

### Retry with Exponential Backoff

```typescript
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            
            if (attempt < maxRetries - 1) {
                const delay = baseDelay * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError!;
}

const handler = await httpHandler(error, {
    onError: async (error, request, response) => {
        await retryWithBackoff(
            async () => await logger.error({ error }),
            3,
            1000
        );
    },
});
```

## Testing Error Handlers

Test your error handling implementation.

### Unit Testing

```typescript
import { describe, it, expect } from "vitest";
import httpMocks from "node-mocks-http";
import httpHandler from "@visulima/error-handler/handler/http/node";

describe("Error Handler", () => {
    it("should return 500 status code", async () => {
        const req = httpMocks.createRequest();
        const res = httpMocks.createResponse();
        
        const error = new Error("Test error");
        const handler = await httpHandler(error, {
            showTrace: false,
        });
        
        await handler(req, res);
        
        expect(res.statusCode).toBe(500);
    });
    
    it("should return JSON for JSON accept header", async () => {
        const req = httpMocks.createRequest({
            headers: { accept: "application/json" },
        });
        const res = httpMocks.createResponse();
        
        const error = new Error("Test error");
        const handler = await httpHandler(error);
        
        await handler(req, res);
        
        expect(res.getHeader("Content-Type")).toContain("application/json");
        const data = JSON.parse(res._getData());
        expect(data.message).toBe("Test error");
    });
});
```

### Integration Testing

```typescript
import request from "supertest";
import app from "./app";

describe("Error Handling Integration", () => {
    it("should handle not found errors", async () => {
        const response = await request(app)
            .get("/nonexistent")
            .set("Accept", "application/json");
        
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty("message");
    });
    
    it("should include error ID in response", async () => {
        const response = await request(app)
            .get("/error")
            .set("Accept", "application/json");
        
        expect(response.status).toBe(500);
        expect(response.headers).toHaveProperty("x-error-id");
    });
});
```

## Performance Optimization

Optimize error handling for production.

### Lazy Loading Error Pages

```typescript
let errorTemplate: string | null = null;

async function getErrorTemplate() {
    if (!errorTemplate) {
        errorTemplate = await fs.readFile("./error.html", "utf-8");
    }
    return errorTemplate;
}

const handler = await httpHandler(error, {
    errorPage: async ({ error, statusCode }) => {
        const template = await getErrorTemplate();
        return template
            .replace("{{statusCode}}", String(statusCode))
            .replace("{{message}}", error.message);
    },
});
```

### Error Handler Caching

```typescript
const handlerCache = new Map<string, any>();

function getCachedHandler(options: any) {
    const key = JSON.stringify(options);
    
    if (!handlerCache.has(key)) {
        const handler = httpHandler(error, options);
        handlerCache.set(key, handler);
    }
    
    return handlerCache.get(key);
}
```

### Async Error Logging

```typescript
// Don't wait for logging to complete
const handler = await httpHandler(error, {
    onError: (error, request, response) => {
        // Fire and forget
        logger.error({ error }).catch(console.error);
        
        // Don't return promise
    },
});
```

### Sampling for High-Traffic Applications

```typescript
const SAMPLE_RATE = 0.1; // Log 10% of errors

const handler = await httpHandler(error, {
    onError: async (error, request, response) => {
        if (Math.random() < SAMPLE_RATE) {
            await logger.error({ error });
        }
    },
});
```
