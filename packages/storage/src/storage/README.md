# Storage System

The storage system provides a unified interface for file upload, storage, and retrieval across multiple cloud providers and local storage. It supports AWS S3, Google Cloud Storage, Azure Blob Storage, and local disk storage.

### File Structure

```
storage/
├── storage.ts           # BaseStorage abstract class
├── types.ts             # Type definitions and interfaces
├── meta-storage.ts      # Metadata storage abstraction
├── index.ts             # Main exports
├── aws/                 # AWS S3 implementation
├── azure/               # Azure Blob Storage implementation
├── gcs/                 # Google Cloud Storage implementation
├── local/               # Local disk storage implementation
└── utils/               # Shared utilities
```

## Storage Operations

### Core Operations

All storage backends implement these standard operations:

- **`create(request, config)`**: Create a new file upload
- **`write(part)`**: Write data to a file
- **`get(query)`**: Retrieve file data
- **`delete(query)`**: Delete a file
- **`list(limit?)`**: List files
- **`copy(source, destination, options?)`**: Copy a file with optional storage class
- **`move(source, destination)`**: Move a file
- **`update(query, metadata)`**: Update file metadata
- **`exists(query)`**: Check if file exists

### Advanced Operations

Storage classes can be set during copy operations on supported backends.

## Usage Examples

### Basic Usage

```typescript
import { S3Storage } from "@visulima/upload/storage";

// Create storage instance
const storage = new S3Storage({
    bucket: "my-bucket",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    region: "us-east-1",
});

// Create a file
const file = await storage.create(request, {
    contentType: "image/jpeg",
    metadata: { filename: "photo.jpg" },
    size: 1024 * 1024, // 1MB
});

// Write data
await storage.write({
    body: imageBuffer,
    contentLength: imageBuffer.length,
    id: file.id,
    start: 0,
});

// Copy with storage class (AWS S3, GCS)
await storage.copy(file.id, "backup/photo.jpg", {
    storageClass: "STANDARD_IA",
});

// Get file
const fileData = await storage.get({ id: file.id });

console.log("File size:", fileData.size);
```

### With Optimizations

```typescript
const storage = new S3Storage({
    bucket: "my-bucket",
    credentials: {
        /* ... */
    },
    genericConfig: {
        optimizations: {
            bulkBatchSize: 50,
            cacheStorageClass: "STANDARD_IA",
            enableCDNHeaders: true,
            prefixTemplate: "uploads/{fileId}/",
            usePrefixes: true,
        },
    },
    region: "us-east-1",
});
```

## Error Handling

The storage system provides consistent error handling:

```typescript
try {
    const file = await storage.get({ id: "nonexistent" });
} catch (error) {
    // All storage backends normalize errors to HttpError format
    console.log("Status:", error.statusCode);
    console.log("Message:", error.message);
    console.log("Provider:", error.code); // Includes provider context
}
```

## Provider-Specific Documentation

- **[AWS S3](./aws/README.md)**: Amazon S3 implementation
- **[Google Cloud Storage](./gcs/README.md)**: GCS implementation
- **[Azure Blob Storage](./azure/README.md)**: Azure implementation
- **[Local Disk](./local/README.md)**: Local filesystem implementation

## File Metadata

Files are tracked with comprehensive metadata:

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

## Storage Classes

Some providers support different storage classes for cost optimization:

```typescript
// Set storage class during copy (S3, GCS)
await storage.copy(file.id, `archive/${file.id}`, { storageClass: "GLACIER" });
```

## TTL (Time-to-Live)

Set expiration times for files during creation or updates:

```typescript
// Create file with TTL
await storage.create(request, {
    contentType: "image/jpeg",
    metadata: { filename: "temp.jpg" },
    ttl: "30d", // Expires in 30 days
});

// Update file TTL
await storage.update({ id: file.id }, { ttl: 24 * 60 * 60 * 1000 }); // 24 hours
```

## Checksum Support

The storage system supports multiple checksum algorithms:

```typescript
const storage = new S3Storage({
    bucket: "my-bucket",
    genericConfig: {
        checksumTypes: ["md5", "crc32c", "sha256"],
    },
});

// Upload with checksum verification
await storage.write({
    body: data,
    checksum: "expected-md5-hash",
    checksumAlgorithm: "md5",
    contentLength: data.length,
    id: file.id,
    start: 0,
});
```

## Development

### Adding a New Storage Backend

1. Extend `BaseStorage<TFile, TFileReturn>`
2. Implement required abstract methods
3. Add provider-specific optimizations
4. Export from the provider's index.ts

### Testing

Each storage backend should have comprehensive tests covering:

- Basic CRUD operations
- Error conditions
- Provider-specific features
- Capability detection
- Optimization behavior
