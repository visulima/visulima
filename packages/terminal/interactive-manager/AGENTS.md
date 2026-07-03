# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/interactive-manager` is the shared rendering substrate for live, redrawing terminal UIs — the layer that owns the cursor, hooks stdout/stderr, and replays buffered writes around an interactive region. Two exports from `src/index.ts`:

- `InteractiveManager` (`src/interactive-manager.ts`) — owns lines, batched redraws, terminal-size tracking.
- `InteractiveStreamHook` (`src/interactive-stream-hook.ts`) — intercepts `process.stdout`/`stderr` writes so concurrent `console.log` calls don't tear the interactive region.

## Architecture

- ANSI emission goes through `@visulima/ansi` (devDependency, bundled). Do not write escape sequences inline — use the named helpers (`cursorHide`, `eraseLines`, etc.) so capability handling stays centralized.
- String-width logic comes from `@visulima/string`; `terminal-size` provides the column count. Both are devDependencies inlined by the bundler — keep them out of runtime `dependencies`.
- `StreamType` distinguishes stdout vs stderr ownership and is re-exported as the only public type.

## Related

- Consumed by `@visulima/spinner` and `@visulima/progress-bar` (both list it as a runtime `dependency`); they delegate all redraw bookkeeping here.
