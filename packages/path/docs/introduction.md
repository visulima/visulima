# Introduction

## What Problem Does @visulima/path Solve?

For historical reasons dating back to MS-DOS, Windows uses backslashes (`\`) as path separators while macOS, Linux, and other POSIX operating systems use forward slashes (`/`). While modern Windows versions support both separators, Node.js's built-in `path` module adapts its behavior based on the operating system it runs on.

This creates a critical problem: **your code behaves differently on different operating systems**.

### Example of the Problem

```javascript
// Using Node.js's native path module
const path = require('path');

// On Windows
path.join('foo', 'bar'); // Returns: 'foo\\bar'

// On Linux/macOS
path.join('foo', 'bar'); // Returns: 'foo/bar'
```

This inconsistency can cause:

- Hard-to-debug cross-platform issues
- Different test results on different development machines
- Production bugs when deploying to different operating systems
- Path comparison failures when mixing Windows and POSIX paths

## How @visulima/path Solves It

`@visulima/path` provides a unified, consistent API that always uses forward slashes, regardless of the operating system:

```javascript
// Using @visulima/path
import { join } from '@visulima/path';

// On ANY operating system
join('foo', 'bar'); // Always returns: 'foo/bar'
```

All path operations are normalized, ensuring predictable behavior across all platforms.

## Key Advantages

### 1. Consistent Behavior

Write your code once and have confidence it will work the same way on all platforms.

### 2. Drop-in Replacement

`@visulima/path` exports the same functions as Node.js's path module, making it easy to migrate existing code:

```javascript
// Before
const path = require('path');

// After
const path = require('@visulima/path');
// All your existing code continues to work!
```

### 3. Modern Implementation

- Written in TypeScript with full type safety
- ESM-first with CommonJS support
- No dependencies on Node.js APIs (works in any JavaScript environment)
- Zero external dependencies

### 4. Additional Utilities

Beyond the standard path module functions, `@visulima/path` includes useful utilities:

- `filename()` - Extract filename without extension
- `normalizeAliases()` - Normalize path alias mappings
- `resolveAlias()` - Resolve paths using aliases
- `reverseResolveAlias()` - Convert absolute paths back to aliases
- `isRelative()` - Check if a path is relative
- `isBinaryPath()` - Detect if a file is binary based on extension
- `toPath()` - Convert URL or string to normalized path
- `isWindows()` - Detect Windows platform

## Comparison with Similar Libraries

### vs Native Node.js path

- Node.js path: Platform-dependent behavior
- @visulima/path: Consistent POSIX-style behavior on all platforms

### vs upath

- upath: Older library with dependencies on Node.js path module
- @visulima/path: Modern ESM/TypeScript implementation, no Node.js dependencies

### vs pathe

- pathe: Similar goals and approach
- @visulima/path: Extended with additional utility functions and built specifically for the Visulima ecosystem

## When to Use @visulima/path

Use `@visulima/path` when you:

- Need consistent cross-platform path handling
- Want to avoid platform-specific bugs
- Are building applications that run on multiple operating systems
- Need additional path utilities beyond the standard API
- Want a modern, TypeScript-first path library
- Are working in non-Node.js environments (like edge functions or browsers)

## When to Stick with Node.js path

Consider using the native Node.js path module when:

- You specifically need platform-dependent behavior
- You're working on a system-level tool that must respect OS conventions
- You need `path.win32` or `path.posix` namespaces for explicit platform handling
- Your codebase has deep dependencies on platform-specific path behavior

## Next Steps

Ready to get started? Head over to the [Installation Guide](./installation.md) to add `@visulima/path` to your project.
