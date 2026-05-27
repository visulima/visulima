# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/api-platform` is the umbrella API toolkit. It re-exports `@visulima/connect` (routing), bundles serializers (JSON/XML/YAML/JSON:API via `ts-japi`), wraps `http-errors` for ESM/CJS compatibility, and ships framework adapters under `src/framework/` (Next.js Swagger/Redoc pages, a CLI under `bin/index.js`). Also provides `corsMiddleware`, `rateLimiterMiddleware`, `httpHeaderNormalizerMiddleware`, and the `swaggerHandler`.

## Architecture

- **Three entry points**: `src/index-server.ts` (Node/SSR), `src/index-browser.ts` (browser bundle), and `src/framework/next/`, `src/framework/cli/` subpaths. The `browser` export condition swaps the bundle automatically.
- **`http-errors` re-export workaround**: `index-server.ts` reads each error class off `createHttpError` as `export const X: typeof createHttpError.X = createHttpError.X` instead of `export ... from "http-errors"`. Re-exporting via `from` produces an ESM bundle Node rejects with "Named export not found", and destructuring trips TS9019 under `--isolatedDeclarations`. Note: `NetworkAuthenticationRequire` (typed) is read from the runtime `NetworkAuthenticationRequired` property.
- **zod is a non-optional peer (load-bearing)**: although declared optional historically, the package was migrated to **zod v4** and **swagger-ui v5** (resolved in commit 9fe33dae6). Packem inlines optional-peer type namespaces, so zod must be installed for types to resolve. Treat zod as required when adding consumers.
- **Bin**: `bin/index.js` is the `api-platform` CLI; sources live in `src/framework/cli/`.
- **Recipes**: ships a `recipes/` directory in the published tarball.

## Related

- Built on `@visulima/connect` (router) and depends on `@visulima/jsdoc-open-api`, `@visulima/crud` (optional peer), `@visulima/fs`, `@visulima/path`.
- Consumed by Next.js apps that need swagger/redoc routes out of the box.
