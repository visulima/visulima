# Migration Guide

This guide documents breaking changes and migration steps for the `@visulima/pail` package.

## Version 3.0.0

### Breaking Changes Summary

- **Minimum Node.js version**: 20.19+ required
- **Module format**: ESM-only (CommonJS removed)
- **Reporter imports**: Changed to granular paths
- **Internal dependencies**: Consolidated with @visulima/string

### Dependency Consolidation

In version 3.0.0, we consolidated external dependencies by replacing them with internal `@visulima/string` package utilities.

#### Replaced Dependencies

| Previous        | New                                 | Reason                                   |
| --------------- | ----------------------------------- | ---------------------------------------- |
| `wrap-ansi`     | `@visulima/string` (wordWrap)       | Consolidated text wrapping functionality |
| `string-length` | `@visulima/string` (getStringWidth) | Consolidated string width calculation    |

#### Benefits

- **Reduced bundle size**: Fewer external dependencies
- **Better maintenance**: Internal package control
- **Consistent API**: Unified string utilities across visulima packages
- **Performance**: Optimized internal implementations

#### Backward Compatibility

The dependency consolidation changes are **backward compatible** for pail users. The internal API changes don't affect the public pail API. The CJS export removal and reporter export structure changes are **breaking changes** that require migration.

### Reporter Export Structure Changes

The reporter export structure has been reorganized to provide more granular access to individual reporter types.

#### Old Export Structure

```javascript
import { JsonReporter, JsonFileReporter, PrettyReporter, SimpleReporter } from "@visulima/pail/reporter";
```

#### New Granular Export Structure

```javascript
import { JsonReporter } from "@visulima/pail/reporter/json";
import { JsonFileReporter } from "@visulima/pail/reporter/file";
import { PrettyReporter } from "@visulima/pail/reporter/pretty";
import { SimpleReporter } from "@visulima/pail/reporter/simple";
```

#### Benefits

- **Smaller bundle sizes**: Only import the reporters you need
- **Better tree-shaking**: Unused reporters are excluded from bundles
- **Clearer dependencies**: Explicit imports make dependencies obvious
- **Improved performance**: Reduced bundle size and faster loading

### CommonJS (CJS) Export Removed

The CommonJS (CJS) export has been removed in favor of ECMAScript Modules (ESM) only. For CJS compatibility in Node.js 20.19+, use dynamic imports.

#### Before (v2.x)

```javascript
// This no longer works
const { createPail, pail } = require("@visulima/pail");
```

#### After (v3.x) - Node.js 20.19+

```javascript
// Use dynamic import for ESM modules from CJS
const { createPail, pail } = await import("@visulima/pail");
```

#### Alternative: Convert to ESM

For better compatibility and performance, convert your project to use ESM:

```json
// package.json
{
    "name": "your-project",
    "type": "module"
}
```

```typescript
// Your files can now use ESM imports
import { createPail, pail } from "@visulima/pail";

const logger = createPail({
    reporters: [new JsonReporter()],
});

logger.info("Hello ESM world!");
```

### Why ESM Only?

#### Benefits of ESM for Pail

- **Standards Compliance**: ESM follows the official JavaScript module specification
- **Tree Shaking**: Better dead code elimination in bundlers
- **Static Analysis**: Improved tooling and IDE support
- **Future-Proof**: ESM is the standard for modern JavaScript
- **Bundle Optimization**: Smaller bundle sizes with better optimization

### Migration Steps

#### 1. Update Reporter Imports

Replace old reporter imports with new granular imports:

```javascript
// Before
import { JsonReporter, JsonFileReporter, PrettyReporter, SimpleReporter } from "@visulima/pail/reporter";

// After
import { JsonReporter } from "@visulima/pail/reporter/json";
import { JsonFileReporter } from "@visulima/pail/reporter/file";
import { PrettyReporter } from "@visulima/pail/reporter/pretty";
import { SimpleReporter } from "@visulima/pail/reporter/simple";
```

