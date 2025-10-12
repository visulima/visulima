# File Operations

Functions for reading, writing, moving, and removing files.

## readFile

Asynchronously reads the contents of a file.

### Signature

```typescript
function readFile<O extends ReadFileOptions<C>, C extends "brotli" | "gzip" | "none" = "none">(
    path: URL | string,
    options?: O
): Promise<ContentType<O>>
```

### Parameters

- `path` (`URL | string`) - The path to the file
- `options` (`ReadFileOptions`) - Optional reading options
  - `encoding` (`ReadFileEncoding`) - Character encoding (default: `"utf8"`)
  - `buffer` (`boolean`) - Return as Buffer instead of string (default: `false`)
  - `compression` (`"none" | "gzip" | "brotli"`) - Decompression method (default: `"none"`)
  - `flag` (`string | number`) - File system flag (default: `"r"`)

### Returns

`Promise<string | Buffer>` - File contents as string or Buffer based on options

### Examples

```typescript
import { readFile } from "@visulima/fs";

// Read as string (default)
const text = await readFile("./file.txt");

// Read as buffer
const buffer = await readFile("./image.png", { buffer: true });

// Read compressed file
const compressed = await readFile("./file.txt.gz", { compression: "gzip" });

// Read with specific encoding
const content = await readFile("./file.txt", { encoding: "utf-16le" });
```

## readFileSync

Synchronously reads the contents of a file.

### Signature

```typescript
function readFileSync<O extends ReadFileOptions<C>, C extends "brotli" | "gzip" | "none" = "none">(
    path: URL | string,
    options?: O
): ContentType<O>
```

### Parameters

Same as `readFile`.

### Returns

`string | Buffer` - File contents as string or Buffer based on options

### Examples

```typescript
import { readFileSync } from "@visulima/fs";

const text = readFileSync("./file.txt");
const buffer = readFileSync("./image.png", { buffer: true });
```

## writeFile

Asynchronously writes content to a file, creating parent directories if needed.

### Signature

```typescript
function writeFile(
    path: URL | string,
    data: Buffer | string | Uint8Array,
    options?: WriteFileOptions
): Promise<void>
```

### Parameters

- `path` (`URL | string`) - The path to the file
- `data` (`string | Buffer | Uint8Array`) - Content to write
- `options` (`WriteFileOptions`) - Optional writing options
  - `encoding` (`BufferEncoding`) - Character encoding (default: `"utf8"`)
  - `mode` (`number`) - File mode/permissions (default: `0o666`)
  - `flag` (`string`) - File system flag (default: `"w"`)
  - `recursive` (`boolean`) - Create parent directories (default: `true`)
  - `overwrite` (`boolean`) - Overwrite if exists (default: `false`)
  - `chown` (`{ uid: number, gid: number }`) - Set ownership

### Returns

`Promise<void>`

### Examples

```typescript
import { writeFile } from "@visulima/fs";

// Basic write
await writeFile("./file.txt", "Hello, World!");

// Write with automatic directory creation
await writeFile("./path/to/nested/file.txt", "content");

// Write with specific options
await writeFile("./file.txt", "content", {
    encoding: "utf8",
    mode: 0o644,
    overwrite: true,
});

// Write buffer
const buffer = Buffer.from("binary data");
await writeFile("./data.bin", buffer);

// Prevent overwriting
try {
    await writeFile("./existing.txt", "new content", { overwrite: false });
} catch (error) {
    console.error("File already exists");
}
```

## writeFileSync

Synchronously writes content to a file.

### Signature

```typescript
function writeFileSync(
    path: URL | string,
    data: Buffer | string | Uint8Array,
    options?: WriteFileOptions
): void
```

### Parameters

Same as `writeFile`.

### Returns

`void`

### Examples

```typescript
import { writeFileSync } from "@visulima/fs";

writeFileSync("./file.txt", "Hello, World!");
writeFileSync("./path/to/file.txt", "content", { recursive: true });
```

## move

Asynchronously moves or renames a file or directory.

### Signature

```typescript
function move(
    source: URL | string,
    destination: URL | string,
    options?: MoveOptions
): Promise<void>
```

### Parameters

- `source` (`URL | string`) - Source path
- `destination` (`URL | string`) - Destination path
- `options` (`MoveOptions`) - Optional move options
  - `overwrite` (`boolean`) - Overwrite if destination exists (default: `false`)

### Returns

`Promise<void>`

### Examples

```typescript
import { move } from "@visulima/fs";

// Move/rename file
await move("./old-name.txt", "./new-name.txt");

// Move to different directory
await move("./file.txt", "./backup/file.txt");

// Overwrite existing file
await move("./source.txt", "./dest.txt", { overwrite: true });

// Move directory
await move("./old-dir", "./new-dir");
```

## moveSync

Synchronously moves or renames a file or directory.

### Signature

```typescript
function moveSync(
    source: URL | string,
    destination: URL | string,
    options?: MoveOptions
): void
```

