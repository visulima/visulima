# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/tui` is a React-based TUI framework with a drop-in [Ink](https://github.com/vadimdemedes/ink)-compatible API, accelerated by a native Rust diff engine exposed via NAPI. Based on [ratatat](https://github.com/geoffmiller/ratatat). The default export at `.` is the Ink-compatible surface (`src/ink/index.ts` → `render`, `Box`, `Text`, primitives, hooks). Component, hook, `core`, `react`, and `test` entries are exposed as deep subpath exports so consumers only pay for what they import.

## Architecture

- Four-layer source tree in `src/`:
    - `core/` — runtime kernel (`app.ts`, `cell.ts`, `inline.ts`, `input.ts`) plus `native-binding.ts`, the loader that picks the right `@visulima/tui-binding-*` optional dep per platform.
    - `ink/` — the Ink-compatible React renderer: reconciler, layout (`yoga-layout`), input parsing (`parse-keypress.ts`, `kitty-keyboard.ts`), backbuffer, mouse, canvas, hooks.
    - `react/` — generic React-renderer entry separate from the Ink shape (`./react` subpath).
    - `components/` — the published component library; each component is its own subpath export (`@visulima/tui/components/<name>`).
    - `testing/` — `./test` subpath: mock streams, frame capture, harness utilities.
- Native bindings are eight platform-specific packages (`@visulima/tui-binding-darwin-arm64`, `…-linux-x64-gnu`, `…-win32-x64-msvc`, etc.) declared under `optionalDependencies`. The Rust source lives in `native/` and is built by `pnpm run build:native` via `@napi-rs/cli`. Do not bundle the `.node` files into the JS dist.
- Heavy peers (`shiki`, `@shikijs/langs`/`themes`, `marked`, `diff`, `cfonts`, `react-devtools-core`, `ws`, `@visulima/tabular`) are **optional peers** — they must be lazy-imported inside the component that needs them, never at module top-level, so unused features don't drag in their dependencies.
- Required peers: `react ^19.2.6`, `react-reconciler ^0.33.0`. New components must work against React 19 (Suspense semantics, etc.).
- This package has `"sideEffects"` set for `./dist/components/**`, `./dist/ink/**`, `./dist/react/**`, and `./index.js` so the native binding loader is preserved through tree-shaking. New side-effectful entry points must be added to that list.

## Related

- Consumed by `@visulima/vis`. Pairs with `@visulima/ansi`, `@visulima/boxen`, `@visulima/colorize`, `@visulima/spinner`, and `@visulima/tabular` for their rendering primitives.
