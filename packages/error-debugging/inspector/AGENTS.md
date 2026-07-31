# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/inspector` is a `util.inspect`-style pretty-printer that runs in both Node.js and browsers. Single entry exports `inspect(value, options)` plus `registerConstructor` / `registerStringTag` for extending the type table. Used by `@visulima/pail` for object/error rendering.

## Architecture

### Type dispatch

`src/index.ts` builds a `baseTypesMap` keyed by `Object.prototype.toString` slug (`Date`, `Map`, `Set`, `Promise`, typed arrays, etc.). Each entry lives in `src/types/<name>.ts` and follows the `(value, options, inspect, indent) => string` signature.

Adding a type takes **two** registrations, not one:

1. Add a file under `src/types/` and register it in `baseTypesMap` (`src/index.ts`).
2. Add a matching entry to the brand table in `src/utils/brand-check.ts`.

The slug is not a fact about the value: `Symbol.toStringTag` overrides the built-in tag outright, so `{ [Symbol.toStringTag]: "Map" }` matches `inspectMap`, which then calls `map.entries()` and throws. `matchesBuiltInTag` confirms the value really owns the internal slots the tag claims before the renderer sees it; a value that fails takes the plain-object route instead.

A tag with no entry in that table **fails open** — `matchesBuiltInTag` reports it as genuine (`check === undefined || check(value)`). That is the right default, since a probe has to be side-effect free and some tags have none available, but it also means step 2 is silent when skipped: a new renderer that reads anything off the value stays reachable by forgery until its entry exists. See the header comment in `brand-check.ts` for the tags left deliberately unchecked and why.

### Custom inspectors

Honors Node's `Symbol.for("nodejs.util.inspect.custom")` and falls back to `.inspect()` methods when present. Consumers can extend at runtime via `registerConstructor(Class, inspector)` (keyed by constructor function via `WeakMap`) or `registerStringTag(tag, inspector)` (keyed by `Symbol.toStringTag` value).

### Cross-runtime build

One ESM build via packem (`./dist/index.js`), served to every runtime. The source is runtime-agnostic, so the `browser` export condition points at the same file as `default` rather than diverting to a second artefact, and no `workerd` / `edge-light` condition is needed. Keep it that way unless a genuinely divergent build appears — `__tests__/integration/package.test.ts` asserts every condition under `"."` resolves to the one file, and will fail if one is added without revisiting the condition order.

Tests run on three runtimes: Node (`pnpm run test`), workerd via `@cloudflare/vitest-pool-workers` (`pnpm run test:workerd`, `__tests__/workerd/`), and Vitest browser-mode in Chromium/Firefox/WebKit (`pnpm run test:browser:*`). HTML inspection lives in `src/html.ts` and handles `HTMLElement` / `NodeList` / `HTMLCollection` only in browser contexts.

## Related

- Consumed by `@visulima/pail` for object tree rendering (`./object-tree`).
- Implicit dev dep on `@visulima/colorize` (only via consumers' `stylize` callback).
