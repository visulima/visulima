# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/ono` renders pretty error pages — `toHTML` produces a Shiki-highlighted, theme-aware HTML report (sticky header, frame tabs, cause chain, solution panel, raw stack trace); `toANSI` produces a terminal report using `@visulima/boxen`. The HTML template lives under `src/error-inspector/` and is shared by `vite-overlay`-adjacent consumers; the CLI builder is shared via the monorepo's `shared/utils/cli-error-builder` (re-imported via relative path).

## Architecture

### Sub-path exports

- `.` — `Ono` class with `toHTML(error, opts)` and `toANSI(error, opts)`.
- `./page/context` — `createRequestContext`; lets consumers build the HTTP request panel shown in the HTML page.
- `./server/open-in-editor` — wraps `launch-editor-middleware` so the page's "Open in editor" buttons can call back into the dev server.

### `sideEffects: true`

Unlike most packages in the monorepo, this one is **not** marked side-effect-free. The Shiki highlighter is a module-level singleton and CSS/template assets must survive tree-shaking.

### Rendering stack

- **Shiki** (`shiki`, `@shikijs/langs`) for syntax highlighting — initialized once per process.
- **`isomorphic-dompurify`** for sanitizing rendered HTML (solutions can contain Markdown).
- **`@visulima/error`** for stack parsing, cause walking, and the solution-finder protocol.
- Tailwind v4 powers the page styles (`@tailwindcss/oxide`, `cssnano`, `tailwind-csstree` at build time).

### Peer deps (all optional)

AI providers — `ai` `^6.0.175`, plus `@ai-sdk/anthropic`, `@ai-sdk/azure`, `@ai-sdk/google`, `@ai-sdk/mistral`, `@ai-sdk/openai`, `open-editor`. The base HTML/ANSI rendering has no required peers.

## Related

- Built on `@visulima/error` (solution finders, stack parsing) and `@visulima/boxen` (ANSI output).
- Nx implicit deps: `error-debugging/error`, `terminal/boxen`.
- Shares the CLI error builder with `vite-overlay` via `shared/utils/cli-error-builder`.
