# API Reference

Complete API documentation for `@visulima/error`.

## Core Classes

### VisulimaError

Enhanced error class with additional properties and methods.

```typescript
class VisulimaError extends Error {
    constructor(properties: ErrorProperties);
    
    // Properties
    loc?: ErrorLocation;
    title?: string;
    hint?: ErrorHint;
    type: "VisulimaError";
    
    // Methods
    setLocation(location: ErrorLocation): void;
    setName(name: string): void;
    setMessage(message: string): void;
    setHint(hint: ErrorHint): void;
}
```

#### ErrorProperties

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
```

#### ErrorLocation

```typescript
interface ErrorLocation {
    file?: string;
    line?: number;
    column?: number;
}
```

#### ErrorHint

```typescript
type ErrorHint = string | string[];
```

### NonError

Wrapper class for non-error objects during deserialization.

```typescript
class NonError extends Error {
    constructor(message: string);
}
```

## Error Functions

### isVisulimaError

Check if an error is a VisulimaError instance.

```typescript
function isVisulimaError(error: unknown): error is VisulimaError;
```

**Parameters:**
- `error`: Value to check

**Returns:** `true` if the error is a VisulimaError

**Example:**
```typescript
import { isVisulimaError, VisulimaError } from "@visulima/error";

const error = new VisulimaError({ name: "Error", message: "Test" });
console.log(isVisulimaError(error)); // true
```

### getErrorCauses

Extract all causes from an error chain.

```typescript
function getErrorCauses(error: Error): SerializedError[];
```

**Parameters:**
- `error`: The error to extract causes from

**Returns:** Array of serialized error objects

**Example:**
```typescript
import { getErrorCauses } from "@visulima/error";

const error = new Error("Top", { 
    cause: new Error("Middle", { 
        cause: new Error("Root") 
    }) 
});

const causes = getErrorCauses(error);
console.log(causes.length); // 3
```

### renderError

Render an error with pretty formatting.

```typescript
function renderError(
    error: Error | AggregateError | VisulimaError,
    options?: RenderErrorOptions
): string;
```

**Parameters:**
- `error`: The error to render
- `options`: Optional rendering configuration

**Options:**
```typescript
interface RenderErrorOptions {
    color?: {
        title?: ColorizeMethod;
        message?: ColorizeMethod;
        hint?: ColorizeMethod;
        marker?: ColorizeMethod;
        method?: ColorizeMethod;
        fileLine?: ColorizeMethod;
    };
    cwd?: string;
    displayShortPath?: boolean;
    framesMaxLimit?: number;
    hideErrorCauseCodeView?: boolean;
    hideErrorCodeView?: boolean;
    hideErrorTitle?: boolean;
    hideMessage?: boolean;
}
```

**Returns:** Formatted error string

**Example:**
```typescript
import { renderError } from "@visulima/error";
import { red, cyan } from "@visulima/colorize";

const output = renderError(error, {
    color: {
        title: red,
        hint: cyan
    },
    displayShortPath: true,
    framesMaxLimit: 5
});
```

### captureRawStackTrace

Capture a raw stack trace at the current location.

```typescript
function captureRawStackTrace(skip?: number): string;
```

**Parameters:**
- `skip`: Number of stack frames to skip (default: 0)

**Returns:** Raw stack trace string

**Example:**
```typescript
import { captureRawStackTrace } from "@visulima/error";

const stack = captureRawStackTrace(1); // Skip current frame
console.log(stack);
```

## Serialization Functions

### serializeError

Serialize an error into a plain object.

```typescript
function serializeError(
    error: unknown,
    options?: ErrorWithCauseSerializerOptions
): SerializedError | unknown;
```

**Parameters:**
- `error`: The error to serialize
- `options`: Optional serialization configuration

**Options:**
```typescript
interface ErrorWithCauseSerializerOptions {
    maxDepth?: number; // Default: Infinity
}
```

**Returns:** Serialized error object

**Example:**
```typescript
import { serializeError } from "@visulima/error";

