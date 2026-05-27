# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

> The root `AGENTS.md` already documents the NAPI platform packages, the `build-native.yml` matrix workflow, the `semantic-release-native-addons.mjs` plugin, and the `binding.js` runtime detection — don't repeat that here.

## Overview

`@visulima/task-runner` is the engine behind `@visulima/vis`: a monorepo task runner with two caching modes (Nx-style explicit inputs or Vite Task-style auto-fingerprinting), dependency-aware scheduling, affected detection, Turborepo-compatible HTTP remote cache, and a Bazel REAPI gRPC backend. Heavy paths (file hashing, concurrent process management, graph operations) run in Rust via NAPI; everything else is TypeScript with a pure-JS fallback.

## Architecture

Module layout in `src/`:

- `backends/` — remote-cache backends: `http.ts` (Turbo-compatible), `reapi.ts` (Bazel REAPI gRPC), `factory.ts` (selection by `CacheMode`), `hash-bridge.ts` (maps task-hashes <-> action-digests), `types.ts` (the `RemoteCacheBackend` contract).
- `cas/` — content-addressable store primitives (v2 layout): `digest.ts`, `paths.ts`, `store.ts`. Constants `V2_ROOT`/`V2_CAS`/`V2_AC`/`V2_INDEX`/`V2_TMP` live in `paths.ts`.
- `cache.ts` — local cache façade (`Cache`, `DEFAULT_CACHE_DIRECTORY_NAME`, size helpers).
- `concurrent.ts` / `concurrent-fallback.ts` — process orchestration; the `-fallback` variant is the pure-JS path used when the native addon isn't loaded.
- `command-parser/` — `npm:build` shortcuts, `npm run watch-*` wildcard expansion, `{1}` argument placeholders.
- `flow-controllers/` — restart-with-backoff, stdin routing, timing summaries, teardown commands.
- `framework-inference.ts` — Next/Vite/CRA/Gatsby/Nuxt env-var auto-injection.
- `affected.ts` — git-diff-based change detection + dependency expansion.
- `task-graph*.ts`, `task-orchestrator.ts`, `task-scheduler.ts`, `task-hasher.ts` — scheduling and hashing.
- `native-binding.ts` — single chokepoint for talking to the Rust addon. When the native `.node` isn't loadable, every call site here transparently degrades to the JS implementation. New native methods MUST follow this pattern: optional native call -> JS fallback -> identical observable behaviour.

## Local development

- `pnpm build` produces the JS bundle only — it does NOT rebuild the native addon. Use `pnpm build:native` (release) or `pnpm build:native:debug` for Rust changes; both emit `task-runner-native.<target>.node` to the package root.
- Native source lives in `native/` (`Cargo.toml`, `src/`, `build.rs`). After editing Rust, run `pnpm build:native:debug` then `pnpm test`. CI invokes `pnpm build:native` per target.
- `__bench__/` holds Vitest benchmarks; run with `pnpm bench` (where defined) or vitest directly. Don't add benchmarks to the regular test suite.
- Optional peer deps `@grpc/grpc-js` + `@grpc/proto-loader` are only required for the REAPI backend — import lazily.

## Related

- Consumed by `@visulima/vis` (`packages/tooling/vis`), which adds the CLI, config schema, plugins, dashboard, and AI/audit features on top.
