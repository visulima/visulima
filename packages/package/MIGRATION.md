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
// packageJson is now a Promise, must be awaited
console.log(packageJson.name);
```

### Migration Steps

1. **Update all `parsePackageJson` calls to be awaited**
2. **Ensure calling functions are marked as `async`**
3. **Update error handling if needed**

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
const fs = require('fs');
const path = require('path');

function findFilesWithParsePackageJson(dir, files = []) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
            findFilesWithParsePackageJson(fullPath, files);
        } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.js'))) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('parsePackageJson') && !content.includes('await parsePackageJson')) {
                files.push(fullPath);
            }
        }
    }

    return files;
}

const files = findFilesWithParsePackageJson('./src');
console.log('Files that may need updating:', files);
```

### New Features

While migrating, you can also take advantage of the new pnpm catalog resolution feature:

```typescript
import { parsePackageJson } from "@visulima/package";

// Enable catalog resolution for pnpm workspaces
const packageJson = await parsePackageJson("./package.json", {
    resolveCatalogs: true
});
```

This will automatically resolve catalog references like `"react": "catalog:"` to their actual versions from your `pnpm-workspace.yaml` file.

### Automated Migration

For large codebases, consider using a codemod or find-and-replace tool:

```bash
# Find all parsePackageJson calls (excluding imports)
grep -r "parsePackageJson(" --include="*.ts" --include="*.js" --exclude-dir=node_modules .

# Then manually update each occurrence to add await
```

### Testing Your Migration

After updating your code, run your tests to ensure everything works:

```bash
npm test
# or
yarn test
# or
pnpm test
```

### Need Help?

If you encounter issues during migration:

1. Check that all `parsePackageJson` calls are properly awaited
2. Ensure all calling functions are marked as `async`
3. Verify that error handling still works as expected
4. Test with both catalog resolution enabled and disabled

For additional support, please file an issue on the GitHub repository.
