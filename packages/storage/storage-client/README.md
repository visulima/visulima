<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="storage-client" />

</a>

<h3 align="center">The upload client library. Simple and easy file uploads for React | Vue | Solid | Svelte.</h3>

<!-- END_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<br />

<div align="center">

[![typescript-image][typescript-badge]][typescript-url]
[![mit licence][license-badge]][license]
[![npm downloads][npm-downloads-badge]][npm-downloads]
[![Chat][chat-badge]][chat]
[![PRs Welcome][prs-welcome-badge]][prs-welcome]

</div>

---

<div align="center">
    <p>
        <sup>
            Daniel Bannert's open source work is supported by the community on <a href="https://github.com/sponsors/prisis">GitHub Sponsors</a>
        </sup>
    </p>
</div>

---

## Install

```sh
npm install @visulima/storage-client
```

```sh
yarn add @visulima/storage-client
```

```sh
pnpm add @visulima/storage-client
```

## Description

The Visulima Storage Client is a powerful, framework-agnostic library for handling file uploads in modern web applications. It provides a unified API across React, Vue, Nuxt, Solid, and Svelte with support for multiple upload methods, progress tracking, retry mechanisms, and batch operations.

## Features

- **Framework Support** - First-class support for React, Vue/Nuxt, Solid, and Svelte
- **Multiple Upload Methods** - Multipart (form-based), TUS (resumable), and chunked REST uploads
- **Auto-detection** - Automatically selects the best upload method based on file size and available endpoints
- **Progress Tracking** - Real-time upload progress with percentage and byte-level tracking
- **Batch Operations** - Upload multiple files simultaneously with a configurable concurrency cap
- **Retry Mechanism** - Built-in retry with exponential backoff for failed uploads (opt-in via `retry`)
- **Custom Headers / Auth** - Attach static or dynamically-resolved headers (e.g. an `Authorization` token) to every upload and file-management request
- **Upload Restrictions** - Validate `maxFileSize` / `minFileSize` / `allowedFileTypes` / `maxNumberOfFiles` client-side before any request
- **Chunk Checksums** - Opt-in per-chunk `X-Chunk-Checksum` integrity headers (Web Crypto) for the chunked-REST adapter
- **Typed Errors** - `UploadError` exposes the HTTP `status` and server error `code` instead of a string-only message
- **File Management** - Get, list, delete files with full metadata support
- **TypeScript Ready** - Full TypeScript support with comprehensive type definitions
- **TanStack Query Integration** - Built on TanStack Query for powerful caching and state management
- **Drag & Drop Support** - Built-in file input hooks with drag & drop functionality
- **Paste Upload** - Support for pasting images from clipboard
- **Transform Support** - Transform files and metadata on upload
- **Abort Control** - Cancel uploads at any time with abort functionality

## Prerequisites

The storage client requires TanStack Query (formerly React Query) for state management. You'll need to install the appropriate version for your framework:

- **React**: `@tanstack/react-query` >= 5.90.10
- **Vue**: `@tanstack/vue-query` >= 5.91.2
- **Solid**: `@tanstack/solid-query` >= 5.90.13
- **Svelte**: `@tanstack/svelte-query` >= 6.0.8

## Usage

### React

```tsx
import { useUpload } from "@visulima/storage-client/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <UploadComponent />
        </QueryClientProvider>
    );
}

function UploadComponent() {
    const { upload, progress, isUploading, error, result } = useUpload({
        endpointMultipart: "/api/upload/multipart",
        onSuccess: (result) => console.log("Upload successful:", result),
    });

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await upload(file);
        }
    };

    return (
        <div>
            <input type="file" onChange={handleFileChange} />
            {isUploading && <div>Progress: {progress}%</div>}
            {error && <div>Error: {error.message}</div>}
            {result && <div>File ID: {result.id}</div>}
        </div>
    );
}
```

### Vue / Nuxt

```vue
<template>
    <div>
        <input type="file" @change="handleFileChange" />
        <div v-if="isUploading">Progress: {{ progress }}%</div>
        <div v-if="error">Error: {{ error.message }}</div>
        <div v-if="result">File ID: {{ result.id }}</div>
    </div>
</template>

<script setup lang="ts">
import { useUpload } from "@visulima/storage-client/vue";

const { upload, progress, isUploading, error, result } = useUpload({
    endpointMultipart: "/api/upload/multipart",
});

const handleFileChange = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
        await upload(file);
    }
};
</script>
```

### Solid

```tsx
import { createUpload } from "@visulima/storage-client/solid";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";

const queryClient = new QueryClient();

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <UploadComponent />
        </QueryClientProvider>
    );
}

function UploadComponent() {
    const { upload, progress, isUploading, error, result } = createUpload({
        endpointMultipart: "/api/upload/multipart",
    });

    const handleFileChange = async (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
            await upload(file);
        }
    };

    return (
        <div>
            <input type="file" onChange={handleFileChange} />
            {isUploading() && <div>Progress: {progress()}%</div>}
            {error() && <div>Error: {error()?.message}</div>}
            {result() && <div>File ID: {result()?.id}</div>}
        </div>
    );
}
```

### Svelte

