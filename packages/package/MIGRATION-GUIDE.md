# Migration Guide

This guide helps you migrate from `@visulima/package` versions before v4.0.0 to v4.0.0+.

## Breaking Changes

### `parsePackageJson` is now async

The `parsePackageJson` function is now asynchronous and returns a `Promise<NormalizedPackageJson>` instead of `NormalizedPackageJson` directly.

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

### CJS Export Removed

The CommonJS (CJS) export has been removed. If you need CJS support, use Node.js 20.19+ import syntax:

#### Before

```javascript
// This will no longer work
const { parsePackageJson } = require("@visulima/package");
```

#### After (Node.js 20.19+)

```javascript
// Use require() to load ESM modules from CJS
const { parsePackageJson } = require("@visulima/package");
// parsePackageJson is still async and must be awaited
const packageJson = await parsePackageJson("./package.json");
```

Or convert your project to use ESM:

```javascript
// package.json
{
  "type": "module"
}

// or rename files to .mjs
```

### Migration Steps

1. **Replace CJS require() with ESM import() or convert to ESM**
2. **Update all `parsePackageJson` calls to be awaited**
3. **Ensure calling functions are marked as `async`**
4. **Update error handling if needed**

#### Example: Simple function

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

#### Example: With error handling

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

#### Example: CJS to ESM migration

```javascript
// Before (CJS - no longer works)
// Or convert entire file to ESM
import { parsePackageJson } from "@visulima/package";

const { parsePackageJson } = require("@visulima/package");

/**
 *
 */
function getPackageName() {
    const packageJson = parsePackageJson("./package.json");

    return packageJson.name;
}

// After (CJS with ESM loading)
/**
 *
 */
async function getPackageName() {
    const { parsePackageJson } = require("@visulima/package");
    const packageJson = await parsePackageJson("./package.json");

    return packageJson.name;
}

/**
 *
 */
export async function getPackageName() {
    const packageJson = await parsePackageJson("./package.json");

    return packageJson.name;
}
```

#### Example: In async context

```typescript
// Before
async function processPackage() {
    const packageJson = parsePackageJson("./package.json");
    // ... rest of async function
}

// After
async function processPackage() {
    const packageJson = await parsePackageJson("./package.json");
    // ... rest of async function
}
```

### Migration Script

If you have many files to update, you can use this Node.js script to help identify files that need updating:

```javascript
// migration-helper.js
const fs = require("node:fs");
const path = require("node:path");

/**
 *
 * @param dir
 * @param files
 */
function findFilesWithParsePackageJson(dir, files = []) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith(".") && item !== "node_modules") {
            findFilesWithParsePackageJson(fullPath, files);
        } else if (stat.isFile() && (item.endsWith(".ts") || item.endsWith(".js"))) {
            const content = fs.readFileSync(fullPath, "utf8");

            if (content.includes("parsePackageJson") && (!content.includes("await parsePackageJson") || content.includes("require(\"@visulima/package\")"))) {
                files.push(fullPath);
            }
        }
    }

    return files;
}

const files = findFilesWithParsePackageJson("./src");

console.log("Files that may need updating:", files);
```

### New Features

While migrating, you can also take advantage of the new pnpm catalog resolution feature:

```typescript
import { parsePackageJson } from "@visulima/package";

// Enable catalog resolution for pnpm workspaces
const packageJson = await parsePackageJson("./package.json", {
    resolveCatalogs: true,
});
```

This will automatically resolve catalog references like `"react": "catalog:"` to their actual versions from your `pnpm-workspace.yaml` file.

### Need Help?

If you encounter issues during migration:

1. Replace all `require("@visulima/package")` calls (they now work with ESM but functions are still async)
2. Check that all `parsePackageJson` calls are properly awaited
3. Ensure all calling functions are marked as `async`
4. Verify that error handling still works as expected
5. Test with both catalog resolution enabled and disabled

For additional support, please file an issue on the GitHub repository.
