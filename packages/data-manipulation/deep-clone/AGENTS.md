# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/deep-clone` is a performance-oriented structured clone implementation. It supports arrays, objects, `Map`, `Set`, `RegExp`, `Date`, `Error`, `ArrayBuffer`, `DataView`, `Blob`, and DOM nodes (via `cloneNode`). `Promise`, `WeakMap`, `WeakSet`, and `SharedArrayBuffer` throw `TypeError` by design.

## Architecture

- Three public entry points (declared in `package.json` `exports`):
    - `.` — main `deepClone` function (`src/index.ts`)
    - `./handler` — re-exports every per-type copier (`src/handler.ts` → `src/handler/copy-*.ts`). Consumers can swap in custom handlers via the `options.handler` parameter.
    - `./utils` — `copyOwnProperties` and `getCleanClone` (`src/utils.ts` → `src/utils/`)
- Two cloning modes: **loose** (default — own enumerable props) and **strict** (own properties including symbols and descriptors). Each handler ships both variants (`copyArrayLoose`/`copyArrayStrict`, etc.). When adding a new handler, follow the same pair convention.
- Cycle handling uses a `WeakMap` cache passed via `State`. New handlers must accept `(value, state)` and check `state.cache` before recursing.
- The DOM-node detection (`nodeType` + `cloneNode`) is intentional — keep it; `jsdom` is a devDependency used to test this path.
