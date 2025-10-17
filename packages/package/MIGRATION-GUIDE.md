# Migration Guide

This guide documents breaking changes and migration steps for the `@visulima/package` package.

## Version 4.0.0

### `parsePackageJson` Function Now Asynchronous

The `parsePackageJson` function has been updated to be asynchronous and returns a `Promise<NormalizedPackageJson>` instead of `NormalizedPackageJson` directly.

#### Before (v3.x)

```typescript
import { parsePackageJson } from "@visulima/package";

const packageJson = parsePackageJson("./package.json");

// packageJson is immediately available
console.log(packageJson.name);
```

#### After (v4.x)

```typescript
import { parsePackageJson } from "@visulima/package";

const packageJson = await parsePackageJson("./package.json");

// parsePackageJson now returns a Promise and must be awaited
console.log(packageJson.name);
```

### CommonJS (CJS) Export Removed

The CommonJS (CJS) export has been removed in favor of ECMAScript Modules (ESM) only. For CJS compatibility in Node.js 20.19+, use dynamic imports.

#### Before (v3.x)

```javascript
// This no longer works
const { parsePackageJson } = require("@visulima/package");
```

#### After (v4.x) - Node.js 20.19+

```javascript
// Use dynamic import for ESM modules from CJS
const { parsePackageJson } = await import("@visulima/package");
// parsePackageJson is async and must be awaited
const packageJson = await parsePackageJson("./package.json");
```

#### Alternative: Convert to ESM

For better compatibility and performance, convert your project to use ESM:

```json
// package.json
{
  "type": "module"
}
```

```typescript
// Your files can now use ESM imports
import { parsePackageJson } from "@visulima/package";

const packageJson = await parsePackageJson("./package.json");
```

### Why These Changes?

#### Benefits of Asynchronous API

- **Better Performance**: Non-blocking I/O operations
- **Resource Efficiency**: Improved memory usage and responsiveness
- **Modern JavaScript**: Aligns with async/await patterns
- **Error Handling**: More predictable error propagation

#### Benefits of ESM Only

- **Standards Compliance**: Follows official JavaScript module specification
- **Tree Shaking**: Better dead code elimination in bundlers
- **Static Analysis**: Improved tooling and IDE support
- **Future-Proof**: ESM is the standard for modern JavaScript

### Migration Steps

#### 1. Update Function Calls

Replace all `parsePackageJson` calls to use `await`:

```typescript
// Before
const packageJson = parsePackageJson("./package.json");

// After
const packageJson = await parsePackageJson("./package.json");
```

#### 2. Mark Functions as Async

Ensure all functions calling `parsePackageJson` are marked as `async`:

```typescript
// Before
function getPackageName() {
    const packageJson = parsePackageJson("./package.json");
    return packageJson.name;
}

// After
async function getPackageName() {
    const packageJson = await parsePackageJson("./package.json");
    return packageJson.name;
}
```

#### 3. Update Error Handling

Error handling patterns remain the same but must account for async context:

```typescript
// Before
function getPackageInfo() {
    try {
        const packageJson = parsePackageJson("./package.json");
        return { name: packageJson.name, version: packageJson.version };
    } catch (error) {
        console.error("Failed to parse package.json:", error);
        throw error;
    }
}

// After
async function getPackageInfo() {
    try {
        const packageJson = await parsePackageJson("./package.json");
        return { name: packageJson.name, version: packageJson.version };
    } catch (error) {
        console.error("Failed to parse package.json:", error);
        throw error;
    }
}
```

### New Features in v4.0.0

#### Pnpm Catalog Resolution Support

The new version adds support for pnpm catalog resolution:

```typescript
import { parsePackageJson } from "@visulima/package";

// Enable catalog resolution for pnpm workspaces
const packageJson = await parsePackageJson("./package.json", {
    resolveCatalogs: true,
});

// Automatically resolves catalog references like "react": "catalog:"
console.log(packageJson.dependencies.react); // "18.2.0" (resolved from catalog)
```

#### Enhanced Error Messages

Better error reporting for common issues:

- **File not found**: Clear path resolution errors
- **Invalid JSON**: Detailed syntax error information
- **Permission issues**: Helpful suggestions for file access problems

### Migration Issues & Solutions

#### 1. Missing await Keywords

**Problem**: Forgetting to await `parsePackageJson` calls.

**Solution**: Add `await` before all `parsePackageJson` calls and mark calling functions as `async`.

#### 2. CJS require() Calls

**Problem**: `require("@visulima/package")` no longer works.

**Solution**: Use dynamic imports:

```javascript
// Dynamic import for ESM modules from CJS
const { parsePackageJson } = await import("@visulima/package");
```

#### 3. Async Function Requirements

**Problem**: Functions calling `parsePackageJson` must be async.

**Solution**: Mark all calling functions as `async`:

```typescript
// Before
function getPackageName() {
    const packageJson = parsePackageJson("./package.json");
    return packageJson.name;
}

// After
async function getPackageName() {
    const packageJson = await parsePackageJson("./package.json");
    return packageJson.name;
}
```

### Migration Script

Use this script to identify files that need updating:

```javascript
// migration-helper.mjs
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";

/**
 * @param {string} dir
 * @param {string[]} files
 * @returns {string[]}
 */
function findFilesWithParsePackageJson(dir, files = []) {
    const items = readdirSync(dir);

    for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith(".") && item !== "node_modules") {
            findFilesWithParsePackageJson(fullPath, files);
        } else if (stat.isFile() && (extname(item) === ".ts" || extname(item) === ".js")) {
            const content = readFileSync(fullPath, "utf8");

            if (content.includes("parsePackageJson") &&
                (!content.includes("await parsePackageJson") || content.includes('require("@visulima/package")'))) {
                files.push(fullPath);
            }
        }
    }

    return files;
}

const files = findFilesWithParsePackageJson("./src");
console.log("Files that may need updating:", files);
```

### Testing Migration

After migration, verify that your code works correctly:

```typescript
import { parsePackageJson } from "@visulima/package";

// Test basic functionality
const packageJson = await parsePackageJson("./package.json");
console.log(`Project: ${packageJson.name} v${packageJson.version}`);

// Test with catalog resolution
const packageJsonWithCatalogs = await parsePackageJson("./package.json", {
    resolveCatalogs: true,
});
console.log("Catalog resolution working:", packageJsonWithCatalogs.dependencies);
```

### Migration Benefits

- **Better Performance**: Non-blocking I/O operations
- **Modern JavaScript**: Async/await patterns throughout
- **ESM Compatibility**: Works with modern bundlers and tools
- **Type Safety**: Better TypeScript integration
- **Future-Proof**: Aligned with JavaScript ecosystem direction

### Need Additional Help?

If you encounter issues during migration:

1. Ensure all `parsePackageJson` calls are properly awaited
2. Mark all calling functions as `async`
3. Use ESM imports instead of CJS require()
4. Update error handling for async context
5. Test with catalog resolution features

For additional support, please file an issue on the GitHub repository.
