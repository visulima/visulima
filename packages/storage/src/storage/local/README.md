# Local Disk Storage

Local filesystem storage implementation for the Visulima upload system. Provides file storage on the local disk with features like checksum validation, resumable uploads, and metadata management.

## Features

- ✅ **Filesystem Storage**: Direct disk I/O operations
- ✅ **Checksum Support**: MD5 and SHA1 validation
- ✅ **Resumable Uploads**: Continue interrupted uploads
- ✅ **Metadata Storage**: JSON-based metadata files
- ✅ **Directory Management**: Automatic directory creation
- ✅ **File Locking**: Concurrent access protection
- ✅ **Cross-platform**: Works on Windows, macOS, Linux

## Installation

No additional dependencies required - uses Node.js built-in `fs` module.

## Basic Usage

```typescript
import { DiskStorage } from "@visulima/upload/storage";

const storage = new DiskStorage({
    directory: "./uploads",
});

// Use storage...
const file = await storage.create(request, {
    contentType: "image/jpeg",
    metadata: { filename: "photo.jpg" },
    ttl: "30d", // Optional: expires in 30 days
});
```

## Configuration

### Basic Configuration

```typescript
const storage = new DiskStorage({
    directory: "/var/uploads", // Upload directory
});
```

### With Checksum Validation

```typescript
import { DiskStorageWithChecksum } from "@visulima/upload/storage";

const storage = new DiskStorageWithChecksum({
    checksum: "md5", // Enable MD5 checksum validation
    directory: "/var/uploads",
});
```

### Advanced Configuration

```typescript
const storage = new DiskStorage({
    assetFolder: "assets",
    directory: "/var/uploads",
    filename: (file, request) => `${Date.now()}-${file.originalName}`,

    // Generic storage config
    genericConfig: {
        checksumTypes: ["md5", "sha1"],
        maxFileSize: 100 * 1024 * 1024, // 100MB
        optimizations: {
            prefixTemplate: "files/{fileId}/",
            usePrefixes: true,
        },
    },
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
    {
        ttl: 24 * 60 * 60 * 1000, // 24 hours
    },
);
```

## Directory Structure

Local storage creates the following structure:

```
/var/uploads/
├── .meta/                    # Metadata files
│   ├── abc123.meta.json
│   └── def456.meta.json
├── assets/                   # Uploaded files
│   ├── abc123.jpg
│   └── def456.pdf
└── temp/                     # Temporary files (if configured)
```

## Metadata Storage

Files are tracked with JSON metadata files:

```json
{
    "id": "abc123",
    "name": "photo.jpg",
    "contentType": "image/jpeg",
    "size": 1024000,
    "bytesWritten": 1024000,
    "status": "completed",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "modifiedAt": "2024-01-01T00:00:00.000Z",
    "metadata": {
        "filename": "photo.jpg",
        "author": "John Doe"
    }
}
```

## Checksum Validation

Enable checksum validation for data integrity:

```typescript
const storage = new DiskStorageWithChecksum({
    checksum: "md5", // Options: 'md5', 'sha1', or boolean
    directory: "/var/uploads",
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

## Resumable Uploads

Continue interrupted uploads:

```typescript
// Create file
const file = await storage.create(request, {
    contentType: "video/mp4",
    size: 100 * 1024 * 1024, // 100MB
});

// Upload first chunk
await storage.write({
    body: chunk1,
    contentLength: chunk1.length,
    id: file.id,
    start: 0,
});

// Upload second chunk (resumes from where it left off)
await storage.write({
    body: chunk2,
    contentLength: chunk2.length,
    id: file.id,
    start: chunk1.length,
});
```

## File Naming

Customize file naming strategy:

```typescript
const storage = new DiskStorage({
    directory: "/var/uploads",
    filename: (file, request) => {
        // Custom naming logic
        const timestamp = Date.now();
        const random = Math.random().toString(36).slice(2);

        return `${timestamp}-${random}-${file.originalName}`;
    },
});
```

## Directory Management

Automatic directory creation and management:

```typescript
const storage = new DiskStorage({
    assetFolder: "files", // Subfolder for uploaded files
    directory: "/var/uploads",
});