#### 2. Use Dynamic Imports for CJS

Replace `require()` calls with dynamic `import()`:

```javascript
// Before
const { createPail } = require("@visulima/pail");

// After
const { createPail } = await import("@visulima/pail");
```

#### 3. Convert to ESM (Recommended)

For the best experience, convert your project to use ESM:

```json
// package.json
{
    "name": "your-project",
    "type": "module",
    "scripts": {
        "start": "node src/index.js"
    }
}
```

```typescript
// src/index.ts
import { createPail, pail } from "@visulima/pail";
import { JsonReporter } from "@visulima/pail/reporter/json";

async function main() {
    const logger = createPail({
        reporters: [new JsonReporter()],
    });

    logger.info("Project started");
}

main().catch(console.error);
```

### Migration Issues & Solutions

#### 1. Old Reporter Imports No Longer Work

**Problem**: `import { JsonReporter } from "@visulima/pail/reporter"` throws "module not found" error.

**Solution**: Use new granular reporter imports:

```javascript
// Before
import { JsonReporter, JsonFileReporter, PrettyReporter, SimpleReporter } from "@visulima/pail/reporter";

// After
import { JsonReporter } from "@visulima/pail/reporter/json";
import { JsonFileReporter } from "@visulima/pail/reporter/file";
import { PrettyReporter } from "@visulima/pail/reporter/pretty";
import { SimpleReporter } from "@visulima/pail/reporter/simple";
```

#### 2. require() Calls No Longer Work

**Problem**: `require('@visulima/pail')` throws "module not found" error.

**Solution**: Use dynamic imports:

```javascript
// Dynamic import for ESM modules from CJS
const { createPail, pail } = await import("@visulima/pail");
```

#### 3. Async Context Required

**Problem**: Functions using pail must be async when using dynamic imports.

**Solution**: Mark functions as async and await the import:

```typescript
// Before
function setupLogger() {
    const { createPail } = require("@visulima/pail");

    return createPail();
}

// After
async function setupLogger() {
    const { createPail } = await import("@visulima/pail");

    return createPail();
}
```

### Verification Steps

1. **Test new reporter imports**:

    ```javascript
    // test-reporters.mjs
    import { JsonReporter } from "@visulima/pail/reporter/json";
    import { JsonFileReporter } from "@visulima/pail/reporter/file";
    import { PrettyReporter } from "@visulima/pail/reporter/pretty";
    import { SimpleReporter } from "@visulima/pail/reporter/simple";
    import { createPail } from "@visulima/pail";

    async function test() {
        const logger = createPail({
            reporters: [new JsonReporter(), new JsonFileReporter({ filePath: "/tmp/test.log" }), new PrettyReporter(), new SimpleReporter()],
        });

        logger.info("All reporter imports successful");
    }

    test().catch(console.error);
    ```

2. **Test ESM imports**:

    ```javascript
    // test.mjs
    import { createPail } from "@visulima/pail";

    async function test() {
        const logger = createPail();

        logger.info("ESM import successful");
    }

    test().catch(console.error);
    ```

3. **Test dynamic imports from CJS**:

    ```javascript
    // test.cjs
    async function test() {
        const { createPail } = await import("@visulima/pail");
        const logger = createPail();

        logger.info("Dynamic import successful");
    }

    test().catch(console.error);
    ```

### Migration Benefits

#### Reporter Import Benefits

- **Smaller bundle sizes**: Only import the reporters you need
- **Better tree-shaking**: Unused reporters are excluded from bundles
- **Clearer dependencies**: Explicit imports make dependencies obvious
- **Improved performance**: Reduced bundle size and faster loading

#### ESM Migration Benefits

- **Better Performance**: ESM's improved module caching in Node.js 20.19+
- **Modern JavaScript**: Consistent module syntax across environments
- **Bundle Optimization**: Better tree-shaking and dead code elimination
- **Developer Experience**: Improved IDE support and error messages
- **Future-Proof**: Aligned with JavaScript ecosystem direction
