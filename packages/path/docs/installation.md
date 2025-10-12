# Installation

## Package Manager Installation

`@visulima/path` can be installed using any of the popular Node.js package managers:

### npm

```bash
npm install @visulima/path
```

### Yarn

```bash
yarn add @visulima/path
```

### pnpm

```bash
pnpm add @visulima/path
```

### Bun

```bash
bun add @visulima/path
```

## Requirements

### Node.js Version

`@visulima/path` requires Node.js version 18.0.0 or higher. The library is tested against the following versions:

- Node.js 18.x
- Node.js 20.x
- Node.js 22.x
- Node.js 23.x

### Operating Systems

`@visulima/path` works on all major operating systems:

- Windows (win32)
- macOS (darwin)
- Linux

## Module System Support

The package supports both module systems:

### ESM (ES Modules)

```javascript
import path from '@visulima/path';
// or
import { resolve, join, dirname } from '@visulima/path';

// For utilities
import { filename, normalizeAliases } from '@visulima/path/utils';
```

### CommonJS

```javascript
const path = require('@visulima/path');
// or
const { resolve, join, dirname } = require('@visulima/path');

// For utilities
const { filename, normalizeAliases } = require('@visulima/path/utils');
```

## TypeScript Support

`@visulima/path` is written in TypeScript and includes type definitions out of the box. No need to install separate `@types` packages.

### TypeScript Configuration

The package works with TypeScript 5.0 and higher. Simply import and use:

```typescript
import path from '@visulima/path';
import type { Path } from '@visulima/path';

const resolvedPath: string = path.resolve('./foo', 'bar');
```

## Verifying Installation

After installation, you can verify that the package is working correctly:

```javascript
// ESM
import { version } from '@visulima/path/package.json';
import { join } from '@visulima/path';

console.log('Installed version:', version);
console.log('Test join:', join('foo', 'bar')); // Should output: foo/bar
```

```javascript
// CommonJS
const { join } = require('@visulima/path');

console.log('Test join:', join('foo', 'bar')); // Should output: foo/bar
```

## Package Exports

The package provides the following exports:

### Main Export

```javascript
import path from '@visulima/path';
```

Includes all standard path module functions: `resolve`, `normalize`, `join`, `relative`, `dirname`, `basename`, `extname`, `parse`, `format`, `isAbsolute`, `toNamespacedPath`, `sep`, `delimiter`, and `matchesGlob`.

### Utilities Export

```javascript
import { filename, normalizeAliases } from '@visulima/path/utils';
```

Includes additional utility functions not present in the standard Node.js path module.

### Package.json

```javascript
import pkg from '@visulima/path/package.json';
```

Access to package metadata.

## Bundle Size

`@visulima/path` is lightweight with no runtime dependencies:

- Core module: ~8KB minified
- Utilities: ~3KB minified
- Total: ~11KB minified

The package is tree-shakeable when using ESM, so you only bundle what you use.

## Next Steps

Now that you have `@visulima/path` installed, continue to the [Getting Started Guide](./getting-started.md) to learn how to use it in your project.
