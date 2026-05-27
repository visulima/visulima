# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/object` is a thin barrel over a few curated object/array helpers. Local code is `src/omit.ts`, `src/pick.ts`, and `src/utils/is-plain-object.ts`. The rest of the surface is intentional re-exports from `deeks` (`deepKeys`, `deepKeysFromList`) and `dot-prop` (`getProperty`, `setProperty`, `hasProperty`, `deleteProperty`, `escapePath`).

## Architecture

- Single entry (`.` only) — there are no sub-exports. Everything ships from `src/index.ts`.
- `deeks`, `dot-prop`, `filter-obj`, and `is-plain-obj` appear as **devDependencies** even though they are re-exported. Bundling assumes they get inlined by `packem` — if a consumer reports missing peer deps after a bump, that's the cause.
- `type-fest` is a real runtime dep — types like `OmitDeep`, `Paths`, `PickDeep`, `Split` are re-exported.
- `omit` and `pick` are local implementations (not re-exports) — modify in place; tests live in `__tests__/`.

## Related

- `@visulima/redact` depends on `dot-prop` directly for the same path-access pattern; consider this package the public façade for that style of access.
