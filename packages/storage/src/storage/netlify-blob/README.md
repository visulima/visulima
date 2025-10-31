# Netlify Blob Storage

Netlify Blob Storage implementation for the Visulima upload storage system. Provides full Netlify Blobs compatibility with features like metadata support, store organization, and seamless integration with Netlify Functions and Edge Functions.

## Features

- ✅ **Full Netlify Blobs Compatibility**: Complete Netlify Blobs API support
- ✅ **Store Organization**: Organize blobs into named stores
- ✅ **Metadata Support**: Rich metadata and custom headers
- ✅ **Automatic Cleanup**: TTL support for temporary files
- ✅ **Simple Operations**: Create, read, update, delete operations
- ✅ **Advanced Operations**: Copy and move operations
- ✅ **Netlify Integration**: Works seamlessly with Netlify Functions and Edge Functions

## Installation

```bash
npm install @netlify/blobs
```

## Basic Usage

```typescript
import { NetlifyBlobStorage } from "@visulima/upload/storage";

const storage = new NetlifyBlobStorage({
    storeName: "uploads",
});

const file = await storage.create(request, {
    contentType: "image/jpeg",
    metadata: { filename: "photo.jpg" },
});
```

## Integration with Base Handler

```typescript
import { Upload } from "@visulima/upload";
import { NetlifyBlobStorage } from "@visulima/upload/storage";

// Create storage with custom store name
const storage = new NetlifyBlobStorage({
    storeName: "user-uploads",
});

// Use with upload handler
const upload = new Upload({ storage });

app.use("/upload", upload);
```

## Configuration

### Environment Variables

```bash
# Optional - for explicit site access
NETLIFY_SITE_ID=your-site-id

# Optional - for API access outside Netlify environment
NETLIFY_TOKEN=your-api-token
```

### Basic Configuration

```typescript
const storage = new NetlifyBlobStorage({
    storeName: "uploads",
});
```

### Advanced Configuration

```typescript
const storage = new NetlifyBlobStorage({
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

    // Netlify Blob specific config
    storeName: "uploads",
    siteID: process.env.NETLIFY_SITE_ID, // Optional
    token: process.env.NETLIFY_TOKEN, // Optional
});
```

## Storage Features

Netlify Blobs provides the following features:

- **File Operations**: Upload, download, delete, copy, move
- **Store Organization**: Multiple named stores per site
- **Metadata Support**: Custom metadata and system metadata
- **Content Types**: Automatic content-type detection
- **Maximum File Size**: Up to 500MB per blob (with Netlify plan limits)
- **List Operations**: Paginated listing with filtering

## Store Organization

Organize blobs into named stores:

```typescript
// Different stores for different purposes
const imageStorage = new NetlifyBlobStorage({
    storeName: "images",
});

const documentStorage = new NetlifyBlobStorage({
    storeName: "documents",
});

const videoStorage = new NetlifyBlobStorage({
    storeName: "videos",
});
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

// Metadata is stored with the blob and can be retrieved
const retrieved = await storage.get({ id: file.id });
console.log(retrieved.metadata); // { author: "John Doe", ... }
```

## Serving Blobs

Netlify Blobs don't provide direct public URLs. You'll need to serve them through Netlify Functions or Edge Functions:

### Using Netlify Functions

```typescript
// netlify/functions/serve-blob.ts
import { getStore } from "@netlify/blobs";
import type { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
    const store = getStore({ name: "uploads" });
    const key = event.pathParameters?.key;

    if (!key) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Missing key" }),
        };
    }

    const blob = await store.get(key, { type: "blob" });

    if (!blob) {
        return {
            statusCode: 404,
            body: JSON.stringify({ error: "Not found" }),
        };
    }

    const metadata = await store.getMetadata(key);

    return {
        statusCode: 200,
        headers: {
            "Content-Type": metadata?.contentType || "application/octet-stream",
        },
        body: await blob.text(),
        isBase64Encoded: false,
    };
};
```

### Using Edge Functions

