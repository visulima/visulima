# Utility Functions

Helper functions for JSON parsing, validation, and path conversion.

## parseJson

Parses a JSON string with enhanced error messages including code frames showing the exact location of syntax errors.

### Signature

```typescript
function parseJson<T = unknown>(
    text: string,
    options?: {
        source?: string;
        color?: CodeFrameOptions;
    }
): T
```

### Parameters

- `text` (`string`) - JSON string to parse
- `options` - Optional parsing options
  - `source` (`string`) - Source identifier for error messages
  - `color` (`CodeFrameOptions`) - Color options for error messages

### Returns

`T` - Parsed JSON data

### Examples

```typescript
import { parseJson } from "@visulima/fs/utils";

// Basic parsing
const data = parseJson('{"name": "example", "version": "1.0.0"}');

// With source for better error messages
const config = parseJson(jsonString, {
    source: "config.json",
});

// Error handling
try {
    const invalid = parseJson('{"broken": }', {
        source: "broken.json",
    });
} catch (error) {
    console.error(error.message);
    // Output includes:
    // JSON parsing failed in broken.json at line 1, column 12:
    //   1 | {"broken": }
    //     |            ^
    // Unexpected token } in JSON
}
```

### Error Messages

Enhanced error messages include:
- File source (if provided)
- Line and column numbers
- Code frame showing the error location
- Original error message

## stripJsonComments

Removes single-line and multi-line comments from JSON strings.

### Signature

```typescript
function stripJsonComments(
    text: string,
    options?: {
        whitespace?: boolean;
    }
): string
```

### Parameters

- `text` (`string`) - JSON string with comments
- `options` - Optional stripping options
  - `whitespace` (`boolean`) - Replace comments with whitespace (default: `true`)

### Returns

`string` - JSON string without comments

### Examples

```typescript
import { stripJsonComments } from "@visulima/fs/utils";

// Single-line comments
const json1 = stripJsonComments(`
{
    // This is a comment
    "name": "example"
}
`);

// Multi-line comments
const json2 = stripJsonComments(`
{
    /* This is a
       multi-line comment */
    "name": "example"
}
`);

// Mixed comments
const json3 = stripJsonComments(`
{
    // Single line
    "name": "example", /* inline comment */
    "version": "1.0.0"
}
`);

// Parse after stripping
const data = JSON.parse(stripJsonComments(jsonWithComments));

// Preserve whitespace (default: true)
const cleaned = stripJsonComments(json, { whitespace: true });

// Remove whitespace
const compact = stripJsonComments(json, { whitespace: false });
```

### Supported Comment Styles

- Single-line: `// comment`
- Multi-line: `/* comment */`
- Inline: `"key": "value" // comment`

### Notes

- Comments within strings are preserved
- Whitespace preservation maintains line/column positions for error messages

## assertValidFileContents

Validates that file contents are not empty or whitespace-only.

### Signature

```typescript
function assertValidFileContents(
    contents: Buffer | string | Uint8Array
): void
```

### Parameters

- `contents` (`Buffer | string | Uint8Array`) - File contents to validate

### Throws

Throws an error if contents are empty or whitespace-only.

### Examples

```typescript
import { assertValidFileContents } from "@visulima/fs/utils";

// Valid content
assertValidFileContents("Hello, World!"); // OK
assertValidFileContents(Buffer.from("data")); // OK

// Invalid content
try {
    assertValidFileContents(""); // Throws
} catch (error) {
    console.error("Contents are empty");
}

try {
    assertValidFileContents("   \n  \t  "); // Throws
} catch (error) {
    console.error("Contents are whitespace only");
}

// Usage in file operations
import { readFile } from "@visulima/fs";

async function readNonEmptyFile(path: string) {
    const contents = await readFile(path);
    assertValidFileContents(contents);
    return contents;
}
```

## assertValidFileOrDirectoryPath

Validates that a path is a non-empty string.

### Signature

```typescript
function assertValidFileOrDirectoryPath(
    path: string
): void
```

### Parameters

- `path` (`string`) - Path to validate

### Throws

Throws an error if path is empty or not a string.

### Examples

```typescript
import { assertValidFileOrDirectoryPath } from "@visulima/fs/utils";

// Valid paths
assertValidFileOrDirectoryPath("./file.txt"); // OK
assertValidFileOrDirectoryPath("/absolute/path"); // OK
assertValidFileOrDirectoryPath("relative/path"); // OK

// Invalid paths
try {
    assertValidFileOrDirectoryPath(""); // Throws
} catch (error) {
    console.error("Path is empty");
}

// Usage in functions
async function processFile(path: string) {
    assertValidFileOrDirectoryPath(path);
    // Process file...
}
```

## toPath

Converts a URL or string to a file system path.

### Signature

```typescript
function toPath(
    urlOrPath: URL | string
): string
```

### Parameters

- `urlOrPath` (`URL | string`) - URL or path to convert

### Returns

`string` - File system path

### Examples

