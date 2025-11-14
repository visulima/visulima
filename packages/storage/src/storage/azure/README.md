# Azure Blob Storage

Azure Blob Storage implementation for the Visulima upload storage system. Provides comprehensive Azure Blob Storage support with features like access tiers, snapshots, and metadata management.

## Features

- ✅ **Full Azure Compatibility**: Complete Azure Blob API support
- ✅ **Access Tiers**: Hot, Cool, Archive storage tiers
- ✅ **Blob Snapshots**: Point-in-time backups
- ✅ **Shared Access Signatures**: Secure access tokens
- ✅ **Metadata Support**: Rich metadata and tags
- ✅ **Conditional Operations**: ETags and conditional headers
- ✅ **Large File Support**: Block blobs up to 4.75TB

## Installation

```bash
npm install @azure/storage-blob
```

## Basic Usage

```typescript
import { AzureStorage } from "@visulima/upload/storage";

const storage = new AzureStorage({
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
    containerName: "my-container",
});

// Use storage...
const file = await storage.create(request, {
    contentType: "image/jpeg",
    metadata: { filename: "photo.jpg" },
});
```

## Configuration

### Connection String

```typescript
const storage = new AzureStorage({
    connectionString: "DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net",
    containerName: "uploads",
});
```

### Account Key Authentication

```typescript
const storage = new AzureStorage({
    accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
    accountName: "mystorageaccount",
    containerName: "uploads",
});
```

### Advanced Configuration

```typescript
const storage = new AzureStorage({
    accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
    accountName: "mystorageaccount",
    containerName: "uploads",

    // Generic storage config
    genericConfig: {
        checksumTypes: ["md5"],
        maxFileSize: 5 * 1024 * 1024 * 1024 * 1024, // 5TB
        optimizations: {
            bulkBatchSize: 50,
            prefixTemplate: "uploads/{fileId}/",
            usePrefixes: true,
        },
    },
});
```

## Storage Features

Azure Blob Storage provides the following features:

- **File Operations**: Upload, download, delete, copy, move
- **Blob Types**: Block blobs, Append blobs, Page blobs
- **Metadata Support**: Custom metadata and system metadata
- **Checksum Validation**: MD5
- **Access Tiers**: Hot, Cool (limited storage classes)
- **Shared Access Signatures**: Secure access tokens
- **Block Uploads**: Large file uploads with resumability
- **Server-side Copy**: Efficient file copying within Azure
- **Conditional Operations**: ETags and conditional headers
- **Maximum File Size**: ~4.75TB per blob
- **Maximum Block Size**: 100MB per block

## Access Tiers

Azure supports different access tiers for cost optimization:

