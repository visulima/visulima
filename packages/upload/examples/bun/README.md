# Bun Upload Example

This example demonstrates how to use the Visulima Upload package with [Bun](https://bun.sh/), a fast JavaScript runtime and toolkit. It showcases the modern `fetch()` method for Web API compatibility.

## Features

- **Native Web API Support** - Uses the `fetch()` method for seamless Web API integration
- **Multipart File Uploads** - Full multipart/form-data support
- **File Listing** - Built-in file listing using the upload library
- **CORS Support** - Proper CORS headers for web applications
- **Health Check** - Comprehensive health endpoint with metadata
- **Local Disk Storage** - Configurable local filesystem storage
- **Error Handling** - Robust error handling with proper HTTP status codes

## Installation

```bash
cd examples/bun
pnpm install
```

## Usage

```bash
pnpm run dev
```

The server will start on `http://localhost:3002` with detailed startup information.

## Endpoints

- `GET /health` - Health check with runtime and version info
- `GET /files` - List uploaded files (uses fetch method)
- `POST /upload` - Upload files (multipart/form-data, uses fetch method)

## API Examples

### Upload a File

```bash
curl -X POST http://localhost:3002/upload \
  -F "file=@/path/to/your/file.jpg" \
  -F "metadata={\"description\":\"My file\"}"
```

**Response:**

```json
{
    "id": "abc123",
    "filename": "file.jpg",
    "size": 1024000,
    "url": "/files/abc123.jpg"
}
```

### List Files

```bash
curl http://localhost:3002/files
```

**Response:**

```json
{
    "data": [
        {
            "id": "abc123",
            "filename": "file.jpg",
            "size": 1024000,
            "contentType": "image/jpeg",
            "createdAt": "2024-01-01T00:00:00.000Z"
        }
    ],
    "headers": {},
    "statusCode": 200
}
```

### Health Check

```bash
curl http://localhost:3002/health
```

**Response:**

```json
{
    "status": "OK",
    "runtime": "bun",
    "method": "fetch",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0"
}
```

## Code Structure

```ts
import { Multipart, DiskStorage } from "@visulima/upload";

// Single storage and handler instances
const storage = new DiskStorage({ directory: "./uploads" });
const multipart = new Multipart({ storage });

// All endpoints use the fetch() method
if (url.pathname === "/files" && method === "GET") {
    return await multipart.fetch(request);
}
if (url.pathname === "/upload" && method === "POST") {
    return await multipart.fetch(request);
}
```

## Configuration

### Environment Variables

- `PORT` - Server port (default: 3002)

### Storage Configuration

```ts
const storage = new DiskStorage({
    directory: "./uploads", // Upload directory
    maxUploadSize: "100MB", // Maximum file size
});
```

## Error Handling

The example includes comprehensive error handling:

- **400 Bad Request** - Invalid request format
- **404 Not Found** - Unknown endpoints
- **413 Payload Too Large** - File exceeds size limit
- **500 Internal Server Error** - Server-side errors

All errors return JSON responses with descriptive error messages.

## Development

### Testing the Endpoints

```bash
# Health check
curl http://localhost:3002/health

# Upload a test file
echo "test content" > test.txt
curl -X POST http://localhost:3002/upload -F "file=@test.txt"

# List files
curl http://localhost:3002/files
```

## Performance Benefits

Bun's native performance combined with the efficient `fetch()` method provides:

- **Fast Startup** - Quick server initialization
- **Low Memory Usage** - Efficient resource management
- **High Throughput** - Optimized for concurrent requests
- **Web API Compatibility** - Native Request/Response objects

## Integration with Other Tools

This example works well with Bun's ecosystem:

- **Bun's Test Runner** - Use `bun test` for testing
- **Bun's Package Manager** - Fast dependency management
- **TypeScript Support** - Built-in TypeScript compilation
- **Hot Reload** - Development with automatic restarts
