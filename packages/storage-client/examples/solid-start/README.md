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

## Notes

- This example uses Solid Start's file-based routing
- Update the `endpoint` in `app/routes/index.tsx` to point to your upload API
