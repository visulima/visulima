# Getting Started

This guide will help you get started with @visulima/fs, a human-friendly file system utility library for Node.js.

## Installation

Install the package using your preferred package manager:

### npm

```bash
npm install @visulima/fs
```

### yarn

```bash
yarn add @visulima/fs
```

### pnpm

```bash
pnpm add @visulima/fs
```

## Requirements

- **Node.js**: Version 18.0.0 or higher (supports up to 23.x)
- **Operating Systems**: Linux, macOS, Windows
- **TypeScript**: Version 5.0 or higher (for TypeScript projects)

## Optional Dependencies

If you plan to work with YAML files, install the optional peer dependency:

```bash
npm install yaml
```

## Basic Usage

### ESM (ES Modules)

@visulima/fs is an ESM-first package. Import functions using modern ES module syntax:

```typescript
import { readFile, writeFile, ensureDir } from "@visulima/fs";

// Read a file
const content = await readFile("./example.txt");

// Write a file
await writeFile("./output.txt", "Hello, World!");

// Ensure a directory exists
await ensureDir("./my-directory");
```

### CommonJS

The package also provides CommonJS builds:

```javascript
const { readFile, writeFile, ensureDir } = require("@visulima/fs");

(async () => {
    const content = await readFile("./example.txt");
    await writeFile("./output.txt", "Hello, World!");
    await ensureDir("./my-directory");
})();
```

## Importing Submodules

The package provides several submodules for specific functionality:

### Utils Module

```typescript
import { parseJson, stripJsonComments, toPath } from "@visulima/fs/utils";

const data = parseJson('{"name": "example"}');
```

### Error Module

```typescript
import { JSONError, DirectoryError } from "@visulima/fs/error";

try {
    // ... your code
} catch (error) {
    if (error instanceof JSONError) {
        console.error("JSON parsing failed:", error.message);
    }
}
```

### YAML Module

```typescript
import { readYaml, writeYaml } from "@visulima/fs/yaml";

// Read YAML file
const config = await readYaml("./config.yml");

// Write YAML file
await writeYaml("./output.yml", { key: "value" });
```

### Size Module

```typescript
import { gzipSize, brotliSize, rawSize } from "@visulima/fs/size";

// Calculate gzipped size
const size = await gzipSize("./large-file.txt");
console.log(`Gzipped size: ${size} bytes`);
```

### EOL Module

```typescript
import { detect, format, LF, CRLF, EOL } from "@visulima/fs/eol";

// Detect line endings
const eol = detect("Hello\r\nWorld");
console.log(eol); // "\r\n"

// Format line endings
const formatted = format("Hello\r\nWorld\nMixed", LF);
console.log(formatted); // "Hello\nWorld\nMixed"
```

## TypeScript Support

@visulima/fs is written in TypeScript and provides comprehensive type definitions. All functions are fully typed:

```typescript
import { readFile, writeFile, type ReadFileOptions, type WriteFileOptions } from "@visulima/fs";

// Type-safe options
const options: ReadFileOptions<"gzip"> = {
    encoding: "utf8",
    compression: "gzip",
};

const content = await readFile("./file.txt.gz", options);
```

## Synchronous vs Asynchronous

Most functions in @visulima/fs come in both asynchronous and synchronous versions:

### Asynchronous (Recommended)

Asynchronous functions use promises and should be used with `async`/`await`:

```typescript
import { readFile, writeFile } from "@visulima/fs";

async function processFile() {
    const content = await readFile("./input.txt");
    await writeFile("./output.txt", content.toUpperCase());
}
```

### Synchronous

Synchronous functions block the event loop and should be used sparingly:

```typescript
import { readFileSync, writeFileSync } from "@visulima/fs";

const content = readFileSync("./input.txt");
writeFileSync("./output.txt", content.toUpperCase());
```

## Error Handling

@visulima/fs provides custom error types for better error handling:

```typescript
import { readJson } from "@visulima/fs";
import { JSONError, NotFoundError } from "@visulima/fs/error";

try {
    const data = await readJson("./config.json");
} catch (error) {
    if (error instanceof JSONError) {
        console.error("Invalid JSON:", error.message);
    } else if (error instanceof NotFoundError) {
        console.error("File not found:", error.path);
    } else {
        console.error("Unknown error:", error);
    }
}
```

## Common Patterns

### Reading and Writing Files

```typescript
import { readFile, writeFile } from "@visulima/fs";

// Read as string (default)
const text = await readFile("./file.txt");

// Read as buffer
const buffer = await readFile("./image.png", { buffer: true });

// Write with automatic directory creation
await writeFile("./path/to/file.txt", "content", { recursive: true });
```

### Working with JSON

```typescript
import { readJson, writeJson } from "@visulima/fs";

// Read JSON file
const config = await readJson("./config.json");

// Write JSON file with formatting
await writeJson("./config.json", { key: "value" }, { indent: 2 });
```

### Directory Operations

```typescript
import { ensureDir, emptyDir, remove } from "@visulima/fs";

// Ensure directory exists
await ensureDir("./my-directory");

// Empty a directory (remove contents, keep directory)
await emptyDir("./temp");

// Remove directory and contents
await remove("./temp");
```

### Finding Files

```typescript
import { findUp, walk } from "@visulima/fs";

// Find a file by walking up the directory tree
const packageJsonPath = await findUp("package.json");

// Walk a directory tree
for await (const entry of walk("./src")) {
    if (entry.isFile && entry.name.endsWith(".ts")) {
        console.log(entry.path);
    }
}
```

## Next Steps

- Explore the [API Reference](./api-reference/README.md) for detailed documentation
- Check out [Examples](./examples/README.md) for more use cases
- Read the [Advanced Guides](./advanced/README.md) for best practices

## Migration from Other Libraries

### From `fs-extra`

@visulima/fs provides similar functionality with modern async/await API:

```typescript
// fs-extra
import fse from "fs-extra";
await fse.ensureDir("./dir");
await fse.readJson("./file.json");

// @visulima/fs
import { ensureDir, readJson } from "@visulima/fs";
await ensureDir("./dir");
await readJson("./file.json");
```

### From Node.js `fs/promises`

@visulima/fs extends native functionality with convenience features:

```typescript
// fs/promises
import { readFile, mkdir, writeFile } from "fs/promises";
await mkdir("./path/to", { recursive: true });
await writeFile("./path/to/file.txt", "content");
const content = await readFile("./file.txt", "utf8");

// @visulima/fs
import { writeFile, readFile } from "@visulima/fs";
await writeFile("./path/to/file.txt", "content"); // auto-creates directories
const content = await readFile("./file.txt"); // utf8 by default
```
