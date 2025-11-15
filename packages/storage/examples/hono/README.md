# Fetch API Upload Example

This example demonstrates how to use the Visulima Upload package with modern frameworks that support the Web Fetch API, including Hono, Cloudflare Workers, Deno, Bun, and other Web API environments.

## Features

- Native Web API Request/Response support using the `fetch()` method
- **Multipart file uploads** - Traditional form-based uploads
- **REST API uploads** - Direct binary uploads via POST/PUT
- **TUS resumable uploads** - Robust, resumable file uploads with pause/resume support
- File listing endpoint
- **Image transformation support** - Resize, crop, convert formats with caching
- CORS support
- Local disk storage
- **Swagger/OpenAPI documentation** - Interactive API documentation
- Compatible with Hono, Cloudflare Workers, Deno, Bun, and other Web API frameworks

## Choosing the Right Upload Method

This example provides three upload methods:

- **Multipart uploads** (`multipart/form-data`) - Traditional form-based uploads, best for web forms
- **REST uploads** (direct binary) - Clean REST API for direct binary uploads, best for API-first applications
- **TUS resumable uploads** - Recommended for:
    - Large files (>100MB)
    - Unreliable network connections
    - Mobile applications
    - Files that may be interrupted during upload
    - Applications requiring upload progress tracking

TUS provides:

- ✅ Automatic resume after network interruptions
- ✅ Upload progress tracking
- ✅ Chunked uploads for better memory management
- ✅ Parallel upload support
- ✅ Checksum validation
- ✅ Standardized protocol (works with any TUS client)

## Installation

```bash
cd examples/hono
pnpm install
```

## Usage

```bash
pnpm run dev
```

The server will start on `http://localhost:3000`.

## Endpoints

### Multipart Uploads (Traditional)

- `GET /health` - Health check
- `GET /files` - List uploaded files
- `POST /files` - Upload files (multipart/form-data)
- `GET /files/:id` - Download file (supports image transformations via query parameters)
- `DELETE /files/:id` - Delete file

### REST API Uploads (Direct Binary)

- `POST /files-rest` - Upload file with raw binary data
- `PUT /files-rest/:id` - Create or update file (requires ID in URL)
- `GET /files-rest/:id` - Download file
- `DELETE /files-rest/:id` - Delete single file
- `DELETE /files-rest?ids=id1,id2,id3` - Batch delete multiple files
- `HEAD /files-rest/:id` - Get file metadata

### TUS Resumable Uploads

- `OPTIONS /files-tus` - Get server capabilities
- `POST /files-tus` - Create new TUS upload
- `PATCH /files-tus/:id` - Upload file chunks (resumable)
- `HEAD /files-tus/:id` - Get upload status/offset
- `GET /files-tus/:id` - Download completed file
- `DELETE /files-tus/:id` - Delete upload

### Documentation

- `GET /` - Interactive Swagger UI documentation
- `GET /openapi.json` - OpenAPI JSON specification

## Image Transformations

The API supports image transformations through query parameters on file download endpoints:

- `?format=jpeg|png|webp|avif` - Convert to different format
- `?width=300&height=200` - Resize image
- `?crop=100,100,200,200` - Crop image (x,y,width,height)
- `?quality=80` - Set JPEG/WebP quality (0-100)

Example:

```
GET /files/your-file-id?format=webp&width=800&height=600&quality=90
```

Transformations are cached for performance, and only image formats are supported in this configuration.

## Example Usage

### Multipart Uploads

Upload a file using curl:

```bash
curl -X POST http://localhost:3000/files \
  -F "file=@/path/to/your/file.jpg" \
  -F "metadata={\"description\":\"My file\"}"
```

List uploaded files:

```bash
curl http://localhost:3000/files
```

### REST API Uploads

Upload a file with raw binary data:

```bash
curl -X POST http://localhost:3000/files-rest \
  -H "Content-Type: image/jpeg" \
  -H "Content-Disposition: attachment; filename=\"photo.jpg\"" \
  -H "X-File-Metadata: {\"description\":\"My photo\"}" \
  --data-binary @/path/to/your/file.jpg
```

Create or update a file with PUT:

```bash
curl -X PUT http://localhost:3000/files-rest/your-file-id \
  -H "Content-Type: image/png" \
  --data-binary @/path/to/your/file.png
```

Batch delete multiple files:

```bash
# Via query parameter
curl -X DELETE "http://localhost:3000/files-rest?ids=id1,id2,id3"

# Via JSON body
curl -X DELETE http://localhost:3000/files-rest \
  -H "Content-Type: application/json" \
  -d '{"ids": ["id1", "id2", "id3"]}'
```

Get file metadata:

```bash
curl -X HEAD http://localhost:3000/files-rest/your-file-id -v
```

