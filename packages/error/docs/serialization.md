# Error Serialization

Learn how to serialize and deserialize errors for storage, transmission, and logging.

## Overview

Error serialization converts Error objects into plain JavaScript objects that can be:

- Converted to JSON
- Stored in databases
- Transmitted over networks
- Logged to files
- Sent to error tracking services

## Why Serialize Errors?

Standard JavaScript errors lose information when serialized:

```typescript
const error = new TypeError("Invalid value");
error.customProperty = "important data";

console.log(JSON.stringify(error));
// {} - Empty object! Information is lost
```

With `@visulima/error`:

```typescript
import { serializeError } from "@visulima/error";

const serialized = serializeError(error);
console.log(JSON.stringify(serialized));
// Full error information preserved
```

## Basic Usage

### Serializing Errors

```typescript
import { serializeError } from "@visulima/error";

const error = new TypeError("Invalid input");
const serialized = serializeError(error);

console.log(serialized);
// {
//   name: "TypeError",
//   message: "Invalid input",
//   stack: "TypeError: Invalid input\n    at ...",
//   ...
// }
```

### Converting to JSON

```typescript
import { serializeError } from "@visulima/error";

const error = new Error("Something went wrong");
const json = JSON.stringify(serializeError(error));

// Send over network, store in database, etc.
await fetch("/api/errors", {
    method: "POST",
    body: json,
    headers: { "Content-Type": "application/json" }
});
```

### Deserializing Errors

```typescript
import { deserializeError } from "@visulima/error";

const jsonString = '{"name":"TypeError","message":"Invalid"}';
const parsed = JSON.parse(jsonString);

const error = deserializeError(parsed);

console.log(error instanceof TypeError); // true
console.log(error.message); // "Invalid"
```

## Features

### Preserves Error Types

```typescript
import { serializeError, deserializeError } from "@visulima/error";

const original = new RangeError("Out of bounds");
const serialized = serializeError(original);
const deserialized = deserializeError(serialized);

console.log(deserialized instanceof RangeError); // true
console.log(deserialized.name); // "RangeError"
```

### Handles Error Causes

```typescript
const rootCause = new Error("Database connection failed");
const topError = new Error("Query failed", { cause: rootCause });

const serialized = serializeError(topError);
const deserialized = deserializeError(serialized);

console.log(deserialized.cause instanceof Error); // true
console.log(deserialized.cause.message); // "Database connection failed"
```

### Supports AggregateError

```typescript
const errors = [
    new Error("Error 1"),
    new Error("Error 2")
];
const aggregate = new AggregateError(errors, "Multiple errors occurred");

const serialized = serializeError(aggregate);
const deserialized = deserializeError(serialized);

console.log(deserialized instanceof AggregateError); // true
console.log(deserialized.errors.length); // 2
```

### Preserves Custom Properties

```typescript
const error = new Error("Custom error") as Error & { 
    statusCode?: number;
    details?: unknown;
};

error.statusCode = 404;
error.details = { userId: "123", resource: "user" };

const serialized = serializeError(error);
const deserialized = deserializeError(serialized) as typeof error;

console.log(deserialized.statusCode); // 404
console.log(deserialized.details); // { userId: "123", resource: "user" }
```

### Handles Circular References

```typescript
const error = new Error("Circular") as Error & { self?: Error };
error.self = error; // Circular reference

const serialized = serializeError(error);
// Circular reference is handled gracefully
```

### Replaces Buffers

```typescript
const error = new Error("Buffer error") as Error & { buffer?: Buffer };
error.buffer = Buffer.from("data");

const serialized = serializeError(error);
// Buffer is replaced with "[object Buffer]"
```

## Custom Error Classes

### Registering Custom Errors

To properly deserialize custom error classes, register them first:

