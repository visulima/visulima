# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/dev-toolbar` is a framework-agnostic development toolbar for any Vite project (React, Vue, Svelte, Solid, plain HTML). The toolbar renders inside a Shadow DOM custom element (zero style leakage) and communicates with the Vite dev server over a type-safe RPC bridge (`src/rpc/client.ts` over `import.meta.hot`, `src/rpc/server.ts` Node-only). Ships nine built-in apps under `src/apps/` (a11y, annotations, assets, inspector, module-graph, performance, seo, settings, tailwind, timeline, vite-config).

## Architecture

### Sub-path exports
- `.` (main) — re-exports `DevToolbar`, RPC contexts, hooks, timeline store, settings helpers.
- `./vite` — the Vite plugin (`src/vite-plugin.ts`).
- `./client/overlay` — runtime overlay client.
- `./apps/<name>` — per-app entry points (a11y, assets, inspector, tailwind, module-graph, performance, seo, settings, timeline, annotations, vite-config). Each app is a self-contained unit.
- `./mcp` — optional MCP server (`src/mcp/server.ts`); also exposed via the `visulima-dev-toolbar-mcp` bin.
- `./toolbar`, `./ui` — internal toolbar shell and shared UI primitives (Preact components).

### Runtime split (Node vs. client)
`createClientRPCContext` is client-safe (uses `import.meta.hot`). `createServerRPCContext` is Node-only and is safe to import from the main entry because Vite only loads the plugin in Node. Keep this distinction when adding new RPC endpoints.

### UI stack
Built on **Preact** (not React), styled via Tailwind v4 (`@tailwindcss/node` + `@tailwindcss/oxide`), uses `clsx` for class composition, `@floating-ui/dom` for positioning, `launch-editor` for jump-to-source, `axe-core` (optional peer) for the a11y app, and Babel (`@babel/parser`/`@babel/traverse`/`@babel/generator` + `babel-plugin-transform-hook-names`) for source rewrites.

### Peer deps
`vite` `^8.0.11` (required). Optional peers: `@modelcontextprotocol/sdk` `^1.29.0` (only when consuming the `./mcp` entry), `axe-core` (a11y app), `zod` `^3.25.0 || ^4.0.0`.

## Related

- Pairs with `@visulima/vite-overlay` for runtime error display.
- The MCP server entry mirrors the broader "vis MCP + Skill" strategy in the monorepo.
