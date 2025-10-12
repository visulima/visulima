# TypeScript Support

Complete guide to using `@visulima/error` with TypeScript.

## Overview

`@visulima/error` is written in TypeScript and provides comprehensive type definitions for:

- All classes and functions
- Type guards and type predicates
- Generic error handling
- Custom error types
- Configuration options

## Installation

TypeScript support is included automatically:

```bash
pnpm add @visulima/error
```

No separate `@types` package is needed.

## Type Imports

### Import Types

```typescript
import type {
    // Error types
    ErrorProperties,
    ErrorLocation,
    ErrorHint,
    SerializedError,
    RenderErrorOptions,
    
    // Stack trace types
    Trace,
    TraceType,
    
    // Code frame types
    CodeFrameLocation,
    CodeFrameNodeLocation,
    CodeFrameOptions,
    ColorizeMethod,
    
    // Solution types
    Solution,
    SolutionError,
    SolutionFinder,
    SolutionFinderFile
} from "@visulima/error";
```

### Import Classes and Functions

```typescript
import {
    VisulimaError,
    isVisulimaError,
    renderError,
    serializeError,
    deserializeError,
    parseStacktrace,
    codeFrame
} from "@visulima/error";
```

## Type Definitions

### VisulimaError Types

```typescript
interface ErrorProperties {
    name: string;
    message: string;
    cause?: unknown;
    hint?: ErrorHint;
    location?: ErrorLocation;
    stack?: string;
    title?: string;
}

interface ErrorLocation {
    file?: string;
    line?: number;
    column?: number;
}

type ErrorHint = string | string[];
```

### Stack Trace Types

```typescript
interface Trace {
    methodName?: string;
    file?: string;
    line?: number;
    column?: number;
    type?: TraceType;
    evalOrigin?: string;
    raw: string;
}

type TraceType = "eval" | "native" | "internal" | undefined;
```

### Code Frame Types

```typescript
interface CodeFrameLocation {
    start: CodeFrameNodeLocation;
    end?: CodeFrameNodeLocation;
}

interface CodeFrameNodeLocation {
    line: number;
    column: number;
}

interface CodeFrameOptions {
    linesAbove?: number;
    linesBelow?: number;
    tabWidth?: number | false;
    colorize?: ColorizeMethod;
}

type ColorizeMethod = (text: string) => string;
```

### Solution Types

```typescript
interface Solution {
    header?: string;
    body: string;
}

interface SolutionFinderFile {
    file: string;
    line: number;
    language?: string;
    snippet?: string;
}

type SolutionError = Error;

interface SolutionFinder {
    handle(
        error: SolutionError,
        file: SolutionFinderFile
    ): Promise<Solution | undefined>;
}
```

## Type-Safe Error Handling

### Type Guards

```typescript
import { isVisulimaError, VisulimaError } from "@visulima/error";

function handleError(error: unknown): void {
    if (isVisulimaError(error)) {
        // TypeScript knows error is VisulimaError
        console.log(error.hint);
        console.log(error.loc);
    } else if (error instanceof Error) {
        // Standard Error
        console.log(error.message);
    } else {
        // Unknown error type
        console.log("Unknown error:", error);
    }
}
```

### Custom Type Guards

```typescript
class CustomError extends VisulimaError {
    public readonly code: string;
    
    constructor(message: string, code: string) {
        super({ name: "CustomError", message });
        this.code = code;
    }
}

function isCustomError(error: unknown): error is CustomError {
    return error instanceof CustomError;
}

// Usage
try {
    throw new CustomError("Error", "ERR_001");
} catch (error) {
    if (isCustomError(error)) {
        console.log(error.code); // Type-safe access
    }
}
```

## Generic Error Handling

### Generic Error Wrapper

