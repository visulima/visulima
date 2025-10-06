# AWS S3 Storage

Amazon S3 (Simple Storage Service) implementation for the Visulima upload storage system. Provides full S3 compatibility with advanced features like multipart uploads, storage classes, and lifecycle management.

## Features

- ✅ **Full S3 Compatibility**: Complete S3 API support
- ✅ **Multipart Uploads**: Efficient large file uploads
- ✅ **Storage Classes**: Standard, IA, Glacier, etc.
- ✅ **Signed URLs**: Pre-signed URLs for direct uploads/downloads
- ✅ **Server-side Copy**: Efficient file copying within S3
- ✅ **Lifecycle Policies**: Automatic TTL and storage class transitions
- ✅ **Custom Endpoints**: Support for S3-compatible services (MinIO, etc.)

## Installation

```bash
npm install @aws-sdk/client-s3
```

## Basic Usage

```typescript
import { S3Storage } from "@visulima/upload/storage";

const storage = new S3Storage({
    bucket: "my-upload-bucket",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    region: "us-east-1",
});

// Use storage...
const file = await storage.create(request, {
    contentType: "image/jpeg",
    metadata: { filename: "photo.jpg" },
});
```

## Configuration

### Basic Configuration

```typescript
const storage = new S3Storage({
    bucket: "my-bucket",
    credentials: {
        accessKeyId: "AKIA...",
        secretAccessKey: "secret...",
    },
    region: "us-east-1",
});
```

### Advanced Configuration

```typescript
const storage = new S3Storage({
    bucket: "my-bucket",
    clientDirectUpload: true, // Enable direct uploads
    credentials: {
        /* ... */
    },

    // Generic storage config
    genericConfig: {
        checksumTypes: ["md5", "crc32c", "sha256"],
        maxFileSize: 100 * 1024 * 1024 * 1024, // 100GB
        optimizations: {
            cacheStorageClass: "STANDARD_IA",
            enableCompression: false,
            prefixTemplate: "uploads/{fileId}/",
            usePrefixes: true,
        },
    },
    // Storage-specific options
    partSize: 8 * 1024 * 1024, // 8MB parts

    region: "us-east-1",
});
```

## Storage Features

AWS S3 provides the following features:

- **File Operations**: Upload, download, delete, copy, move
- **Metadata Support**: Custom metadata and system metadata
- **Checksum Validation**: MD5, CRC32, CRC32C, SHA1, SHA256
- **Storage Classes**: Standard, IA, Glacier, Deep Archive
- **Lifecycle Policies**: Automatic TTL and class transitions
- **Signed URLs**: Pre-signed URLs for secure access
- **Multipart Uploads**: Large file uploads with resumability
- **Server-side Copy**: Efficient file copying within S3
- **Conditional Operations**: ETags and conditional headers
- **Maximum File Size**: 5TB per file
- **Maximum Part Size**: 5GB per part

## S3-Compatible Services

The S3 storage works with any S3-compatible service:

### MinIO

```typescript
const storage = new S3Storage({
    bucket: "my-bucket",
    credentials: {
        accessKeyId: "minio-user",
        secretAccessKey: "minio-password",
    },
    endpoint: "https://minio.example.com",
    forcePathStyle: true, // Required for MinIO
    region: "us-east-1",
});
```

### DigitalOcean Spaces

```typescript
const storage = new S3Storage({
    bucket: "my-space",
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY!,
        secretAccessKey: process.env.DO_SPACES_SECRET!,
    },
    endpoint: "https://nyc3.digitaloceanspaces.com",
    region: "nyc3",
});
```

### Cloudflare R2

```typescript
const storage = new S3Storage({
    bucket: "my-r2-bucket",
    credentials: {
        accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
    },
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: "auto",
});
```

## Multipart Uploads

S3 storage automatically handles multipart uploads for large files:

