# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/inspector` is a `util.inspect`-style pretty-printer that runs in both Node.js and browsers. Single entry exports `inspect(value, options)` plus `registerConstructor` / `registerStringTag` for extending the type table. Used by `@visulima/pail` for object/error rendering.

## Architecture

### Type dispatch
`src/index.ts` builds a `baseTypesMap` keyed by `Object.prototype.toString` slug (`Date`, `Map`, `Set`, `Promise`, typed arrays, etc.). Each entry lives in `src/types/<name>.ts` and follows the `(value, options, inspect, indent) => string` signature. Add a new type by adding a file under `src/types/` and registering it in the map.

### Custom inspectors
Honors Node's `Symbol.for("nodejs.util.inspect.custom")` and falls back to `.inspect()` methods when present. Consumers can extend at runtime via `registerConstructor(Class, inspector)` (keyed by constructor function via `WeakMap`) or `registerStringTag(tag, inspector)` (keyed by `Symbol.toStringTag` value).

### Cross-runtime build
Dual ESM/CJS via packem (`./dist/index.{mjs,cjs}`) with a `browser` export condition that serves the ESM build — unusual in this monorepo, which is otherwise ESM-only. Browser tests run via Vitest browser-mode in Chromium/Firefox/WebKit (`pnpm run test:browser:*`). HTML inspection lives in `src/html.ts` and handles `HTMLElement` / `NodeList` / `HTMLCollection` only in browser contexts.

## Related

- Consumed by `@visulima/pail` for object tree rendering (`./object-tree`).
- Implicit dev dep on `@visulima/colorize` (only via consumers' `stylize` callback).