```typescript
import { addKnownErrorConstructor, deserializeError } from "@visulima/error";

class DatabaseError extends Error {
    constructor(
        message: string,
        public query?: string,
        public table?: string
    ) {
        super(message);
        this.name = "DatabaseError";
    }
}

// Register the constructor
addKnownErrorConstructor(DatabaseError);

// Now it can be properly deserialized
const serialized = {
    name: "DatabaseError",
    message: "Query failed",
    query: "SELECT * FROM users",
    table: "users"
};

const error = deserializeError(serialized);
console.log(error instanceof DatabaseError); // true
console.log((error as DatabaseError).query); // "SELECT * FROM users"
```

### Multiple Custom Errors

```typescript
import { addKnownErrorConstructor } from "@visulima/error";

class ValidationError extends Error {
    constructor(
        message: string,
        public fields?: Record<string, string[]>
    ) {
        super(message);
        this.name = "ValidationError";
    }
}

class AuthenticationError extends Error {
    constructor(
        message: string,
        public code?: string
    ) {
        super(message);
        this.name = "AuthenticationError";
    }
}

// Register all custom error types
addKnownErrorConstructor(ValidationError);
addKnownErrorConstructor(AuthenticationError);
```

## Configuration Options

### Maximum Depth

Control how deep nested objects are serialized:

```typescript
import { serializeError } from "@visulima/error";

const error = new Error("Deep nesting") as Error & { nested?: unknown };
error.nested = {
    level1: {
        level2: {
            level3: "data"
        }
    }
};

const serialized = serializeError(error, {
    maxDepth: 2  // Only serialize 2 levels deep
});
```

### Deserialization Depth

```typescript
import { deserializeError } from "@visulima/error";

const deserialized = deserializeError(serialized, {
    maxDepth: 5
});
```

## Non-Error Objects

### NonError Class

When deserializing objects that don't look like errors, they're wrapped in `NonError`:

```typescript
import { deserializeError, NonError } from "@visulima/error";

const notAnError = { foo: "bar" };
const deserialized = deserializeError(notAnError);

console.log(deserialized instanceof NonError); // true
console.log(deserialized.message); // '{"foo":"bar"}'
```

### Checking for Error-Like Objects

```typescript
import { isErrorLike } from "@visulima/error";

console.log(isErrorLike({ name: "Error", message: "Test" })); // true
console.log(isErrorLike({ foo: "bar" })); // false
console.log(isErrorLike(null)); // false
```

## Practical Examples

### Logging to Files

```typescript
import { serializeError } from "@visulima/error";
import { appendFile } from "fs/promises";

async function logError(error: unknown) {
    const serialized = serializeError(error);
    const logEntry = {
        timestamp: new Date().toISOString(),
        error: serialized,
        environment: process.env.NODE_ENV
    };
    
    await appendFile(
        "errors.log",
        JSON.stringify(logEntry) + "\n"
    );
}

try {
    // Application code
} catch (error) {
    await logError(error);
}
```

### Error Reporting Service

```typescript
import { serializeError } from "@visulima/error";

class ErrorReporter {
    constructor(
        private apiEndpoint: string,
        private apiKey: string
    ) {}
    
    async report(error: unknown, context?: Record<string, unknown>) {
        const serialized = serializeError(error);
        
        await fetch(this.apiEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                error: serialized,
                context,
                timestamp: Date.now(),
                version: process.env.APP_VERSION
            })
        });
    }
}

const reporter = new ErrorReporter(
    "https://errors.example.com/api/report",
    process.env.ERROR_API_KEY
);

try {
    // Application code
} catch (error) {
    await reporter.report(error, {
        userId: "123",
        route: "/dashboard"
    });
}
```

### Database Storage

```typescript
import { serializeError, deserializeError } from "@visulima/error";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function saveError(error: unknown, userId: string) {
    const serialized = serializeError(error);
    
    await prisma.errorLog.create({
        data: {
            userId,
            errorData: JSON.stringify(serialized),
            createdAt: new Date()
        }
    });
}

async function loadError(errorId: string): Promise<Error> {
    const record = await prisma.errorLog.findUnique({
        where: { id: errorId }
    });
    
    const parsed = JSON.parse(record.errorData);
    return deserializeError(parsed);
}
```

### Cross-Process Communication

