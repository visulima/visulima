<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="vis" />

</a>

<h3 align="center">A CLI task runner for monorepo workspaces, powered by @visulima/task-runner</h3>

<!-- END_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<br />

<div align="center">

[![typescript-image][typescript-badge]][typescript-url]
[![mit licence][license-badge]][license]
[![npm downloads][npm-downloads-badge]][npm-downloads]
[![Chat][chat-badge]][chat]
[![PRs Welcome][prs-welcome-badge]][prs-welcome]

</div>

---

<div align="center">
    <p>
        <sup>
            Daniel Bannert's open source work is supported by the community on <a href="https://github.com/sponsors/prisis">GitHub Sponsors</a>
        </sup>
    </p>
</div>

---

## Features

- **Workspace-aware**: Automatically discovers projects from `pnpm-workspace.yaml` or `package.json` workspaces
- **Task caching**: Powered by `@visulima/task-runner` with local and remote caching support
- **Dependency-aware scheduling**: Runs tasks in topological order with configurable parallelism
- **Affected detection**: Only runs tasks for projects changed since a given git ref
- **Pluggable installer**: Defaults to the lockfile-detected PM (pnpm/npm/yarn/bun); auto-uses [aube](https://github.com/endevco/aube) when on `PATH`, with a single switch (`install.backend` / `--installer` / `--no-aube`) to pin or bypass it
- **Catalog management**: Check and update dependencies in pnpm/bun workspace catalogs
- **Security scanning**: Check for known vulnerabilities via OSV.dev
- **Graph visualization**: View your project dependency graph in ASCII, DOT, JSON, or HTML
- **Git hooks**: Install, manage, and migrate git hooks (husky migration supported)
- **Configurable**: `vis.json` for target defaults, cache settings, and task runner options
- **Inferred targets**: Optional Project Crystal-style synthesis of `build`/`test`/`dev`/`lint`/`format` from 36 tools (Vite, Vitest, Next, Nuxt, packem, ESLint, Biome, Prisma, …). Opt in with `inferTargets: true`; explicit scripts and `project.json`/`vis.task.ts` overrides always win
- **URI-based input format**: `inputs` accepts `file://`, `glob://`, `env://`, `func://`, `dep://` strings as forward-compat sugar for the structured object form
- **Built on Cerebro**: Uses `@visulima/cerebro` for a robust CLI experience with built-in help, version, and completion

## Install

```sh
npm install @visulima/vis
```

```sh
yarn add @visulima/vis
```

```sh
pnpm add @visulima/vis
```

### Cold start (no Node? no manager?)

One-liner bootstrap that installs a version manager, Node LTS, and `vis` in one go.

**Linux / macOS / WSL** (bash):

```sh
curl -fsSL https://visulima.com/install.sh | bash
```

**Windows** (PowerShell 5.1+):

```powershell
irm https://visulima.com/install.ps1 | iex
```

Pass `--yes --manager=proto` (POSIX) or `-Yes -Manager proto` (PowerShell) for non-interactive / CI usage. See [`vis toolchain` docs](./docs/commands/toolchain.mdx#cold-start--no-node-no-manager) for details.

## Quick Start

```bash
# Run a target across all workspace projects
vis run build

# Run tests only on affected projects
vis affected test --base=main

# Visualize the project dependency graph
vis graph

# Check for outdated catalog dependencies
vis check

# Check with security vulnerability scanning
vis check --security

# Update catalog dependencies interactively
vis update --interactive

# Install git hooks
vis hook install
```

## Installer backend (aube)

`vis install`, `vis add`, `vis remove`, `vis update`, `vis dlx`, `vis exec`, `vis link`, `vis unlink`, `vis dedupe`, `vis why`, `vis outdated`, `vis info`, and `vis pm` honor [aube](https://github.com/endevco/aube) — a Rust-native package manager that reads and writes pnpm/npm/yarn/bun lockfiles in place — as a drop-in installer. Aube also supports the pnpm `catalog:` and `catalog:<name>` protocol from `pnpm-workspace.yaml`, including walk-up resolution from subpackages.

`vis` does not bundle aube. Install it once via your tool of choice and `vis` will auto-detect it on `PATH`:

```bash
npm install -g @endevco/aube       # or
mise use -g aube                   # or
brew install endevco/tap/aube
```

Resolution precedence (highest first):

1. `--installer <name>` CLI flag — `auto`, `aube`, `pnpm`, `npm`, `yarn`, or `bun` (or `--no-aube` to force the lockfile-detected PM for a single run; `--no-aube` wins over every other source).
2. `VIS_INSTALLER` environment variable — same accepted values as the flag.
3. `install.backend` in `vis.config.ts` — same accepted values; the team-wide pin.
4. Auto-detect — `aube` when it's on `PATH`, otherwise the lockfile-detected PM (`pnpm-lock.yaml` → pnpm, `package-lock.json` → npm, `yarn.lock` → yarn, `bun.lockb` → bun).

Each step is consulted in order; the first one that resolves to a concrete backend wins. Picking an explicit value (`pnpm`, `npm`, …) at any level always beats the auto-detect step below it, so you can override the team default for a single shell session via `VIS_INSTALLER=pnpm vis install` without touching the config file.

```ts
// vis.config.ts — pin the installer for the team
import { defineConfig } from "@visulima/vis/config";

export default defineConfig({
    install: { backend: "aube" }, // "auto" | "aube" | "pnpm" | "npm" | "yarn" | "bun"
});
```

### Lockfile drift

Aube reuses pnpm/npm/yarn/bun lockfile formats but its serialized output isn't byte-identical to the original tool's. The first install on a workspace whose lockfile was written by another PM produces a one-time churn diff; teams that mix tools on the same lockfile see ongoing drift. `vis install` warns when this is about to happen — pin `install.backend` to keep the team consistent.

### Lifecycle scripts

Aube already skips dependency lifecycle scripts by default. `--ignore-scripts` is a no-op under aube (`vis install` warns when you pass it). To opt specific packages back in, run `aube approve-builds` — the inverse direction from the pnpm/npm `--ignore-scripts` model.

## Commands

| Command                 | Alias  | Description                                                          |
| ----------------------- | ------ | -------------------------------------------------------------------- |
| `vis create [template]` |        | Scaffold a new project from templates, npm packages, or git repos    |
| `vis generate [name]`   |        | Scaffold files from an in-repo template (native TS or moon-format)   |
| `vis init`              |        | Initialize vis.config.ts with security defaults                      |
| `vis run <target>`      |        | Run a target across workspace projects with caching                  |
| `vis affected <target>` |        | Run tasks only on projects affected by git changes                   |
| `vis ignore <project>`  |        | CI build gating for Vercel / Netlify "Ignored Build Step"            |
| `vis graph`             |        | Visualize the project dependency graph                               |
| `vis check [packages]`  | `c`    | Check for outdated dependencies in workspace catalogs                |
| `vis update [packages]` | `up`   | Update packages to their latest versions                             |
| `vis install`           | `i`    | Install dependencies via the detected package manager                |
| `vis info <package>`    | `view` | Show npm registry metadata for a package (wraps `npm view` et al.)   |
| `vis dlx <package>`     |        | Execute a remote package without permanent installation              |
| `vis audit`             |        | Audit dependencies for security vulnerabilities                      |
| `vis clean`             |        | Remove build artifacts, caches, and node_modules                     |
| `vis cache <action>`    |        | Inspect cache (`list`, `size`, `hash`, `why`), or `prune` / `clean`  |
| `vis hook <action>`     |        | Manage git hooks (install, uninstall, migrate)                       |
| `vis secrets [paths]`   |        | Scan for hardcoded secrets / credentials (Rust-native)               |
| `vis toolchain <cmd>`   |        | Inspect / delegate to the version manager (proto, mise, fnm, volta…) |
| `vis staged`            |        | Run tasks on staged files (built-in `lint-staged` replacement)       |
| `vis migrate <type>`    |        | Migrate from other tools — now including `gitleaks` and `secretlint` |

For `vis ignore`, see the [command reference](./docs/commands/ignore.mdx) and the [deployment build gating section](./docs/guides/ci-cd.mdx#deployment-build-gating) of the CI/CD guide.

### Diagnosing cache misses

When a task you expected to be cached re-ran, ask vis what changed:

```sh
vis cache why @myorg/app:build           # human-friendly diff vs. previous run
vis cache why @myorg/app:build --json    # stable shape for CI
vis cache hash @myorg/app:build          # just print the hash + per-bucket inputs
```

`vis cache why` reads `.task-runner/last-summary.json` and diffs the task's `hashDetails` (`command`, `nodes`, `runtime`, `implicitDeps`) against the previous run, so you can pinpoint exactly which bucket rotated. Past runs only land in `.task-runner/runs/` when you pass `--summarize`, so use `vis run :build --summarize` (or set it as a default in CI) for diffs you'll want to inspect later.

### Cache retention

`vis cache prune` evicts entries by any combination of age, total size, and count:

```sh
vis cache prune --max-age-days=7              # drop entries older than a week
vis cache prune --max-size=2GB                # evict oldest until under 2 GB
vis cache prune --keep-last=30                # keep only the 30 newest entries
vis cache prune --keep-last=30 --max-age-days=14   # combine: 30-newest floor, then age cap
```

`--keep-last` enforces a count floor first (newest-first by mtime), then `--max-age-days` and `--max-size` apply.

### Sharing the cache across git worktrees

When the workspace is a linked worktree (created with `git worktree add`), vis stores the cache at `<mainWorktreeRoot>/.task-runner-cache` so sibling worktrees driven by parallel agents share one cache instead of rebuilding the same hash N times. Set `sharedWorktreeCache: false` in `vis.config.ts` to opt out, or use `--scope=worktree|shared|all` on `vis cache list/size/prune` to inspect or operate on a specific store.

### Quieting successful runs

`--output-style=quiet` skips stdout/stderr from successful and cached tasks while keeping failures fully visible. Pair it with per-target `options.outputStyle` to mute a single noisy task — or to keep one critical task verbose under a global quiet flag:

```sh
vis run :build --output-style=quiet     # only failures print
```

```json
{
    "targets": {
        "lint": { "options": { "outputStyle": "quiet" } },
        "migrate": { "options": { "outputStyle": "normal" } }
    }
}
```

See the [`vis cache`](./docs/commands/cache.mdx) and [`vis run`](./docs/commands/run.mdx) command references for the full surface.

### Scanning for secrets

`vis secrets` wraps [`@visulima/secret-scanner`](../secret-scanner) — a Rust port of the gitleaks detection engine — with ergonomic flags for the common workflows.

```sh
vis secrets                         # scan the workspace (grouped, colourised output)
vis secrets --staged                # pre-commit mode: scan staged files only
vis secrets --since main            # scan files changed since the `main` branch
vis secrets --affected              # scan only files affected by the current branch
vis secrets --init                  # scaffold an initial .secrets-baseline.json
vis secrets --list-rules            # print all bundled detection rules
vis secrets --enable-rule tag:preset:weak-passwords  # enable an opt-in rule group additively
vis secrets --exclude 'dist/**' --exclude-from .secretsignore    # extra walker exclusions
vis secrets --include-rule stripe-access-token                   # check a single rule
vis secrets --exclude-rule generic-api-key                       # drop a noisy rule
vis secrets --baseline .secrets-baseline.json   # suppress triaged findings; print diff
vis secrets --update-baseline       # merge current findings into the baseline
vis secrets --format sarif > report.sarif       # SARIF for GitHub code-scanning
```

**Suppression** — inline (`// gitleaks:allow`), block (`gitleaks:allow-start` … `gitleaks:allow-end`), or a baseline JSON (sole fingerprint store). See the [secret-scanner README](../secret-scanner/README.md#suppression) for details.

**CI example** (GitHub Actions, SARIF upload):

```yaml
name: Secrets
on: [push, pull_request]
jobs:
    scan:
        runs-on: ubuntu-latest
        permissions: { security-events: write, contents: read }
        steps:
            - uses: actions/checkout@v4
            - uses: pnpm/action-setup@v4
            - run: pnpm install
            - run: pnpm vis secrets --format sarif > report.sarif
              continue-on-error: true
            - uses: github/codeql-action/upload-sarif@v3
              with: { sarif_file: report.sarif }
```

### Migrations

`vis migrate` now speaks two security tools:

```sh
vis migrate gitleaks     # keeps gitleaks.toml, rewrites scripts/hooks to `vis secrets`
vis migrate secretlint   # removes @secretlint/*, rewrites scripts/hooks, notes active rules
```

Every destructive step writes a `.bak` sidecar first and prompts for confirmation (skip with `-y`). Dry-run previews are available via `--dry-run`.

### Running tasks on staged files

`vis staged` is a built-in replacement for `lint-staged` — the same config shape, no peer dependency, and an integrated task renderer. Requires Git ≥ 2.32.

Declare the patterns and tasks under `staged` in `vis.config.ts`:

```ts
// vis.config.ts
import { defineConfig } from "@visulima/vis/config";

export default defineConfig({
    staged: {
        "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
        "*.md": "prettier --write",
        "package.json": (files) => `sort-package-json ${files.join(" ")}`,
    },
});
```

Each key is a glob (basename or path-style — path-style matches resolve relative to `cwd`). Each value is one of:

- a command string — split into argv, invoked with matched files appended;
- a `string[]` array — commands run serially for that pattern;
- a function `(files) => string | string[] | {title, task}` — generate dynamic commands or a custom task;
- a `{ title, task }` object — runs `task(files)` with no argv construction, useful for in-process side effects.

`vis.config.ts` is the single source of truth — no standalone `.lintstagedrc*` or `.vis-staged.*` files are read at runtime. Migrating from lint-staged or nano-staged? Run `vis migrate lint-staged` (or `vis migrate nano-staged`) to move the config in and remove the legacy files.

#### Command-line flags

```sh
vis staged                          # run tasks on the current staged set
vis staged --verbose                # show stdout/stderr on success as well as failure
vis staged --no-stash               # skip the backup stash (faster, but no recovery on failure)
vis staged --diff HEAD~1            # operate on a range instead of `--staged`
vis staged --diff-filter=ACM        # override the default ACMR filter
vis staged --concurrent 4           # cap parallel pattern execution
vis staged --continue-on-error      # don't short-circuit on the first failure
vis staged --fail-on-changes        # non-zero exit if tasks modified staged content
vis staged --hide-unstaged          # hide all unstaged edits on tracked files
vis staged --hide-all               # hide unstaged edits AND untracked files
vis staged --relative               # pass paths relative to cwd to tasks
vis staged --revert                 # restore pre-task state on failure
vis staged --allow-empty            # allow a commit when tasks revert everything
vis staged --auto-stage             # auto-stage new files tasks create (codegen, lockfile regen, …)
vis staged --force-kill             # kill in-flight tasks with SIGKILL on fast-fail (default: SIGTERM)
```

#### Environment variables

| Variable                | Description                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VIS_STAGED_CONCURRENT` | Concurrency fallback when `--concurrent` is not passed. Same value shape as the flag (`true`, `false`, or an integer). Useful in CI so you don't repeat the flag on every invocation. |

#### How it behaves

1. A hidden backup stash is created (via `git stash create` + `git stash store`, so the working tree is untouched).
2. For partially-staged files, the unstaged delta is captured as a patch and the working tree is reset to the staged content. `--hide-all` extends this to every unstaged change _and_ untracked files via a single `git stash push --include-untracked`.
3. Tasks run — patterns in parallel (capped at `os.availableParallelism()` by default), commands within a pattern serially.
4. Task-driven edits are re-staged with `git update-index --again` (with a `git add -u` fallback for deletions), so commits made via pathspec (`git commit -m "…" .`) keep working.
5. The unstaged patch — or the hide-all stash — is re-applied and the backup stash is dropped on success. On failure without `--revert`, the backup stash is preserved and the recovery sha is surfaced to the user. Ctrl+C aborts in-flight commands and still runs the restore path; a second Ctrl+C exits immediately.

#### Migrating from lint-staged

```sh
vis migrate lint-staged    # moves the config into vis.config.ts and rewrites hooks
```

The migrator detects `package.json` keys, `.lintstagedrc*` files, and `lint-staged.config.*`, prompts before rewriting husky/vis hooks to call `vis staged`, and removes `lint-staged` from the dependency list.

## Documentation

For full documentation including command reference, configuration options, best practices, and CI/CD integration guides, see the [docs](./docs) folder.

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).
Here's [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima vis is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/vis?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/vis?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/vis
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
