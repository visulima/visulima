# Node.js Upload Example

This example demonstrates how to use the Visulima Upload package with native Node.js HTTP server, showcasing the traditional `handle()` method for optimal Node.js performance.

## Features

- **Native Node.js Support** - Uses the `handle()` method directly with IncomingMessage/ServerResponse
- **Multipart File Uploads** - Full multipart/form-data support
- **File Listing** - Built-in file listing using the upload library
- **CORS Support** - Proper CORS headers for web applications
- **Health Check** - Comprehensive health endpoint with metadata
- **Local Disk Storage** - Configurable local filesystem storage
- **Error Handling** - Robust error handling with proper HTTP status codes

## Installation

```bash
cd examples/node
pnpm install
```

## Usage

```bash
pnpm run dev
```

The server will start on `http://localhost:3002` with detailed startup information.

## Endpoints

- `GET /health` - Health check with runtime and version info
- `GET /files` - List uploaded files (uses handle method)
- `POST /upload` - Upload files (multipart/form-data, uses handle method)

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
    "runtime": "node",
    "method": "handle",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0"
}
```

## Code Structure

```ts
import { createServer } from "http";
import { Multipart, DiskStorage } from "@visulima/upload";

// Single storage and handler instances
const storage = new DiskStorage({ directory: "./uploads" });
const multipart = new Multipart({ storage });

// All endpoints use the handle() method directly
if (pathname === "/files" && method === "GET") {
    await multipart.handle(req, res); // Direct Node.js API
}

if (pathname === "/upload" && method === "POST") {
    await multipart.handle(req, res); // Direct Node.js API
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

## Node.js HTTP Server Benefits

- **Optimal Performance** - Uses `handle()` method directly with no conversion overhead
- **No Framework Dependencies** - Pure Node.js implementation
- **Maximum Control** - Full control over HTTP handling
- **High Performance** - Direct access to Node.js HTTP APIs
- **Framework Agnostic** - Can be extended to work with any Node.js framework
- **Learning Tool** - Great for understanding HTTP fundamentals and traditional Node.js patterns

## Integration with Frameworks

This example can be easily adapted to work with popular Node.js frameworks:

### Express.js Integration

```ts
import express from "express";
import { Multipart, DiskStorage } from "@visulima/upload";

const app = express();
const multipart = new Multipart({ storage: new DiskStorage({ directory: "./uploads" }) });

// Use the handle method directly (most efficient for Node.js frameworks)
app.use("/upload", (req, res) => {
    multipart.handle(req, res);
});

app.use("/files", (req, res) => {
    multipart.handle(req, res);
});
```

### Fastify Integration

```ts
import Fastify from "fastify";
import { Multipart, DiskStorage } from "@visulima/upload";

const fastify = Fastify();
const multipart = new Multipart({ storage: new DiskStorage({ directory: "./uploads" }) });

// Use the handle method directly
fastify.post("/upload", async (request, reply) => {
    // Fastify uses Node.js IncomingMessage internally
    await multipart.handle(request.raw, reply.raw);
    return reply.sent;
});

fastify.get("/files", async (request, reply) => {
    await multipart.handle(request.raw, reply.raw);
    return reply.sent;
});
```

### Koa Integration

```ts
import Koa from "koa";
import { Multipart, DiskStorage } from "@visulima/upload";

const app = new Koa();
const multipart = new Multipart({ storage: new DiskStorage({ directory: "./uploads" }) });

// Use the handle method directly
app.use(async (ctx) => {
    if (ctx.path === "/upload" && ctx.method === "POST") {
        await multipart.handle(ctx.req, ctx.res);
    } else if (ctx.path === "/files" && ctx.method === "GET") {
        await multipart.handle(ctx.req, ctx.res);
    } else {
        ctx.status = 404;
        ctx.body = { error: "Not found" };
    }
});
```
