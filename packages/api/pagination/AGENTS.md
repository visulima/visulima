# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/pagination` is a zero-dependency offset/limit paginator. Exports a `Paginator` class (`src/paginator.ts`), a `paginate(page, perPage, total, rows)` helper that returns a `PaginatorInterface<Result>`, and two OpenAPI schema builders — `createPaginationSchemaObject` and `createPaginationMetaSchemaObject` (`src/swagger/`).

## Architecture

- **Pure ESM** — single `import` condition exported, no CJS bundle; `lint:attw` runs with `--profile esm-only`.
- **No runtime dependencies and no peer dependencies** — keep it that way. Adding deps to this package ripples into `@visulima/crud` and `@visulima/api-platform` which catalog this version.
- **Types-only swagger surface**: `src/swagger/` consumes `openapi-types` (devDep) to produce schema objects; it does not import a swagger runtime.

## Related

- Used by `@visulima/crud` (declared dep) for paginated CRUD list responses.
