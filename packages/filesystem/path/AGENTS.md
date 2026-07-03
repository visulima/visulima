# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/path` is a drop-in replacement for Node.js' `node:path` that **always behaves as POSIX**, regardless of the host OS. It exists to eliminate cross-platform path drift between Windows and POSIX runtimes. Zero runtime dependencies; ESM/TypeScript only.

## Architecture

### Critical gotcha: `sep` is always `/`

```ts
import { sep } from "@visulima/path";
sep === "/"; // true on Linux, macOS, AND Windows
```

This is load-bearing: when you need to construct a **native Windows path** (e.g. to hand to a non-`@visulima/path` consumer, a shell command, or a Windows-only API), do **not** use `sep` — hard-code the literal `"\\"` and replace, e.g. `posixPath.replace(/\//g, "\\")`. The same applies to `delimiter` — it is the POSIX `:` everywhere.

### Drop-in surface

Re-exports the standard `node:path` API: `basename`, `delimiter`, `dirname`, `extname`, `format`, `isAbsolute`, `join`, `matchesGlob`, `normalize`, `normalizeString`, `parse`, `relative`, `resolve`, `sep`, `toNamespacedPath`, plus a default export.

`path.win32` and `path.posix` are **both aliased to the same POSIX implementation** — they exist only so `import path from "@visulima/path"` works as a `node:path` shim. Do not rely on `path.win32` for Windows-style output.

### Extra utilities

`@visulima/path/utils` exports helpers that go beyond `node:path` (e.g. binary-extension detection, glob match via `zeptomatch`). Import from the subpath; don't add them to the main barrel.

### Cross-platform behaviour

All inputs are normalised through `normalize-windows-path.ts` so backslashes from callers get folded into POSIX form on every operation. When fixing path bugs, check whether the input is reaching `normalizeWindowsPath` before assuming the issue is in `join`/`resolve`.

## Related

- `@visulima/fs` — depends on this package for all internal path math.
- `@visulima/find-cache-dir` — uses `join`/`dirname` from here.
