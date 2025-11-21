# Deno Upload Example

This example demonstrates how to use the Visulima Upload package with [Deno](https://deno.com/), a secure runtime for JavaScript and TypeScript. It showcases the modern `fetch()` method for Web API compatibility.

## Features

- **Native Web API Support** - Uses the `fetch()` method for seamless Web API integration
- **Multipart File Uploads** - Full multipart/form-data support
- **File Listing** - Built-in file listing using the upload library
- **CORS Support** - Proper CORS headers for web applications
- **Health Check** - Comprehensive health endpoint with metadata
- **Local Disk Storage** - Configurable local filesystem storage
- **Error Handling** - Robust error handling with proper HTTP status codes

## Installation

No installation needed - Deno handles dependencies automatically through npm specifiers.

## Usage

```bash
# Run directly with Deno
deno run --allow-net --allow-read --allow-write --allow-env index.ts

# Or use the convenience script
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
    "runtime": "deno",
    "method": "fetch",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0"
}
```

## Code Structure

```ts
import { DiskStorage } from "npm:@visulima/storage";
import { Multipart } from "npm:@visulima/storage/handler/http/fetch";

// Single storage and handler instances
const storage = new DiskStorage({ directory: "./uploads" });
const multipart = new Multipart({ storage });

// All endpoints use the fetch() method
app.get("/files", async (req) => await multipart.fetch(req));
app.post("/upload", async (req) => await multipart.fetch(req));
```

## Permissions

This example requires the following Deno permissions:

- `--allow-net` - Network access for HTTP server
- `--allow-read` - File system read access for uploads directory
- `--allow-write` - File system write access for file uploads
- `--allow-env` - Environment variable access for PORT configuration

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

### Running with Custom Permissions

```bash
deno run --allow-net --allow-read --allow-write --allow-env index.ts
```

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

## Integration with Other Frameworks

This example demonstrates how Deno can be used alongside other runtimes in a microservices architecture:

- **API Gateway** - Deno can serve as a lightweight API gateway
- **File Processing** - Specialized file processing services
- **CDN Integration** - Direct integration with CDN services
- **Serverless Functions** - Deno Deploy for serverless file operations
