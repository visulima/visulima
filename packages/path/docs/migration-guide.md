# Migration Guide

This guide helps you migrate from Node.js's native `path` module to `@visulima/path`.

## Why Migrate?

The native Node.js `path` module has platform-dependent behavior that can cause subtle bugs and inconsistencies across different operating systems. `@visulima/path` solves this by providing consistent cross-platform behavior while maintaining API compatibility.

## Quick Migration

For most projects, migration is straightforward:

### Step 1: Install the Package

```bash
npm install @visulima/path
```

### Step 2: Update Your Imports

**Before:**

```javascript
// Node.js path
const path = require('path');
// or
import path from 'path';
```

**After:**

```javascript
// @visulima/path
const path = require('@visulima/path');
// or
import path from '@visulima/path';
```

That's it! Your existing code should continue to work.

---

## Detailed Migration

### CommonJS Projects

#### Before (Node.js path)

```javascript
const path = require('path');
const { join, resolve, dirname } = require('path');

const filePath = path.join('src', 'components', 'Button.tsx');
const absolutePath = path.resolve(__dirname, 'config', 'app.json');
const directory = path.dirname(filePath);
```

#### After (@visulima/path)

```javascript
const path = require('@visulima/path');
const { join, resolve, dirname } = require('@visulima/path');

const filePath = path.join('src', 'components', 'Button.tsx');
const absolutePath = path.resolve(__dirname, 'config', 'app.json');
const directory = path.dirname(filePath);
```

No functional changes needed - just update the import!

---

### ESM Projects

#### Before (Node.js path)

```javascript
import path from 'path';
import { join, resolve, dirname } from 'path';

const filePath = path.join('src', 'components', 'Button.tsx');
```

#### After (@visulima/path)

```javascript
import path from '@visulima/path';
import { join, resolve, dirname } from '@visulima/path';

const filePath = path.join('src', 'components', 'Button.tsx');
```

---

### TypeScript Projects

#### Before (Node.js path)

```typescript
import path from 'path';
import type { ParsedPath } from 'path';

const parsed: ParsedPath = path.parse('/home/user/file.txt');
```

#### After (@visulima/path)

```typescript
import path from '@visulima/path';
import type { Path } from '@visulima/path';

const parsed = path.parse('/home/user/file.txt');
// ParsedPath type is available from Node.js types
```

---

## Behavioral Differences

While `@visulima/path` maintains API compatibility, there are intentional behavioral differences to ensure cross-platform consistency:

### 1. Path Separators

**Node.js path:** Platform-dependent separators

```javascript
// On Windows
path.join('foo', 'bar');  // 'foo\\bar'

// On Linux/macOS
path.join('foo', 'bar');  // 'foo/bar'
```

**@visulima/path:** Always uses forward slashes

```javascript
// On ALL platforms
join('foo', 'bar');  // 'foo/bar'
```

**Migration Impact:** Low - Modern Windows supports forward slashes

---

### 2. Windows Path Handling

**Node.js path:** Preserves backslashes on Windows

```javascript
// On Windows
path.normalize('C:\\Users\\John\\Documents');
// Returns: 'C:\\Users\\John\\Documents'
```

**@visulima/path:** Normalizes to forward slashes

```javascript
// On all platforms
normalize('C:\\Users\\John\\Documents');
// Returns: 'C:/Users/John/Documents'
```

**Migration Impact:** Low - Windows accepts both separators

---

### 3. posix and win32 Namespaces

**Node.js path:** Separate implementations

```javascript
import path from 'path';

path.win32.join('foo', 'bar');   // Always: 'foo\\bar'
path.posix.join('foo', 'bar');   // Always: 'foo/bar'
```

**@visulima/path:** Both point to the same normalized implementation

```javascript
import { posix, win32 } from '@visulima/path';

posix.join('foo', 'bar');  // 'foo/bar'
win32.join('foo', 'bar');  // 'foo/bar' (same!)
```

**Migration Impact:** **BREAKING** if you explicitly need platform-specific behavior

**Workaround:** Keep Node.js path for explicit platform handling:

```javascript
import path from '@visulima/path';  // Default for cross-platform
import nodePath from 'path';  // For explicit platform behavior

// Use @visulima/path for normal operations
const normalPath = path.join('foo', 'bar');

// Use Node.js path when you need explicit platform behavior
const windowsPath = nodePath.win32.join('foo', 'bar');
```

---

## Breaking Changes

### Removed Features

`@visulima/path` intentionally does not export `path.win32` and `path.posix` with different behaviors. If your code relies on these for platform-specific paths, you'll need to keep Node.js `path` for those specific cases.

#### Code Using win32/posix Explicitly

**Before:**

```javascript
import path from 'path';

// Explicitly force Windows-style paths
const windowsPath = path.win32.join('C:', 'Users', 'John');
console.log(windowsPath);  // 'C:\\Users\\John'

// Explicitly force POSIX-style paths
const posixPath = path.posix.join('/home', 'user');
console.log(posixPath);  // '/home/user'
```

