# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/colorize` is a Chalk-compatible terminal string-styling library with named imports (`red`, `bold`), chained syntax (`red.bold.underline(...)`), tagged-template literals, and gradients. It auto-detects terminal color capability and falls back TrueColor → 256 → 16 → no-color.

## Architecture

- Triple-platform build: `colorize.server.ts` (Node/Deno/Bun), `colorize.browser.ts` (browser-friendly without `process` lookups), and an edge-light condition for Next.js edge runtimes. The `exports` map wires these to `import`, `require`, `browser`, and `edge-light` conditions — do not collapse them; new APIs must be added to all three entry points or the build will report missing exports.
- The server entry has both `.mts` (ESM) and `.cts` (CJS) variants. `index.server.mts` and `index.server.cts` are intentionally separate sources, not generated from each other.
- Subpath exports: `./browser`, `./template`, `./gradient`, `./utils`. Gradients live in `src/gradient/` and the tagged-template renderer in `src/template/`.
- Color capability detection is delegated to the (only) runtime dep `@visulima/is-ansi-color-supported`. Do not re-implement `FORCE_COLOR` / `NO_COLOR` parsing here.

## Related

- Depends on `@visulima/is-ansi-color-supported`. Used by `@visulima/cerebro`, `@visulima/boxen`, `@visulima/tabular`, `@visulima/tui`, and most other terminal packages.
