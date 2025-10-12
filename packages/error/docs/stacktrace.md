# Stack Trace Parsing

Learn how to parse, format, and work with stack traces using `@visulima/error`.

## Overview

The stack trace module provides functionality to:

- Parse error stack traces into structured data
- Format stack frames back into strings
- Filter and manipulate stack frames
- Support multiple JavaScript engines (V8, SpiderMonkey, JavaScriptCore)

## Browser and Platform Support

Stack trace parsing works across modern platforms:

- Node.js (V8 engine)
- Chrome/Chromium
- Firefox (SpiderMonkey)
- Safari/WebKit (JavaScriptCore)
- Edge (Chromium-based)
- Opera (Chromium-based)

Note: Browsers older than 6 years are not supported.

## Basic Usage

### Parsing a Stack Trace

```typescript
import { parseStacktrace } from "@visulima/error";

const error = new Error("Something went wrong");
const frames = parseStacktrace(error);

console.log(frames);
// [
//   {
//     methodName: "myFunction",
//     file: "file:///path/to/file.js",
//     line: 42,
//     column: 15,
//     type: undefined,
//     raw: "    at myFunction (/path/to/file.js:42:15)"
//   },
//   ...
// ]
```

### Frame Structure

Each parsed frame has the following structure:

```typescript
interface Trace {
    methodName?: string;    // Function or method name
    file?: string;          // File path or URL
    line?: number;          // Line number
    column?: number;        // Column number
    type?: TraceType;       // Frame type
    evalOrigin?: string;    // Original location for eval frames
    raw: string;            // Original stack frame string
}

type TraceType = "eval" | "native" | "internal" | undefined;
```

## Formatting Stack Traces

### Format Complete Stack

```typescript
import { parseStacktrace, formatStacktrace } from "@visulima/error";

const error = new Error("Example");
const frames = parseStacktrace(error);

const formatted = formatStacktrace(frames, {
    header: {
        name: error.name,
        message: error.message
    }
});

console.log(formatted);
// Error: Example
//     at functionName (/path/to/file.js:10:5)
//     at anotherFunction (/path/to/file.js:20:10)
//     ...
```

### Format Single Frame

```typescript
import { parseStacktrace, formatStackFrameLine } from "@visulima/error";

const frames = parseStacktrace(new Error("Test"));
const firstLine = formatStackFrameLine(frames[0]);

console.log(firstLine);
// "    at myFunction (/path/to/file.js:10:5)"
```

### Format Without Header

```typescript
const formatted = formatStacktrace(frames);
// No "Error: message" header, just stack frames
```

## Filtering Stack Frames

### Remove Node Modules

```typescript
import { parseStacktrace } from "@visulima/error";

const error = new Error("Application error");
const frames = parseStacktrace(error, {
    filter: (frame) => {
        return !frame.file?.includes("node_modules");
    }
});
```

### Remove Internal Frames

```typescript
const frames = parseStacktrace(error, {
    filter: (frame) => {
        // Exclude Node.js internals
        if (frame.type === "internal") return false;
        
        // Exclude native code
        if (frame.type === "native") return false;
        
        return true;
    }
});
```

### Keep Only Application Code

```typescript
function isApplicationCode(frame: Trace): boolean {
    if (!frame.file) return false;
    
    // Exclude node_modules
    if (frame.file.includes("node_modules")) return false;
    
    // Exclude Node.js internals
    if (frame.type === "internal" || frame.type === "native") return false;
    
    // Only include your source directory
    return frame.file.includes("/src/");
}

const frames = parseStacktrace(error, {
    filter: isApplicationCode
});
```

### Limit Frame Count

```typescript
const frames = parseStacktrace(error, {
    frameLimit: 10  // Only parse first 10 frames
});
```

## Advanced Usage

### Custom Stack Formatter

Create a custom formatter for specific output formats:

```typescript
import { parseStacktrace, type Trace } from "@visulima/error";

function formatForLogging(error: Error): string {
    const frames = parseStacktrace(error);
    
    const lines = frames.map(frame => {
        const location = frame.file 
            ? `${frame.file}:${frame.line}:${frame.column}`
            : "unknown";
        
        const method = frame.methodName || "<anonymous>";
        
        return `  ${method} (${location})`;
    });
    
    return [
        `Error: ${error.message}`,
        ...lines
    ].join("\n");
}

// Usage
console.log(formatForLogging(new Error("Test")));
```

### Extract Function Names

```typescript
function extractFunctionNames(error: Error): string[] {
    const frames = parseStacktrace(error);
    
    return frames
        .map(frame => frame.methodName)
        .filter((name): name is string => name !== undefined);
}

const functionNames = extractFunctionNames(error);
console.log(functionNames);
// ["processRequest", "handleRoute", "middleware", ...]
```

### Find Specific Frame

```typescript
function findFrameInFile(error: Error, fileName: string): Trace | undefined {
    const frames = parseStacktrace(error);
    
    return frames.find(frame => 
        frame.file?.includes(fileName)
    );
}

const frame = findFrameInFile(error, "app.js");
if (frame) {
    console.log(`Error in ${frame.file} at line ${frame.line}`);
}
```

### Group Frames by File

```typescript
function groupByFile(error: Error): Map<string, Trace[]> {
    const frames = parseStacktrace(error);
    const grouped = new Map<string, Trace[]>();
    
    for (const frame of frames) {
        if (!frame.file) continue;
        
        const existing = grouped.get(frame.file) || [];
        existing.push(frame);
        grouped.set(frame.file, existing);
    }
    
    return grouped;
}

const byFile = groupByFile(error);
byFile.forEach((frames, file) => {
    console.log(`${file}: ${frames.length} frames`);
});
```

