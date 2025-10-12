# Size Utilities

Functions for calculating file sizes with support for gzip and brotli compression. Memory-efficient with streaming support for large files.

## gzipSize

Asynchronously calculates the gzipped size of the input.

### Signature

```typescript
function gzipSize(
    input: Buffer | Readable | URL | string,
    options?: ZlibOptions
): Promise<number>
```

### Parameters

- `input` (`Buffer | Readable | URL | string`) - Input to measure
  - `Buffer` - Direct buffer data
  - `Readable` - Stream of data
  - `URL` - Path to file
  - `string` - File path or string content
- `options` (`ZlibOptions`) - Optional gzip compression options

### Returns

`Promise<number>` - Gzipped size in bytes

### Examples

```typescript
import { gzipSize } from "@visulima/fs/size";
import { Readable } from "node:stream";

// From string content
const text = "Lorem ipsum dolor sit amet";
const size = await gzipSize(text);
console.log(`Gzipped size: ${size} bytes`);

// From file path
const fileSize = await gzipSize("./large-file.txt");

// From URL
const urlSize = await gzipSize(new URL("file:///path/to/file.txt"));

// From buffer
const buffer = Buffer.from(text);
const bufferSize = await gzipSize(buffer);

// From stream (memory-efficient for large files)
const stream = Readable.from(text);
const streamSize = await gzipSize(stream);

// With custom gzip options
const customSize = await gzipSize(text, {
    level: 9, // Maximum compression
});
```

## gzipSizeSync

Synchronously calculates the gzipped size of the input.

### Signature

```typescript
function gzipSizeSync(
    input: Buffer | URL | string,
    options?: ZlibOptions
): number
```

### Parameters

- `input` (`Buffer | URL | string`) - Input to measure (no Readable support)
- `options` (`ZlibOptions`) - Optional gzip compression options

### Returns

`number` - Gzipped size in bytes

### Examples

```typescript
import { gzipSizeSync } from "@visulima/fs/size";

const size = gzipSizeSync("Hello, World!");
const fileSize = gzipSizeSync("./file.txt");

// With options
const size = gzipSizeSync(buffer, { level: 6 });
```

## brotliSize

Asynchronously calculates the Brotli compressed size of the input.

### Signature

```typescript
function brotliSize(
    input: Buffer | Readable | URL | string,
    options?: BrotliOptions
): Promise<number>
```

### Parameters

- `input` (`Buffer | Readable | URL | string`) - Input to measure
- `options` (`BrotliOptions`) - Optional Brotli compression options

### Returns

`Promise<number>` - Brotli compressed size in bytes

### Examples

```typescript
import { brotliSize } from "@visulima/fs/size";
import { Readable } from "node:stream";

// From string
const text = "This is a test string for Brotli compression";
const size = await brotliSize(text);
console.log(`Brotli size: ${size} bytes`);

// From file
const fileSize = await brotliSize("./large-file.txt");

// From URL
const urlSize = await brotliSize(new URL("file:///path/to/file.txt"));

// From buffer
const buffer = Buffer.from(text);
const bufferSize = await brotliSize(buffer);

// From stream
const stream = Readable.from(text);
const streamSize = await brotliSize(stream);

// With custom Brotli options
import { constants } from "node:zlib";
const customSize = await brotliSize(text, {
    params: {
        [constants.BROTLI_PARAM_QUALITY]: 11, // Maximum compression
    },
});
```

## brotliSizeSync

Synchronously calculates the Brotli compressed size of the input.

### Signature

```typescript
function brotliSizeSync(
    input: Buffer | URL | string,
    options?: BrotliOptions
): number
```

### Parameters

- `input` (`Buffer | URL | string`) - Input to measure
- `options` (`BrotliOptions`) - Optional Brotli compression options

### Returns

`number` - Brotli compressed size in bytes

### Examples

```typescript
import { brotliSizeSync } from "@visulima/fs/size";

const size = brotliSizeSync("Hello, World!");
const fileSize = brotliSizeSync("./file.txt");
```

## rawSize

Asynchronously calculates the raw (uncompressed) size of the input.

### Signature

```typescript
function rawSize(
    input: Buffer | Readable | URL | string
): Promise<number>
```

### Parameters

- `input` (`Buffer | Readable | URL | string`) - Input to measure

### Returns

`Promise<number>` - Raw size in bytes

### Examples

```typescript
import { rawSize } from "@visulima/fs/size";
import { Readable } from "node:stream";

// From string
const text = "Hello, World!";
const size = await rawSize(text);
console.log(`Raw size: ${size} bytes`);

// From file
const fileSize = await rawSize("./file.txt");

// From URL
const urlSize = await rawSize(new URL("file:///path/to/file.txt"));

// From buffer
const buffer = Buffer.from(text);
const bufferSize = await rawSize(buffer);

// From stream
const stream = Readable.from(text);
const streamSize = await rawSize(stream);
```

## rawSizeSync

Synchronously calculates the raw (uncompressed) size of the input.

### Signature

```typescript
function rawSizeSync(
    input: Buffer | URL | string
): number
```

### Parameters

- `input` (`Buffer | URL | string`) - Input to measure

### Returns

`number` - Raw size in bytes

### Examples

```typescript
import { rawSizeSync } from "@visulima/fs/size";

const size = rawSizeSync("Hello, World!");
const fileSize = rawSizeSync("./file.txt");
const bufferSize = rawSizeSync(Buffer.from("data"));
```

## Common Patterns

### Comparing Compression Methods

