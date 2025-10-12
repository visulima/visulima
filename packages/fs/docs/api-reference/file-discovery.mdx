# File Discovery

Functions for walking directory trees, collecting entries, and finding files up the directory hierarchy.

## walk

Asynchronously walks a directory tree and yields entries.

### Signature

```typescript
async function* walk(
    path: URL | string,
    options?: WalkOptions
): AsyncIterableIterator<WalkEntry>
```

### Parameters

- `path` (`URL | string`) - Directory path to walk
- `options` (`WalkOptions`) - Optional walk options
  - `maxDepth` (`number`) - Maximum depth to recurse (default: `Infinity`)
  - `includeFiles` (`boolean`) - Include file entries (default: `true`)
  - `includeDirs` (`boolean`) - Include directory entries (default: `true`)
  - `includeSymlinks` (`boolean`) - Include symlink entries (default: `true`)
  - `followSymlinks` (`boolean`) - Follow symlinks (default: `false`)
  - `extensions` (`string[]`) - Filter by file extensions
  - `match` (`(RegExp | string)[]`) - Include patterns (globs or regex)
  - `skip` (`(RegExp | string)[]`) - Exclude patterns (globs or regex)

### Returns

`AsyncIterableIterator<WalkEntry>` - Async iterator of directory entries

### Examples

```typescript
import { walk } from "@visulima/fs";

// Basic directory walk
for await (const entry of walk("./src")) {
    console.log(entry.path);
}

// Filter by file extension
for await (const entry of walk("./src", {
    extensions: [".ts", ".tsx"],
})) {
    console.log(entry.path);
}

// Skip directories
for await (const entry of walk("./", {
    skip: ["node_modules", ".git", "dist"],
})) {
    console.log(entry.path);
}

// Match patterns
for await (const entry of walk("./src", {
    match: ["**/*.test.ts"], // Glob pattern
})) {
    console.log("Test file:", entry.path);
}

// Limit depth
for await (const entry of walk("./", {
    maxDepth: 2, // Only walk 2 levels deep
})) {
    console.log(entry.path);
}

// Only files, no directories
for await (const entry of walk("./src", {
    includeDirs: false,
})) {
    if (entry.isFile) {
        console.log(entry.path);
    }
}

// Follow symlinks
for await (const entry of walk("./src", {
    followSymlinks: true,
})) {
    console.log(entry.path);
}
```

## walkSync

Synchronously walks a directory tree and yields entries.

### Signature

```typescript
function* walkSync(
    path: URL | string,
    options?: WalkOptions
): IterableIterator<WalkEntry>
```

### Parameters

Same as `walk`.

### Returns

`IterableIterator<WalkEntry>` - Iterator of directory entries

### Examples

```typescript
import { walkSync } from "@visulima/fs";

for (const entry of walkSync("./src")) {
    console.log(entry.path);
}

for (const entry of walkSync("./src", { extensions: [".ts"] })) {
    console.log(entry.path);
}
```

## collect

Asynchronously collects all entries from a directory walk into an array.

### Signature

```typescript
function collect(
    path: URL | string,
    options?: WalkOptions
): Promise<WalkEntry[]>
```

### Parameters

Same as `walk`.

### Returns

`Promise<WalkEntry[]>` - Array of all directory entries

### Examples

```typescript
import { collect } from "@visulima/fs";

// Collect all files
const entries = await collect("./src");
console.log(`Found ${entries.length} entries`);

// Collect only TypeScript files
const tsFiles = await collect("./src", {
    extensions: [".ts", ".tsx"],
    includeDirs: false,
});

// Process all entries
entries.forEach(entry => {
    if (entry.isFile) {
        console.log("File:", entry.path);
    } else if (entry.isDirectory) {
        console.log("Dir:", entry.path);
    }
});
```

## collectSync

Synchronously collects all entries from a directory walk into an array.

### Signature

```typescript
function collectSync(
    path: URL | string,
    options?: WalkOptions
): WalkEntry[]
```

### Parameters

Same as `walk`.

### Returns

`WalkEntry[]` - Array of all directory entries

### Examples

```typescript
import { collectSync } from "@visulima/fs";

const entries = collectSync("./src");
const jsFiles = collectSync("./src", {
    extensions: [".js"],
    includeDirs: false,
});
```

## findUp

Asynchronously finds a file or directory by walking up the directory tree.

### Signature

```typescript
function findUp(
    name: FindUpName,
    options?: FindUpOptions
): Promise<string | undefined>
```

### Parameters

- `name` (`FindUpName`) - File/directory name, array of names, or matcher function
  - `string` - Single filename to find
  - `string[]` - Array of filenames (finds first match)
  - `(directory: string) => FindUpNameFnResult` - Custom matcher function
- `options` (`FindUpOptions`) - Optional search options
  - `cwd` (`string | URL`) - Starting directory (default: `process.cwd()`)
  - `type` (`"file" | "directory"`) - Type to find (default: `"file"`)
  - `stopAt` (`string | URL`) - Directory to stop at (default: root)
  - `allowSymlinks` (`boolean`) - Allow symlinks (default: `true`)

### Returns

`Promise<string | undefined>` - Path to found entry or `undefined`

### Examples