```typescript
// netlify/edge-functions/serve-blob.ts
import { getStore } from "@netlify/blobs";

export default async (request: Request) => {
    const url = new URL(request.url);
    const key = url.pathname.split("/").pop();

    if (!key) {
        return new Response("Missing key", { status: 400 });
    }

    const store = getStore({ name: "uploads" });
    const blob = await store.get(key, { type: "blob" });

    if (!blob) {
        return new Response("Not found", { status: 404 });
    }

    const metadata = await store.getMetadata(key);

    return new Response(blob, {
        headers: {
            "Content-Type": metadata?.contentType || "application/octet-stream",
        },
    });
};
```

## Folders and Organization

Netlify Blob supports folder-like organization using key prefixes:

```typescript
// Upload to "folder"
const file = await storage.create(request, {
    contentType: "image/jpeg",
    metadata: { filename: "photo.jpg" },
});

// The naming function can create folder structure
const storage = new NetlifyBlobStorage({
    storeName: "uploads",
    filename: (file) => `images/${Date.now()}-${file.originalName}`,
});
```

## Error Handling

Netlify Blob-specific errors are properly handled:

```typescript
try {
    await storage.get({ id: "nonexistent" });
} catch (error) {
    console.log(error.message); // File not found in Netlify Blob
}
```

Common errors:

- `File not found`: Blob does not exist
- `Store not found`: Store name doesn't exist
- `Unauthorized`: Invalid token or missing permissions

## Performance Optimization

### Bulk Operations

```typescript
// List operations support pagination
const files = await storage.list(100); // Get first 100 files
```

### Caching

```typescript
const storage = new NetlifyBlobStorage({
    storeName: "uploads",
    genericConfig: {
        cache: new MemoryCache(), // Use memory cache for metadata
    },
});
```

## Environment Setup

### Netlify Platform

When deploying to Netlify, the blob store is automatically available:

```bash
# In Netlify dashboard: Site Settings > Environment Variables (if needed)
NETLIFY_SITE_ID=your-site-id
NETLIFY_TOKEN=your-api-token
```

### Local Development

```bash
# .env.local
NETLIFY_SITE_ID=your-site-id
NETLIFY_TOKEN=your-api-token
```

## Testing

Run Netlify Blob-specific tests:

```bash
# Run Netlify Blob tests
npm test -- --testPathPattern="netlify-blob.*test"

# With real Netlify Blob
NETLIFY_TOKEN=... npm test
```

## Troubleshooting

### Authentication Issues

```typescript
// Verify store access
const storage = new NetlifyBlobStorage({
    storeName: "uploads",
});

try {
    await storage.list(1);
    console.log("Store access successful");
} catch (error) {
    console.error("Store access failed:", error.message);
    // Check store name and permissions
}
```

### Upload Failures

```typescript
// Check file size limits
const MAX_SIZE = 500 * 1024 * 1024; // 500MB (Netlify plan dependent)

if (file.size && file.size > MAX_SIZE) {
    console.error("File too large for Netlify Blob");
}
```

### Store Access Issues

Ensure the store name matches across your application:

```typescript
// Make sure store names are consistent
const storage = new NetlifyBlobStorage({
    storeName: "uploads", // Must match in all places
});
```

## Pricing Considerations

Netlify Blob pricing is based on:

- **Storage**: GB per month (plan dependent)
- **Operations**: Per operation cost (plan dependent)
- **Bandwidth**: GB transferred (plan dependent)

Monitor usage in Netlify dashboard to optimize costs.

## Migration from Other Storage

### From Vercel Blob

```typescript
// Before (Vercel Blob)
const vercelStorage = new VercelBlobStorage({
    token: process.env.BLOB_READ_WRITE_TOKEN,
});

// After (Netlify Blob)
const netlifyStorage = new NetlifyBlobStorage({
    storeName: "uploads",
});
```

### Key Differences

- Netlify Blob uses named stores instead of a single global namespace
- No direct public URLs - must serve through Functions or Edge Functions
- Store-based organization vs. path-based organization
- Metadata is stored separately and can be retrieved independently

## Best Practices

1. **Use descriptive store names**: `user-uploads`, `profile-images`, `documents`
2. **Organize by purpose**: Separate stores for different content types
3. **Use TTL for temporary files**: Automatically clean up temporary uploads
4. **Serve through Edge Functions**: For better performance and caching
5. **Monitor store size**: Keep an eye on storage usage per store
