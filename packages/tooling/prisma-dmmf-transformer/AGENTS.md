# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/prisma-dmmf-transformer` converts a Prisma DMMF (Data Model Meta Format) into a valid JSON Schema v7 document. Exports `transformDMMF` (full-document transformer) and `getJSONSchemaProperty` (per-field helper) from `src/index.ts`. Used to derive JSON Schema validators/types from a Prisma schema.

## Architecture

- Dual ESM/CJS build (this is one of the few packages in the repo with a `require` conditional export — keep both entries in sync when changing exports).
- `peerDependencies`: `prisma` and `@prisma/client` both as `3.* || 4.* || 5.* || 6.*`. New behaviour must work across all four majors or be feature-gated.
- Core logic split between `transform-dmmf.ts` (model + enum walk) and `get-json-schema-property.ts` (scalar/relation mapping). `types.ts` defines `DefinitionMap`, `PropertyMap`, `TransformOptions`, etc.
- `__fixtures__/` holds DMMF snapshots used by `__tests__/` — when adding fields, regenerate fixtures rather than hand-editing.
