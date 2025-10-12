# Error Types

Custom error classes for better error handling and debugging.

## JSONError

Error thrown when JSON parsing fails, with enhanced error messages including code frames.

### Constructor

```typescript
constructor(
    message: string,
    options?: {
        source?: string;
        location?: CodeFrameLocation;
        codeFrame?: string;
    }
)
```

### Properties

- `name`: `"JSONError"`
- `message`: Error message
- `source`: Source file/identifier (optional)
- `location`: Error location (line and column)
- `codeFrame`: Formatted code frame showing error location

### Examples

```typescript
import { readJson } from "@visulima/fs";
import { JSONError } from "@visulima/fs/error";

try {
    const data = await readJson("./config.json");
} catch (error) {
    if (error instanceof JSONError) {
        console.error("JSON parsing failed!");
        console.error(`Source: ${error.source}`);
        console.error(`Location: Line ${error.location?.line}, Column ${error.location?.column}`);
        console.error(error.codeFrame);
    }
}
```

### Error Output Example

```
JSON parsing failed in config.json at line 3, column 5:

  1 | {
  2 |   "name": "example",
  3 |   "invalid"
    |           ^
  4 | }

Unexpected end of JSON input
```

## NotFoundError

Error thrown when a file or directory is not found.

### Constructor

```typescript
constructor(
    message: string,
    path: string
)
```

### Properties

- `name`: `"NotFoundError"`
- `message`: Error message
- `path`: Path that was not found

### Examples

```typescript
import { readFile } from "@visulima/fs";
import { NotFoundError } from "@visulima/fs/error";

try {
    const content = await readFile("./nonexistent.txt");
} catch (error) {
    if (error instanceof NotFoundError) {
        console.error(`File not found: ${error.path}`);
        
        // Provide helpful message or fallback
        console.log("Creating default file...");
    }
}
```

## DirectoryError

Error thrown when directory operations fail.

### Constructor

```typescript
constructor(
    message: string,
    path: string
)
```

### Properties

- `name`: `"DirectoryError"`
- `message`: Error message
- `path`: Directory path

### Examples

```typescript
import { ensureDir } from "@visulima/fs";
import { DirectoryError } from "@visulima/fs/error";

try {
    await ensureDir("./my-directory");
} catch (error) {
    if (error instanceof DirectoryError) {
        console.error(`Directory operation failed: ${error.path}`);
        console.error(error.message);
    }
}
```

## AlreadyExistsError

Error thrown when attempting to create a file or link that already exists.

### Constructor

```typescript
constructor(
    message: string,
    path: string
)
```

### Properties

- `name`: `"AlreadyExistsError"`
- `message`: Error message
- `path`: Path that already exists

### Examples

```typescript
import { ensureSymlink } from "@visulima/fs";
import { AlreadyExistsError } from "@visulima/fs/error";

try {
    await ensureSymlink("./source.txt", "./link.txt");
} catch (error) {
    if (error instanceof AlreadyExistsError) {
        console.error(`Already exists: ${error.path}`);
        
        // Decide whether to overwrite or skip
        console.log("Skipping...");
    }
}
```

## NotEmptyError

Error thrown when attempting to remove a non-empty directory without recursion.

### Constructor

```typescript
constructor(
    message: string,
    path: string
)
```

### Properties

- `name`: `"NotEmptyError"`
- `message`: Error message
- `path`: Directory path

### Examples

```typescript
import { remove } from "@visulima/fs";
import { NotEmptyError } from "@visulima/fs/error";

try {
    await remove("./directory");
} catch (error) {
    if (error instanceof NotEmptyError) {
        console.error(`Directory not empty: ${error.path}`);
        console.log("Use emptyDir() to remove contents first");
    }
}
```

## PermissionError

Error thrown when lacking permissions for a file system operation.

### Constructor

```typescript
constructor(
    message: string,
    path: string
)
```

### Properties

- `name`: `"PermissionError"`
- `message`: Error message
- `path`: Path with permission issue

### Examples

```typescript
import { writeFile } from "@visulima/fs";
import { PermissionError } from "@visulima/fs/error";

try {
    await writeFile("/root/protected.txt", "data");
} catch (error) {
    if (error instanceof PermissionError) {
        console.error(`Permission denied: ${error.path}`);
        console.log("Run with appropriate permissions");
    }
}
```

## WalkError

Error thrown when directory walking encounters an error.

### Constructor

```typescript
constructor(
    message: string,
    path: string,
    cause?: Error
)
```

### Properties

- `name`: `"WalkError"`
- `message`: Error message
- `path`: Path where error occurred
- `cause`: Original error (if any)

### Examples

```typescript
import { walk } from "@visulima/fs";
import { WalkError } from "@visulima/fs/error";

try {
    for await (const entry of walk("./directory")) {
        console.log(entry.path);
    }
} catch (error) {
    if (error instanceof WalkError) {
        console.error(`Walk failed at: ${error.path}`);
        console.error(`Reason: ${error.message}`);
        
        if (error.cause) {
            console.error(`Caused by:`, error.cause);
        }
    }
}
```

## Common Patterns

### Comprehensive Error Handling