```typescript
class Result<T, E extends Error = Error> {
    private constructor(
        private readonly value?: T,
        private readonly error?: E
    ) {}
    
    static ok<T>(value: T): Result<T, never> {
        return new Result(value);
    }
    
    static err<E extends Error>(error: E): Result<never, E> {
        return new Result(undefined, error);
    }
    
    isOk(): this is { value: T } {
        return this.error === undefined;
    }
    
    isErr(): this is { error: E } {
        return this.error !== undefined;
    }
    
    unwrap(): T {
        if (this.isErr()) {
            throw this.error;
        }
        return this.value!;
    }
    
    unwrapOr(defaultValue: T): T {
        return this.isOk() ? this.value : defaultValue;
    }
}

// Usage
function divide(a: number, b: number): Result<number, RangeError> {
    if (b === 0) {
        return Result.err(new RangeError("Division by zero"));
    }
    return Result.ok(a / b);
}

const result = divide(10, 2);
if (result.isOk()) {
    console.log(result.value); // Type-safe: number
} else {
    console.log(result.error); // Type-safe: RangeError
}
```

### Typed Error Handlers

```typescript
type ErrorHandler<E extends Error = Error> = (error: E) => void;

class ErrorManager {
    private handlers = new Map<
        new (...args: any[]) => Error,
        ErrorHandler
    >();
    
    register<E extends Error>(
        errorClass: new (...args: any[]) => E,
        handler: ErrorHandler<E>
    ): void {
        this.handlers.set(errorClass, handler as ErrorHandler);
    }
    
    handle(error: Error): void {
        for (const [ErrorClass, handler] of this.handlers) {
            if (error instanceof ErrorClass) {
                handler(error);
                return;
            }
        }
        
        // Default handler
        console.error("Unhandled error:", error);
    }
}

// Usage
const manager = new ErrorManager();

manager.register(ValidationError, (error) => {
    // error is typed as ValidationError
    console.log("Validation errors:", error.fields);
});

manager.register(DatabaseError, (error) => {
    // error is typed as DatabaseError
    console.log("Database error:", error.query);
});
```

## Extending Types

### Custom Error Properties

```typescript
interface HttpErrorProperties extends ErrorProperties {
    statusCode: number;
    headers?: Record<string, string>;
}

class HttpError extends VisulimaError {
    public readonly statusCode: number;
    public readonly headers?: Record<string, string>;
    
    constructor(properties: HttpErrorProperties) {
        super(properties);
        this.statusCode = properties.statusCode;
        this.headers = properties.headers;
    }
}
```

### Augmenting Error Types

```typescript
// Extend native Error with custom properties
interface ErrorWithContext extends Error {
    context?: Record<string, unknown>;
    timestamp?: Date;
}

function createErrorWithContext(
    message: string,
    context: Record<string, unknown>
): ErrorWithContext {
    const error = new Error(message) as ErrorWithContext;
    error.context = context;
    error.timestamp = new Date();
    return error;
}
```

## Configuration Types

### Render Options

