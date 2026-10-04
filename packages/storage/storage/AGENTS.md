# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

Server-side file storage abstraction (`@visulima/storage`). Exposes two surfaces over the same provider adapters: a one-liner `Files` facade for ad-hoc operations, and `BaseStorage` adapters powering a full upload server (TUS / multipart / REST handlers, lifecycle hooks, transformers, OpenAPI export). Swap providers without touching call sites.

## Architecture

### Provider adapters (`src/storage/<provider>/`)

Each provider implements `BaseStorage` (see `src/storage/storage.ts`). Available: `aws`, `aws-light`, `azure`, `box`, `bunny`, `bun-s3`, `cloudinary`, `dropbox`, `firebase`, `ftp`, `gcs`, `google-drive`, `local` (DiskStorage / DiskStorageWithChecksum), `memory` (in-process, useful for tests), `netlify-blob`, `onedrive`, `pocketbase`, `sftp`, `sharepoint`, `supabase`, `uploadthing`, `vercel-blob`, `webdav`. Each is exported as a sub-path (`@visulima/storage/provider/<name>`).

### HTTP handlers (`src/handler/http/`)

Runtime adapters for upload endpoints: `node`, `fetch` (re-used by `bun`/`cloudflare`/`deno`/`edge`), `hono`, `nextjs`, `solid-start`. Protocol handlers under `src/handler/` itself: `tus/`, `multipart/`, `rest/` (chunked REST), plus shared `base/` and `services/`.

### Top-level features

- `Files` facade (`src/files/`) — `upload` (pausable/abortable via `UploadControl`), `download` (byte `range`), `head`, `exists`, `delete`, `copy`, `move`, `list` (S3-style `delimiter` returns `{ files, prefixes }`), `listAll`, `search` (glob / regex / substring / exact over `listAll`, glob prefix push-down; the read-only `searchFiles` AI tool), `url`, `signedUploadUrl`, `signedUpload`, plus `.raw` escape hatch, a `capabilities` getter, `readonly()` locked views, and top-level `transfer(source, destination)` (one-shot stream) / `sync(source, destination)` (incremental, optionally-pruning, `dryRun`) for cross-adapter migration/mirroring.
    - Adapter capability flags on `BaseStorage`: `supportsRange`, `supportsMetadata`, `supportsCacheControl`, `supportsDelimiter` — the facade gates optional ops on these and surfaces them via `Files.capabilities`.
    - Cross-process resume: with a `control` on a `supportsResumableWrites` adapter (S3, aws-light, GCS, Azure, Disk, Memory) `upload` writes `multipart.partSize` parts (default 8 MiB) via `Files#writeInParts`, one adapter `write` each, so the adapter persists the offset in its meta store. `UploadControl.toJSON()` (v2 token: `uploadId`, `size`, `loaded`, `adapter`, …) + `UploadControl.from(token)` resume it; `resumeOffset` marks a body holding only the rest. On resume, appending adapters (`sequentialWrites`) are probed with a body-less `write({ id })` (S3 ListParts / GCS session status), others via `getMeta`. Surfaced as `Files.capabilities.resumable`; other adapters reject a token with `METHOD_NOT_ALLOWED`. Contract scenario: "resume across processes".
    - Conditional (ETag) ops: `upload` `ifMatch` / `ifNoneMatch: "*"`, `download`/`head`/`delete` `ifMatch`, `copy` `sourceIfMatch` + destination predicate. Adapters declare `BaseStorage.conditionalSupport` (`{ create, replace, read, delete, copy }`, surfaced as `Files.capabilities.conditional`); an unsupported predicate rejects with `METHOD_NOT_ALLOWED`, a failed one with `PRECONDITION_FAILED` (412). A conditional `create` parks its record (`parkConditional`) and the committing `write` takes it back, so a failed predicate never touches the stored record. Native on S3/aws-light (AWS by default, `conditional` option), Azure (read/delete/copy), WebDAV (opt-in), Disk, Memory.
    - `signedUpload(key, { maxSize?, minSize? })` returns `{ method: "PUT", url, headers }` or, with a size limit, a presigned `{ method: "POST", url, fields }` policy (`BaseStorage.getUploadPost`, gated on `supportsUploadPost`; SigV4 signer in `src/storage/aws/s3-post-policy.ts`, S3 + aws-light). `maxSignedUrlExpiresIn` caps `expiresIn` (BAD_REQUEST above it).
    - `delimiter` is pushed down natively where the provider can collapse prefixes server-side (S3 family via `listDirectory`, GCS); other adapters fall back to facade synthesis. Azure ships a native `deleteBatch` (Blob Batch API); FTP/SFTP support ranged `get`.
- Transformers (`src/transformer/`) — `image-transformer` (sharp), `video-transformer` / `audio-transformer` (mediabunny). All extend `base-transformer`.
- AI adapters (`src/ai/`) — `ai-sdk`, `openai`, `claude`, `tanstack` integrations.
- Nuxt adapter (`src/adapter/nuxt/`).
- OpenAPI export (`src/openapi/`).
- Metrics (`src/metrics/`) — `NoOpMetrics`, `OpenTelemetryMetrics`.

### Peer-dependency model

Every provider/runtime SDK is an **optional** peer (see `peerDependenciesMeta` in `package.json`). Users install only what they need. When adding a new provider, mirror this pattern: add to `dependencies` of the package only if it's universally needed; otherwise it goes in `peerDependencies` + `peerDependenciesMeta.optional = true`, and the import must stay inside the provider's sub-path so tree-shaking still works.

### Hard dependencies

`@remix-run/multipart-parser`, `@visulima/pagination`, `file-type`, `lru-cache`, `mime`, `nanoid`, `openapi-types`, `type-is`. `zod` is an optional peer used only by the AI entries (`src/ai/`). Implicit Nx deps: `api/pagination`, `data-manipulation/humanizer`, `filesystem/path`, `filesystem/fs`.

## Related

- `@visulima/storage-client` — browser-side upload client that talks to this package's HTTP handlers (TUS / multipart / chunked REST).