```typescript
import { readJson, ensureDir, remove } from "@visulima/fs";
import {
    JSONError,
    NotFoundError,
    DirectoryError,
    PermissionError,
} from "@visulima/fs/error";

async function safeOperation(path: string) {
    try {
        const data = await readJson(path);
        return data;
    } catch (error) {
        if (error instanceof JSONError) {
            console.error("Invalid JSON:", error.message);
            console.error(error.codeFrame);
        } else if (error instanceof NotFoundError) {
            console.error("File not found:", error.path);
        } else if (error instanceof DirectoryError) {
            console.error("Directory error:", error.message);
        } else if (error instanceof PermissionError) {
            console.error("Permission denied:", error.path);
        } else {
            console.error("Unknown error:", error);
        }
        
        throw error;
    }
}
```

### Error Recovery

```typescript
import { readJson, writeJson } from "@visulima/fs";
import { NotFoundError, JSONError } from "@visulima/fs/error";

async function loadConfigWithDefaults<T>(
    path: string,
    defaults: T
): Promise<T> {
    try {
        return await readJson<T>(path);
    } catch (error) {
        if (error instanceof NotFoundError) {
            // File doesn't exist, create with defaults
            await writeJson(path, defaults, { indent: 2 });
            return defaults;
        } else if (error instanceof JSONError) {
            // Invalid JSON, backup and create new
            await writeJson(`${path}.backup`, await readFile(path));
            await writeJson(path, defaults, { indent: 2 });
            console.warn(`Backed up invalid config to ${path}.backup`);
            return defaults;
        }
        throw error;
    }
}

const config = await loadConfigWithDefaults("./config.json", {
    name: "app",
    version: "1.0.0",
});
```

### Graceful Degradation

```typescript
import { findUp } from "@visulima/fs";
import { NotFoundError } from "@visulima/fs/error";

async function findConfigOrUseDefaults() {
    try {
        const configPath = await findUp("config.json");
        if (configPath) {
            return await readJson(configPath);
        }
    } catch (error) {
        if (error instanceof NotFoundError) {
            console.warn("Config not found, using defaults");
        } else {
            console.error("Error loading config:", error);
        }
    }
    
    // Return defaults
    return { default: true };
}
```

### Retry Logic

```typescript
import { writeFile } from "@visulima/fs";
import { PermissionError } from "@visulima/fs/error";

async function writeWithRetry(
    path: string,
    content: string,
    maxRetries = 3
): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await writeFile(path, content);
            return;
        } catch (error) {
            if (error instanceof PermissionError && attempt < maxRetries) {
                console.log(`Retry ${attempt}/${maxRetries}...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                throw error;
            }
        }
    }
}
```

### User-Friendly Messages

```typescript
import { readFile } from "@visulima/fs";
import {
    NotFoundError,
    PermissionError,
    JSONError,
} from "@visulima/fs/error";

async function readFileWithFriendlyErrors(path: string) {
    try {
        return await readFile(path);
    } catch (error) {
        let message = "An error occurred";
        
        if (error instanceof NotFoundError) {
            message = `The file "${path}" doesn't exist. Please check the path.`;
        } else if (error instanceof PermissionError) {
            message = `You don't have permission to read "${path}". Try running with elevated privileges.`;
        } else if (error instanceof JSONError) {
            message = `The file "${path}" contains invalid JSON:\n${error.codeFrame}`;
        }
        
        throw new Error(message);
    }
}
```

### Error Logging

```typescript
import { walk } from "@visulima/fs";
import { WalkError, PermissionError } from "@visulima/fs/error";

async function walkWithErrorLogging(directory: string) {
    const errors: Array<{ path: string; error: Error }> = [];
    
    try {
        for await (const entry of walk(directory)) {
            try {
                // Process entry
                await processEntry(entry);
            } catch (error) {
                errors.push({
                    path: entry.path,
                    error: error as Error,
                });
                
                if (error instanceof PermissionError) {
                    console.warn(`Skipping ${entry.path}: Permission denied`);
                    continue;
                }
                
                throw error;
            }
        }
    } catch (error) {
        if (error instanceof WalkError) {
            console.error(`Walk failed: ${error.message}`);
        }
    }
    
    // Report all errors
    if (errors.length > 0) {
        console.log(`Encountered ${errors.length} errors`);
        errors.forEach(({ path, error }) => {
            console.log(`  ${path}: ${error.message}`);
        });
    }
}
```

## Error Hierarchy

All custom errors extend the base `Error` class:

```
Error (base)
├── JSONError
├── NotFoundError
├── DirectoryError
├── AlreadyExistsError
├── NotEmptyError
├── PermissionError
└── WalkError
```

## Type Guards

Use `instanceof` to check error types:

```typescript
function isFileSystemError(error: unknown): boolean {
    return (
        error instanceof NotFoundError ||
        error instanceof DirectoryError ||
        error instanceof PermissionError ||
        error instanceof AlreadyExistsError ||
        error instanceof NotEmptyError
    );
}

try {
    await someOperation();
} catch (error) {
    if (isFileSystemError(error)) {
        console.error("File system error:", error.message);
    }
}
```

## Best Practices

1. **Always check error types** using `instanceof`
2. **Log error context** including file paths
3. **Provide recovery mechanisms** where appropriate
4. **Use code frames** for debugging JSON errors
5. **Handle permissions gracefully** with helpful messages
6. **Consider retry logic** for transient errors

## Related

- [File Operations](./file-operations.md)
- [JSON Operations](./json-operations.md)
- [Directory Operations](./directory-operations.md)
- [File Discovery](./file-discovery.md)
