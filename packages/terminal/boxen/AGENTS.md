# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/boxen` renders a string inside a styled, bordered box for terminal output — borders, padding, margins, alignment, header/footer, and float positioning. Single-file core in `src/index.ts`, with the bundled border catalog in `src/vendor/cli-boxes/` (a vendored copy of `cli-boxes`), the terminal-width probe in `src/vendor/terminal-size/` (a port of `terminal-size`) and width measurement in `src/widest-line.ts`. Originally derived from Sindre Sorhus's `boxen`.

## Architecture

- Hot-path dependencies are inlined via the bundler rather than declared as runtime deps: `@visulima/string` (for `alignText`, `getStringWidth`, `wordWrap`) lives in `devDependencies` and is imported with `// eslint-disable-next-line import/no-extraneous-dependencies`. When changing imports inside `src/index.ts`, keep that pattern — boxen ships zero runtime deps in `package.json`.
- Borders come from the vendored `cli-boxes` JSON in `src/vendor/`; do not depend on the npm `cli-boxes` package.
- **The module graph must stay free of `node:*` imports.** `boxen()` is a pure string transform, so importing the package has to work on runtimes with no Node builtins (a Worker without `nodejs_compat`, Deno Deploy, the browser). The terminal-width probe is the only thing that wants builtins, and `src/vendor/terminal-size/` resolves them lazily via `process.getBuiltinModule()` — synchronously, because the public API is synchronous and a dynamic `import()` would not be. `__tests__/workerd/module-graph.test.ts` enforces this; do not add a static `node:*` (or `terminal-size`) import to `src/`.
- Dual-published (ESM `.mjs` + CJS `.cjs`) — keep new top-level files framework-agnostic so both build outputs stay valid.

## Related

- Used by `@visulima/cerebro` (optional peer) for help/error rendering, and by `@visulima/tui` for component borders.