```typescript
import { rawSize, gzipSize, brotliSize } from "@visulima/fs/size";

async function compareCompression(filePath: string) {
    const raw = await rawSize(filePath);
    const gzip = await gzipSize(filePath);
    const brotli = await brotliSize(filePath);
    
    console.log(`Raw size:    ${raw} bytes`);
    console.log(`Gzip size:   ${gzip} bytes (${((gzip / raw) * 100).toFixed(1)}%)`);
    console.log(`Brotli size: ${brotli} bytes (${((brotli / raw) * 100).toFixed(1)}%)`);
    
    return { raw, gzip, brotli };
}

await compareCompression("./large-file.txt");
```

### Build Size Analysis

```typescript
import { gzipSize, brotliSize } from "@visulima/fs/size";
import { collect } from "@visulima/fs";

async function analyzeBuildSizes(buildDir: string) {
    const entries = await collect(buildDir, {
        extensions: [".js", ".css"],
        includeDirs: false,
    });
    
    const results = await Promise.all(
        entries.map(async (entry) => {
            const gzip = await gzipSize(entry.path);
            const brotli = await brotliSize(entry.path);
            
            return {
                file: entry.name,
                gzip,
                brotli,
            };
        })
    );
    
    // Sort by gzip size
    results.sort((a, b) => b.gzip - a.gzip);
    
    console.table(results);
}

await analyzeBuildSizes("./dist");
```

### Monitoring File Sizes

```typescript
import { gzipSize } from "@visulima/fs/size";

async function checkBundleSize(
    filePath: string,
    maxSizeKB: number
): Promise<boolean> {
    const size = await gzipSize(filePath);
    const sizeKB = size / 1024;
    
    console.log(`Bundle size: ${sizeKB.toFixed(2)} KB (gzipped)`);
    
    if (sizeKB > maxSizeKB) {
        console.error(`Bundle exceeds maximum size of ${maxSizeKB} KB!`);
        return false;
    }
    
    console.log(`Bundle size is within limits`);
    return true;
}

// Usage in CI/CD
const isValid = await checkBundleSize("./dist/bundle.js", 100);
if (!isValid) {
    process.exit(1);
}
```

### Size Report Generation

```typescript
import { rawSize, gzipSize, brotliSize } from "@visulima/fs/size";
import { writeJson } from "@visulima/fs";

interface SizeReport {
    file: string;
    raw: number;
    gzip: number;
    brotli: number;
}

async function generateSizeReport(
    files: string[],
    outputPath: string
): Promise<void> {
    const reports: SizeReport[] = [];
    
    for (const file of files) {
        const [raw, gzip, brotli] = await Promise.all([
            rawSize(file),
            gzipSize(file),
            brotliSize(file),
        ]);
        
        reports.push({ file, raw, gzip, brotli });
    }
    
    await writeJson(outputPath, {
        timestamp: new Date().toISOString(),
        reports,
    }, { indent: 2 });
}

await generateSizeReport(
    ["./dist/main.js", "./dist/vendor.js"],
    "./size-report.json"
);
```

### Stream Processing for Large Files

```typescript
import { gzipSize } from "@visulima/fs/size";
import { createReadStream } from "node:fs";

async function calculateLargeFileSize(filePath: string) {
    // Create a readable stream for memory-efficient processing
    const stream = createReadStream(filePath);
    
    // gzipSize handles streams efficiently
    const size = await gzipSize(stream);
    
    return size;
}

// Process very large file without loading into memory
const size = await calculateLargeFileSize("./very-large-file.bin");
```

### Formatted Output

```typescript
import { rawSize, gzipSize, brotliSize } from "@visulima/fs/size";

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

async function displayFileSizes(filePath: string) {
    const [raw, gzip, brotli] = await Promise.all([
        rawSize(filePath),
        gzipSize(filePath),
        brotliSize(filePath),
    ]);
    
    console.log(`File: ${filePath}`);
    console.log(`Raw:    ${formatBytes(raw)}`);
    console.log(`Gzip:   ${formatBytes(gzip)}`);
    console.log(`Brotli: ${formatBytes(brotli)}`);
}

await displayFileSizes("./bundle.js");
```

## Performance Considerations

### Async vs Sync

- **Async functions** (`gzipSize`, `brotliSize`, `rawSize`)
  - Non-blocking, suitable for I/O operations
  - Support streaming for large files
  - Recommended for web servers and CLI tools

- **Sync functions** (`gzipSizeSync`, `brotliSizeSync`, `rawSizeSync`)
  - Blocking, simpler for scripts
  - No stream support
  - Use only for small files or build scripts

### Memory Efficiency

```typescript
import { gzipSize } from "@visulima/fs/size";
import { createReadStream } from "node:fs";

// Memory-efficient for large files (streaming)
const stream = createReadStream("./large-file.bin");
const size = await gzipSize(stream);

// Less efficient (loads entire file into memory)
const size = await gzipSize("./large-file.bin");
```

### Compression Levels

```typescript
import { gzipSize } from "@visulima/fs/size";

// Faster, larger size
const fast = await gzipSize(data, { level: 1 });

// Balanced (default)
const balanced = await gzipSize(data, { level: 6 });

// Slower, smaller size
const best = await gzipSize(data, { level: 9 });
```

## Use Cases

1. **Build Size Monitoring** - Track bundle sizes in CI/CD
2. **Performance Analysis** - Compare compression algorithms
3. **Asset Optimization** - Identify large assets
4. **CDN Optimization** - Calculate transfer sizes
5. **Storage Planning** - Estimate compressed storage needs

## Related

- [File Operations](./file-operations.md)
- Node.js [zlib documentation](https://nodejs.org/api/zlib.html)
