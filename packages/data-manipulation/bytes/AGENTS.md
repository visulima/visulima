# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/bytes` is a tiny zero-dependency utility module for converting between `Uint8Array`, Node.js `Buffer`, `ArrayBuffer`, and string encodings (ASCII / UTF-8). All exports live directly in `src/index.ts` — there is no sub-module structure.

## Architecture

- Single-file package: every helper (`bufferToUint8Array`, `isUint8Array`, `asciiToUint8Array`, `utf8ToUint8Array`, `toUint8Array`, etc.) is exported from `src/index.ts`.
- Runtime-conditional code: helpers branch on the `hasBuffer()` check (`typeof Buffer === "function"`, re-checked per call) so the module stays usable in non-Node environments. String encoding/decoding uses the standard `TextEncoder`/`TextDecoder` (no `node:buffer` import), so keep both the Node fast paths and the cross-runtime fallbacks intact.
- `toUint8Array` throws a `Uint8ArrayIncompatibleError` (subclass of `Error`, with a `code === "UINT8ARRAY_INCOMPATIBLE"`) for unsupported inputs. The message still begins with the `UINT8ARRAY_INCOMPATIBLE: Cannot convert data to Uint8Array` prefix — preserve that prefix and the `code`; tests assert on both.
- Tagged-template inputs are supported (e.g. `` utf8ToUint8Array`hello` ``); editors must keep the `TemplateStringsArray` overloads in helper signatures.
- `@std/bytes` (from JSR) is a devDependency used as a behavioral reference in tests, not at runtime.
