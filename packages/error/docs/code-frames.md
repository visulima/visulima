# Code Frames

Learn how to generate and display code frames that highlight error locations in source code.

## Overview

Code frames provide visual context for errors by displaying source code snippets with highlighted error locations. They're particularly useful for:

- Debugging syntax errors
- Displaying runtime errors in context
- Developer tools and error messages
- Test failure reports

## Basic Usage

### Simple Code Frame

```typescript
import { codeFrame } from "@visulima/error";

const sourceCode = `const x = 10;
const error = x.y;
console.log(error);`;

const frame = codeFrame(sourceCode, {
    start: { line: 2, column: 16 }
});

console.log(frame);
```

Output:
```
  1 | const x = 10;
> 2 | const error = x.y;
    |                ^
  3 | console.log(error);
```

### Highlighting a Range

```typescript
const frame = codeFrame(sourceCode, {
    start: { line: 2, column: 1 },
    end: { line: 2, column: 18 }
});

console.log(frame);
```

Output:
```
  1 | const x = 10;
> 2 | const error = x.y;
    | ^^^^^^^^^^^^^^^^^
  3 | console.log(error);
```

### Multi-Line Highlighting

```typescript
const code = `function example() {
    const a = 1;
    const b = 2;
    return a + b;
}`;

const frame = codeFrame(code, {
    start: { line: 2, column: 5 },
    end: { line: 3, column: 16 }
});

console.log(frame);
```

Output:
```
  1 | function example() {
> 2 |     const a = 1;
    |     ^^^^^^^^^^^^
> 3 |     const b = 2;
    | ^^^^^^^^^^^^^^^^
  4 |     return a + b;
```

## Configuration Options

### linesAbove

Number of lines to show above the error location.

```typescript
const frame = codeFrame(sourceCode, 
    { start: { line: 5, column: 1 } },
    { linesAbove: 1 }  // Show only 1 line above
);
```

Default: `2`

### linesBelow

Number of lines to show below the error location.

```typescript
const frame = codeFrame(sourceCode,
    { start: { line: 5, column: 1 } },
    { linesBelow: 1 }  // Show only 1 line below
);
```

Default: `3`

### tabWidth

Width of tab characters in spaces. Set to `false` to disable tab-to-space conversion.

```typescript
// Convert tabs to 2 spaces
const frame = codeFrame(sourceCode,
    { start: { line: 2, column: 1 } },
    { tabWidth: 2 }
);

// Don't convert tabs
const frame = codeFrame(sourceCode,
    { start: { line: 2, column: 1 } },
    { tabWidth: false }
);
```

Default: `4`

### colorize

Function to colorize the output.

```typescript
import { codeFrame } from "@visulima/error";
import { red } from "@visulima/colorize";

const frame = codeFrame(sourceCode,
    { start: { line: 2, column: 16 } },
    { colorize: red }
);
```

## Advanced Usage

### Custom Context Size

```typescript
const frame = codeFrame(sourceCode,
    { start: { line: 10, column: 5 } },
    {
        linesAbove: 5,   // Show 5 lines before
        linesBelow: 5    // Show 5 lines after
    }
);
```

### Minimal Context

For compact error messages:

```typescript
const frame = codeFrame(sourceCode,
    { start: { line: 10, column: 5 } },
    {
        linesAbove: 0,   // No lines above
        linesBelow: 0    // No lines below
    }
);
```

### Full File Display

```typescript
const frame = codeFrame(sourceCode,
    { start: { line: 10, column: 5 } },
    {
        linesAbove: Infinity,
        linesBelow: Infinity
    }
);
```

## Working with Files

### Read File and Generate Frame

```typescript
import { codeFrame } from "@visulima/error";
import { readFileSync } from "fs";

function showErrorInFile(filePath: string, line: number, column: number) {
    const source = readFileSync(filePath, "utf-8");
    
    return codeFrame(source, {
        start: { line, column }
    });
}

console.log(showErrorInFile("./src/app.ts", 42, 10));
```