const error = new TypeError("Invalid");
const serialized = serializeError(error);
const json = JSON.stringify(serialized);
```

### deserializeError

Deserialize a plain object back into an Error instance.

```typescript
function deserializeError(
    value: unknown,
    options?: { maxDepth?: number }
): Error;
```

**Parameters:**
- `value`: The serialized error object
- `options`: Optional deserialization configuration

**Returns:** Reconstructed Error instance

**Example:**
```typescript
import { deserializeError } from "@visulima/error";

const parsed = JSON.parse(jsonString);
const error = deserializeError(parsed);
console.log(error instanceof Error); // true
```

### addKnownErrorConstructor

Register a custom error constructor for proper deserialization.

```typescript
function addKnownErrorConstructor(
    constructor: new (...args: unknown[]) => Error
): void;
```

**Parameters:**
- `constructor`: The error constructor to register

**Example:**
```typescript
import { addKnownErrorConstructor, deserializeError } from "@visulima/error";

class CustomError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CustomError";
    }
}

addKnownErrorConstructor(CustomError);

const deserialized = deserializeError({ 
    name: "CustomError", 
    message: "Test" 
});

console.log(deserialized instanceof CustomError); // true
```

### isErrorLike

Check if an object resembles a serialized error.

```typescript
function isErrorLike(value: unknown): boolean;
```

**Parameters:**
- `value`: Value to check

**Returns:** `true` if the value looks like a serialized error

**Example:**
```typescript
import { isErrorLike } from "@visulima/error";

console.log(isErrorLike({ name: "Error", message: "Test" })); // true
console.log(isErrorLike({ foo: "bar" })); // false
```

## Stack Trace Functions

### parseStacktrace

Parse an error stack trace into structured frames.

```typescript
function parseStacktrace(
    error: Error,
    options?: ParseOptions
): Trace[];
```

**Parameters:**
- `error`: The error to parse
- `options`: Optional parsing configuration

**Options:**
```typescript
interface ParseOptions {
    filter?: (frame: Trace) => boolean;
    frameLimit?: number;
}
```

**Returns:** Array of parsed stack frames

**Trace Type:**
```typescript
interface Trace {
    file?: string;
    methodName?: string;
    line?: number;
    column?: number;
    type?: TraceType;
    evalOrigin?: string;
    raw: string;
}

type TraceType = "eval" | "native" | "internal" | undefined;
```

**Example:**
```typescript
import { parseStacktrace } from "@visulima/error";

const error = new Error("Test");
const frames = parseStacktrace(error, {
    filter: (frame) => !frame.file?.includes("node_modules"),
    frameLimit: 10
});
```

### formatStacktrace

Format parsed stack frames back into a string.

```typescript
function formatStacktrace(
    frames: Trace[],
    options?: { header?: { name?: string; message?: string } }
): string;
```

**Parameters:**
- `frames`: Array of parsed frames
- `options`: Optional formatting configuration

**Returns:** Formatted stack trace string

**Example:**
```typescript
import { parseStacktrace, formatStacktrace } from "@visulima/error";

const error = new Error("Boom");
const frames = parseStacktrace(error);

const formatted = formatStacktrace(frames, {
    header: { name: error.name, message: error.message }
});

console.log(formatted);
```

### formatStackFrameLine

Format a single stack frame into a string.

```typescript
function formatStackFrameLine(frame: Trace): string;
```

**Parameters:**
- `frame`: The frame to format

**Returns:** Formatted frame string

**Example:**
```typescript
import { parseStacktrace, formatStackFrameLine } from "@visulima/error";

const frames = parseStacktrace(new Error("Test"));
const firstLine = formatStackFrameLine(frames[0]);
// "    at functionName (/path/to/file.js:10:5)"
```

## Code Frame Functions

### codeFrame

Generate a formatted code frame with error highlighting.

```typescript
function codeFrame(
    source: string,
    location: CodeFrameLocation,
    options?: CodeFrameOptions
): string;
```

**Parameters:**
- `source`: Source code string
- `location`: Error location
- `options`: Optional formatting configuration

**Types:**
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
    linesAbove?: number; // Default: 2
    linesBelow?: number; // Default: 3
    tabWidth?: number | false; // Default: 4
    colorize?: ColorizeMethod;
}
```