```typescript
import { findUp, FIND_UP_STOP } from "@visulima/fs";

// Find single file
const packageJson = await findUp("package.json");
console.log(packageJson); // "/path/to/project/package.json"

// Find first match from array
const config = await findUp([
    ".eslintrc.js",
    ".eslintrc.json",
    ".eslintrc.yml",
]);

// Find directory
const nodeModules = await findUp("node_modules", {
    type: "directory",
});

// Custom starting directory
const readme = await findUp("README.md", {
    cwd: "/path/to/subdirectory",
});

// Stop at specific directory
const file = await findUp("config.json", {
    stopAt: "/home/user",
});

// Custom matcher function
const customFile = await findUp(async (directory) => {
    const hasPackage = await isAccessible(
        join(directory, "package.json")
    );
    
    if (hasPackage) {
        return "package.json";
    }
    
    // Stop searching
    if (directory === "/home") {
        return FIND_UP_STOP;
    }
    
    // Continue searching
    return undefined;
});

// Multiple conditions
const found = await findUp((dir) => {
    // Custom logic to determine what to find
    if (existsSync(join(dir, ".git"))) {
        return ".git";
    }
    return undefined;
});
```

## findUpSync

Synchronously finds a file or directory by walking up the directory tree.

### Signature

```typescript
function findUpSync(
    name: FindUpNameSync,
    options?: FindUpOptions
): string | undefined
```

### Parameters

Same as `findUp`, except the matcher function is synchronous.

### Returns

`string | undefined` - Path to found entry or `undefined`

### Examples

```typescript
import { findUpSync } from "@visulima/fs";

const packageJson = findUpSync("package.json");
const config = findUpSync([".config.js", ".config.json"]);
const gitDir = findUpSync(".git", { type: "directory" });
```

## Common Patterns

### Finding All TypeScript Files

```typescript
import { collect } from "@visulima/fs";

async function findAllTsFiles(directory: string) {
    return await collect(directory, {
        extensions: [".ts", ".tsx"],
        includeDirs: false,
        skip: ["node_modules", "dist", ".git"],
    });
}

const files = await findAllTsFiles("./src");
```

### Finding Test Files

```typescript
import { walk } from "@visulima/fs";

async function findTestFiles() {
    const testFiles: string[] = [];
    
    for await (const entry of walk(".", {
        match: ["**/*.test.ts", "**/*.spec.ts"],
        skip: ["node_modules"],
    })) {
        testFiles.push(entry.path);
    }
    
    return testFiles;
}
```

### Finding Project Root

```typescript
import { findUp } from "@visulima/fs";
import { dirname } from "node:path";

async function findProjectRoot(): Promise<string | undefined> {
    // Find package.json to determine project root
    const packagePath = await findUp("package.json");
    
    if (packagePath) {
        return dirname(packagePath);
    }
    
    return undefined;
}
```

### Walking with File Processing

```typescript
import { walk } from "@visulima/fs";
import { readFile } from "@visulima/fs";

async function processAllJsonFiles(directory: string) {
    for await (const entry of walk(directory, {
        extensions: [".json"],
        includeDirs: false,
    })) {
        try {
            const content = await readFile(entry.path);
            console.log(`Processing ${entry.name}`);
            // Process content...
        } catch (error) {
            console.error(`Error processing ${entry.path}:`, error);
        }
    }
}
```

### Finding Configuration Files

```typescript
import { findUp } from "@visulima/fs";

async function findConfig(
    configNames: string[]
): Promise<string | undefined> {
    return await findUp(configNames, {
        cwd: process.cwd(),
    });
}

// Usage
const config = await findConfig([
    "myapp.config.js",
    "myapp.config.json",
    ".myapprc",
]);
```

### Collecting Files by Size

```typescript
import { collect } from "@visulima/fs";
import { stat } from "node:fs/promises";

async function findLargeFiles(
    directory: string,
    minSizeBytes: number
): Promise<string[]> {
    const entries = await collect(directory, {
        includeDirs: false,
    });
    
    const largeFiles: string[] = [];
    
    for (const entry of entries) {
        const stats = await stat(entry.path);
        if (stats.size >= minSizeBytes) {
            largeFiles.push(entry.path);
        }
    }
    
    return largeFiles;
}

// Find files larger than 1MB
const large = await findLargeFiles("./", 1024 * 1024);
```

## Types

### WalkOptions

```typescript
interface WalkOptions {
    extensions?: string[];
    followSymlinks?: boolean;
    includeDirs?: boolean;
    includeFiles?: boolean;
    includeSymlinks?: boolean;
    match?: (RegExp | string)[];
    maxDepth?: number;
    skip?: (RegExp | string)[];
}
```

### WalkEntry

```typescript
interface WalkEntry {
    name: string;
    path: string;
    isFile: boolean;
    isDirectory: boolean;
    isSymbolicLink: boolean;
}
```

### FindUpOptions

```typescript
interface FindUpOptions {
    allowSymlinks?: boolean;
    cwd?: URL | string;
    stopAt?: URL | string;
    type?: "directory" | "file";
}
```

### FindUpName

```typescript
type FindUpName = 
    | string
    | string[]
    | ((directory: string) => FindUpNameFnResult);

type FindUpNameFnResult = 
    | PathLike
    | Promise<PathLike | typeof FIND_UP_STOP>
    | typeof FIND_UP_STOP
    | undefined;
```

## Pattern Matching

Both glob patterns and regular expressions are supported for `match` and `skip` options:

### Glob Patterns

```typescript
// Match all test files
match: ["**/*.test.ts", "**/*.spec.ts"]

// Skip build directories
skip: ["**/dist/**", "**/build/**"]

// Match specific directories
match: ["src/**/*.ts"]
```

### Regular Expressions

```typescript
// Match files with numbers
match: [/\d+\.js$/]

// Skip temporary files
skip: [/\.tmp$/, /~$/]
```

## Performance Tips

1. Use `maxDepth` to limit recursion depth
2. Use `skip` to exclude large directories early (e.g., `node_modules`)
3. Prefer `walk` over `collect` for large directories (streaming)
4. Use `extensions` for efficient filtering
5. Avoid following symlinks unless necessary

## Related

- [File Operations](./file-operations.md)
- [Directory Operations](./directory-operations.md)