### TUS Resumable Uploads

TUS provides robust, resumable file uploads that can survive network interruptions. Here's how to use it:

#### 1. Check server capabilities

```bash
curl -X OPTIONS http://localhost:3000/files-tus \
  -H "Tus-Resumable: 1.0.0" \
  -v
```

#### 2. Create a new upload

```bash
curl -X POST http://localhost:3000/files-tus \
  -H "Tus-Resumable: 1.0.0" \
  -H "Upload-Length: 1024" \
  -H "Upload-Metadata: filename dGVzdC5qcGc=" \
  -v
```

This returns a `Location` header with the upload URL, e.g., `http://localhost:3000/files-tus/abc123`

#### 3. Upload file chunks

```bash
curl -X PATCH http://localhost:3000/files-tus/abc123 \
  -H "Tus-Resumable: 1.0.0" \
  -H "Upload-Offset: 0" \
  -H "Content-Type: application/offset+octet-stream" \
  --data-binary @/path/to/your/file.jpg \
  -v
```

#### 4. Check upload progress

```bash
curl -X HEAD http://localhost:3000/files-tus/abc123 \
  -H "Tus-Resumable: 1.0.0" \
  -v
```

This returns `Upload-Offset` header showing current progress.

#### 5. Resume interrupted upload

If upload was interrupted, check the current offset and resume:

```bash
# Get current offset
OFFSET=$(curl -X HEAD http://localhost:3000/files-tus/abc123 \
  -H "Tus-Resumable: 1.0.0" \
  -s -D - | grep "Upload-Offset:" | cut -d' ' -f2 | tr -d '\r')

# Resume from that offset
curl -X PATCH http://localhost:3000/files-tus/abc123 \
  -H "Tus-Resumable: 1.0.0" \
  -H "Upload-Offset: $OFFSET" \
  -H "Content-Type: application/offset+octet-stream" \
  --data-binary @<(tail -c +$((OFFSET+1)) /path/to/your/file.jpg) \
  -v
```

#### 6. Download completed file

```bash
curl http://localhost:3000/files-tus/abc123 \
  -o downloaded_file.jpg
```

## TUS JavaScript Client

For easier integration, you can use the [TUS JavaScript client](https://github.com/tus/tus-js-client):

```javascript
import { Upload } from "tus-js-client";

const upload = new Upload(file, {
    endpoint: "http://localhost:3000/files-tus",
    metadata: {
        filename: file.name,
        filetype: file.type,
    },
    onError(error) {
        console.error("Upload failed:", error);
    },
    onProgress(bytesUploaded, bytesTotal) {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        console.log(`Uploaded ${percentage}%`);
    },
    onSuccess() {
        console.log("Upload finished:", upload.url);
    },
});

upload.start();
```

## API Documentation

The API includes interactive Swagger documentation that you can access at:

```bash
open http://localhost:3000/
```

The Swagger UI provides:

- Complete API documentation
- Interactive testing interface
- Request/response examples
- Schema definitions for all endpoints
- Both multipart and TUS endpoint documentation with merged OpenAPI spec

## Code Example

```ts
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { Multipart, DiskStorage } from "@visulima/upload";

const app = new OpenAPIHono();

// Create storage and handler
const storage = new DiskStorage({
    directory: "./uploads",
});

const multipart = new Multipart({ storage });

// Define OpenAPI routes with automatic documentation
const uploadRoute = createRoute({
    method: "post",
    path: "/upload",
    summary: "Upload files",
    description: "Upload one or more files using multipart/form-data",
    request: {
        body: {
            content: {
                "multipart/form-data": {
                    schema: z.object({
                        file: z.instanceof(File).openapi({
                            type: "string",
                            format: "binary",
                            description: "File to upload",
                        }),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description: "File uploaded successfully",
        },
    },
});

app.openapi(uploadRoute, async (c) => {
    const request = c.req.raw;
    try {
        return await multipart.fetch(request);
    } catch (error) {
        return c.json({ error: "Upload failed" }, 500);
    }
});

// Add Swagger UI
app.get("/swagger", swaggerUI({ url: "/openapi.json" }));

// Add OpenAPI JSON endpoint
app.get("/openapi.json", (c) =>
    c.json(
        app.getOpenAPIDocument({
            openapi: "3.0.0",
            info: {
                title: "Visulima Upload API",
                version: "1.0.0",
                description: "File upload API built with Hono and Visulima Upload",
            },
        }),
    ),
);
```

## Supported Frameworks

This example works with any framework that supports the Web Fetch API:

- **Hono** - Lightweight web framework
- **Cloudflare Workers** - Serverless edge functions
- **Deno** - Secure runtime
- **Bun** - Fast JavaScript runtime
- **Next.js 15+** - With Web API support
- **Any Web API compatible environment**
