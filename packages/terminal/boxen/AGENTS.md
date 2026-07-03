# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/boxen` renders a string inside a styled, bordered box for terminal output — borders, padding, margins, alignment, header/footer, and float positioning. Single-file core in `src/index.ts`, with the bundled border catalog in `src/vendor/cli-boxes/` (a vendored copy of `cli-boxes`) and width measurement in `src/widest-line.ts`. Originally derived from Sindre Sorhus's `boxen`.

## Architecture

- Hot-path dependencies are inlined via the bundler rather than declared as runtime deps: `@visulima/string` (for `alignText`, `getStringWidth`, `wordWrap`) and `terminal-size` live in `devDependencies` and are imported with `// eslint-disable-next-line import/no-extraneous-dependencies`. When changing imports inside `src/index.ts`, keep that pattern — boxen ships zero runtime deps in `package.json`.
- Borders come from the vendored `cli-boxes` JSON in `src/vendor/`; do not depend on the npm `cli-boxes` package.
- Dual-published (ESM `.mjs` + CJS `.cjs`) — keep new top-level files framework-agnostic so both build outputs stay valid.

## Related

- Used by `@visulima/cerebro` (optional peer) for help/error rendering, and by `@visulima/tui` for component borders.