```svelte
<script lang="ts">
  import { createUpload } from "@visulima/storage-client/svelte";
  import { QueryClient, QueryClientProvider } from "@tanstack/svelte-query";

  const queryClient = new QueryClient();

  const { upload, progress, isUploading, error, result } = createUpload({
    endpointMultipart: "/api/upload/multipart",
  });

  async function handleFileChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      await upload(file);
    }
  }
</script>

<QueryClientProvider client={queryClient}>
  <div>
    <input type="file" on:change={handleFileChange} />
    {#if $isUploading}
      <div>Progress: {$progress}%</div>
    {/if}
    {#if $error}
      <div>Error: {$error.message}</div>
    {/if}
    {#if $result}
      <div>File ID: {$result.id}</div>
    {/if}
  </div>
</QueryClientProvider>
```

## Upload Methods

### Multipart Upload

Traditional `multipart/form-data` uploads, perfect for small to medium files and web forms.

```tsx
import { useMultipartUpload } from "@visulima/storage-client/react";

const { upload, progress, isUploading } = useMultipartUpload({
    endpoint: "/api/upload/multipart",
});

await upload(file);
```

### TUS Upload

Resumable uploads using the TUS protocol, ideal for large files and unreliable networks.

```tsx
import { useTusUpload } from "@visulima/storage-client/react";

const { upload, pause, resume, progress } = useTusUpload({
    endpoint: "/api/upload/tus",
});

await upload(file);
// Can pause and resume later
pause();
resume();
```

### Chunked REST Upload

Client-side chunked uploads for large files without requiring TUS server support.

```tsx
import { useChunkedRestUpload } from "@visulima/storage-client/react";

const { upload, progress } = useChunkedRestUpload({
    endpoint: "/api/upload/chunked-rest",
    chunkSize: 5 * 1024 * 1024, // 5MB chunks
});

await upload(file);
```

### Cross-process resume

Both `useTusUpload` and `useChunkedRestUpload` (plus their Vue / Solid / Svelte equivalents) can resume
an upload after a page refresh, process restart, or hand-off to another tab.

- Pass `urlStorage: defaultUrlStorage()` and a later `upload(sameFile)` automatically resumes from the
  saved server-side identifier — no extra code needed.
- Pass a shared `UploadControl` to drive `pause` / `resume` / `abort` from outside the hook, and call
  `control.toJSON()` to get a token you can serialize and hand to `UploadControl.from(token)` elsewhere.

```tsx
import { defaultUrlStorage, UploadControl, useTusUpload } from "@visulima/storage-client/react";

const control = useMemo(() => new UploadControl(), []);
const { upload } = useTusUpload({
    endpoint: "/api/upload/tus",
    urlStorage: defaultUrlStorage(),
    control,
});
```

See [API → Cross-process resume](https://visulima.com/docs/package/storage-client/api#cross-process-resume) for the full surface.

### Custom headers / authentication

Every adapter (and the underlying fetch helpers) accepts a `headers` option. Pass a static object, or a
sync/async factory that is resolved before each request — ideal for short-lived tokens.

```tsx
import { useTusUpload } from "@visulima/storage-client/react";

const { upload } = useTusUpload({
    endpoint: "/api/upload/tus",
    // Static, or `async () => ({ Authorization: `Bearer ${await getToken()}` })`
    headers: () => ({ Authorization: `Bearer ${getToken()}` }),
});
```

### Upload restrictions

Validate files client-side before any network request. A violation throws a `RestrictionError`
(with a machine-readable `reason`) instead of surfacing an opaque server 413.

```tsx
import { useBatchUpload } from "@visulima/storage-client/react";

const { uploadBatch } = useBatchUpload({
    endpoint: "/api/upload",
    restrictions: {
        allowedFileTypes: ["image/*", ".pdf"],
        maxFileSize: 10 * 1024 * 1024, // 10 MB
        maxNumberOfFiles: 20,
    },
});
```

### Batch concurrency

Batch uploads run through a worker pool so a large drop does not open one request per file at once.
Tune it with `concurrency` (default `5`).

```tsx
useBatchUpload({ endpoint: "/api/upload", concurrency: 3 });
```

### Per-chunk checksums

The chunked-REST adapter can compute a per-chunk integrity digest and send it as `X-Chunk-Checksum`.
Pass `checksum: true` for the default `SHA-256`, or an explicit algorithm (requires the Web Crypto API).

```tsx
import { useChunkedRestUpload } from "@visulima/storage-client/react";

useChunkedRestUpload({ endpoint: "/api/upload/chunked-rest", checksum: true });
```

### Typed errors

Failed requests reject with an `UploadError` that preserves the HTTP `status` and the server-provided
error `code`, so you can branch on the failure without string-matching messages.

```tsx
import { UploadError } from "@visulima/storage-client";

try {
    await upload(file);
} catch (error) {
    if (error instanceof UploadError && error.status === 413) {
        // Payload too large — surface a friendly message.
    }
}
```

## Documentation

For complete documentation and examples, visit:

- [Installation Guide](https://visulima.com/docs/package/storage-client/installation)
- [React Guide](https://visulima.com/docs/package/storage-client/react)
- [Vue / Nuxt Guide](https://visulima.com/docs/package/storage-client/vue)
- [Solid Guide](https://visulima.com/docs/package/storage-client/solid)
- [Svelte Guide](https://visulima.com/docs/package/storage-client/svelte)
- [Next.js Guide](https://visulima.com/docs/package/storage-client/nextjs)
- [TanStack Start Guide](https://visulima.com/docs/package/storage-client/tanstack-start)

## Related

- [@visulima/storage-server](../storage-server) - Server-side storage implementation

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima storage-client is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/storage-client?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/storage-client?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/storage-client
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
