# Nuxt Example

This example demonstrates how to use `@visulima/storage-client` with Nuxt 3.

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

- Vue composables (`useUpload`, `useMultipartUpload`, `useTusUpload`)
- File upload with progress tracking
- Error handling
- Automatic method selection (multipart vs TUS)
- SSR compatible
- Server-side API routes for file uploads:
    - `/api/upload/multipart` - Multipart/form-data uploads
    - `/api/upload/rest` - REST API for direct binary uploads (supports chunked uploads)
    - `/api/upload/tus` - TUS resumable uploads

## Configuration

### Using the Nuxt Module (Recommended)

The simplest way to set up upload endpoints is using the Nuxt module from `@visulima/storage/nuxt`:

```typescript
// nuxt.config.ts
import { DiskStorage } from "@visulima/storage";
import storageModule from "@visulima/storage/nuxt";

export default defineNuxtConfig({
    modules: [
        [
            storageModule,
            {
                basePath: "/api/upload",
                multipart: true,
                rest: true,
                storage: new DiskStorage({
                    directory: "./uploads",
                }),
                tus: true,
            },
        ],
    ],
});
```

This automatically registers the upload endpoints without needing manual API route files.

### Manual API Routes (Alternative)

If you need more control, you can create manual API routes in `server/api/upload/`:

```typescript
// server/api/upload/multipart.post.ts
import { DiskStorage } from "@visulima/storage";
import { Multipart } from "@visulima/storage/handler/http/node";

const storage = new DiskStorage({ directory: "./uploads" });
const multipart = new Multipart({ storage });

export default defineEventHandler(async (event) => {
    event.node.res.setHeader("Access-Control-Allow-Origin", "*");
    await multipart.handle(event.node.req, event.node.res);
});
```

## Notes

- This example uses Nuxt 3 with Vue 3
- Files are stored in the system temporary directory (`os.tmpdir()/visulima-uploads`)
- The example automatically selects between multipart and TUS based on file size when both endpoints are provided
- Nuxt composables work seamlessly with Vue composables from `@visulima/storage-client/vue`
- Update the `endpointMultipart` and `endpointTus` in `app.vue` if you want to use different endpoints
