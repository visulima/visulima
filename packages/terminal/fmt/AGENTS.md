# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/fmt` is a small, fast `util.format`-style string formatter — `format("%s %d %j %c", [args], options)`. Supports the standard `%s %d %f %i %O %o %j` specifiers plus `%c` for CSS-driven ANSI styling (see `src/inspect-colors.ts` for the CSS → ANSI translator). The whole formatter is a single function in `src/index.ts`.

## Architecture

- Codepoint comparisons via `"x".codePointAt(0)` constants rather than string equality — keep that style when adding new specifiers; the hot path was deliberately micro-optimized.
- Zero runtime dependencies, dual-published ESM `.mjs` + CJS `.cjs`. No `node:` imports — runs in browsers and edge runtimes.
- `options.stringify` lets callers swap the JSON stringifier (`%j`, `%o`, `%O`); the default catches `JSON.stringify` throws and emits `"[Circular]"`.
