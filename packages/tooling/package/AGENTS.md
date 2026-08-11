# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/package` is a package-resolution and manifest-reading utility: find the nearest `package.json` / monorepo root, detect the active package manager, parse `package.json` / `package.yaml` / `package.json5`, parse npm/pnpm/yarn/bun lockfiles, and resolve pnpm catalog references. Bun lockfiles, pnpm catalogs, and lockfile SRI integrity decoding are first-class citizens.

## Architecture

Each concern is a separate sub-export — agents should import from the narrowest entry point:

- `.` — re-exports everything (see `src/index.ts`).
- `./monorepo` — `findMonorepoRoot[Sync]`, strategy detection.
- `./package` — `findPackageRoot[Sync]`.
- `./package-json` — `findPackageJson[Sync]`, `parsePackageJson[Sync]`, `writePackageJson[Sync]`, property helpers, `ensurePackages`.
- `./package-manager` — `findPackageManager[Sync]`, `findLockFile[Sync]`, `identifyInitiatingPackageManager`, `getPackageManagerVersion`.
- `./lockfile` — `parseLockFile[Sync]`, per-PM parsers (`parseNpmLockFile`, `parsePnpmLockFile`, `parseYarnLockFile`, `parseBunLockFile`), `decodeSriIntegrity`.
- `./pnpm` — catalog readers (`readPnpmCatalogs[Sync]`) and resolvers (`resolveCatalogReference`, `resolveCatalogReferences`, `resolveDependenciesCatalogReferences`), `isPackageInWorkspace`.
- `./error` — `PackageNotFoundError`.

Relies on `@visulima/fs` and `@visulima/path` (implicit Nx deps — both must build before this).

`EnsurePackagesOptions.confirm.theme` is deprecated and ignored — the readline-based prompt
uses fixed styling. It is typed `object` on purpose: its former `PartialDeep<Theme>` type put
`@inquirer/core` and `@inquirer/type` into the published declarations, which no consumer installs.
`object` rather than `Record<string, unknown>` — an interface-typed theme has no index signature,
so the `Record` form silently rejects every caller who declared their theme as an interface. Don't
re-narrow it; remove the option instead when a major lands.