```typescript
import { toPath } from "@visulima/fs/utils";

// String path (returned as-is)
const path1 = toPath("./file.txt");
console.log(path1); // "./file.txt"

// File URL
const path2 = toPath(new URL("file:///path/to/file.txt"));
console.log(path2); // "/path/to/file.txt" (Unix) or "C:\path\to\file.txt" (Windows)

// URL string
const path3 = toPath("file:///path/to/file.txt");
console.log(path3); // "/path/to/file.txt"

// Usage with file operations
import { readFile } from "@visulima/fs";

async function readFromUrlOrPath(input: URL | string) {
    const path = toPath(input);
    return await readFile(path);
}

await readFromUrlOrPath(new URL("file:///path/to/file.txt"));
await readFromUrlOrPath("./file.txt");
```

## Common Patterns

### Safe JSON Parsing with Comments

```typescript
import { stripJsonComments, parseJson } from "@visulima/fs/utils";

function parseJsonWithComments(text: string, source?: string) {
    const cleaned = stripJsonComments(text);
    return parseJson(cleaned, { source });
}

// Usage
const config = parseJsonWithComments(`
{
    // Application config
    "name": "my-app",
    /* Environment settings */
    "env": "production"
}
`, "config.json");
```

### Validating File Input

```typescript
import {
    assertValidFileContents,
    assertValidFileOrDirectoryPath,
} from "@visulima/fs/utils";

async function processFile(path: string, contents: string) {
    // Validate inputs
    assertValidFileOrDirectoryPath(path);
    assertValidFileContents(contents);
    
    // Process file...
}

try {
    await processFile("", "data"); // Throws: invalid path
} catch (error) {
    console.error(error.message);
}

try {
    await processFile("./file.txt", ""); // Throws: invalid contents
} catch (error) {
    console.error(error.message);
}
```

### URL-Safe File Operations

```typescript
import { toPath } from "@visulima/fs/utils";
import { readFile, writeFile } from "@visulima/fs";

async function copyFile(
    source: URL | string,
    dest: URL | string
): Promise<void> {
    const sourcePath = toPath(source);
    const destPath = toPath(dest);
    
    const contents = await readFile(sourcePath);
    await writeFile(destPath, contents);
}

// Works with URLs and paths
await copyFile(
    new URL("file:///source/file.txt"),
    "./dest/file.txt"
);
```

### Configuration Parser

```typescript
import { readFile } from "@visulima/fs";
import { stripJsonComments, parseJson } from "@visulima/fs/utils";

async function loadConfig<T = unknown>(path: string): Promise<T> {
    const contents = await readFile(path);
    const cleaned = stripJsonComments(contents);
    
    return parseJson<T>(cleaned, {
        source: path,
    });
}

interface AppConfig {
    name: string;
    port: number;
}

const config = await loadConfig<AppConfig>("./config.json");
```

### Input Validation Wrapper

```typescript
import {
    assertValidFileContents,
    assertValidFileOrDirectoryPath,
} from "@visulima/fs/utils";

function validateFileInput(
    path: string,
    contents: Buffer | string | Uint8Array
): void {
    const errors: string[] = [];
    
    try {
        assertValidFileOrDirectoryPath(path);
    } catch (error) {
        errors.push(`Invalid path: ${error.message}`);
    }
    
    try {
        assertValidFileContents(contents);
    } catch (error) {
        errors.push(`Invalid contents: ${error.message}`);
    }
    
    if (errors.length > 0) {
        throw new Error(errors.join("; "));
    }
}

// Usage
try {
    validateFileInput("./file.txt", "Hello");
} catch (error) {
    console.error(error.message);
}
```

### Enhanced JSON Error Reporting

```typescript
import { parseJson } from "@visulima/fs/utils";
import { readFile } from "@visulima/fs";

async function loadAndParseJson<T>(path: string): Promise<T> {
    const contents = await readFile(path);
    
    try {
        return parseJson<T>(contents, {
            source: path,
        });
    } catch (error) {
        console.error(`Failed to parse ${path}:`);
        console.error(error.message);
        
        // Re-throw or return default
        throw error;
    }
}

// Enhanced error messages help locate issues quickly
try {
    const data = await loadAndParseJson("./broken.json");
} catch (error) {
    // Error includes file name, line, column, and code frame
}
```

## Type Definitions

### CodeFrameOptions

```typescript
type CodeFrameOptions = {
    color?: {
        gutter?: (value: string) => string;
        marker?: (value: string) => string;
        message?: (value: string) => string;
    };
};
```

### CodeFrameLocation

```typescript
type CodeFrameLocation = {
    line: number;
    column?: number;
};
```

## Error Handling

All utility functions can throw errors. Handle them appropriately:

```typescript
import {
    parseJson,
    stripJsonComments,
    assertValidFileContents,
} from "@visulima/fs/utils";
import { JSONError } from "@visulima/fs/error";

try {
    // Parsing
    const data = parseJson(jsonString);
    
    // Validation
    assertValidFileContents(data);
} catch (error) {
    if (error instanceof JSONError) {
        console.error("JSON error:", error.message);
        console.error(error.codeFrame);
    } else {
        console.error("Validation error:", error.message);
    }
}
```

## Best Practices

1. **Use parseJson over JSON.parse** for better error messages
2. **Strip comments before parsing** JSON with comments
3. **Validate inputs** before file operations
4. **Use toPath** for consistent URL handling
5. **Preserve whitespace** when stripping comments for better error reporting

## Related

- [JSON Operations](./json-operations.md)
- [Error Types](./error-types.md)
- [File Operations](./file-operations.md)
