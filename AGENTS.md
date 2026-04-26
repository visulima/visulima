# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Repository Overview

Visulima is a pnpm monorepo with 44+ TypeScript packages organized under `packages/<category>/<name>/`. Categories: `api`, `data-manipulation`, `email`, `error-debugging`, `filesystem`, `storage`, `terminal`, `tooling`. Apps live in `apps/` (web, storybook). Shared code in `shared/`.

**Package manager**: pnpm v10.32.1 (enforced). **Monorepo orchestration**: Nx. **Node**: ^22.14.0 || >=24.10.0.

## Build & Test Commands

```bash
# Build
pnpm run build:packages           # All packages (dev)
pnpm run build:packages:prod      # All packages (production)
pnpm run build:affected:packages  # Only changed packages

# Test
pnpm run test                     # All tests
pnpm run test:coverage            # With coverage
pnpm run test:affected            # Only changed packages

# Single package (use pnpm --filter)
pnpm --filter "@visulima/cerebro" run test
pnpm --filter "@visulima/cerebro" run build

# Lint
pnpm run lint:eslint              # ESLint all
pnpm run lint:eslint:fix          # ESLint fix all
pnpm run lint:prettier            # Prettier check
pnpm run lint:prettier:fix        # Prettier fix
pnpm run lint:types               # TypeScript type check
pnpm run lint:affected:eslint     # Only changed
pnpm run lint:affected:types      # Only changed
```

## Commit Convention

Angular-style conventional commits, enforced by hooks:

```
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `perf`, `docs`, `dx`, `refactor`, `test`, `workflow`, `build`, `ci`, `chore`, `types`, `wip`, `release`, `deps`, `revert`. Scope is typically the package name (e.g., `feat(cerebro): add plugin system`). Subject: imperative, lowercase, no period, max 50 chars.

## Branch Strategy

- **alpha**: Primary development branch — most PRs target this
- **main**: Stable releases
- **next/beta**: Pre-release channels
- Feature branches: `feat/name`, `fix/issue-number`

## Architecture & Patterns

### Package Structure
Every package follows the same layout:
- `src/index.ts` — main export
- `__tests__/` — Vitest tests (`.test.ts` or `.spec.ts`)
- `vitest.config.ts` — per-package test config
- `.releaserc.json` — extends `@anolilab/semantic-release-preset/pnpm`
- `project.json` — Nx metadata with tags (e.g., `type:package`, `category:cli-terminal`)
- `packem.config.ts` — bundler config (uses `@visulima/packem`)

All packages are ESM (`"type": "module"`), use conditional exports, and have `"sideEffects": false`.

### Nx Tags on project.json
Each package has tags for categorization:
- `type:package` — marks it as a publishable package
- `category:<slug>` — web category (e.g., `category:cli-terminal`, `category:data`, `category:api-web`, `category:error-handling`, `category:file-system`, `category:dev-tools`, `category:internationalization`, `category:communication`)

### Website Package Discovery
The packages page at `apps/web/` is auto-generated:
- `project.json` tags provide category
- `package.json` provides name, description
- `apps/web/src/data/packages-metadata.json` stores curated displayName and features
- `apps/web/scripts/generate-packages.js` combines all sources into `packages.ts`
- Runs automatically during `build` and `dev`

To add a new package to the website: add `category:<slug>` tag to its `project.json`, optionally add metadata to `packages-metadata.json`.

### Native Rust Packages (task-runner)
`packages/tooling/task-runner/` has native NAPI bindings:
- 8 platform-specific packages in `npm/` (darwin, linux, windows × x64, arm64)
- Built by `.github/workflows/build-native.yml` (matrix across all targets)
- Published via `scripts/semantic-release-native-addons.mjs` (local semantic-release plugin, runs in `verifyConditions` + `prepare`)
- Platform packages are excluded from `multi-semantic-release` via `--ignore-packages`
- `binding.js` handles runtime platform detection and fallback to JS implementations

### Dependency Catalog
Shared dependency versions are managed via pnpm catalog in `pnpm-workspace.yaml`. Packages reference versions as `catalog:dev`, `catalog:test`, `catalog:lint`, etc.

### Pre-commit Hooks
Husky + lint-staged runs on commit:
- `sort-package-json` on `package.json` files
- `secretlint` on all files
- `tsc --noEmit` on `.ts` files (per-package tsconfig)
- ESLint on test files
- Fixtures (`__fixtures__/`) are excluded

### Release
Independent per-package versioning via `multi-semantic-release`. Each package has `.releaserc.json` extending the shared preset. The preset chain: commit-analyzer → release-notes-generator → changelog → clean-package-json → pnpm-publish → git → github.

Research the codebase before editing. Never change code you haven't read.
