# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/command-line-args` is a modern, TypeScript-first replacement for the original `command-line-args` library — strict-by-default argv parsing with optional `partial` and `stopAtFirstUnknown` modes. Public surface is `commandLineArgs` (legacy name) and `parseArgs` (alias) from `src/index.ts`; both take an option-definitions array and a `ParseOptions` object.

## Architecture

- Pipeline: `validateDefinitions` (`src/validate-definitions.ts`) → tokenize (`src/tokenizer.ts`) → resolve (`src/resolve-args.ts`). When adding a parsing feature, decide which stage owns it; do not bypass the tokenizer.
- Errors are class-based and re-exported from `src/errors/`: `AlreadySetError`, `InvalidDefinitionsError`, `UnknownOptionError`, `UnknownValueError`. Throw these instead of generic `Error` so callers can branch on type.
- Automatically strips `process.execArgv` entries from `process.argv.slice(2)` when no `argv` override is supplied — relevant when running under `node --import=tsx` etc.
- Zero runtime dependencies. `@visulima/error` is dev-only and not imported at runtime.
- ESM-only (`type: "module"`, single `dist/index.js` exports). Do not add CJS conditions.

## Related

- Used by `@visulima/cerebro` as the underlying argv parser.
