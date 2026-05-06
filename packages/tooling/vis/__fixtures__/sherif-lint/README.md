# sherif test fixtures

These fixtures are copied verbatim from [sherif](https://github.com/QuiiBz/sherif),
a Rust monorepo linter by Tom Lienard, and used to validate that vis's
lint subsystem catches the same classes of issues sherif catches.

The original repository is licensed under the MIT License — see `LICENSE`
in this directory for the full text. We retain the copyright notice as
required by the MIT terms.

## What's here

Each subdirectory next to this README is a synthetic monorepo that exercises
one or more lint rules:

| fixture | exercises |
|---|---|
| `basic` | npm-style `workspaces` array, plus dead patterns (`examples/*`, `website`) |
| `pnpm` | `pnpm-workspace.yaml` packages list, plus dead patterns |
| `pnpm-glob` | scope-glob workspace pattern (`@*`) |
| `yarn-nohoist` | yarn-style `workspaces.packages` object form |
| `dependencies` | external-dep version drift across packages |
| `dependencies-star` | drift with `*` star specifier in one package |
| `dependencies-nested-star` | drift under nested workspace globs (`packages/*/*`) |
| `unsync` | similar-deps family drift (turbo + turbo-ignore) |
| `root-issues` | private/packageManager/deps/empty-deps issues at the root |
| `root-issues-fixed` | a clean root for negative-test parity |
| `without-package-json` | workspace dirs that lack a package.json |
| `ignore-paths` | excludes (`!packages/abc`, `!packages/d*`) and re-includes |
| `no-workspace-pnpm` | no workspace config at all (single-package layout) |
| `empty` | empty directory — no package.json, no workspace config |
| `install` | install-flow fixture — not exercised by vis lint tests |

The `install/` fixture is kept for completeness but is not exercised
by the vis lint tests since it tests sherif's `install` flow, not its
lint rules.

## Note on counting differences

vis's lints emit one issue per *instance* (e.g. one issue per drifting
package.json), while several sherif rules emit one issue per *cluster*
(one issue per dep name with drift). Tests in `__tests__/lint/sherif-fixtures.test.ts`
assert vis-native counts and verify that the same fixtures trigger the
equivalent vis rule.
