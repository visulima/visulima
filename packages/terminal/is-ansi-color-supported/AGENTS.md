# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/is-ansi-color-supported` answers "does this runtime support ANSI colors, and at what depth?" — returning a `ColorSpace` (none / 16 / 256 / truecolor) per stream. It honors `NO_COLOR`, `FORCE_COLOR`, `--no-color`, `--color`, CI detection, `TERM`, `COLORTERM`, and Windows version checks.

## Architecture

- Three platform-specific entry points wired via `exports` conditions:
  - `is-color-supported.server.ts` — Node/Deno/Bun, reads `process.env`, `process.argv`, `os.release()`, `tty.isatty`.
  - `is-color-supported.browser.ts` — DevTools-friendly detection (Chrome/Firefox console color support); no `process` references.
  - `is-color-supported.edge-light.ts` — Next.js edge runtime (no `tty`, no `os`).
- When adding a new env var or heuristic, mirror it across all three files where it makes sense; the browser/edge variants are deliberately narrower.
- Shared types live in `src/types.ts`, color-space enums in `src/color-spaces.ts`. Zero runtime dependencies.

## Related

- Sole runtime dependency of `@visulima/colorize`; both files travel together.