```typescript
import { serializeError, deserializeError } from "@visulima/error";
import { Worker } from "worker_threads";

// Main thread
const worker = new Worker("./worker.js");

worker.on("message", (message) => {
    if (message.type === "error") {
        const error = deserializeError(message.error);
        console.error("Worker error:", error);
    }
});

// Worker thread
process.on("uncaughtException", (error) => {
    process.send({
        type: "error",
        error: serializeError(error)
    });
});
```

### Redux Error Actions

```typescript
import { serializeError, deserializeError } from "@visulima/error";

// Action creator
function fetchUserFailure(error: unknown) {
    return {
        type: "FETCH_USER_FAILURE",
        payload: serializeError(error)
    };
}

// Reducer
function userReducer(state: UserState, action: Action) {
    switch (action.type) {
        case "FETCH_USER_FAILURE":
            const error = deserializeError(action.payload);
            return {
                ...state,
                error,
                loading: false
            };
        default:
            return state;
    }
}
```

### GraphQL Error Formatting

```typescript
import { serializeError } from "@visulima/error";
import { GraphQLError } from "graphql";

function formatError(error: GraphQLError) {
    const serialized = serializeError(error.originalError || error);
    
    return {
        message: error.message,
        locations: error.locations,
        path: error.path,
        extensions: {
            ...error.extensions,
            error: serialized
        }
    };
}
```

### API Response Formatting

```typescript
import { serializeError } from "@visulima/error";
import express from "express";

const app = express();

app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const serialized = serializeError(error);
    
    res.status(500).json({
        status: "error",
        error: process.env.NODE_ENV === "production" 
            ? { message: error.message }
            : serialized
    });
});
```

## Best Practices

### 1. Always Use for JSON Conversion

```typescript
// Good
const json = JSON.stringify(serializeError(error));

// Bad - loses information
const json = JSON.stringify(error);
```

### 2. Register Custom Errors Early

```typescript
// At application startup
import { addKnownErrorConstructor } from "@visulima/error";

// Register all custom error types
addKnownErrorConstructor(DatabaseError);
addKnownErrorConstructor(ValidationError);
addKnownErrorConstructor(ApiError);

// Now they can be properly deserialized anywhere
```

### 3. Handle Deserialization Safely

```typescript
import { deserializeError, isErrorLike } from "@visulima/error";

function safeDeserialize(data: unknown): Error {
    try {
        if (isErrorLike(data)) {
            return deserializeError(data);
        }
        return new Error("Invalid error data");
    } catch (error) {
        return new Error(`Deserialization failed: ${error.message}`);
    }
}
```

### 4. Limit Serialization Depth

```typescript
// For large, complex errors
const serialized = serializeError(error, {
    maxDepth: 10  // Prevent excessive nesting
});
```

### 5. Sanitize Before Sending

```typescript
function sanitizeError(error: unknown) {
    const serialized = serializeError(error);
    
    // Remove sensitive information
    delete serialized.stack;
    if (serialized.cause) {
        delete serialized.cause.stack;
    }
    
    return serialized;
}

// Send to external service
await reportError(sanitizeError(error));
```

## Performance Considerations

### Cache Serialized Errors

```typescript
const errorCache = new WeakMap<Error, unknown>();

function getCachedSerialized(error: Error) {
    if (!errorCache.has(error)) {
        errorCache.set(error, serializeError(error));
    }
    return errorCache.get(error);
}
```

### Batch Error Processing

```typescript
function serializeErrors(errors: Error[]) {
    return errors.map(error => serializeError(error));
}

const serialized = serializeErrors(multipleErrors);
await saveToDatabase(serialized);
```

## TypeScript Types

```typescript
import type {
    SerializedError,
    ErrorWithCauseSerializerOptions
} from "@visulima/error";

const serialized: SerializedError = serializeError(error);

const options: ErrorWithCauseSerializerOptions = {
    maxDepth: 10
};
```

## See Also

- [API Reference](./api-reference.md)
- [Examples](./examples.md)
- [VisulimaError Class](./visulima-error.md)
- [Custom Error Types](./custom-errors.md)
