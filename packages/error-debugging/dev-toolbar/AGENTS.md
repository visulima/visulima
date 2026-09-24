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

### One `declare global` block, in `src/types/global-api.ts`

All `Window` augmentation for this package lives in the single `declare global` block in `src/types/global-api.ts`. Do **not** add a second one next to the interface it relates to.

packem's `.d.ts` bundler treats `global` as an ordinary identifier when de-duplicating declarations, so a second `declare global` in another bundled module is emitted as `declare global$1` — invalid TypeScript (TS1435). It is **not** suppressed by `skipLibCheck`, because it is a grammar error rather than a type error, so it breaks every consumer's build. This shipped in 1.0.5 and 1.0.6.

The real fix belongs in packem's dts bundler (separate repo); keeping to one block is the workaround that holds until then. When touching this, verify the built output actually parses:

```sh
pnpm build && tsc --noEmit --ignoreConfig --target es2022 --moduleResolution bundler --module esnext dist/packem_shared/global-api.d-*.d.ts
```

### The json-view renderer has no runtime dependency

`src/json-view/` renders a panel from a JSON spec. It implements its own state store
(`state-store.ts`, JSON-Pointer get/set over a plain object) and its own binding
resolution (`resolve.ts`), rather than depending on a library for them.

That is deliberate, and the reason is worth keeping:

`@json-render/core` supplies exactly these pieces, and the first version of this module
used it. But packem **externalises** declared dependencies rather than inlining them — the
built chunk keeps a bare `import … from "@json-render/core"` — so nothing was tree-shaken
at our build at all. The consumer's dev server resolves it with esbuild, which without a
`"sideEffects"` field keeps the whole package: **270 KB (58 KB gzip), zod included**,
fetched by every consumer's browser the first time a panel opens. For three functions, in
a dev-only overlay whose other runtime deps are Babel, floating-ui, launch-editor and
Preact.

Two traps if you revisit this:

- A green `grep -r zod dist/` proves nothing. Our `dist` is clean because the dependency
  **is not in it**, not because it was shaken out.
- Measuring the panel chunk from `pnpm build` output under-counts for the same reason. To
  see what a consumer actually downloads, build a host app against the built `dist` and
  look at `node_modules/.vite/deps/`.

The package is still a devDependency: `validateSpec` is used in the spec tests to assert
structural integrity, which never reaches a consumer. The spec's wire format is unchanged,
so a `@json-render/*` renderer remains a drop-in option for anyone who wants one.

### Peer deps

`vite` `^8.0.11` (required). Optional peers: `@modelcontextprotocol/sdk` `^1.29.0` (only when consuming the `./mcp` entry), `axe-core` (a11y app), `zod` `^3.25.0 || ^4.0.0`.

## Related

- Pairs with `@visulima/vite-overlay` for runtime error display.
- The MCP server entry mirrors the broader "vis MCP + Skill" strategy in the monorepo.
