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

- `Files` facade (`src/files/`) — `upload` (pausable/abortable via `UploadControl`), `download` (byte `range`), `head`, `exists`, `delete`, `copy`, `move`, `list` (S3-style `delimiter` returns `{ files, prefixes }`), `listAll`, `search` (glob / regex / substring / exact over `listAll`, filtered by a glob's literal prefix — the provider listing still walks every key; the read-only `searchFiles` AI tool, which offers no regex), `url`, `signedUploadUrl`, `signedUpload`, plus `.raw` escape hatch, a `capabilities` getter, `readonly()` locked views, and top-level `transfer(source, destination)` (one-shot stream) / `sync(source, destination)` (incremental, optionally-pruning, `dryRun`) for cross-adapter migration/mirroring.
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

## Tests

- `pnpm run test` runs everything against in-memory fakes. Provider fakes shared between suites live in `__tests__/__helpers__/fakes/`; `describeStorageContract` (`__tests__/__helpers__/storage-contract.ts`) is the behaviour every adapter shares.
- `__tests__/matrix/` (`describeMatrix`, `__tests__/__helpers__/matrix.ts`) runs the cross-product: providers (memory, disk, S3, aws-light, Azure, GCS, FTP, SFTP) × naming (default id, custom `filename`) × expiration (none, `maxAge`, rolling) × meta store (provider default, shared `MemoryMetaStorage`) × handler (REST, TUS, multipart) × runtime (node http server, fetch). Add a provider there when it gets a fake.

### Live tests

`__tests__/live/` runs the storage contract and a slice of the matrix against real services: MinIO and SeaweedFS (S3Storage, AwsLightStorage; `pgsty/minio`, as MinIO no longer publishes images), Azurite, fake-gcs-server, an SFTP server (atmoz/sftp), an FTP server (vsftpd), Apache httpd's mod_dav (WebDAV, with `FileETag Digest`: by default Apache hands out weak ETags for files changed in the last second, which `If-Match` never matches), PocketBase, and Supabase's storage-api over Postgres. They are skipped unless `LIVE_TESTS=1`, and excluded from `pnpm run test`. Every image is pinned by digest.

```bash
docker compose -f docker-compose.live.yml up -d --wait
LIVE_TESTS=1 pnpm run test:live
docker compose -f docker-compose.live.yml down --volumes
```

Every test gets a fresh bucket, container or directory. The connection settings default to the compose services and can be pointed elsewhere with `LIVE_S3_ENDPOINT`, `LIVE_S3_ACCESS_KEY`, `LIVE_S3_SECRET_KEY`, `LIVE_S3_REGION`, `LIVE_AZURE_CONNECTION_STRING`, `LIVE_GCS_ENDPOINT`, `LIVE_SFTP_HOST`/`_PORT`/`_USER`/`_PASSWORD`, `LIVE_FTP_HOST`/`_PORT`/`_USER`/`_PASSWORD`/`_HOME`, `LIVE_SEAWEEDFS_ENDPOINT`, `LIVE_WEBDAV_URL`/`_USER`/`_PASSWORD`, `LIVE_POCKETBASE_URL`/`_EMAIL`/`_PASSWORD` and `LIVE_SUPABASE_URL`/`_JWT_SECRET` (see `__tests__/live/backends.ts`). A service that can't run a contract scenario declares it in `contractSkips` with the reason (S3 refuses requests signed with a faked clock; fake-gcs-server does not emulate the resumable session status query). CI runs them in `.github/workflows/storage-live.yml` on pull requests touching this package and on `main`.

## Related

- `@visulima/storage-client` — browser-side upload client that talks to this package's HTTP handlers (TUS / multipart / chunked REST).
