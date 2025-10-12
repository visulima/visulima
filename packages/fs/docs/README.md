# @visulima/fs Documentation

Welcome to the @visulima/fs documentation! This package provides human-friendly file system utilities for Node.js with a focus on developer experience and type safety.

## Table of Contents

1. [Getting Started](./getting-started.md) - Installation and quick start guide
2. [API Reference](./api-reference/README.md) - Complete API documentation
3. [Examples](./examples/README.md) - Practical usage examples
4. [Advanced Guides](./advanced/README.md) - In-depth guides and best practices

## Quick Overview

@visulima/fs provides a comprehensive set of file system utilities including:

- **File Operations**: Read, write, move, and remove files with advanced options
- **Directory Operations**: Create, empty, and manage directories
- **JSON Support**: Read and write JSON files with error handling and formatting
- **YAML Support**: Read and write YAML files (requires `yaml` peer dependency)
- **File Discovery**: Walk directories, find files, and search upwards in the file tree
- **Size Utilities**: Calculate file sizes with gzip and brotli compression
- **EOL Utilities**: Detect and format line endings
- **Type Safety**: Full TypeScript support with detailed type definitions

## Key Features

- Modern async/await API with synchronous alternatives
- Memory-efficient streaming support
- Comprehensive error handling with custom error types
- Cross-platform compatibility (Linux, macOS, Windows)
- Zero dependencies (except optional YAML peer dependency)
- Full TypeScript support
- Extensively tested

## Quick Start

```typescript
import { readFile, writeFile, findUp, walk } from "@visulima/fs";

// Read a file
const content = await readFile("./file.txt");

// Write a file with automatic directory creation
await writeFile("./nested/path/file.txt", "Hello, World!");

// Find a file by walking up the directory tree
const configPath = await findUp("package.json");

// Walk a directory tree
for await (const entry of walk("./src")) {
    console.log(entry.path);
}
```

## Module Structure

The package is organized into several submodules that can be imported separately:

- `@visulima/fs` - Main module with all core functionality
- `@visulima/fs/utils` - Utility functions for JSON parsing and validation
- `@visulima/fs/error` - Custom error classes
- `@visulima/fs/yaml` - YAML-specific operations
- `@visulima/fs/size` - File size calculation utilities
- `@visulima/fs/eol` - End-of-line utilities

## Need Help?

- Report issues on [GitHub Issues](https://github.com/visulima/visulima/issues)
- Check out the [examples](./examples/README.md) for common use cases
- Read the [API reference](./api-reference/README.md) for detailed documentation

## License

MIT License - see the [LICENSE.md](../LICENSE.md) file for details.
