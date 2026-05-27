# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/jsdoc-open-api` parses JSDoc comments and emits OpenAPI/Swagger specs. Exposes `parseFile`, `SpecBuilder`, two comment parsers (`jsDocumentCommentsToOpenApi` for standard syntax, `swaggerJsDocumentCommentsToOpenApi` for `@swagger`-prefixed blocks), a `SwaggerCompilerPlugin` Webpack plugin, and a `jsdoc-open-api` CLI (`bin/index.js`, sources in `src/cli/`).

## Architecture

- **Three subpath exports**: `.` (programmatic API), `./cli` (CLI core), `./cli/commander` (commander.js wrapper for the bin).
- **Two JSDoc dialects**: `src/jsdoc/` handles standard OpenAPI-in-YAML/JSON comments; `src/swagger-jsdoc/` handles the legacy `@swagger` short syntax. Keep them separate — they have divergent grammars.
- **Optional deps** (`optionalDependencies`): `cli-progress`, `commander`, `webpack`. Code paths that touch these (CLI, Webpack plugin) must guard against absence.
- **Validates output** via `@apidevtools/swagger-parser`.
- **Spec assembly**: `SpecBuilder` merges per-file results into a single OpenAPI document.

## Related

- Used by `@visulima/api-platform` to generate the Swagger doc served by its Next.js routes.
- Pairs with `@visulima/fs` (file reads / globs).
