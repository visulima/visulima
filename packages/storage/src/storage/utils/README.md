# Storage Utilities

Shared utility functions and classes used across all storage backends in the Visulima upload system. These utilities provide common functionality for file handling, metadata management, and storage operations.

## Directory Structure

```
utils/
├── file/                    # File-related utilities
│   ├── index.ts            # Main exports
│   ├── file.ts             # Core file types and classes
│   ├── metadata.ts         # Metadata handling
│   ├── extract-mime-type.ts # MIME type extraction
│   ├── extract-original-name.ts # Filename extraction
│   ├── file-name.ts        # File naming utilities
│   ├── get-file-status.ts  # Upload status calculation
│   ├── has-content.ts      # Content checking
│   ├── is-expired.ts       # Expiration checking
│   ├── part-match.ts       # Upload part matching
│   ├── types.ts            # Type definitions
│   └── update-metadata.ts  # Metadata updates
└── README.md               # This file
```

## Core File Types

### UploadFile Interface

The core file interface used across all storage backends:

```typescript
interface UploadFile {
    bytesWritten: number; // Bytes uploaded so far
    contentType: string; // MIME type
    createdAt?: Date | number; // Creation timestamp
    expiredAt?: Date | number; // Expiration timestamp
    hash?: FileHash; // File hash information
    id: string; // Unique file identifier
    metadata?: Record<string, any>; // Custom metadata
    modifiedAt?: Date | number; // Last modified timestamp
    name?: string; // Original filename
    size?: number; // File size in bytes
    status?: UploadEventType; // Upload status
}
```

### File Classes

#### S3File, GCSFile, AzureFile

Provider-specific file implementations:

```typescript
class S3File extends UploadFile {
    // AWS S3 specific properties and methods
    bucket: string;

    key: string;

    etag?: string;
}

class GCSFile extends UploadFile {
    // Google Cloud Storage specific properties
    bucket: string;

    name: string;

    generation?: string;
}

class AzureFile extends UploadFile {
    // Azure Blob Storage specific properties
    container: string;

    blobName: string;

    etag?: string;
}
```

## File Operations

### File Status Management

```typescript
import { getFileStatus } from "./utils/file/get-file-status";

// Determine upload status based on bytes written vs total size
const status = getFileStatus(file);
// Returns: 'created', 'part', 'completed'
```

### Content Validation

```typescript
import { hasContent } from "./utils/file/has-content";

// Check if upload part has actual content
if (hasContent(part)) {
    // Process the content
}
```

### Expiration Checking

```typescript
import { isExpired } from "./utils/file/is-expired";

// Check if file has expired
if (isExpired(file)) {
    // Handle expired file
}
```

## Metadata Management

### Metadata Handling

```typescript
import { Metadata } from "./utils/file/metadata";

// Create metadata object
const metadata = new Metadata({
    contentType: "image/jpeg",
    filename: "photo.jpg",
});

// Serialize for storage
const serialized = metadata.toString();

// Parse from storage
const parsed = Metadata.parse(serializedMetadata);
```

### Metadata Updates

```typescript
import { updateMetadata } from "./utils/file/update-metadata";

// Update file metadata
const updatedFile = updateMetadata(file, {
    processed: true,
    thumbnailUrl: "/thumbnails/photo.jpg",
});
```

## MIME Type Handling

### MIME Type Extraction

```typescript
import { extractMIMEType } from "./utils/file/extract-mime-type";

// Extract MIME type from request
const mimeType = extractMIMEType(request);
// Returns: 'image/jpeg', 'application/pdf', etc.
```

### Filename Extraction

```typescript
import { extractOriginalName } from "./utils/file/extract-original-name";

// Extract original filename from request
const filename = extractOriginalName(request);
// Returns: 'photo.jpg', 'document.pdf', etc.
```

## File Naming

### File Name Generation

```typescript
import { FileName } from "./utils/file/file-name";

// Generate unique file names
const filename = FileName.generate("photo.jpg");
// Returns: 'photo-abc123.jpg'

// Validate filenames
if (FileName.isValid(filename)) {
    // Filename is safe to use
}

// Configure naming patterns
FileName.configure({
    prefix: "upload-",
    suffix: "-processed",
});
```

## Upload Part Management

### Part Matching

```typescript
import { partMatch } from "./utils/file/part-match";

// Check if upload part matches expected chunk
if (partMatch(part, expectedStart, expectedSize)) {
    // Part is valid
}
```

### Size Updates

