# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/source-map` is a thin wrapper around `@jridgewell/trace-mapping`. The only original code is `src/load-source-map.ts` (`loadSourceMap(path)` — reads a JS file, locates the `# sourceMappingURL=` comment or sibling `.map` file, parses it, returns a `TraceMap`). Everything else (`originalPositionFor`, `generatedPositionFor`, `eachMapping`, `AnyMap`, `traceSegment`, the `TraceMap`/`SourceMapInput`/`Bias` types, etc.) is re-exported verbatim from `@jridgewell/trace-mapping`.

## Architecture

- **Single export entry.** No sub-paths beyond `./package.json`.
- **No native bindings, no vendored source-map.** This package does not bundle the upstream — it has `@jridgewell/trace-mapping` as a hard dependency and forwards its surface so consumers can pin to one Visulima version instead of tracking the upstream.
- **No peer deps.**

## Related

- Used by `@visulima/error` (stack-trace remapping) and `@visulima/vite-overlay` (via `@jridgewell/trace-mapping` directly).
