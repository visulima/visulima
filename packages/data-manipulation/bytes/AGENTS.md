# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/bytes` is a tiny utility module for converting between `Uint8Array`, Node.js `Buffer`, `ArrayBuffer`, and string encodings (ASCII / UTF-8 / hex / base64). All exports live directly in `src/index.ts` — there is no sub-module structure. Note that `src/index.ts` also `export *`s the entire `@std/bytes` surface (`concat`, `equals`, `indexOfNeedle`, ...), which is inlined into `dist` at build time, so a large share of the public API is that re-exported third-party code.

## Architecture

- Single-file package: every helper (`bufferToUint8Array`, `isUint8Array`, `asciiToUint8Array`, `utf8ToUint8Array`, `toUint8Array`, etc.) is exported from `src/index.ts`.
- Runtime-conditional code: helpers branch on the `hasBuffer()` check (`typeof Buffer === "function"`, re-checked per call) so the module stays usable in non-Node environments. String encoding/decoding uses the standard `TextEncoder`/`TextDecoder` (no `node:buffer` import), so keep both the Node fast paths and the cross-runtime fallbacks intact.
- `toUint8Array` throws a `Uint8ArrayIncompatibleError` (subclass of `Error`, with a `code === "UINT8ARRAY_INCOMPATIBLE"`) for unsupported inputs. The message still begins with the `UINT8ARRAY_INCOMPATIBLE: Cannot convert data to Uint8Array` prefix — preserve that prefix and the `code`; tests assert on both.
- Tagged-template inputs are supported (e.g. `` utf8ToUint8Array`hello` ``); editors must keep the `TemplateStringsArray` overloads in helper signatures.
- `@std/bytes` (from JSR) is re-exported from `src/index.ts` (`export * from "@std/bytes"`) and is part of the published public API. It sits in `devDependencies` because packem inlines its code into `dist` at build time (hence the `@jsr/std__bytes` hoisted-validation exclusion in `packem.config.ts`) — it is not a runtime dependency, but bumping its version changes the exported API surface and is a semver-relevant change.
