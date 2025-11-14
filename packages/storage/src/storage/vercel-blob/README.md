# Vercel Blob Storage

Vercel Blob Storage implementation for the Visulima upload storage system. Provides full Vercel Blob compatibility with features like public/private access, metadata support, and global CDN integration.

## Features

- ✅ **Full Vercel Blob Compatibility**: Complete Vercel Blob API support
- ✅ **Public/Private Access**: Control blob accessibility
- ✅ **Global CDN**: Worldwide content delivery through Vercel's edge network
- ✅ **Metadata Support**: Rich metadata and custom headers
- ✅ **Signed URLs**: Pre-signed URLs for secure access (via Vercel Blob)
- ✅ **Automatic Cleanup**: TTL support for temporary files
- ✅ **Simple Operations**: Head, put, list, delete operations
- ✅ **Advanced Operations**: Copy operations counted for billing

## Installation

```bash
npm install @vercel/blob
```

## Basic Usage

```typescript
import { VercelBlobStorage } from "@visulima/upload/storage";

const storage = new VercelBlobStorage({
    token: process.env.BLOB_READ_WRITE_TOKEN,
});

const file = await storage.create(request, {
    contentType: "image/jpeg",
    metadata: { filename: "photo.jpg" },
});
```

## Integration with Base Handler

```typescript
import { Upload } from "@visulima/upload";
import { VercelBlobStorage } from "@visulima/upload/storage";

// Create storage with multipart enabled for large files
const storage = new VercelBlobStorage({
    multipart: 100 * 1024 * 1024, // Enable multipart for files > 100MB
    token: process.env.BLOB_READ_WRITE_TOKEN,
});

// Use with upload handler
const upload = new Upload({ storage });

// Files larger than 100MB will automatically use multipart uploads
app.use("/upload", upload);
```

## Multipart Uploads

Vercel Blob supports multipart uploads for large files, which provides better reliability and performance for big uploads.

### Enabling Multipart Uploads

```typescript
// Always use multipart uploads
const storage = new VercelBlobStorage({
    multipart: true,
    token: process.env.BLOB_READ_WRITE_TOKEN,
});

// Use multipart for files larger than 50MB
const storage = new VercelBlobStorage({
    multipart: 50 * 1024 * 1024, // 50MB threshold
    token: process.env.BLOB_READ_WRITE_TOKEN,
});

// Upload a large file (will automatically use multipart if enabled)
const file = await storage.create(request, {
    contentType: "video/mp4",
    size: 200 * 1024 * 1024, // 200MB video
});
```

### Benefits of Multipart Uploads

- **Reliability**: Failed parts can be retried individually
- **Performance**: Parallel upload of file chunks
- **Large Files**: Support for files up to 5GB
- **Resumability**: Better handling of network interruptions

## Configuration

### Environment Variables

```bash
# Required
BLOB_READ_WRITE_TOKEN=vercel_blob_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional
VERCEL_BLOB_TOKEN=vercel_blob_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Basic Configuration

```typescript
const storage = new VercelBlobStorage({
    token: process.env.BLOB_READ_WRITE_TOKEN,
});
```

### Advanced Configuration

```typescript
const storage = new VercelBlobStorage({
    // Generic storage config
    genericConfig: {
        checksumTypes: ["md5"],
        maxFileSize: 100 * 1024 * 1024, // 100MB
        optimizations: {
            bulkBatchSize: 50,
            enableCDNHeaders: true,
        },
    },

    // Meta storage configuration
    metaStorageConfig: {
        directory: "/tmp/upload-metafiles",
    },
    // Enable multipart uploads for large files
    multipart: true, // Always use multipart

    // OR
    multipart: 50 * 1024 * 1024, // Use multipart for files > 50MB

    token: process.env.BLOB_READ_WRITE_TOKEN,
});
```

## Storage Features

Vercel Blob provides the following features:

- **File Operations**: Upload, download, delete, copy
- **Access Control**: Public and private blob access
- **Metadata Support**: Custom metadata and system metadata
- **Content Types**: Automatic content-type detection
- **Cache Control**: CDN caching headers
- **Global Distribution**: Served through Vercel's edge network
- **Simple Operations**: Head, put, list operations
- **Advanced Operations**: Copy operations (counted for billing)
- **Maximum File Size**: 5GB per blob
- **Maximum Operations**: Rate limits apply

## Access Control

### Public Blobs

```typescript
const file = await storage.create(request, {
    contentType: "image/jpeg",
    metadata: { access: "public" }, // This is handled by Vercel Blob client
});
```

### Private Blobs

```typescript
// Vercel Blob handles private access through signed URLs
// Use the blob URL directly for private access
const blobUrl = file.url; // Private URL
```

## TTL (Time-to-Live)

Set expiration times for files:

```typescript
// Create file with TTL
const file = await storage.create(request, {
    contentType: "image/jpeg",
    metadata: { filename: "temp.jpg" },
    ttl: "30d", // Expires in 30 days
});