**Returns:** Formatted code frame string

**Example:**
```typescript
import { codeFrame } from "@visulima/error";

const source = "const x = 10;\nconst y = x.z;\n";

const frame = codeFrame(source, {
    start: { line: 2, column: 13 }
}, {
    linesAbove: 1,
    linesBelow: 1
});

console.log(frame);
//   1 | const x = 10;
// > 2 | const y = x.z;
//     |             ^
```

### indexToLineColumn

Convert a string index to line and column numbers.

```typescript
function indexToLineColumn(
    source: string,
    index: number
): { line: number; column: number };
```

**Parameters:**
- `source`: Source code string
- `index`: Character index

**Returns:** Line and column position

**Example:**
```typescript
import { indexToLineColumn } from "@visulima/error";

const source = "hello\nworld";
const pos = indexToLineColumn(source, 7);
console.log(pos); // { line: 2, column: 2 }
```

## Solution Finder Functions

### ruleBasedFinder

Finder that provides rule-based error solutions.

```typescript
const ruleBasedFinder: SolutionFinder;

interface SolutionFinder {
    handle(error: SolutionError, file: SolutionFinderFile): Promise<Solution | undefined>;
}
```

**Example:**
```typescript
import { ruleBasedFinder } from "@visulima/error";

const solution = await ruleBasedFinder.handle(
    error,
    { file: "/path/to/file.js", line: 10, language: "js", snippet: "..." }
);
```

### errorHintFinder

Finder that reads hints from error.hint property.

```typescript
const errorHintFinder: SolutionFinder;
```

**Example:**
```typescript
import { errorHintFinder } from "@visulima/error";

const error = new Error("Failed") as Error & { hint?: unknown };
error.hint = "Check your configuration";

const solution = await errorHintFinder.handle(error, { file: "", line: 0 });
```

### aiFinder

Create an AI-powered solution finder (requires `ai` package).

```typescript
function aiFinder(
    model: LanguageModel,
    options?: { temperature?: number }
): SolutionFinder;
```

**Example:**
```typescript
import { aiFinder } from "@visulima/error/solution/ai";
import { createOpenAI } from "@ai-sdk/openai";

const client = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const finder = aiFinder(client("gpt-4"), { temperature: 0 });

const solution = await finder.handle(error, fileContext);
```

## AI Integration Functions

### aiPrompt

Generate an AI prompt for error analysis.

```typescript
function aiPrompt(context: {
    error: Error;
    file: SolutionFinderFile;
    applicationType?: string;
}): string;
```

**Parameters:**
- `context`: Error and file context

**Returns:** Formatted prompt string

**Example:**
```typescript
import { aiPrompt } from "@visulima/error/solution/ai";

const prompt = aiPrompt({
    error,
    file: { file: "/path/to/file.js", line: 10, snippet: "..." }
});

// Send prompt to your LLM...
```

### aiSolutionResponse

Format AI response into HTML.

```typescript
function aiSolutionResponse(text: string): string;
```

**Parameters:**
- `text`: AI response text

**Returns:** Formatted HTML string

**Example:**
```typescript
import { aiSolutionResponse } from "@visulima/error/solution/ai";

const llmResponse = "Try checking your...";
const html = aiSolutionResponse(llmResponse);
```

## Type Exports

All TypeScript types are exported and available for use:

```typescript
import type {
    // Error types
    ErrorProperties,
    ErrorLocation,
    ErrorHint,
    SerializedError,
    RenderErrorOptions,
    ErrorWithCauseSerializerOptions,
    
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

## Constants

### CODE_FRAME_POINTER

The character used to point to error locations in code frames.

```typescript
const CODE_FRAME_POINTER: "^";
```

**Example:**
```typescript
import { CODE_FRAME_POINTER } from "@visulima/error";

console.log(CODE_FRAME_POINTER); // "^"
```
