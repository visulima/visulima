# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/find-cache-dir` resolves a writable cache directory for a named tool, mirroring the conventional `node_modules/.cache/<name>` layout. Exports `findCacheDir` (async) and `findCacheDirSync`.

## Architecture

Lookup order:

1. If `process.env.CACHE_DIR` is set (and not `"0"`/`"1"`/`"false"`/`"true"`), use `${CACHE_DIR}/<name>`.
2. Otherwise `findUp("package.json")` from `options.cwd ?? process.cwd()`, then resolve `<pkg-root>/node_modules/.cache/<name>`.
3. If any segment in that chain (`node_modules/.cache/<name>`, `node_modules/.cache`, or `node_modules`) exists but is not writable (`W_OK`), return `undefined` rather than a stale path.

Options: `{ create?: boolean; cwd?: URL | string; throwError?: boolean }`. `create: true` runs `ensureDirSync` on the resolved path. `throwError: true` throws `NotFoundError` (from `@visulima/fs/error`) when no `package.json` ancestor exists; otherwise returns `undefined`.

Depends on `@visulima/fs` (`findUp`, `isAccessible`, `ensureDirSync`, `W_OK`) and `@visulima/path` — pinned exact versions in `devDependencies`, so bump them in lockstep when releasing.

## Related

- `@visulima/fs` — provides the underlying `findUp` / accessibility checks.
- `@visulima/path` — POSIX-normalised path joining (see its AGENTS.md for the `sep` gotcha).