// Files stored in: /var/uploads/files/
// Metadata in: /var/uploads/.meta/
```

## Concurrent Access

File locking prevents corruption during concurrent access:

```typescript
// Automatic locking during write operations
await storage.write({
    body: data,
    contentLength: data.length,
    id: file.id,
    start: 0,
});
// File is locked during the operation
```

## Error Handling

Local storage provides clear error messages:

```typescript
try {
    await storage.get({ id: "nonexistent" });
} catch (error) {
    console.log(error.code); // 'ENOENT'
    console.log(error.statusCode); // 404
    console.log(error.message); // 'File not found'
}
```

Common errors:

- `ENOENT` (404): File not found
- `EACCES` (403): Permission denied
- `ENOSPC` (507): Disk full
- `EMFILE` (503): Too many open files

## Performance Optimization

### Large File Handling

```typescript
const storage = new DiskStorage({
    directory: "/var/uploads",
    // Optimize for large files
    highWaterMark: 64 * 1024, // 64KB buffer size
});
```

### Directory Structure

```typescript
// Use prefixes to avoid too many files per directory
const storage = new DiskStorage({
    directory: "/var/uploads",
    genericConfig: {
        optimizations: {
            prefixTemplate: "{year}/{month}/{day}/",
            usePrefixes: true,
        },
    },
});
// Files organized by date: /var/uploads/2024/01/01/file.jpg
```

## Cleanup and Maintenance

### Automatic Cleanup

```typescript
// Enable expiration-based cleanup
const storage = new DiskStorage({
    directory: "/var/uploads",
    expiration: {
        maxAge: "7d", // Files older than 7 days
        purgeInterval: "1h", // Check every hour
    },
});
```

### Manual Cleanup

```typescript
// List expired files
const expiredFiles = await storage.listExpired();

// Clean up manually
for (const file of expiredFiles) {
    await storage.delete({ id: file.id });
}
```

## Environment Variables

```bash
# No required environment variables
# All configuration done in code

# Optional: Base directory
UPLOAD_DIR=/var/uploads
```

## Development Setup

### Directory Permissions

Ensure proper permissions:

```bash
# Create upload directory
mkdir -p /var/uploads
chmod 755 /var/uploads

# For web applications
chown www-data:www-data /var/uploads
```

### Disk Space Monitoring

Monitor disk usage:

```typescript
import { statvfs } from "node:fs";

const getDiskUsage = async (path: string) => {
    // Check available disk space before uploads
    const stats = await statvfs(path);
    const freeSpace = stats.f_bavail * stats.f_frsize;

    if (freeSpace < 100 * 1024 * 1024) {
        // Less than 100MB
        console.warn("Low disk space:", freeSpace);
    }
};
```

## Testing

Run local storage tests:

```bash
# Run local storage tests
npm test -- --testPathPattern="disk.*test"

# Run with temporary directory
UPLOAD_DIR=/tmp/test-uploads npm test
```

## Troubleshooting

### Permission Issues

```typescript
// Check directory permissions
const fs = require("node:fs");
const stats = fs.statSync("/var/uploads");

console.log("Permissions:", stats.mode.toString(8));

// Ensure write permissions
if (!(stats.mode & 0o200)) {
    console.error("No write permissions");
}
```

### Disk Space Issues

```typescript
// Check available space
const { execSync } = require("node:child_process");
const output = execSync("df -h /var/uploads").toString();

console.log("Disk usage:", output);
```

### File Corruption

```typescript
// Verify file integrity
const storage = new DiskStorageWithChecksum({
    checksum: "md5",
    directory: "/var/uploads",
});

// This will validate checksums during read operations
const file = await storage.get({ id: fileId });
```

### Concurrent Access Issues

```typescript
// Check for file locks
const fs = require("node:fs");
const lockfile = "/var/uploads/.lock";

if (fs.existsSync(lockfile)) {
    console.warn("Storage operation in progress");
}
```

## Security Considerations

### File Access Control

```typescript
// Implement access control in your application layer
const canAccessFile = (userId: string, fileId: string) =>
    // Check user permissions before allowing access
    checkUserPermission(userId, fileId);

// In your route handler
app.get("/files/:id", async (request, res) => {
    if (!canAccessFile(request.user.id, request.params.id)) {
        return res.status(403).send("Access denied");
    }

    const file = await storage.get({ id: request.params.id });
    // Serve file...
});
```

### Path Traversal Protection

Local storage automatically prevents path traversal attacks:

```typescript
// These attempts will be blocked
await storage.get({ id: "../../../etc/passwd" }); // Blocked
await storage.get({ id: "/absolute/path" }); // Blocked
```

### Temporary File Cleanup

```typescript
// Clean up temporary files regularly
const { glob } = require("glob");

const cleanupTemporaryFiles = async () => {
    const temporaryFiles = await glob("/var/uploads/temp/**/*", {
        absolute: true,
        nodir: true,
    });

    for (const file of temporaryFiles) {
        const stats = fs.statSync(file);
        const age = Date.now() - stats.mtime.getTime();

        // Delete files older than 1 hour
        if (age > 60 * 60 * 1000) {
            fs.unlinkSync(file);
        }
    }
};
```
