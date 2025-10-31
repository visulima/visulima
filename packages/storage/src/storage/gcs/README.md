# Google Cloud Storage

Google Cloud Storage (GCS) implementation for the Visulima upload storage system. Provides full GCS compatibility with advanced features like storage classes, lifecycle management, and global CDN integration.

## Features

- ✅ **Full GCS Compatibility**: Complete GCS API support
- ✅ **Storage Classes**: Standard, Nearline, Coldline, Archive
- ✅ **Lifecycle Policies**: Automatic TTL and storage transitions
- ✅ **Signed URLs**: V4 signed URLs for secure access
- ✅ **Global CDN**: Worldwide content delivery
- ✅ **Versioning**: Object versioning support
- ✅ **Custom Metadata**: Rich metadata support
- ✅ **Resumable Uploads**: Large file upload support

## Installation

```bash
npm install @google-cloud/storage
```

## Basic Usage

```typescript
import { GCStorage } from "@visulima/upload/storage";

const storage = new GCStorage({
    bucket: "my-upload-bucket",
    credentials: {
        client_email: "...",
        client_id: "...",
        private_key: "...",
        private_key_id: "...",
        project_id: "my-project-id",
        type: "service_account",
    },
    projectId: "my-project-id",
});

// Use storage...
const file = await storage.create(request, {
    contentType: "image/jpeg",
    metadata: { filename: "photo.jpg" },
});
```

## Configuration

### Service Account Key

```typescript
const storage = new GCStorage({
    bucket: "my-bucket",
    keyFilename: "/path/to/service-account-key.json",
    projectId: "my-project-123",
});
```

### Environment Variables

```typescript
// Set GOOGLE_APPLICATION_CREDENTIALS
process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/key.json";

const storage = new GCStorage({
    bucket: "my-bucket",
    projectId: "my-project-123",
});
```

### Advanced Configuration

```typescript
const storage = new GCStorage({
    bucket: "my-bucket",
    credentials: {
        /* service account */
    },
    // Generic storage config
    genericConfig: {
        checksumTypes: ["md5", "crc32c"],
        maxFileSize: 5 * 1024 * 1024 * 1024 * 1024, // 5TB
        optimizations: {
            cacheStorageClass: "NEARLINE",
            enableCompression: false,
            prefixTemplate: "uploads/{fileId}/",
            usePrefixes: true,
        },
    },

    projectId: "my-project-123",

    // GCS-specific options
    retryOptions: {
        maxRetryDelay: 64_000,
        retryableErrorFn: (error) => error.code !== 404,
        retryDelayMultiplier: 2,
        totalTimeout: 600_000, // 10 minutes
    },
});
```

## Storage Features

Google Cloud Storage provides the following features:

- **File Operations**: Upload, download, delete, copy, move
- **Metadata Support**: Custom metadata and system metadata
- **Checksum Validation**: MD5, CRC32C
- **Storage Classes**: Standard, Nearline, Coldline, Archive
- **Lifecycle Policies**: Automatic TTL and class transitions
- **Signed URLs**: V4 signed URLs for secure access
- **Resumable Uploads**: Large file uploads with continuation
- **Server-side Copy**: Efficient file copying within GCS
- **Conditional Operations**: ETags and conditional headers
- **Maximum File Size**: 5TB per file
- **Maximum Part Size**: 2GB per part

## Storage Classes

GCS offers different storage classes for cost optimization:

```typescript
// Set storage class during copy
await storage.copy(file.id, `archive/${file.id}`, { storageClass: "COLDLINE" });
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
// Set TTL (moves to cheaper storage automatically)
await storage.setTTL({ id: file.id }, 30 * 24 * 60 * 60 * 1000); // 30 days

// GCS lifecycle rules can be configured in the console or via API
// to automatically transition files between storage classes
```

## Signed URLs

Generate V4 signed URLs for secure access:

```typescript
// Generate signed URL for download (1 hour)
const downloadUrl = await storage.getUrl({ id: file.id }, 60 * 60 * 1000);

// Generate signed URL for upload
const uploadUrl = await storage.getUploadUrl({ id: file.id }, 60 * 60 * 1000);
```

## Resumable Uploads

GCS supports resumable uploads for large files:

```typescript
// Large file upload (automatically resumable)
const file = await storage.create(request, {
    contentType: "video/mp4",
    size: 10 * 1024 * 1024 * 1024, // 10GB
});

// The storage will automatically:
// - Use resumable upload protocol
// - Handle network interruptions
// - Resume from last successful chunk
// - Provide upload progress
```

