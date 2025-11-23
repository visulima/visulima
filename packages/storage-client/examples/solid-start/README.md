# Solid Start Example

This example demonstrates how to use `@visulima/storage-client` with Solid Start.

## Setup

```bash
pnpm install
```

## Run

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Features

- Solid primitives (`createUpload`, `createMultipartUpload`, `createTusUpload`)
- Client-side upload component
- Progress tracking
- Error handling
- API routes for multipart and TUS uploads

## API Routes

This example includes API routes for handling file uploads:

- `/api/upload/multipart` - Multipart form upload handler
- `/api/upload/tus` - TUS resumable upload handler
- `/api/upload/rest` - Chunked REST upload handler

The API routes are implemented using SolidStart's API route support and use `@visulima/storage` handlers.

## Notes

- This example uses Solid Start's file-based routing
- API routes are located in `src/routes/api/upload/`
- Storage configuration is in `src/lib/storage.ts`
