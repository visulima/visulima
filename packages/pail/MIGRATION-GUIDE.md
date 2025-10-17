# Migration Guide

This guide documents breaking changes and migration steps for the `@visulima/pail` package.

## Version 3.0.0

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

The dependency consolidation changes are **backward compatible** for pail users. The internal API changes don't affect the public pail API. The CJS export removal is a **breaking change** that requires migration to ESM or dynamic imports for continued CJS usage.

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

### Migration Steps for CJS Users

#### 1. Use Dynamic Imports

Replace `require()` calls with dynamic `import()`:

```javascript
// Before
const { createPail } = require("@visulima/pail");

// After
const { createPail } = await import("@visulima/pail");
```

#### 2. Convert to ESM (Recommended)

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

async function main() {
    const logger = createPail({
        reporters: [new JsonReporter()],
    });

    logger.info("Project started");
}

main().catch(console.error);
```

### Migration Issues & Solutions

#### 1. require() Calls No Longer Work

**Problem**: `require('@visulima/pail')` throws "module not found" error.

**Solution**: Use dynamic imports:

```javascript
// Dynamic import for ESM modules from CJS
const { createPail, pail } = await import("@visulima/pail");
```

#### 2. Async Context Required

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

1. **Test ESM imports**:

    ```javascript
    // test.mjs
    import { createPail } from "@visulima/pail";

    /**
     *
     */
    async function test() {
        const logger = createPail();

        logger.info("ESM import successful");
    }

    test().catch(console.error);
    ```

2. **Test dynamic imports from CJS**:

    ```javascript
    // test.cjs
    /**
     *
     */
    async function test() {
        const { createPail } = await import("@visulima/pail");
        const logger = createPail();

        logger.info("Dynamic import successful");
    }

    test().catch(console.error);
    ```

### Migration Benefits

- **Better Performance**: ESM's improved module caching in Node.js 20.19+
- **Modern JavaScript**: Consistent module syntax across environments
- **Bundle Optimization**: Better tree-shaking and dead code elimination
- **Developer Experience**: Improved IDE support and error messages
- **Future-Proof**: Aligned with JavaScript ecosystem direction