// Update file TTL
await storage.update(
    { id: file.id },
    { ttl: 24 * 60 * 60 * 1000 }, // 24 hours
);
```

## Operations and Billing

Vercel Blob has two types of operations:

### Simple Operations (Free)

- `head()` - Get blob metadata
- `put()` - Upload blob
- `list()` - List blobs

### Advanced Operations (Billed)

- `copy()` - Copy blob (downloads and re-uploads)

## Metadata and Headers

Rich metadata support:

```typescript
const file = await storage.create(request, {
    contentType: "image/jpeg",
    metadata: {
        author: "John Doe",
        category: "photos",
        customField: "custom-value",
        tags: "vacation,beach",
    },
});

// Vercel Blob automatically sets:
// - Content-Type
// - Content-Disposition
// - Cache-Control
// - Custom metadata headers
```

## Global CDN

Vercel Blob automatically serves content through Vercel's global edge network:

```typescript
// Files are automatically served through CDN
const cdnUrl = file.url; // https://blob.vercel-storage.com/...

// No additional configuration needed
// Vercel handles CDN caching automatically
```

## Folders and Organization

Vercel Blob supports folder-like organization using pathnames:

```typescript
// Upload to "folder"
const file = await storage.create(request, {
    contentType: "image/jpeg",
    metadata: { filename: "photo.jpg" },
});

// The naming function can create folder structure
const storage = new VercelBlobStorage({
    filename: (file) => `uploads/${Date.now()}-${file.originalName}`,
});
```

## Error Handling

Vercel Blob-specific errors are properly mapped:

```typescript
try {
    await storage.get({ id: "nonexistent" });
} catch (error) {
    console.log(error.code); // 'NOT_FOUND'
    console.log(error.statusCode); // 404
    console.log(error.message); // 'The specified blob does not exist.'
}
```

Common errors:

- `NOT_FOUND` (404): Blob does not exist
- `UNAUTHORIZED` (401): Invalid token
- `FORBIDDEN` (403): Access denied
- `PAYLOAD_TOO_LARGE` (413): File too large

## Performance Optimization

### CDN Headers

Enable CDN-friendly headers:

```typescript
const storage = new VercelBlobStorage({
    genericConfig: {
        optimizations: {
            enableCDNHeaders: true, // Add cache-control headers
        },
    },
});
```

### Bulk Operations

```typescript
// List operations support pagination
const files = await storage.list(100); // Get first 100 files
```

## Monitoring and Metrics

Vercel Blob provides metrics through the Vercel dashboard:

- Request count and performance
- Bandwidth usage
- Storage usage
- Error rates
- Geographic distribution

## Environment Setup

### Vercel Platform

When deploying to Vercel, set the environment variable in your project settings:

```bash
# In Vercel dashboard: Project Settings > Environment Variables
BLOB_READ_WRITE_TOKEN=vercel_blob_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Local Development

```bash
# .env.local
BLOB_READ_WRITE_TOKEN=vercel_blob_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Or .env
VERCEL_BLOB_TOKEN=vercel_blob_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Testing

Run Vercel Blob-specific tests:

```bash
# Run Vercel Blob tests
npm test -- --testPathPattern="vercel-blob.*test"

# With real Vercel Blob
BLOB_READ_WRITE_TOKEN=... npm test
```

## Troubleshooting

### Authentication Issues

```typescript
// Verify token
const storage = new VercelBlobStorage({
    token: process.env.BLOB_READ_WRITE_TOKEN,
});

try {
    await storage.list(1);
    console.log("Authentication successful");
} catch (error) {
    console.error("Authentication failed:", error.message);
    // Check token format and permissions
}
```

### Upload Failures

```typescript
// Check file size limits
const MAX_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

if (file.size > MAX_SIZE) {
    console.error("File too large for Vercel Blob");
}
```

### CORS Issues

For web applications, ensure proper CORS configuration:

```typescript
// Vercel Blob automatically handles CORS for Vercel deployments
// For custom domains, configure CORS in Vercel dashboard
```

## Pricing Considerations

Vercel Blob pricing is based on:

- **Storage**: GB per month
- **Bandwidth**: GB transferred
- **Advanced Operations**: Per operation cost

Monitor usage in Vercel dashboard to optimize costs.

## Migration from Other Storage

### From AWS S3

```typescript
// Before (S3)
const s3Storage = new S3Storage({ bucket: "my-bucket" });

// After (Vercel Blob)
const blobStorage = new VercelBlobStorage({
    token: process.env.BLOB_READ_WRITE_TOKEN,
});
```

### Key Differences

- Vercel Blob URLs are always publicly accessible (unless deleted)
- No direct private access - use application-level access control
- Automatic global CDN distribution
- Simpler API with fewer configuration options