### Async File Reading

```typescript
import { codeFrame } from "@visulima/error";
import { readFile } from "fs/promises";

async function generateFrameAsync(filePath: string, line: number, column: number) {
    const source = await readFile(filePath, "utf-8");
    
    return codeFrame(source, {
        start: { line, column }
    }, {
        linesAbove: 3,
        linesBelow: 3
    });
}
```

## Integration with Errors

### Extract Location from Error

```typescript
import { codeFrame, parseStacktrace } from "@visulima/error";
import { readFileSync } from "fs";

function showErrorWithContext(error: Error) {
    const frames = parseStacktrace(error);
    const topFrame = frames[0];
    
    if (!topFrame?.file) {
        return error.stack;
    }
    
    const source = readFileSync(topFrame.file, "utf-8");
    const frame = codeFrame(source, {
        start: {
            line: topFrame.line || 1,
            column: topFrame.column || 1
        }
    });
    
    return `${error.message}\n\n${frame}`;
}
```

### VisulimaError Integration

```typescript
import { VisulimaError, codeFrame } from "@visulima/error";
import { readFileSync } from "fs";

class ParseError extends VisulimaError {
    constructor(message: string, filePath: string, line: number, column: number) {
        const source = readFileSync(filePath, "utf-8");
        const frame = codeFrame(source, {
            start: { line, column }
        });
        
        super({
            name: "ParseError",
            message,
            location: { file: filePath, line, column }
        });
        
        this.hint = `Error at ${filePath}:${line}:${column}\n\n${frame}`;
    }
}
```

## Colorized Output

### Basic Colorization

```typescript
import { codeFrame } from "@visulima/error";
import { red, dim } from "@visulima/colorize";

// Colorize error marker
const frame = codeFrame(sourceCode,
    { start: { line: 2, column: 16 } },
    { colorize: red }
);
```

### Custom Color Scheme

```typescript
import { parseStacktrace } from "@visulima/error";
import { red, yellow, cyan, dim } from "@visulima/colorize";

function colorizedFrame(source: string, line: number, column: number) {
    const frame = codeFrame(source, {
        start: { line, column }
    });
    
    // Apply colors to different parts
    const lines = frame.split("\n");
    return lines.map(line => {
        if (line.startsWith(">")) {
            return red(line);
        } else if (line.trim().startsWith("|")) {
            return dim(line);
        }
        return line;
    }).join("\n");
}
```

## Helper Functions

### indexToLineColumn

Convert string index to line and column numbers:

```typescript
import { indexToLineColumn, codeFrame } from "@visulima/error";

const source = "hello\nworld\ntest";
const index = 7; // Character position

const { line, column } = indexToLineColumn(source, index);

const frame = codeFrame(source, {
    start: { line, column }
});
```

### Line/Column from Character Index

```typescript
function showErrorAtIndex(source: string, errorIndex: number) {
    const { line, column } = indexToLineColumn(source, errorIndex);
    
    return codeFrame(source, {
        start: { line, column }
    });
}

const code = "const x = 10;\nconst y = 20;";
console.log(showErrorAtIndex(code, 15)); // Character 15 in the string
```

## Practical Examples

### Syntax Error Reporter

```typescript
import { codeFrame } from "@visulima/error";

interface SyntaxError {
    message: string;
    line: number;
    column: number;
}

function reportSyntaxError(source: string, error: SyntaxError): string {
    const frame = codeFrame(source, {
        start: { line: error.line, column: error.column }
    }, {
        linesAbove: 2,
        linesBelow: 2
    });
    
    return [
        `Syntax Error: ${error.message}`,
        "",
        frame,
        "",
        `at line ${error.line}, column ${error.column}`
    ].join("\n");
}
```

### Test Failure Display