## Frame Types

### Understanding Frame Types

```typescript
// undefined: Regular application code
{
    methodName: "myFunction",
    file: "/app/src/index.js",
    line: 10,
    type: undefined
}

// "eval": Code executed via eval()
{
    methodName: "evalCode",
    file: "eval",
    line: 1,
    type: "eval",
    evalOrigin: "/app/src/index.js:20:15"
}

// "native": Native JavaScript functions
{
    methodName: "Array.map",
    type: "native"
}

// "internal": Node.js internal modules
{
    methodName: "Module._compile",
    file: "node:internal/modules/cjs/loader",
    type: "internal"
}
```

### Filtering by Type

```typescript
import { parseStacktrace, type Trace, type TraceType } from "@visulima/error";

function getFramesByType(error: Error, type: TraceType): Trace[] {
    const frames = parseStacktrace(error);
    return frames.filter(frame => frame.type === type);
}

// Get all eval frames
const evalFrames = getFramesByType(error, "eval");

// Get all native frames
const nativeFrames = getFramesByType(error, "native");
```

## Working with File Paths

### Normalize File Paths

```typescript
import { parseStacktrace } from "@visulima/error";
import { resolve, relative } from "path";

function normalizeFramePaths(error: Error, baseDir: string): Trace[] {
    const frames = parseStacktrace(error);
    
    return frames.map(frame => {
        if (!frame.file) return frame;
        
        // Convert file URLs to paths
        let filePath = frame.file;
        if (filePath.startsWith("file://")) {
            filePath = new URL(filePath).pathname;
        }
        
        // Make relative to base directory
        const relativePath = relative(baseDir, filePath);
        
        return {
            ...frame,
            file: relativePath
        };
    });
}
```

### Extract File Extensions

```typescript
function groupByFileType(error: Error): Map<string, Trace[]> {
    const frames = parseStacktrace(error);
    const groups = new Map<string, Trace[]>();
    
    for (const frame of frames) {
        if (!frame.file) continue;
        
        const ext = frame.file.split(".").pop() || "unknown";
        const existing = groups.get(ext) || [];
        existing.push(frame);
        groups.set(ext, existing);
    }
    
    return groups;
}

const byType = groupByFileType(error);
console.log(`TypeScript frames: ${byType.get("ts")?.length || 0}`);
console.log(`JavaScript frames: ${byType.get("js")?.length || 0}`);
```

## Integration Examples

### Express.js Middleware

```typescript
import express from "express";
import { parseStacktrace } from "@visulima/error";

const app = express();

app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const frames = parseStacktrace(error, {
        filter: frame => !frame.file?.includes("node_modules"),
        frameLimit: 5
    });
    
    console.error(`Error: ${error.message}`);
    frames.forEach(frame => {
        console.error(`  at ${frame.methodName || "anonymous"} (${frame.file}:${frame.line})`);
    });
    
    res.status(500).json({
        error: error.message,
        stack: frames.map(frame => ({
            method: frame.methodName,
            file: frame.file,
            line: frame.line
        }))
    });
});
```

### Error Reporting

```typescript
import { parseStacktrace } from "@visulima/error";

interface ErrorReport {
    message: string;
    timestamp: Date;
    stack: Array<{
        method: string;
        location: string;
    }>;
}

function createErrorReport(error: Error): ErrorReport {
    const frames = parseStacktrace(error, {
        filter: frame => !frame.file?.includes("node_modules"),
        frameLimit: 10
    });
    
    return {
        message: error.message,
        timestamp: new Date(),
        stack: frames.map(frame => ({
            method: frame.methodName || "<anonymous>",
            location: `${frame.file || "unknown"}:${frame.line || 0}`
        }))
    };
}
```

### Test Helpers

```typescript
import { parseStacktrace } from "@visulima/error";

export function getCallerInfo() {
    const error = new Error();
    const frames = parseStacktrace(error);
    
    // Skip Error constructor and this function
    const caller = frames[2];
    
    return {
        file: caller?.file,
        line: caller?.line,
        function: caller?.methodName
    };
}

// Usage in tests
function testSomething() {
    const caller = getCallerInfo();
    console.log(`Called from ${caller.file}:${caller.line}`);
}
```

## Performance Considerations

### Parse Once, Use Multiple Times

```typescript
// Good - parse once
const frames = parseStacktrace(error);
const filtered = frames.filter(f => !f.file?.includes("node_modules"));
const formatted = formatStacktrace(filtered);

// Avoid - parsing multiple times
const formatted1 = formatStacktrace(parseStacktrace(error));
const filtered = parseStacktrace(error).filter(...);
```

### Use Frame Limits for Large Stacks

```typescript
// For display purposes, limit frames
const frames = parseStacktrace(error, {
    frameLimit: 20  // Only parse first 20 frames
});
```

### Cache Parsed Results

```typescript
const errorCache = new WeakMap<Error, Trace[]>();

function getCachedFrames(error: Error): Trace[] {
    if (!errorCache.has(error)) {
        errorCache.set(error, parseStacktrace(error));
    }
    return errorCache.get(error)!;
}
```

## See Also

- [Error Rendering](./rendering.md)
- [Code Frames](./code-frames.md)
- [API Reference](./api-reference.md)
- [Examples](./examples.md)
