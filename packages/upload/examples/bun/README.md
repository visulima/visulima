# Bun Upload Example

This example demonstrates how to use the Visulima Upload package with [Bun](https://bun.sh/), a fast JavaScript runtime and toolkit.

## Features

- Multipart file uploads using the `@visulima/upload` package
- Native Bun HTTP server
- CORS support
- File listing endpoint
- Health check endpoint
- Local disk storage

## Installation

```bash
cd examples/bun
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
