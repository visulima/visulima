# Deno Upload Example

This example demonstrates how to use the Visulima Upload package with [Deno](https://deno.com/), a secure runtime for JavaScript and TypeScript.

## Features

- Multipart file uploads using the `@visulima/upload` package
- Native Deno HTTP server
- CORS support
- File listing endpoint
- Health check endpoint
- Local disk storage

## Installation

No installation needed - Deno handles dependencies automatically.

## Usage

```bash
cd examples/deno
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

## Permissions

This example requires the following Deno permissions:
- `--allow-net` - Network access
- `--allow-read` - File system read access
- `--allow-write` - File system write access
- `--allow-env` - Environment variable access
