# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/bytes` is a tiny zero-dependency utility module for converting between `Uint8Array`, Node.js `Buffer`, `ArrayBuffer`, and string encodings (ASCII / UTF-8). All exports live directly in `src/index.ts` — there is no sub-module structure.

## Architecture

- Single-file package: every helper (`bufferToUint8Array`, `isUint8Array`, `asciiToUint8Array`, `utf8ToUint8Array`, `toUint8Array`, etc.) is exported from `src/index.ts`.
- Runtime-conditional code: helpers branch on `typeof Buffer === "function"` so the module stays usable in non-Node environments. When editing, keep the Node and browser code paths intact.
- `toUint8Array` throws `Error('UINT8ARRAY_INCOMPATIBLE')` for unsupported inputs — preserve that exact error string; tests assert on it.
- Tagged-template inputs are supported (e.g. `` utf8ToUint8Array`hello` ``); editors must keep the `TemplateStringsArray` overloads in helper signatures.
- `@std/bytes` (from JSR) is a devDependency used as a behavioral reference in tests, not at runtime.