### Parameters

Same as `move`.

### Returns

`void`

### Examples

```typescript
import { moveSync } from "@visulima/fs";

moveSync("./old-name.txt", "./new-name.txt");
moveSync("./source.txt", "./dest.txt", { overwrite: true });
```

## rename

Alias for `move`. Asynchronously renames a file or directory.

### Signature

```typescript
function rename(
    source: URL | string,
    destination: URL | string,
    options?: MoveOptions
): Promise<void>
```

See [`move`](#move) for details.

## renameSync

Alias for `moveSync`. Synchronously renames a file or directory.

### Signature

```typescript
function renameSync(
    source: URL | string,
    destination: URL | string,
    options?: MoveOptions
): void
```

See [`moveSync`](#movesync) for details.

## remove

Asynchronously removes files or directories.

### Signature

```typescript
function remove(
    path: URL | string,
    options?: RetryOptions
): Promise<void>
```

### Parameters

- `path` (`URL | string`) - Path to remove
- `options` (`RetryOptions`) - Optional retry options
  - `maxRetries` (`number`) - Maximum retry attempts (default: `0`)
  - `retryDelay` (`number`) - Delay between retries in ms (default: `100`)

### Returns

`Promise<void>`

### Examples

```typescript
import { remove } from "@visulima/fs";

// Remove file
await remove("./file.txt");

// Remove directory and contents
await remove("./directory");

// Remove with retries (useful for Windows)
await remove("./locked-file.txt", {
    maxRetries: 3,
    retryDelay: 100,
});
```

## removeSync

Synchronously removes files or directories.

### Signature

```typescript
function removeSync(
    path: URL | string,
    options?: RetryOptions
): void
```

### Parameters

Same as `remove`.

### Returns

`void`

### Examples

```typescript
import { removeSync } from "@visulima/fs";

removeSync("./file.txt");
removeSync("./directory");
```

## isAccessible

Asynchronously checks if a path is accessible with specific permissions.

### Signature

```typescript
function isAccessible(
    path: URL | string,
    mode?: number
): Promise<boolean>
```

### Parameters

- `path` (`URL | string`) - Path to check
- `mode` (`number`) - Access mode to check (default: `F_OK`)
  - `F_OK` - File exists
  - `R_OK` - File is readable
  - `W_OK` - File is writable
  - `X_OK` - File is executable

### Returns

`Promise<boolean>` - `true` if accessible, `false` otherwise

### Examples

```typescript
import { isAccessible, F_OK, R_OK, W_OK, X_OK } from "@visulima/fs";

// Check if file exists
if (await isAccessible("./file.txt")) {
    console.log("File exists");
}

// Check if file is readable
if (await isAccessible("./file.txt", R_OK)) {
    console.log("File is readable");
}

// Check if file is writable
if (await isAccessible("./file.txt", W_OK)) {
    console.log("File is writable");
}

// Check if file is executable
if (await isAccessible("./script.sh", X_OK)) {
    console.log("File is executable");
}

// Check multiple permissions
if (await isAccessible("./file.txt", R_OK | W_OK)) {
    console.log("File is readable and writable");
}
```

## isAccessibleSync

Synchronously checks if a path is accessible with specific permissions.

### Signature

```typescript
function isAccessibleSync(
    path: URL | string,
    mode?: number
): boolean
```

### Parameters

Same as `isAccessible`.

### Returns

`boolean` - `true` if accessible, `false` otherwise

### Examples

```typescript
import { isAccessibleSync, R_OK } from "@visulima/fs";

if (isAccessibleSync("./file.txt", R_OK)) {
    console.log("File is readable");
}
```

## Types

### ReadFileOptions

```typescript
type ReadFileOptions<C> = {
    buffer?: boolean;
    compression?: C;
    encoding?: ReadFileEncoding | undefined;
    flag?: number | string | undefined;
};
```

### WriteFileOptions

```typescript
type WriteFileOptions = {
    chown?: {
        gid: number;
        uid: number;
    };
    encoding?: BufferEncoding | null | undefined;
    flag?: string | undefined;
    mode?: number;
    overwrite?: boolean;
    recursive?: boolean;
};
```

### MoveOptions

```typescript
type MoveOptions = {
    overwrite?: boolean;
};
```

### RetryOptions

```typescript
type RetryOptions = {
    maxRetries?: number | undefined;
    retryDelay?: number | undefined;
};
```

### ReadFileEncoding

```typescript
type ReadFileEncoding = 
    | "ascii"
    | "base64"
    | "base64url"
    | "hex"
    | "latin1"
    | "ucs-2"
    | "ucs2"
    | "utf-8"
    | "utf-16le"
    | "utf8"
    | "utf16le";
```

## Related

- [Directory Operations](./directory-operations.md)
- [JSON Operations](./json-operations.md)
- [YAML Operations](./yaml-operations.md)