## Custom Metadata

Rich metadata support:

```typescript
const file = await storage.create(request, {
    contentType: "image/jpeg",
    metadata: {
        author: "John Doe",
        customField: "custom-value",
        tags: ["vacation", "beach"],
    },
});

// Update metadata
await storage.update(
    { id: file.id },
    {
        metadata: { ...file.metadata, processed: true },
    },
);
```

## Versioning

Enable object versioning for backup and recovery:

```typescript
// Enable versioning in GCS console or via API
// Then access specific versions
const versions = await storage.listVersions(fileId);
const latestVersion = await storage.get({ generation: versionId, id: fileId });
```

## CDN Integration

GCS integrates seamlessly with Google Cloud CDN:

```typescript
const storage = new GCStorage({
    bucket: "my-bucket",
    genericConfig: {
        optimizations: {
            cacheStorageClass: "NEARLINE",
            enableCDNHeaders: true, // Add CDN-friendly headers
        },
    },
});

// Copy with storage class
await storage.copy("file1", "archive/file1", {
    storageClass: "COLDLINE",
});

// Files served through CDN automatically
// Configure CDN in Google Cloud Console
```

## Error Handling

GCS-specific errors are properly mapped:

```typescript
try {
    await storage.get({ id: "nonexistent" });
} catch (error) {
    console.log(error.code); // 'Not Found'
    console.log(error.statusCode); // 404
    console.log(error.message); // 'The specified key does not exist.'
}
```

## Global Distribution

GCS provides worldwide data distribution:

### Multi-region Buckets

```typescript
// Create multi-region bucket for global distribution
const storage = new GCStorage({
    bucket: "my-global-bucket",
    location: "us", // Multi-region
});

// Automatic replication across regions
// Lower latency for global users
```

### Regional Buckets

```typescript
// Regional bucket for single region performance
const storage = new GCStorage({
    bucket: "my-regional-bucket",
    location: "us-central1",
});
```

## Performance Optimization

### Upload Optimization

```typescript
const storage = new GCStorage({
    bucket: "my-bucket",
    // Increase chunk size for faster uploads
    chunkSize: 8 * 1024 * 1024, // 8MB
    // Optimize for large files
    retryOptions: {
        maxRetries: 3,
        retryDelayMultiplier: 1.5,
    },
});
```

### Download Optimization

```typescript
// Use signed URLs for direct downloads
const signedUrl = await storage.getUrl({ id: file.id }, 3_600_000);
// Users download directly from GCS, not through your server
```

## Environment Variables

```bash
# Service Account
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Or explicit credentials
GCS_PROJECT_ID=my-project-id
GCS_BUCKET=my-bucket
GCS_KEY_FILENAME=/path/to/key.json

# Optional
GCS_STORAGE_API_VERSION=v1
GCS_RETRY_LIMIT=3
```

## Monitoring and Metrics

GCS provides detailed metrics and monitoring:

```typescript
// Enable detailed logging
const storage = new GCStorage({
    bucket: "my-bucket",
    logger: console,
});

// GCS metrics available in Google Cloud Console:
// - Request count, latency, error rates
// - Storage usage by class
// - Network egress
// - API costs
```

## Testing

Run GCS-specific tests:

```bash
# Run GCS tests
npm test -- --testPathPattern="gcs.*test"

# With real GCS
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json npm test
```

## Troubleshooting

### Authentication Issues

```typescript
// Verify credentials
const storage = new GCStorage({
    bucket: "test-bucket",
    projectId: "test-project",
});

// Test authentication
try {
    await storage.list(1);
    console.log("Authentication successful");
} catch (error) {
    console.error("Authentication failed:", error.message);
    // Check service account permissions
    // Ensure Storage Object Admin role
}
```

### Permission Issues

Ensure your service account has appropriate permissions:

- `Storage Object Admin` - Full control
- `Storage Object Creator` - Upload only
- `Storage Object Viewer` - Read only

### CORS Configuration

For web applications, configure CORS in GCS:

```bash
# Use gsutil or Cloud Console
gsutil cors set cors-config.json gs://my-bucket

# cors-config.json
[
  {
    "origin": ["https://myapp.com"],
    "method": ["GET", "POST", "PUT"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

### Quota Limits

Be aware of GCS quotas:

- 1000 requests/second per bucket
- 5TB/day upload limit (can be increased)
- Rate limits vary by operation type

For high-traffic applications, consider:

- Multiple buckets
- Regional buckets for lower latency
- CDN integration to reduce origin requests
