# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/error` is the foundational error toolkit used by `ono`, `vite-overlay`, and `pail`. It provides the `VisulimaError` class plus serialize/deserialize helpers, a cross-runtime stack trace parser (`parseStacktrace`, `Trace`, `TraceType`), a code-frame renderer (`codeFrame`, `CODE_FRAME_POINTER`, `indexToLineColumn`), and a pluggable "solution finder" system that suggests fixes for common errors.

## Architecture

### Sub-path exports
- `./error` — `VisulimaError`, `serializeError`/`deserializeError`, `getErrorCauses`, `renderError`, `isErrorLike`, `isVisulimaError`, `addKnownErrorConstructor`, `NonError`, `captureRawStackTrace`.
- `./stacktrace` — `parseStacktrace`, `formatStacktrace`, `formatStackFrameLine`, `Trace`, `TraceType`.
- `./code-frame` — `codeFrame`, `CODE_FRAME_POINTER`, `indexToLineColumn`, options/types.
- `./solution` — types only (`Solution`, `SolutionError`, `SolutionFinder`, `SolutionFinderFile`) plus `errorHintFinder`, `ruleBasedFinder`.
- `./solution/ai`, `./solution/ai/prompt` — optional AI-powered solution finder (`aiPrompt`, `aiSolutionResponse`); requires the `ai` peer dep.

### Solution finder pattern
A `SolutionFinder` is `{ name, priority, handle(error, file) => Promise<{ header, body } | undefined> }`. Higher `priority` runs first. `ruleBasedFinder` ships built-in hints for ESM/CJS interop, export mismatch, port-in-use, missing files/case, TS path mapping, DNS/connection, React hydration, undefined property access. Consumers (e.g. `vite-overlay`) compose their own finders alongside these.

### Peer deps
`ai` is an **optional** peer (only needed for `./solution/ai`). No required peers — the package is otherwise dependency-free at runtime.

## Related

- Implicit Nx dep: `filesystem/path` (used internally; not re-exported).
- Consumed by `@visulima/ono`, `@visulima/vite-overlay`, `@visulima/error-handler`, `@visulima/pail`.
