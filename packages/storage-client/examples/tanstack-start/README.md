# TanStack Start Upload Example

This example demonstrates how to use `@visulima/storage-client` for file uploads in a TanStack Start application.

## Features

- File upload API using `@visulima/storage` Multipart handler
- Client-side upload using `@visulima/storage-client/react` hooks
- Simple upload UI with progress tracking
- Server-side file storage using DiskStorage

## Setup

```bash
pnpm install
```

## Run

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000)

## How It Works

### API Route (`/api/upload`)

The API route uses `@visulima/storage`'s `Multipart` handler to process file uploads:

```typescript
import { DiskStorage, Multipart } from "@visulima/storage";

const storage = new DiskStorage({ directory: "./uploads" });
const multipart = new Multipart({ storage });

// In the route handler
export const Route = createFileRoute("/api/upload")({
    server: {
        handlers: {
            POST: async ({ request }) => await multipart.fetch(request),
        },
    },
});
```

### Frontend

The frontend uses `useUpload` hook from `@visulima/storage-client/react`:

```typescript
import { useUpload } from "@visulima/storage-client/react";

const { error, isUploading, progress, reset, result, upload } = useUpload({
    endpoint: "/api/upload",
    onError: (error_) => console.error("Upload error:", error_),
    onSuccess: (res) => console.log("Upload successful:", res),
});

// Upload a file
await upload(file);
```

## Storage Location

Files are stored in the system temporary directory (`os.tmpdir()/visulima-uploads`). In production, configure a persistent storage location.

## Notes

- The example uses `DiskStorage` for local file storage
- Uploads are handled server-side using the Multipart handler
- Client-side uses `@visulima/storage-client/react` hooks for upload management
- The API returns file ID, filename, and URL after successful upload