```typescript
// Access tiers are set during upload or via Azure portal/policies

// Hot tier (frequent access) - Default
// Cool tier (infrequent access, 30+ days)
// Archive tier (rare access, 180+ days)
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

## Blob Types

Azure supports different blob types:

### Block Blobs (Default)

Best for files under 100MB and general-purpose storage:

```typescript
// Automatically uses block blobs for most uploads
const file = await storage.create(request, {
    contentType: "image/jpeg",
    size: 1024 * 1024, // 1MB
});
```

### Append Blobs

Optimized for append operations:

```typescript
// For log files or streaming data
const file = await storage.create(request, {
    contentType: "text/plain",
    metadata: { blobType: "AppendBlob" },
});
```

## Metadata and Tags

Rich metadata support:

```typescript
const file = await storage.create(request, {
    contentType: "image/jpeg",
    metadata: {
        author: "John Doe",
        category: "photos",
        tags: "vacation,beach,summer",
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

## Shared Access Signatures (SAS)

While Azure storage doesn't provide built-in signed URLs like S3, you can generate SAS tokens:

```typescript
// Note: SAS token generation requires @azure/storage-blob helpers
import { generateBlobSASQueryParameters } from "@azure/storage-blob";

// Generate SAS token for blob access
const sasToken = generateBlobSASQueryParameters(
    {
        blobName: file.id,
        containerName: "my-container",
        expiresOn: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        permissions: BlobSASPermissions.parse("r"), // Read permission
        startsOn: new Date(),
    },
    accountKey,
).toString();

// Full URL with SAS token
const url = `https://${accountName}.blob.core.windows.net/${containerName}/${file.id}?${sasToken}`;
```

## Conditional Operations

Azure supports conditional operations using ETags:

```typescript
// Conditional get (only if not modified)
const file = await storage.get({
    conditions: {
        ifNoneMatch: "\"etag-value\"",
    },
    id: fileId,
});

// Conditional update
await storage.update({ id: fileId }, metadata, {
    conditions: {
        ifMatch: "\"current-etag\"",
    },
});
```

## Snapshots

Create point-in-time snapshots for backup:

```typescript
// Create snapshot
const snapshotId = await storage.createSnapshot(fileId);

// List snapshots
const snapshots = await storage.listSnapshots(fileId);

// Restore from snapshot
await storage.copy(snapshotId, fileId);
```

## Error Handling

Azure-specific errors are properly mapped:

```typescript
try {
    await storage.get({ id: "nonexistent" });
} catch (error) {
    console.log(error.code); // 'BlobNotFound'
    console.log(error.statusCode); // 404
    console.log(error.message); // 'The specified blob does not exist.'
}
```

Common Azure errors:

- `BlobNotFound` (404)
- `ContainerNotFound` (404)
- `InvalidBlobOrBlock` (400)
- `BlobAlreadyExists` (409)

## Performance Optimization

### Block Size Optimization

```typescript
const storage = new AzureStorage({
    // Optimize block size for your use case
    blockSize: 4 * 1024 * 1024, // 4MB blocks
    containerName: "uploads",
});
```

### Concurrent Uploads

```typescript
// Azure automatically handles concurrent block uploads
// Configure parallelism for better performance
const storage = new AzureStorage({
    containerName: "uploads",
    maxConcurrency: 5, // Concurrent block uploads
});
```

## Environment Variables

```bash
# Required (choose one method)
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net

# Or separate values
AZURE_STORAGE_ACCOUNT=myaccount
AZURE_STORAGE_ACCOUNT_KEY=mykey
AZURE_STORAGE_CONTAINER=mycontainer

# Optional
AZURE_STORAGE_API_VERSION=2020-04-08
```

## Azure Government Cloud

```typescript
const storage = new AzureStorage({
    accountKey: process.env.AZURE_GOV_ACCOUNT_KEY,
    accountName: "myaccount",
    containerName: "uploads",
    serviceEndpoint: "https://myaccount.blob.core.usgovcloudapi.net",
});
```

## Monitoring and Logging

Enable detailed logging:

```typescript
const storage = new AzureStorage({
    containerName: "uploads",
    logger: console,
    // Enable Azure SDK logging
    logging: {
        enable: true,
        level: "info",
    },
});
```

## Testing

Run Azure-specific tests:

```bash
# Run Azure tests
npm test -- --testPathPattern="azure.*test"

# With real Azure storage
AZURE_STORAGE_CONNECTION_STRING=... npm test
```

## Troubleshooting

### Connection Issues

```typescript
// Check connection
const storage = new AzureStorage({
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
    containerName: "test",
});

// Test connection
try {
    await storage.list(1);
    console.log("Connection successful");
} catch (error) {
    console.error("Connection failed:", error.message);
}
```

### Permission Issues

Ensure your connection string or account key has appropriate permissions:

- `Storage Blob Data Contributor` role
- Or specific permissions: Read, Write, Delete, List

### Firewall Configuration

If using Azure Storage Firewall:

```typescript
// Add your IP or VNet to allowed list in Azure portal
// Or use Shared Access Signatures for secure access
```
