# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/pail` is the monorepo's universal logger — Node.js, Edge, and browser. It splits at build time into `index.server.ts` and `index.browser.ts` so the server bundle never pulls in browser-only paths and vice versa. Logging is pipelined through **processors** (transform `Meta`) and **reporters** (emit to a sink). Also ships **wide-events** (accumulate context across an operation, emit once) and framework middleware for Express, Fastify, Hono, Elysia, SvelteKit, and Next.js.

## Architecture

### Entry-point split

- `.` — automatic; resolves to `./dist/index.server.js` on Node/SSR and `./dist/index.browser.js` in browsers via the `browser` export condition.
- `./server`, `./browser` — explicit entry points when you need to force one bundle.
- Sources: `src/index.server.ts` + `src/pail.server.ts` vs. `src/index.browser.ts` + `src/pail.browser.ts`. Keep server-only imports (`node:*`, `rotating-file-stream`) out of the browser file.

### Processors (`src/processor/`)

Plug-in transforms over each log `Meta`. Stable sub-path exports:

- `./processor/redact` — secret scrubbing (optional peer: `@visulima/redact`).
- `./processor/message-formatter` — printf-style interpolation.
- `./processor/caller` — captures call site (uses stack parsing).
- `./processor/opentelemetry` — injects OTel trace/span IDs (optional peer: `@opentelemetry/api`).
- `./processor/sampling` — probabilistic log sampling.
- `./processor/environment` — adds env/runtime metadata.

### Reporters (`src/reporter/`)

Output sinks; each reporter has stable sub-path exports:

- `./reporter/pretty` — terminal pretty output (server) and DevTools styled output (browser); split entries per runtime.
- `./reporter/json` — JSON lines (server + browser split).
- `./reporter/simple` — server-only minimal output.
- `./reporter/file` — `json-file-reporter` for Node only.
- `./reporter/http` — sends batches over HTTP; three conditional builds (`import`, `edge-light`, `browser`) selected automatically. `./reporter/abstract-http` exposes the base class for custom transports.

### Middleware (`src/middleware/`)

One file per framework: `express`, `fastify`, `hono`, `elysia`, `sveltekit`, `next/handler`. All frameworks are **optional** peer deps; only require them in their middleware file, never at the top level.

### Peer deps

All optional: `@opentelemetry/api`, `@sveltejs/kit` `>=2.0`, `@visulima/redact`, `elysia` `>=1.0`, `express` `>=4.0`, `fastify` `>=4.0`, `hono` `>=4.0`, `next` `>=14.0`, `rotating-file-stream`.

## Related

- Built on `@visulima/colorize`, `@visulima/inspector` (object-tree rendering via `./object-tree`), `@visulima/fmt`, `@visulima/string`, `@visulima/interactive-manager`.
- Nx implicit deps: `terminal/fmt`, `terminal/colorize`, `terminal/is-ansi-color-supported`.
- See `MIGRATION-GUIDE.md` for breaking changes when bumping major versions.
