# Fetch API Upload Example

This example demonstrates how to use the Visulima Upload package with modern frameworks that support the Web Fetch API, including Hono, Cloudflare Workers, Deno, Bun, and other Web API environments.

## Features

- Native Web API Request/Response support using the `fetch()` method
- Multipart file uploads
- File listing endpoint
- CORS support
- Local disk storage
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

## Code Example

```ts
import { Hono } from "hono";
import { Multipart, DiskStorage } from "@visulima/upload";

const app = new Hono();

// Create storage and handler
const storage = new DiskStorage({
    directory: "./uploads",
});

const multipart = new Multipart({
    storage,
});

// Use the fetch method directly
app.post("/upload", async (c) => {
    const request = c.req.raw; // Get the Web API Request

    try {
        return await multipart.fetch(request);
    } catch (error) {
        return c.json({ error: "Upload failed" }, 500);
    }
});
```

## Supported Frameworks

This example works with any framework that supports the Web Fetch API:

- **Hono** - Lightweight web framework
- **Cloudflare Workers** - Serverless edge functions
- **Deno** - Secure runtime
- **Bun** - Fast JavaScript runtime
- **Next.js 15+** - With Web API support
- **Any Web API compatible environment**