```typescript
import type { RenderErrorOptions, ColorizeMethod } from "@visulima/error";

const renderConfig: RenderErrorOptions = {
    color: {
        title: (text: string) => `\x1b[31m${text}\x1b[0m`,
        message: (text: string) => `\x1b[31m${text}\x1b[0m`,
        hint: (text: string) => `\x1b[36m${text}\x1b[0m`,
        marker: (text: string) => `\x1b[31m${text}\x1b[0m`,
        method: (text: string) => `\x1b[33m${text}\x1b[0m`,
        fileLine: (text: string) => `\x1b[2m${text}\x1b[0m`
    },
    cwd: process.cwd(),
    displayShortPath: true,
    framesMaxLimit: 10,
    hideErrorCodeView: false,
    hideErrorCauseCodeView: false,
    hideErrorTitle: false,
    hideMessage: false
};
```

### Serialization Options

```typescript
import type { ErrorWithCauseSerializerOptions } from "@visulima/error";

const serializeConfig: ErrorWithCauseSerializerOptions = {
    maxDepth: 10
};

const serialized = serializeError(error, serializeConfig);
```

## Utility Types

### Extract Error Type

```typescript
type ExtractError<T> = T extends (...args: any[]) => infer R
    ? R extends Promise<infer U>
        ? U extends { error: infer E }
            ? E
            : never
        : never
    : never;

async function fetchUser(id: string): Promise<
    { data: User } | { error: UserNotFoundError }
> {
    // Implementation
}

type UserFetchError = ExtractError<typeof fetchUser>;
// Type: UserNotFoundError
```

### Error Union Types

```typescript
type AppError = 
    | ValidationError
    | DatabaseError
    | NetworkError
    | AuthenticationError;

function handleAppError(error: AppError): void {
    switch (error.name) {
        case "ValidationError":
            // TypeScript narrows to ValidationError
            console.log(error.fields);
            break;
        case "DatabaseError":
            // TypeScript narrows to DatabaseError
            console.log(error.query);
            break;
        case "NetworkError":
            // TypeScript narrows to NetworkError
            break;
        case "AuthenticationError":
            // TypeScript narrows to AuthenticationError
            console.log(error.code);
            break;
    }
}
```

## Async Error Handling

### Typed Async Functions

```typescript
async function safeAsync<T, E extends Error = Error>(
    fn: () => Promise<T>
): Promise<[T, null] | [null, E]> {
    try {
        const result = await fn();
        return [result, null];
    } catch (error) {
        return [null, error as E];
    }
}

// Usage
const [data, error] = await safeAsync(async () => {
    return await fetchUserData();
});

if (error) {
    console.error(error);
} else {
    console.log(data);
}
```

### Promise Error Handling

```typescript
type AsyncResult<T, E extends Error = Error> = Promise<
    | { success: true; data: T }
    | { success: false; error: E }
>;

async function fetchWithResult<T>(
    url: string
): AsyncResult<T, NetworkError> {
    try {
        const response = await fetch(url);
        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        return {
            success: false,
            error: new NetworkError("Fetch failed", error)
        };
    }
}

// Usage
const result = await fetchWithResult<User>("/api/user");

if (result.success) {
    console.log(result.data); // Type-safe: User
} else {
    console.error(result.error); // Type-safe: NetworkError
}
```

## Strict Type Checking

### Enable Strict Mode

In your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

### Strict Error Handling

```typescript
function strictErrorHandler(error: unknown): asserts error is Error {
    if (!(error instanceof Error)) {
        throw new TypeError(
            `Expected Error, got ${typeof error}: ${String(error)}`
        );
    }
}

try {
    throw "string error"; // Anti-pattern
} catch (error) {
    strictErrorHandler(error); // TypeScript error!
    // error is now typed as Error
    console.log(error.message);
}
```

## Best Practices

### 1. Use Type Imports

```typescript
// Good - Only imports types (removed in JS output)
import type { ErrorProperties } from "@visulima/error";

// Acceptable - Imports both types and runtime code
import { ErrorProperties, VisulimaError } from "@visulima/error";
```

### 2. Define Interfaces for Error Options

```typescript
interface CreateUserErrorOptions {
    email: string;
    reason: string;
    cause?: unknown;
}

function createUserError(options: CreateUserErrorOptions): VisulimaError {
    return new VisulimaError({
        name: "CreateUserError",
        message: `Failed to create user: ${options.reason}`,
        cause: options.cause
    });
}
```

### 3. Use Discriminated Unions

```typescript
type Result<T, E> = 
    | { ok: true; value: T }
    | { ok: false; error: E };

function processResult<T>(result: Result<T, Error>): T {
    if (result.ok) {
        return result.value;
    } else {
        throw result.error;
    }
}
```

### 4. Type Error Contexts

```typescript
interface ErrorContext {
    userId?: string;
    requestId?: string;
    timestamp: Date;
    environment: string;
}

class ContextualError extends VisulimaError {
    public readonly context: ErrorContext;
    
    constructor(
        message: string,
        context: Partial<ErrorContext> = {}
    ) {
        super({ name: "ContextualError", message });
        
        this.context = {
            timestamp: new Date(),
            environment: process.env.NODE_ENV || "development",
            ...context
        };
    }
}
```

## See Also

- [API Reference](./api-reference.md)
- [Custom Error Classes](./custom-errors.md)
- [Examples](./examples.md)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
