# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/vis` is the workflow CLI on top of `@visulima/task-runner`: monorepo task running with caching, security scanning (`scan` via `@visulima/secret-scanner`), audit/SBOM/advisory tooling, ecosystem updates, AI-agent integrations, and a React-based dashboard. Built on `@visulima/cerebro` — every subcommand under `src/commands/` is a cerebro command module registered in `src/register-commands.ts` (used by the full `vis` CLI in `src/cli-main.ts`); `src/binx.ts` is the lean `visx` / `vx` dlx-only entry.

## Architecture

### Cerebro-based handler pattern

Command handlers receive a cerebro `toolbox` that exposes `toolbox.fs`, `toolbox.process`, and `toolbox.console`. Per the migration in commit `c582c7401`, **new handlers must use `toolbox.fs` / `toolbox.process` instead of importing `node:fs` / `process` directly** — this keeps commands cloneable/sandboxable for MCP and test contexts. Don't reach past the toolbox for IO unless you have a reason and document it.

`project.json#name` is the workspace identity for vis (honoured since `4a97c9203`). `package.json#name` only matters for npm publish.

### Error-exit pattern (project preference)

When using `@visulima/pail` for fatal errors, **keep the explicit three-liner** — do not extract a `failWithError` / `exitWithError` helper. The pattern is intentional:

```ts
toolbox.console.error(message);
await toolbox.console.flush?.();
toolbox.process.exit(1);
```

### Throwing: `VisUserError` vs `Error`

Throw `VisUserError` (`src/errors/vis-user-error.ts`) whenever the message alone tells the user everything they need to act on — a typo'd project name, a task that exited non-zero, malformed config, a service that isn't running. The CLI renders these **message-only**; the stack is suppressed because it points at minified bundle internals and pushes the real diagnostic off-screen. `--debug` / `DEBUG` still prints the full stack.

Keep plain `Error` for genuine invariants, where a stack points at the broken code.

Wired via the `concise` option on cerebro's `errorHandlerPlugin`, set in all three entry points (`cli-main`, `cli-exec`, `binx`).

### Boolean CLI options: always use `negatable()`

cerebro only recognises `--no-x` when an option **literally named `no-x`** is declared — it derives the mapping from the negated form, not the positive one. Declaring `{ name: "cache" }` and documenting "use `--no-cache` to disable" produces a flag that parses without complaint and changes nothing. This silently broke seven documented flags (`--no-cache`, `--no-flaky`, `--no-preflight`, `--no-strict-env`, `--no-install`, `--no-prune-lockfile`, …).

Spread `negatable()` (`src/util/negatable-option.ts`) instead of writing the object inline:

```ts
options: [
    ...negatable({ defaultValue: true, description: "Enable caching (use --no-cache to disable)", name: "cache", type: Boolean }),
]
```

Omit `defaultValue` when you need a tri-state (`undefined` = "fall back to config") — neither flag present then stays `undefined` instead of collapsing to a boolean.

### Silently-ignored flags are the bug class to avoid

A flag that parses but does nothing is worse than one that errors: it is how a CI job passes without running anything. When a flag only makes sense alongside another (`--base` needs `--affected`), **reject it** with a did-you-mean rather than dropping it. Shared selection logic lives in `src/task/` (`affected-selection.ts`, `project-name-filter.ts`) precisely so two commands can't drift into disagreeing about the same flag.

### Layout under `src/`

- `commands/` — one folder per top-level command (40+). Add new commands here and register in `register-commands.ts`.
- `config/` — `vis.config.ts` loading, plugin system (`define-plugin.ts`), workspace resolution, deprecation surfacing, audit-config types.
- `report/` — audit reporters. Supports SARIF, CSAF, CycloneDX VEX, **GitLab dependency-scan**, and **JUnit** (added in `18e8bc204`). New formats go alongside these.
- `ai/`, `cache/`, `dashboard/`, `generate/`, `inference/`, `lint/`, `pm/`, `scan/`, `secrets/`, `security/`, `sbom/`, `services/`, `task/`, `runtime/`, `tui/`, `watch/`, `preflight/`, `staged/`, `plugins/`, `errors/`, `io/`, `util/` — domain-grouped modules consumed by commands.
- `cerebro-augment.d.ts` — module augmentation for the toolbox extensions. Update here when adding to `toolbox.*`.

### Schemas

- `schemas/vis-config.schema.json` and `schemas/project.schema.json` are **regenerated** by `scripts/generate-schemas.ts` from the TypeScript types via `ts-json-schema-generator`. **Don't hand-edit these files.** Run `pnpm generate:schemas`; CI guards drift via `check:schemas-drift`.

### Ecosystem-update feature

`vis` can auto-update references in **GitHub Actions workflows**, **Docker** images, and **GitLab CI** include/image references, with a breaking-change UI and interactive picker. When extending the updater, keep changes confined to the relevant module under `src/commands/`/`src/inference/` and reuse the existing picker rather than building a new TUI.

### Native addon

Vis has its own NAPI addon (`native/`, `vis-native.<target>.node`, 8 optional binding packages) for performance-critical paths — same machinery as `task-runner`. Use `pnpm build:native` / `pnpm build:native:debug` for Rust changes. The `#native` internal import (in `imports`) wires the runtime resolution.

### Dashboard

`dashboard/` is a separate workspace package (`@visulima/vis-dashboard`) — `pnpm build` and `pnpm build:prod` already run its build first. Don't add a separate manual step.

### Cross-platform gotchas

- **Windows tar:** always pass `--force-local` to `tar` invocations. Forward slashes alone do NOT fix the `host:path` quirk on native Windows.
- **Path separator:** `@visulima/path`'s `sep` is `/` on every platform. For native Windows paths use a literal `\\` replace, not `sep`.

## Related

- Built on `@visulima/cerebro` (CLI framework) and `@visulima/task-runner` (execution engine).
- Companion: `@visulima/vis-mcp` (MCP server) + paired Claude Skill — declarative AI integration, not a runtime bridge.
- Consumes `@visulima/secret-scanner`, `@visulima/tabular`, `@visulima/tui`, `@visulima/find-ai-runner`, `@visulima/package`, `@visulima/tsconfig`.
