# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/crud` generates RESTful CRUD handlers from a Prisma model. The base handler in `src/base-crud-handler.ts` parses query params (`src/query-parser.ts`), dispatches to an `Adapter`, and exposes a `RouteType` enum. Ships a Prisma adapter (`src/adapter/prisma`) and a Swagger generator (`src/swagger/adapter/prisma`, `modelsToOpenApi`) that converts Prisma DMMF into OpenAPI schemas.

## Architecture

- **Two entry points**: root export is framework-agnostic (`src/index.ts`); `./next` (`src/next/`) provides a Next.js-specific handler factory.
- **Adapter pattern**: `Adapter` interface in `src/types.ts` is the extension point. The Prisma adapter is the only built-in; consumers can plug their own ORM. Don't bake Prisma assumptions into `src/handler/` or `src/base-crud-handler.ts`.
- **Required peer**: `@prisma/client` (`^3 || ^4`) — note the peer range pre-dates current Prisma; verify when bumping. `next` is optional peer for the `./next` export.
- **DMMF transformation** uses `@visulima/prisma-dmmf-transformer` (out-of-tree dep) — Swagger output flows through it.
- **Pagination** comes from `@visulima/pagination`; CRUD's `PaginationConfig`/`PaginationData` types wrap that package.

## Related

- Optional peer of `@visulima/api-platform` (`./recipes/` over there shows wiring).
- Pairs with `@visulima/pagination` (sibling package) and `@visulima/prisma-dmmf-transformer`.
