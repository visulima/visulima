# API Reference

Complete API documentation for @visulima/fs.

## Table of Contents

### Core Modules

1. [File Operations](./file-operations.md) - Read, write, and move files
2. [Directory Operations](./directory-operations.md) - Create, ensure, and manage directories
3. [JSON Operations](./json-operations.md) - Read and write JSON files
4. [YAML Operations](./yaml-operations.md) - Read and write YAML files
5. [File Discovery](./file-discovery.md) - Walk directories and find files
6. [Size Utilities](./size-utilities.md) - Calculate file sizes with compression
7. [EOL Utilities](./eol-utilities.md) - Detect and format line endings
8. [Utility Functions](./utility-functions.md) - Helper functions and utilities
9. [Error Types](./error-types.md) - Custom error classes

## Function Overview

### File Operations

| Function | Description | Async |
|----------|-------------|-------|
| `readFile` | Read file contents | Yes |
| `readFileSync` | Read file contents synchronously | No |
| `writeFile` | Write content to a file | Yes |
| `writeFileSync` | Write content to a file synchronously | No |
| `move` | Move or rename a file | Yes |
| `moveSync` | Move or rename a file synchronously | No |
| `rename` | Alias for `move` | Yes |
| `renameSync` | Alias for `moveSync` | No |
| `remove` | Remove files or directories | Yes |
| `removeSync` | Remove files or directories synchronously | No |
| `isAccessible` | Check if a path is accessible | Yes |
| `isAccessibleSync` | Check if a path is accessible synchronously | No |

### Directory Operations

| Function | Description | Async |
|----------|-------------|-------|
| `ensureDir` | Ensure a directory exists | Yes |
| `ensureDirSync` | Ensure a directory exists synchronously | No |
| `ensureFile` | Ensure a file exists | Yes |
| `ensureFileSync` | Ensure a file exists synchronously | No |
| `ensureLink` | Ensure a hard link exists | Yes |
| `ensureLinkSync` | Ensure a hard link exists synchronously | No |
| `ensureSymlink` | Ensure a symbolic link exists | Yes |
| `ensureSymlinkSync` | Ensure a symbolic link exists synchronously | No |
| `emptyDir` | Empty a directory | Yes |
| `emptyDirSync` | Empty a directory synchronously | No |

### JSON Operations

| Function | Description | Async |
|----------|-------------|-------|
| `readJson` | Read and parse a JSON file | Yes |
| `readJsonSync` | Read and parse a JSON file synchronously | No |
| `writeJson` | Stringify and write a JSON file | Yes |
| `writeJsonSync` | Stringify and write a JSON file synchronously | No |
| `parseJson` | Parse JSON string with better errors | N/A |
| `stripJsonComments` | Remove comments from JSON strings | N/A |

### YAML Operations

| Function | Description | Async |
|----------|-------------|-------|
| `readYaml` | Read and parse a YAML file | Yes |
| `readYamlSync` | Read and parse a YAML file synchronously | No |
| `writeYaml` | Stringify and write a YAML file | Yes |
| `writeYamlSync` | Stringify and write a YAML file synchronously | No |

### File Discovery

| Function | Description | Async |
|----------|-------------|-------|
| `walk` | Walk a directory tree | Yes |
| `walkSync` | Walk a directory tree synchronously | No |
| `collect` | Collect all entries from a directory | Yes |
| `collectSync` | Collect all entries from a directory synchronously | No |
| `findUp` | Find a file by walking up the directory tree | Yes |
| `findUpSync` | Find a file by walking up synchronously | No |

### Size Utilities

| Function | Description | Async |
|----------|-------------|-------|
| `gzipSize` | Calculate gzipped size | Yes |
| `gzipSizeSync` | Calculate gzipped size synchronously | No |
| `brotliSize` | Calculate brotli compressed size | Yes |
| `brotliSizeSync` | Calculate brotli compressed size synchronously | No |
| `rawSize` | Calculate raw (uncompressed) size | Yes |
| `rawSizeSync` | Calculate raw size synchronously | No |

### EOL Utilities

| Function | Description | Type |
|----------|-------------|------|
| `detect` | Detect line ending in a string | Function |
| `format` | Format string to use specific line ending | Function |
| `LF` | POSIX line ending constant (`\n`) | Constant |
| `CRLF` | Windows line ending constant (`\r\n`) | Constant |
| `EOL` | Platform-specific line ending | Constant |

### Utility Functions

| Function | Description | Type |
|----------|-------------|------|
| `parseJson` | Parse JSON with enhanced error messages | Function |
| `stripJsonComments` | Strip comments from JSON strings | Function |
| `assertValidFileContents` | Validate file contents | Function |
| `assertValidFileOrDirectoryPath` | Validate file or directory paths | Function |
| `toPath` | Convert URL or string to path | Function |

## Constants

### File Access Constants

```typescript
import { F_OK, R_OK, W_OK, X_OK } from "@visulima/fs";
```

- `F_OK` - File is visible (exists)
- `R_OK` - File is readable
- `W_OK` - File is writable
- `X_OK` - File is executable

### Find Up Constants

```typescript
import { FIND_UP_STOP } from "@visulima/fs";
```

- `FIND_UP_STOP` - Symbol to stop the `findUp` search

## Type Definitions

All types are exported from the main module and can be imported as needed:

```typescript
import type {
    WalkOptions,
    WalkEntry,
    ReadFileOptions,
    WriteFileOptions,
    ReadJsonOptions,
    WriteJsonOptions,
    FindUpOptions,
    FindUpName,
    MoveOptions,
    ContentType,
    JsonReplacer,
    JsonReviver,
    ReadFileEncoding,
} from "@visulima/fs";
```

See individual module documentation for detailed type information.

## Usage Patterns

### Importing Functions

```typescript
// Import from main module
import { readFile, writeFile, ensureDir } from "@visulima/fs";

// Import from submodules
import { readYaml, writeYaml } from "@visulima/fs/yaml";
import { gzipSize, brotliSize } from "@visulima/fs/size";
import { detect, format, LF } from "@visulima/fs/eol";
import { parseJson, stripJsonComments } from "@visulima/fs/utils";
import { JSONError, NotFoundError } from "@visulima/fs/error";
```

### Error Handling

All asynchronous functions can throw errors. It's recommended to wrap them in try-catch blocks:

```typescript
import { readFile } from "@visulima/fs";
import { NotFoundError } from "@visulima/fs/error";

try {
    const content = await readFile("./file.txt");
} catch (error) {
    if (error instanceof NotFoundError) {
        console.error("File not found");
    } else {
        console.error("Unexpected error:", error);
    }
}
```

### Type Safety

All functions have full TypeScript support:

```typescript
import { readFile, type ReadFileOptions } from "@visulima/fs";

// Type inference
const text: string = await readFile("./file.txt");
const buffer: Buffer = await readFile("./file.txt", { buffer: true });

// Explicit types
const options: ReadFileOptions<"gzip"> = {
    encoding: "utf8",
    compression: "gzip",
};
const content = await readFile("./file.txt.gz", options);
```

## Next Steps

- Explore detailed documentation for each module
- Check out [Examples](../examples/README.md) for practical usage
- Read [Advanced Guides](../advanced/README.md) for best practices
