# Storage Client Examples

This directory contains example projects demonstrating how to use `@visulima/storage-client` with different frameworks.

## Available Examples

### React (Vite)

- **Location**: [`react/`](./react/)
- **Framework**: React 18+ with Vite
- **Features**: React hooks (`useUpload`, `useMultipartUpload`, `useChunkedRestUpload`, `useTusUpload`)
- **Run**: `cd react && pnpm install && pnpm dev`

### Next.js

- **Location**: [`nextjs/`](./nextjs/)
- **Framework**: Next.js with App Router
- **Features**: React hooks with SSR support
- **Run**: `cd nextjs && pnpm install && pnpm dev`

### TanStack Start

- **Location**: [`tanstack-start/`](./tanstack-start/)
- **Framework**: TanStack Start (React-based full-stack framework)
- **Features**: React hooks with server-side rendering
- **Run**: `cd tanstack-start && pnpm install && pnpm dev`

### Solid Start

- **Location**: [`solid-start/`](./solid-start/)
- **Framework**: Solid Start (SolidJS full-stack framework)
- **Features**: Solid primitives (`createUpload`, `createMultipartUpload`, `createChunkedRestUpload`, `createTusUpload`)
- **Run**: `cd solid-start && pnpm install && pnpm dev`

### Vue (Vite)

- **Location**: [`vue/`](./vue/)
- **Framework**: Vue 3 with Vite
- **Features**: Vue composables (`useUpload`, `useMultipartUpload`, `useChunkedRestUpload`, `useTusUpload`)
- **Run**: `cd vue && pnpm install && pnpm dev`

### SvelteKit

- **Location**: [`svelte-kit/`](./svelte-kit/)
- **Framework**: SvelteKit
- **Features**: Svelte stores (`createUpload`, `createMultipartUpload`, `createChunkedRestUpload`, `createTusUpload`)
- **Run**: `cd svelte && pnpm install && pnpm dev`

### Nuxt

- **Location**: [`nuxt/`](./nuxt/)
- **Framework**: Nuxt 3
- **Features**: Vue composables (`useUpload`, `useMultipartUpload`, `useChunkedRestUpload`, `useTusUpload`) with SSR support
- **Run**: `cd nuxt && pnpm install && pnpm dev`

## Quick Start

Each example demonstrates:

1. **Basic file upload** - Simple file upload with progress tracking
2. **Multipart upload** - Traditional multipart/form-data uploads
3. **Chunked REST upload** - Client-side chunked uploads for large files with pause/resume capability
4. **TUS resumable upload** - Large file uploads with pause/resume capability
5. **Automatic method selection** - Smart switching between multipart, chunked REST, and TUS based on file size and available endpoints

## Installation

Each example is self-contained. Navigate to the example directory and install dependencies:

```bash
cd react  # or nextjs, vue, svelte, nuxt, etc.
pnpm install
```

## Configuration

All examples use mock upload endpoints. Update the endpoints in each example to point to your actual upload server. You can provide one or more endpoints:

```typescript
const uploader = useUpload({
    endpointChunkedRest: "/api/upload/chunked-rest", // Optional: Chunked REST upload endpoint
    endpointMultipart: "/api/upload/multipart", // Optional: Multipart upload endpoint
    endpointTus: "/api/upload/tus", // Optional: TUS upload endpoint
});
```

**Note**: At least one endpoint (`endpointChunkedRest`, `endpointMultipart`, or `endpointTus`) must be provided. If multiple endpoints are provided, the upload method will be automatically selected based on file size and availability.

## Framework-Specific Usage

### React

```tsx
import { useUpload } from "@visulima/storage-client/react";

const UploadComponent = () => {
    const { isUploading, progress, upload } = useUpload({
        endpointChunkedRest: "/api/upload/chunked-rest",
        endpointMultipart: "/api/upload/multipart",
        endpointTus: "/api/upload/tus",
    });

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];

        if (file) {
            await upload(file);
        }
    };

    return (
        <div>
            <input onChange={handleFileSelect} type="file" />
            {isUploading && (
                <div>
                    Progress:
                    {progress}
                    %
                </div>
            )}
        </div>
    );
};
```

### Vue

```vue
<script setup lang="ts">
import { useUpload } from "@visulima/storage-client/vue";

const { upload, progress, isUploading } = useUpload({
    endpointChunkedRest: "/api/upload/chunked-rest",
    endpointMultipart: "/api/upload/multipart",
    endpointTus: "/api/upload/tus",
});
</script>

<template>
    <div>
        <input type="file" @change="(e) => upload((e.target as HTMLInputElement).files?.[0])" />
        <div v-if="isUploading">Progress: {{ progress }}%</div>
    </div>
</template>
```

### Solid.js

```tsx
import { createUpload } from "@visulima/storage-client/solid";

const UploadComponent = () => {
    const { isUploading, progress, upload } = createUpload({
        endpointChunkedRest: "/api/upload/chunked-rest",
        endpointMultipart: "/api/upload/multipart",
        endpointTus: "/api/upload/tus",
    });

    const handleFileSelect = async (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];

        if (file) {
            await upload(file);
        }
    };

    return (
        <div>
            <input onChange={handleFileSelect} type="file" />
            {isUploading() && (
                <div>
                    Progress:
                    {progress()}
                    %
                </div>
            )}
        </div>
    );
};
```

### Svelte

```svelte
<script lang="ts">
  import { createUpload } from '@visulima/storage-client/svelte';

  const { upload, progress, isUploading } = createUpload({
    endpointChunkedRest: '/api/upload/chunked-rest',
    endpointMultipart: '/api/upload/multipart',
    endpointTus: '/api/upload/tus',
  });
</script>

<input type="file" on:change={(e) => upload(e.target.files?.[0])} />
{#if $isUploading}
  <div>Progress: {$progress}%</div>
{/if}
```

### Nuxt Usage

```vue
<script setup lang="ts">
import { useUpload } from "@visulima/storage-client/vue";

const { upload, progress, isUploading } = useUpload({
    endpointChunkedRest: "/api/upload/chunked-rest",
    endpointMultipart: "/api/upload/multipart",
    endpointTus: "/api/upload/tus",
});
</script>

<template>
    <div>
        <input type="file" @change="(e) => upload((e.target as HTMLInputElement).files?.[0])" />
        <div v-if="isUploading">Progress: {{ progress }}%</div>
    </div>
</template>
```

## Contributing

To add a new framework example:

1. Create a new directory with the framework name
2. Set up the basic project structure
3. Install `@visulima/storage-client` as a dependency
4. Create example components demonstrating upload functionality
5. Add a README.md with setup instructions
6. Update this main README.md

## Support

For issues or questions:

- Check the [main documentation](../README.md)
- Open an issue on [GitHub](https://github.com/visulima/visulima/issues)