**After (if platform-specific behavior is required):**

```javascript
// Keep Node.js path for explicit platform handling
import nodePath from 'path';
// Use @visulima/path for everything else
import path from '@visulima/path';

// For platform-specific behavior, use Node.js path
const windowsPath = nodePath.win32.join('C:', 'Users', 'John');

// For cross-platform behavior, use @visulima/path
const normalizedPath = path.join('/home', 'user');
```

---

## Testing Your Migration

### Create Test Suite

```javascript
import { describe, it, expect } from 'vitest';
import path from '@visulima/path';

describe('path migration', () => {
  it('joins paths correctly', () => {
    expect(path.join('foo', 'bar')).toBe('foo/bar');
  });
  
  it('resolves paths correctly', () => {
    const result = path.resolve('foo', 'bar');
    expect(result).toMatch(/foo\/bar$/);
  });
  
  it('handles Windows paths', () => {
    expect(path.normalize('C:\\Users\\John')).toBe('C:/Users/John');
  });
  
  it('parses paths correctly', () => {
    const parsed = path.parse('/home/user/file.txt');
    expect(parsed.dir).toBe('/home/user');
    expect(parsed.base).toBe('file.txt');
    expect(parsed.ext).toBe('.txt');
  });
});
```

### Run Tests on Multiple Platforms

Test your application on:
- Windows
- macOS
- Linux

Ensure consistent behavior across all platforms.

---

## Common Migration Patterns

### Pattern 1: Build Scripts

**Before:**

```javascript
const path = require('path');
const fs = require('fs');

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

// Build script logic...
```

**After:**

```javascript
const path = require('@visulima/path');
const fs = require('fs');

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

// Build script logic... (no changes needed)
```

---

### Pattern 2: Module Resolution

**Before:**

```javascript
const path = require('path');

function resolveModule(moduleName) {
  return path.resolve(__dirname, 'node_modules', moduleName);
}
```

**After:**

```javascript
const path = require('@visulima/path');

function resolveModule(moduleName) {
  return path.resolve(__dirname, 'node_modules', moduleName);
}
```

---

### Pattern 3: File Path Comparison

**Before:**

```javascript
const path = require('path');

// Normalize paths before comparison
const normalizedPath1 = path.normalize(path1);
const normalizedPath2 = path.normalize(path2);

if (normalizedPath1 === normalizedPath2) {
  // Paths are equal
}
```

**After:**

```javascript
const path = require('@visulima/path');

// Works the same way, but more reliable cross-platform
const normalizedPath1 = path.normalize(path1);
const normalizedPath2 = path.normalize(path2);

if (normalizedPath1 === normalizedPath2) {
  // Paths are equal
}
```

---

## Gradual Migration Strategy

For large codebases, you can migrate gradually:

### Step 1: Alias the Import

```javascript
// Use a consistent alias throughout your codebase
import vPath from '@visulima/path';
import nodePath from 'path';

// Gradually replace nodePath with vPath
```

### Step 2: Create a Wrapper Module

```javascript
// lib/path.js
import path from '@visulima/path';

// Re-export everything
export default path;
export * from '@visulima/path';

// Add any custom logic if needed
export function customPathFunction() {
  // ...
}
```

### Step 3: Update Imports Gradually

```javascript
// Before
import path from 'path';

// After
import path from './lib/path';
```

### Step 4: Remove the Wrapper

Once all code uses the wrapper, update it to directly export from `@visulima/path`:

```javascript
// lib/path.js
export { default } from '@visulima/path';
export * from '@visulima/path';
```

---

## Rollback Plan

If you encounter issues, you can quickly rollback:

### Using Package Aliases (npm)

```json
{
  "dependencies": {
    "@visulima/path": "npm:path-browserify@^1.0.1"
  }
}
```

This allows you to keep the `@visulima/path` imports while using a different implementation.

---

## Getting Help

If you encounter migration issues:

1. Check the [API Reference](./api-reference.md) for function compatibility
2. Review [Examples](./examples.md) for common patterns
3. Search existing [GitHub Issues](https://github.com/visulima/visulima/issues)
4. Open a new issue with:
   - Your use case
   - Expected vs actual behavior
   - Minimal reproduction

---

## Success Checklist

- [ ] Package installed
- [ ] All imports updated
- [ ] Tests pass on all target platforms
- [ ] Build scripts work correctly
- [ ] No platform-specific path.win32/posix usage (or kept Node.js path for those)
- [ ] Path comparisons work as expected
- [ ] File system operations function correctly
- [ ] Application deployed and tested in production

---

## Next Steps

After successful migration:

- Explore [Utility Functions](./utility-functions.md) for additional features
- Review [Best Practices](./getting-started.md#best-practices)
- Consider using path aliases with `normalizeAliases()` and `resolveAlias()`
- Update documentation to reflect new dependency

## See Also

- [API Reference](./api-reference.md) - Complete API documentation
- [Getting Started](./getting-started.md) - Usage guide
- [Examples](./examples.md) - Real-world code examples