```typescript
import { updateSize } from "./utils/file/update-size";

// Update file size information
const updatedFile = updateSize(file, newBytesWritten);
```

## Utility Functions

### Checksum Validation

```typescript
// Checksum validation is handled by individual storage backends
// using the checksumTypes configuration

const storage = new S3Storage({
    bucket: "my-bucket",
    genericConfig: {
        checksumTypes: ["md5", "crc32c", "sha256"],
    },
});
```

### Hash Generation

File hashing for integrity verification:

```typescript
// Hash information stored in file metadata
interface FileHash {
    algorithm: string; // 'md5', 'sha1', 'sha256', etc.
    value: string; // Hex-encoded hash value
}
```

## Error Handling

### File Operation Errors

```typescript
import { ERRORS } from "../utils";

// Common error codes
ERRORS.FILE_ERROR; // General file operation error
ERRORS.FILE_NOT_FOUND; // File not found
ERRORS.INVALID_CHECKSUM; // Checksum validation failed
```

## Testing Utilities

### Mock Files

Create mock files for testing:

```typescript
import { File } from "./utils/file/file";

// Create test file
const testFile = new File({
    contentType: "image/jpeg",
    id: "test-123",
    metadata: { test: true },
    size: 1_024_000,
});
```

## Performance Considerations

### Memory Management

```typescript
// Large file handling
const storage = new DiskStorage({
    directory: "/uploads",
    // Configure buffer sizes for optimal memory usage
    highWaterMark: 64 * 1024, // 64KB chunks
});
```

### Concurrent Access

```typescript
// File locking prevents corruption
await storage.write({
    body: data,
    contentLength: data.length,
    id: file.id,
    start: 0,
});
// Automatic locking during operations
```

## Configuration

### Utility Configuration

```typescript
// Configure global utility behavior
FileName.configure({
    invalidPrefixes: ["..", "."],
    invalidSuffixes: [".exe", ".bat"],
    maxLength: 255,
});
```

## Development Guidelines

### Adding New Utilities

1. **File Organization**: Place utilities in appropriate subdirectories
2. **Type Safety**: Ensure all utilities are fully typed
3. **Error Handling**: Provide clear error messages
4. **Testing**: Include comprehensive test coverage
5. **Documentation**: Document all public APIs

### Utility Design Principles

- **Pure Functions**: Prefer pure functions over classes where possible
- **Immutability**: Avoid mutating input objects
- **Type Safety**: Leverage TypeScript for compile-time safety
- **Performance**: Optimize for common use cases
- **Compatibility**: Work across all storage backends

## Common Patterns

### File Processing Pipeline

```typescript
// Typical file processing flow
const processFile = async (request: Request) => {
    // 1. Extract metadata
    const mimeType = extractMIMEType(request);
    const filename = extractOriginalName(request);

    // 2. Create file record
    const file = await storage.create(request, {
        contentType: mimeType,
        metadata: { source: "upload" },
        originalName: filename,
    });

    // 3. Process upload
    // ... upload logic ...

    // 4. Update metadata
    const processedFile = updateMetadata(file, {
        processed: true,
        processedAt: new Date(),
    });

    return processedFile;
};
```

### Error Recovery

```typescript
// Handle upload interruptions
const resumeUpload = async (fileId: string) => {
    const file = await storage.get({ id: fileId });

    if (isExpired(file)) {
        throw new Error("Upload expired");
    }

    if (getFileStatus(file) === "completed") {
        return file; // Already done
    }

    // Resume from last position
    return file;
};
```

## Troubleshooting

### Common Issues

1. **Invalid File Names**

    ```typescript
    // Check filename validity
    if (!FileName.isValid(filename)) {
        throw new Error("Invalid filename");
    }
    ```

2. **Memory Issues with Large Files**

    ```typescript
    // Use streaming for large files
    const stream = fs.createReadStream(largeFile);

    await storage.write({
        body: stream,
        contentLength: stats.size,
        id: file.id,
        start: 0,
    });
    ```

3. **Metadata Corruption**

    ```typescript
    // Validate metadata before saving
    const validMetadata = sanitizeMetadata(rawMetadata);

    await storage.update({ id: file.id }, { metadata: validMetadata });
    ```

## Contributing

When adding new utilities:

1. **Test Coverage**: Ensure 100% test coverage
2. **Type Definitions**: Provide complete TypeScript types
3. **Documentation**: Update this README with new utilities
4. **Backwards Compatibility**: Don't break existing APIs
5. **Performance**: Profile and optimize for performance