```typescript
import { codeFrame } from "@visulima/error";
import { red, green } from "@visulima/colorize";

function displayTestFailure(
    testCode: string,
    failureLine: number,
    expected: string,
    actual: string
) {
    const frame = codeFrame(testCode, {
        start: { line: failureLine, column: 1 }
    }, {
        linesAbove: 2,
        linesBelow: 2
    });
    
    console.log(red("Test Failed:"));
    console.log(frame);
    console.log();
    console.log(green(`Expected: ${expected}`));
    console.log(red(`Actual:   ${actual}`));
}
```

### Configuration Error Display

```typescript
import { codeFrame } from "@visulima/error";
import { readFileSync } from "fs";

function reportConfigError(
    configPath: string,
    errorLine: number,
    message: string
) {
    const config = readFileSync(configPath, "utf-8");
    const frame = codeFrame(config, {
        start: { line: errorLine, column: 1 }
    });
    
    console.error(`Configuration Error in ${configPath}:`);
    console.error(message);
    console.error();
    console.error(frame);
}
```

### Diff Display

```typescript
import { codeFrame } from "@visulima/error";

function showDiff(
    oldCode: string,
    newCode: string,
    changedLine: number
) {
    const oldFrame = codeFrame(oldCode, {
        start: { line: changedLine, column: 1 }
    });
    
    const newFrame = codeFrame(newCode, {
        start: { line: changedLine, column: 1 }
    });
    
    console.log("Before:");
    console.log(oldFrame);
    console.log("\nAfter:");
    console.log(newFrame);
}
```

## Tab Handling

### Default Tab Behavior

By default, tabs are converted to 4 spaces:

```typescript
const sourceWithTabs = "function test() {\n\tconst x = 10;\n}";

const frame = codeFrame(sourceWithTabs, {
    start: { line: 2, column: 2 }
});
// Tabs will be displayed as 4 spaces
```

### Custom Tab Width

```typescript
const frame = codeFrame(sourceWithTabs, {
    start: { line: 2, column: 2 }
}, {
    tabWidth: 2  // Convert tabs to 2 spaces
});
```

### Preserve Tabs

```typescript
const frame = codeFrame(sourceWithTabs, {
    start: { line: 2, column: 2 }
}, {
    tabWidth: false  // Keep tabs as-is
});
```

## Best Practices

### 1. Appropriate Context Size

```typescript
// For terminal output - moderate context
codeFrame(source, location, {
    linesAbove: 2,
    linesBelow: 3
});

// For file previews - more context
codeFrame(source, location, {
    linesAbove: 5,
    linesBelow: 5
});

// For inline errors - minimal context
codeFrame(source, location, {
    linesAbove: 0,
    linesBelow: 1
});
```

### 2. Error Handling

```typescript
function safeCodeFrame(
    source: string,
    line: number,
    column: number
): string {
    try {
        return codeFrame(source, {
            start: { line, column }
        });
    } catch (error) {
        return `Unable to generate code frame: ${error.message}`;
    }
}
```

### 3. Performance with Large Files

```typescript
function generateFrameFromLargeFile(
    filePath: string,
    line: number,
    column: number
) {
    const source = readFileSync(filePath, "utf-8");
    
    // Use minimal context for large files
    return codeFrame(source, {
        start: { line, column }
    }, {
        linesAbove: 2,
        linesBelow: 2
    });
}
```

## TypeScript Types

```typescript
import type {
    CodeFrameLocation,
    CodeFrameNodeLocation,
    CodeFrameOptions,
    ColorizeMethod
} from "@visulima/error";

const location: CodeFrameLocation = {
    start: { line: 10, column: 5 },
    end: { line: 10, column: 15 }
};

const options: CodeFrameOptions = {
    linesAbove: 2,
    linesBelow: 3,
    tabWidth: 4,
    colorize: (text: string) => text
};
```

## See Also

- [Stack Trace Parsing](./stacktrace.md)
- [Error Rendering](./rendering.md)
- [API Reference](./api-reference.md)
- [Examples](./examples.md)
