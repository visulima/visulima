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
