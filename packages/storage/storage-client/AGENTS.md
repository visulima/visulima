# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

Framework-agnostic upload client (`@visulima/storage-client`) for React, Vue, Solid, and Svelte. Talks to the upload server provided by `@visulima/storage` (TUS, multipart, chunked REST). Built on TanStack Query for caching/state, with progress tracking, retries, batch uploads, abort control, and drag-drop / paste helpers.

## Architecture

### Sub-path exports

`.` (core, framework-agnostic), `./react`, `./vue`, `./solid`, `./svelte`. Framework bindings are thin wrappers over the same core primitives — keep upload logic in `core/` and only expose framework idioms (hooks for React/Vue, `create*` factories for Solid/Svelte) in the per-framework folders.

### `core/` module layout

- `uploader.ts` — main `createUploader` + `Uploader` orchestrator, batch state, event types.
- `tus-adapter.ts` — TUS resumable protocol adapter.
- `multipart-adapter.ts` — multipart form-data adapter.
- `chunked-rest-adapter.ts` — chunked REST adapter.
- `query-client.ts` — fetch helpers (`fetchFile`, `fetchHead`, `fetchJson`, `patchChunk`, `putFile`, `deleteRequest`, `buildUrl`, `parseApiError`).
- `query-keys.ts` — `storageQueryKeys` for TanStack Query cache integration.
- `fingerprint.ts`, `upload-control.ts`, `url-storage.ts` — resumable-upload primitives shared by `tus-adapter` and `chunked-rest-adapter`. `defaultFingerprint` keys uploads by `${protocol}::${endpoint}::name::size::type::lastModified`; `UploadControl` is the unified pause/resume/abort handle with `toJSON()` / `UploadControl.from(token)` for cross-process resume; `UrlStorage` (`MemoryUrlStorage` / `LocalStorageUrlStorage` / `defaultUrlStorage()`) persists the per-file resume identifier so a fresh `adapter.upload(file)` after a crash resumes instead of starting over. Persistence is opt-in — pass `urlStorage` and/or `control` to the adapter constructor. Both adapters preserve the storage entry on error (so retries can resume) and clear it on success.

### Framework parity

`react/` and `vue/` mirror each other one-to-one (`use-*` hooks). `solid/` and `svelte/` mirror each other (`create-*` factories). When adding a feature to one framework, replicate the file across all four to keep the surface consistent.

### Peer deps

TanStack Query is required for whichever framework you use: `@tanstack/react-query` >= 5.100.9, `@tanstack/vue-query` >= 5.100.9, `@tanstack/solid-query` >= 5.100.9, `@tanstack/svelte-query` >= 6.1.28. Framework runtimes: React >= 19.2.6, Vue >= 3.5.34, Solid >= 1.9.12, Svelte >= 3.0.0. No hard runtime dependencies — everything is peer.

## Related

- `@visulima/storage` — the server-side counterpart whose HTTP handlers this client targets.
