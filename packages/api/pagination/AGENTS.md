# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/pagination` is a zero-dependency offset/limit paginator. Exports a `Paginator` class (`src/paginator.ts`), a `paginate(page, perPage, total, rows)` helper that returns a `PaginatorInterface<Result>`, and two OpenAPI schema builders — `createPaginationSchemaObject` and `createPaginationMetaSchemaObject` (`src/swagger/`).

## Architecture

- **Pure ESM** — single `import` condition exported, no CJS bundle; `lint:attw` runs with `--profile esm-only`.
- **No runtime dependencies** — keep it that way. Adding deps to this package ripples into `@visulima/crud` and `@visulima/api-platform` which catalog this version. The single entry in `peerDependencies` is `openapi-types`, marked `optional`, which no package manager installs.
- **Types-only swagger surface**: `src/swagger/` consumes `openapi-types` to produce schema objects; it does not import a swagger runtime. It is an _optional peer_ rather than a devDependency because packem refuses to publish output that imports a devDependency, and rather than a dependency because packem inlines optional-peer type namespaces — so `OpenAPIV3` is emitted into `dist/index.d.ts` and the published types resolve with nothing installed. Moving it to `dependencies` compiles just as well and quietly costs the zero-dependency property.

## Related

- Used by `@visulima/crud` (declared dep) for paginated CRUD list responses.
