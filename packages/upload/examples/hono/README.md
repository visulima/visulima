# Fetch API Upload Example

This example demonstrates how to use the Visulima Upload package with modern frameworks that support the Web Fetch API, including Hono, Cloudflare Workers, Deno, Bun, and other Web API environments.

## Features

- Native Web API Request/Response support using the `fetch()` method
- Multipart file uploads
- File listing endpoint
- CORS support
- Local disk storage
- **Swagger/OpenAPI documentation** - Interactive API documentation
- Compatible with Hono, Cloudflare Workers, Deno, Bun, and other Web API frameworks

## Installation

```bash
cd examples/hono
pnpm install
```

## Usage

```bash
pnpm run dev
```

The server will start on `http://localhost:3002`.

## Endpoints

- `GET /health` - Health check
- `GET /files` - List uploaded files
- `POST /upload` - Upload files (multipart/form-data)
- `GET /swagger` - Interactive Swagger UI documentation
- `GET /openapi.json` - OpenAPI JSON specification

## Example Usage

Upload a file using curl:

```bash
curl -X POST http://localhost:3002/upload \
  -F "file=@/path/to/your/file.jpg" \
  -F "metadata={\"description\":\"My file\"}"
```

List uploaded files:

```bash
curl http://localhost:3002/files
```

## API Documentation

The API includes interactive Swagger documentation that you can access at:

```bash
open http://localhost:3002/swagger
```

The Swagger UI provides:
- Complete API documentation
- Interactive testing interface
- Request/response examples
- Schema definitions for all endpoints

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
app.get("/openapi.json", (c) => c.json(app.getOpenAPIDocument({
    openapi: "3.0.0",
    info: {
        title: "Visulima Upload API",
        version: "1.0.0",
        description: "File upload API built with Hono and Visulima Upload",
    },
})));
```

## Supported Frameworks

This example works with any framework that supports the Web Fetch API:

- **Hono** - Lightweight web framework
- **Cloudflare Workers** - Serverless edge functions
- **Deno** - Secure runtime
- **Bun** - Fast JavaScript runtime
- **Next.js 15+** - With Web API support
- **Any Web API compatible environment**
