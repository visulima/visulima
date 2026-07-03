# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/find-cache-dir` resolves a writable cache directory for a named tool, mirroring the conventional `node_modules/.cache/<name>` layout. Exports `findCacheDir` (async) and `findCacheDirSync`.

## Architecture

Lookup order:

1. If `process.env.CACHE_DIR` is set (and not `"0"`/`"1"`/`"false"`/`"true"`), use `${CACHE_DIR}/<name>`.
2. Otherwise `findUp("package.json")` from the start directory (`options.files` common ancestor, else `options.cwd ?? process.cwd()`), then resolve `<pkg-root>/node_modules/.cache/<name>`.
3. Hot path: if `node_modules/.cache/<name>` already exists and is writable (`W_OK`), return it without probing parents. Otherwise, if any existing segment in the chain (`node_modules/.cache/<name>`, `node_modules/.cache`, or `node_modules`) exists but is not writable, return `undefined` rather than a stale path.

Options: `{ create?: boolean; cwd?: URL | string; files?: ReadonlyArray<URL | string>; thunk?: boolean; throwError?: boolean; useGlobalCacheFallback?: boolean }`. The type is exported as `Options` (alias `FindCacheDirectoryOptions`).

- `create: true` — async path uses non-blocking `ensureDir`; sync path uses `ensureDirSync`.
- `files` — start the lookup from the closest common ancestor of these files instead of `cwd`.
- `thunk: true` — return `(...paths) => string` (a `CacheDirectoryThunk`) instead of the directory string, or `undefined` when unresolved.
- `throwError: true` — throw `NotFoundError` (from `@visulima/fs/error`) when no `package.json` ancestor exists; otherwise return `undefined`. Ignored when `useGlobalCacheFallback` is set.
- `useGlobalCacheFallback: true` — fall back to the OS user cache dir (`$XDG_CACHE_HOME` on Linux, `~/Library/Caches` on macOS, `%LOCALAPPDATA%` on Windows) when no writable `node_modules` exists.

Depends on `@visulima/fs` (`findUp`, `isAccessible`, `ensureDir`/`ensureDirSync`, `W_OK`) and `@visulima/path` — pinned exact versions in `devDependencies`, so bump them in lockstep when releasing.

## Related

- `@visulima/fs` — provides the underlying `findUp` / accessibility checks.
- `@visulima/path` — POSIX-normalised path joining (see its AGENTS.md for the `sep` gotcha).