```typescript
// Large file upload (automatically uses multipart)
const file = await storage.create(request, {
    contentType: "video/mp4",
    size: 2 * 1024 * 1024 * 1024, // 2GB
});

// The storage will automatically:
// - Split into 8MB parts (configurable)
// - Upload parts in parallel
// - Complete multipart upload
// - Handle failures and retries
```

## Storage Classes

Optimize costs by using different storage classes:

```typescript
// Set storage class during copy for cost optimization
await storage.copy(file.id, `archive/${file.id}`, { storageClass: "GLACIER" });
```

## TTL (Time-to-Live)

Set expiration times for files:

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

## Lifecycle Management

Configure automatic lifecycle policies:

```typescript
// Files automatically transition to cheaper storage
// This is configured in S3 bucket lifecycle rules, not in code
// The storage.setTTL() method can be used with lifecycle policies
await storage.setTTL({ id: file.id }, 365 * 24 * 60 * 60 * 1000); // 1 year
```

## Signed URLs

Generate pre-signed URLs for direct access:

```typescript
// Generate signed URL for download (1 hour expiry)
const downloadUrl = await storage.getUrl({ id: file.id }, 60 * 60 * 1000);

// Generate signed URL for upload (direct upload)
const uploadUrl = await storage.getUploadUrl({ id: file.id }, 60 * 60 * 1000);
```

## Server-side Copy

Efficiently copy files within S3:

```typescript
// Copy file within same bucket
await storage.copy("source-file-id", "destination-file-id");

// Copy with storage class
await storage.copy("source-file-id", "archive/file-id", {
    storageClass: "GLACIER",
});

// Copy between buckets (if same region/account)
await storage.copy("bucket1/file-id", "bucket2/file-id");
```

## Error Handling

S3-specific errors are properly mapped:

```typescript
try {
    await storage.get({ id: "nonexistent" });
} catch (error) {
    console.log(error.code); // 'NoSuchKey'
    console.log(error.statusCode); // 404
    console.log(error.message); // 'The specified key does not exist.'
}
```

## Client Configurations

### Backblaze B2

```typescript
import { S3Storage } from "@visulima/upload/storage/aws";

const storage = new S3Storage({
    bucket: "my-bucket",
    credentials: {
        accessKeyId: process.env.B2_KEY_ID!,
        secretAccessKey: process.env.B2_APPLICATION_KEY!,
    },
    endpoint: "https://s3.us-west-002.backblazeb2.com",
    region: "us-west-002", // B2 region
});
```

### Wasabi

```typescript
const storage = new S3Storage({
    bucket: "my-bucket",
    credentials: {
        accessKeyId: process.env.WASABI_ACCESS_KEY!,
        secretAccessKey: process.env.WASABI_SECRET_KEY!,
    },
    endpoint: "https://s3.wasabisys.com",
    region: "us-east-1",
});
```

## Performance Optimization

### Parallel Uploads

```typescript
const storage = new S3Storage({
    bucket: "my-bucket",
    // Increase concurrency for faster uploads
    maxConcurrency: 10,
    // Adjust part size based on file size and network
    partSize: 16 * 1024 * 1024, // 16MB parts
});
```

### CDN Integration

```typescript
const storage = new S3Storage({
    bucket: "my-bucket",
    genericConfig: {
        optimizations: {
            cacheStorageClass: "STANDARD_IA",
            enableCDNHeaders: true, // Add CDN-friendly headers
        },
    },
});
```

## Monitoring and Debugging

Enable detailed logging for debugging:

```typescript
const storage = new S3Storage({
    bucket: "my-bucket",
    logger: console,
    // Enable AWS SDK logging
    logLevel: "debug",
});
```

## Environment Variables

```bash
# Required
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1

# Optional
AWS_S3_BUCKET=my-bucket
AWS_ENDPOINT=https://custom-s3-endpoint.com
```

## Testing

The S3 storage includes comprehensive tests. To run them:

```bash
# Run S3-specific tests
npm test -- --testPathPattern="s3.*test"

# Run with real S3 (requires credentials)
AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... npm test
```
