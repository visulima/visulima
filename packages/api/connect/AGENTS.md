# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/connect` is the minimal async router + middleware layer used by `@visulima/api-platform` and consumable on its own. Targets Node `http`/`http2`, Next.js, Vercel Edge, and Micro. Exposes `Router` (base), `NodeRouter`/`createNodeRouter` (Node), `EdgeRouter`/`createEdgeRouter` (Edge), `expressWrapper` (compat), `withZod` (zod validation adapter), and `sendJson`.

## Architecture

- **Two runtimes from one router**: `src/node.ts` and `src/edge.ts` both extend `src/router.ts`. Keep request-shape branching in those entry files, not in `router.ts`.
- **Adapters under `src/adapter/`**: `express.ts` provides the `expressWrapper` compat shim; `with-zod.ts` provides the zod validator. Other framework adapters belong here too.
- **`regexparam` for path matching** (see `src/regexparam.d.ts` ambient module). When changing routing semantics, also update the ambient typing.
- **zod is a required peer** (`peerDependencies.zod: catalog:utils` -> v4) — `withZod` won't type-check without it.
- **Deprecation note**: `NodeRequestHandler` / `createRouter` (default Node export) are kept for back-compat; prefer `NodeRouter` / `createNodeRouter`.

## Related

- Re-exported wholesale by `@visulima/api-platform` (see its `index-server.ts`).
- `http-errors` is a runtime dependency here, but it's `@visulima/api-platform` that re-exports the error classes for consumers.
