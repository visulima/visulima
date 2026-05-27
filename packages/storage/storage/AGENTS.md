# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

Server-side file storage abstraction (`@visulima/storage`). Exposes two surfaces over the same provider adapters: a one-liner `Files` facade for ad-hoc operations, and `BaseStorage` adapters powering a full upload server (TUS / multipart / REST handlers, lifecycle hooks, transformers, OpenAPI export). Swap providers without touching call sites.

## Architecture

### Provider adapters (`src/storage/<provider>/`)

Each provider implements `BaseStorage` (see `src/storage/storage.ts`). Available: `aws`, `aws-light`, `azure`, `box`, `bunny`, `bun-s3`, `cloudinary`, `dropbox`, `firebase`, `ftp`, `gcs`, `google-drive`, `local` (DiskStorage / DiskStorageWithChecksum), `memory` (in-process, useful for tests), `netlify-blob`, `onedrive`, `pocketbase`, `sftp`, `sharepoint`, `supabase`, `uploadthing`, `vercel-blob`. Each is exported as a sub-path (`@visulima/storage/provider/<name>`).

### HTTP handlers (`src/handler/http/`)

Runtime adapters for upload endpoints: `node`, `fetch` (re-used by `bun`/`cloudflare`/`deno`/`edge`), `hono`, `nextjs`, `solid-start`. Protocol handlers under `src/handler/` itself: `tus/`, `multipart/`, `rest/` (chunked REST), plus shared `base/` and `services/`.

### Top-level features

- `Files` facade (`src/files/`) — `upload`, `download`, `head`, `exists`, `delete`, `copy`, `move`, `list`, `listAll`, `url`, `signedUploadUrl`, plus `.raw` escape hatch and top-level `transfer(source, destination)` for cross-adapter streaming.
- Transformers (`src/transformer/`) — `image-transformer` (sharp), `video-transformer` / `audio-transformer` (mediabunny). All extend `base-transformer`.
- AI adapters (`src/ai/`) — `ai-sdk`, `openai`, `claude`, `tanstack` integrations.
- Nuxt adapter (`src/adapter/nuxt/`).
- OpenAPI export (`src/openapi/`).
- Metrics (`src/metrics/`) — `NoOpMetrics`, `OpenTelemetryMetrics`.

### Peer-dependency model

Every provider/runtime SDK is an **optional** peer (see `peerDependenciesMeta` in `package.json`). Users install only what they need. When adding a new provider, mirror this pattern: add to `dependencies` of the package only if it's universally needed; otherwise it goes in `peerDependencies` + `peerDependenciesMeta.optional = true`, and the import must stay inside the provider's sub-path so tree-shaking still works.

### Hard dependencies

`@remix-run/multipart-parser`, `@sindresorhus/fnv1a`, `@visulima/pagination`, `file-type`, `lru-cache`, `mime`, `nanoid`, `path-to-regexp`, `type-is`, `zod`. Implicit Nx deps: `api/pagination`, `data-manipulation/humanizer`, `filesystem/path`, `filesystem/fs`.

## Related

- `@visulima/storage-client` — browser-side upload client that talks to this package's HTTP handlers (TUS / multipart / chunked REST).
