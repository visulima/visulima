# vis CLI — TODO

Items are grouped by priority. Check the box when done and reference the
commit or PR that landed the feature.

---

## Delivered (this branch)

- [x] Target options (persistent, interactive, internal, runInCI, retryCount, mutex, envFile, osType, shell)
- [x] VIS_AFFECTED_FILES forwarding (newline-delimited)
- [x] Target selectors (`:t`, `~:t`, `#tag:t`, `pkg:t`)
- [x] Query language (`language=X && tag=Y`)
- [x] File groups + scoped task defaults (`taskDefaults` with scope blocks)
- [x] `vis ci` command (install + affected + auto-detected refs)
- [x] `vis doctor` runtime checks (.nvmrc, engines, packageManager)
- [x] Migration extensions (`vis migrate turborepo`, `nx`, `moon`)
- [x] Docker scaffold/prune (`vis docker scaffold --focus=app`)
- [x] CODEOWNERS (`vis sync codeowners`)
- [x] Task types (build/run/test) + presets (server/utility)
- [x] `vis action-graph` + `vis sync` commands
- [x] Watch mode (`vis run :test --watch`)
- [x] `enforceLayerRelationships` constraint (configuration < library < scaffolding < tool < automation < application)
- [x] `versionConstraint` guard in vis.config.ts (with semver.validRange)
- [x] Per-task shell override (unixShell/windowsShell)
- [x] Flakiness detection (auto on failure, `--no-flaky` to suppress)
- [x] UX: target auto-discovery, typo suggestion, timing summary, `--affected`, `--fail-fast`, init auto-detect, `vis list`, duration comparison, `--dry-run` plan, shell completions, `vis status`, interactive project picker
- [x] JSON Schema for project.json + vis-config.schema.json
- [x] Full docs (7 new pages, 3 rewritten)
- [x] Unit tests (11 test files)
- [x] SBOM generation (`vis sbom`) — CycloneDX 1.6 JSON/XML, full lockfile closure, per-version licences, `--focus` / `--include-dev`; see `docs/commands/sbom.mdx`

---

## Open — Tier 3

### In-repo generators (`vis generate <template>`) — DELIVERED ✅

Initial implementation landed. Supports both:

- **Native** templates: TS/JS modules under `.vis/templates/<name>.ts` exporting `createTemplate({ about, options, produce })`. Programmatic, typed, no DSL. Public surface at `@visulima/vis/generate`.
- **Moon-format** templates: directories with `template.yml` + Tera files. Auto-discovered from `.vis/templates/<name>/` and `.moon/templates/<name>/`. Hand-rolled Tera subset (~200 LOC) covers `{{var}}`, filters, `{% if/else/endif %}`, `{% for %}`, `{% include %}`. Errors with file:line on macros / set / extends / block (rewrite required).

**Compat matrix in `docs/commands/generate.mdx`.** Phase 2 work: `extends`, `glob://` source, `object` variable type, `variables()` Tera function, Bingo template adapter (~80 LOC if/when Vite+ portability is requested).

**Followed up — `--` passthrough**: cerebro runs command-line-args with `stopAtFirstUnknown: true`, which routes the `--`-separated tail into `_unknown` instead of `toolbox.argument`. Both `vis generate` and `vis create` now read `process.argv` directly inside `execute()` to recover the tail, so `vis generate pkg -- --name=x` and `vis create vite my-app -- --template react-ts` both work. Tested end-to-end. The proper long-term fix lives in cerebro (expose `_unknown` on the toolbox or stop dropping post-`--` tokens when the command has `argument`).

### Webhook/notifier (`vis.config.ts` pipeline events)

Lifecycle hooks exist in task-runner (`LifeCycleInterface`). Need a built-in
HTTP POST plugin that fires on task start/complete/fail.

**Config shape**:

```typescript
notifier: {
    webhookUrl: "https://hooks.example.com/vis",
    events: ["pipeline.start", "pipeline.end", "task.failure"],
    headers: { "Authorization": "Bearer ..." },
}
```

**Effort**: Low (~100 LOC). Wire a `fetch()` call into a `LifeCycleInterface`
implementation and register it in the task runner context.

---

### Public plugin API

Internal plugin system exists (`config-loader`, `security-enforcement`,
`post-command`). Need:

- Documented `VisPlugin` interface with typed hooks
- Plugin registration in vis.config.ts: `plugins: [myPlugin()]`
- Hook points: `beforeRun`, `afterRun`, `beforeTask`, `afterTask`, `onCacheMiss`

**Effort**: Medium. The hooks exist; the work is defining a stable contract
and documenting it.

---

### In-repo generators — original design notes (delivered, kept for reference)

`vis create` handles remote templates (via giget) for new repos.
`vis generate` is for in-repo scaffolding — generate a new component,
service, or package from a local template directory.

**Prior art — moon generate (researched)**:

- Templates live in directories listed under `generator.templates` in workspace config
- Each template has a `template.yml` with: `title`, `description`, `variables` (typed: string/number/boolean/enum; each with `type`/`default`/`required`/`prompt`)
- Uses [Tera](https://keats.github.io/tera/) (Rust-based, Twig/Django-like) for interpolation:
    - File contents: `{{ varName }}`, `{% if %}`, `{% for %}`
    - Filenames: `src/[varName].ts` or `src/[varName | kebab_case].ts`
    - Built-in filters: `camel_case`, `pascal_case`, `snake_case`, `kebab_case`, `upper_case`, `lower_case`
- `.tera` / `.twig` file extensions auto-stripped at generation
- `.raw` extension bypasses Tera (for files with `{{` in real content)
- Frontmatter block at top of file (`--- to: path, force: true ---`) for per-file control
- Partials (any file with `partial` in path) used for composition, not emitted
- Template sources (moon supports many):
    - Local: `./templates` or `file://...`
    - Git: `git://github.com/org/repo#branch`
    - npm: `npm://@scope/package#1.2.3`
    - Archive URLs (zip/tar)
    - Glob patterns: `./templates/*`
- Built-in vars: `dest_dir`, `dest_rel_dir`, `working_dir`, `workspace_root`
- `variables()` function returns the full variable map

**vis-native design**:

- Templates directory: default `.vis/templates/<name>/` (configurable via `generator.templates` in vis.config.ts)
- Use a minimal JS templating engine — no Rust/WASM needed. Options:
    - **[Eta](https://github.com/eta-dev/eta)** (~15kb, fast, EJS-like) — recommended
    - **[Squirrelly](https://squirrelly.js.org/)** (~4kb) — even smaller
    - Or ship a tiny home-grown renderer (~100 LOC) supporting `{{ var }}`, `{{ var | filter }}`, `{% if %} / {% endif %}`, `{% for %}`, matching the Tera subset vis users will actually use
- Variable types: string, number, boolean, enum, multiselect (from [prompts](https://github.com/terkelg/prompts) which vis already uses in `vis create`)
- Filename interpolation with same `[varName | filter]` syntax for moon compatibility (so moon templates can be reused)
- `.raw` extension to bypass templating
- Frontmatter: JSON in a `{ "to": "...", "force": true }` comment block or YAML `--- ... ---`
- `--to=<dir>` flag for destination (default: cwd)
- `--defaults` skips prompts, uses `default` values
- `--dry-run` prints the generated files without writing
- `--force` overwrites existing files
- Pre-fill variables: `vis generate component -- --name=Button --style=primary`

**Template sources** (Phase 1 = local only, Phase 2 = remote):

- Phase 1: local directories + globs (covers 90% of use cases in a monorepo)
- Phase 2: git/npm via giget (already a dep — reuse the `vis create` infrastructure)

**Building blocks already in vis**:

- `@visulima/cerebro` has `prompts` integration (vis create uses it)
- `giget` is already a dependency (for Phase 2 remote templates)
- `@visulima/fs` has file walk + write helpers

**What's new**:

- `src/generate.ts` — template discovery + rendering engine (~200 LOC if using Eta, ~400 LOC with home-grown)
- `src/commands/generate.ts` — CLI command (~100 LOC)
- `src/frontmatter.ts` — parse `to: path` / `force: true` / `if: condition` (~50 LOC)

**Estimated effort**: ~400-500 LOC total. Medium complexity.

**Moon-compatible subset?** Shipping the same Tera filename syntax + frontmatter keys (`to`, `force`, `if`) means users migrating from moon can reuse their existing templates directly. Low additional cost, high migration value — worth doing.

---

### gRPC Bazel Remote Execution API v2 remote cache

task-runner has Turborepo-compatible HTTP REST. Adding gRPC REAPIv2 unlocks:

- `bazel-remote` (self-hosted)
- BuildBuddy
- Buildbarn
- Depot Cache

**Effort**: High. Needs a protobuf client (`@grpc/grpc-js` + generated types
from the Bazel Remote Execution proto).

---

### Toolchain management (`vis toolchain` — auto-install runtimes) — DELIVERED ✅

Initial implementation landed. `vis toolchain` detects whichever version manager
(proto, mise, fnm, volta, asdf, nvm) is installed and delegates to it — no
embedded runtime, no `~/.vis-plus`. Subcommands: `status`, `detect`, `install`,
`use <tool>@<ver>`, `which <tool>`. Pin discovery merges `engines.node`,
`packageManager`, `.nvmrc`, `.node-version`, `.tool-versions`, `.mise.toml`,
`.prototools`, `volta` field, and `toolchain.tools` in `vis.config.ts` in that
priority order. See `docs/commands/toolchain.mdx` for the full command + config
surface and the compat matrix.

**Open follow-ups** (deferred):

- Wire `autoInstall` into `vis run` / `vis ci` so an engines.node mismatch
  triggers the install flow automatically (currently users run `vis toolchain
  install` manually).
- Richer status output for partial matches (e.g. "node 22.13 would satisfy, but
  you also have a `volta.node: 20` pin that disagrees").
- Rust-side detector on `native-binding.ts` for zero-cost manager detection on
  `vis run` startup (today it runs on demand inside the toolchain command).

**Research summary — how competitors handle this**:

| Tool          | Approach                                                                                                                                                                     | Strengths                                                                           | Weaknesses                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **moon**      | Integrates with [proto](https://github.com/moonrepo/proto) via `.prototools` TOML config; manages Node/Bun/Deno/Rust/Go/Python/Ruby natively + WASM plugins for custom tools | Single source of truth across languages; deterministic CI                           | Requires learning proto; WASM plugin ecosystem small |
| **Nx**        | Delegates to `package.json` `engines` + `packageManager`; no auto-install                                                                                                    | Zero config                                                                         | User must install runtimes manually                  |
| **Turborepo** | Same as Nx — reads `packageManager`, no auto-install                                                                                                                         | Zero config                                                                         | Same limitation                                      |
| **proto**     | Pluggable, Rust-based, WASM plugin system (Extism). Built-in: Node/npm/pnpm/yarn, Bun, Deno, Python (+ uv), Rust, Go, Ruby                                                   | Multi-language; per-project pinning via `.prototools`; WASM plugins in any language | Requires separate binary install                     |
| **fnm**       | Node-only, Rust, ~15ms shell startup (vs nvm's 75ms). Reads `.nvmrc`                                                                                                         | Fast, simple                                                                        | Node only                                            |
| **volta**     | Node/npm/yarn, shim-based (<1ms switch). Pins versions in `package.json` `volta` field                                                                                       | Fastest switching; package.json-driven                                              | Node ecosystem only                                  |
| **mise**      | Rust, asdf-compatible, `.mise.toml` config. Supports 700+ tools via plugins                                                                                                  | Very broad                                                                          | Bigger surface area                                  |

**Design**: don't try to be a version manager. Delegate.

The killer UX is: user runs `vis run build`, vis notices the Node version doesn't
match `engines.node` or `.nvmrc`, and **auto-installs + switches** instead of
warning (which is what `vis doctor` already does today).

**Three-tier delegation strategy**:

1. **Detect an installed version manager**:
    - Check `$PATH` for `proto`, `mise`, `fnm`, `volta`, `asdf`, `nvm` in that order
    - Check if the workspace has `.prototools` (proto), `.mise.toml` (mise), `.nvmrc` (fnm/nvm), or `package.json` `volta` (volta)
    - Store the detected tool name in the toolbox

2. **Auto-install flow**:
    - When `vis run` / `vis ci` starts, call `checkRuntimeVersions()` (already exists in runtime-check.ts)
    - If a finding has `severity: "error"` (engines.node mismatch):
        - If a version manager is detected AND `config.toolchain?.autoInstall !== false`: run the appropriate command (`proto install node`, `fnm install`, `volta install node@X`, etc.) and re-exec
        - Otherwise: print the existing doctor-style error and exit
    - If severity is `"warning"` (.nvmrc mismatch): print a one-line hint (`run 'fnm use' to switch`), don't block

3. **Config shape** (vis.config.ts):
    ```typescript
    toolchain: {
        autoInstall: true,              // default: true when a PM is detected, false otherwise
        preferredManager: "proto",       // explicit override: "proto" | "mise" | "fnm" | "volta" | "asdf" | "nvm" | "none"
        tools: {
            node: ">=22.13",             // override engines.node
            pnpm: "10.32.1",             // override packageManager
        },
    }
    ```

**Commands**:

- `vis toolchain status` — lists detected version manager + each tool's expected-vs-actual version (similar to `vis doctor` but focused on runtimes)
- `vis toolchain install` — auto-install all pinned versions via the detected manager
- `vis toolchain use <tool>@<version>` — wrapper that updates the appropriate config file

**Building blocks already in vis**:

- `runtime-check.ts` — already parses `engines.node`, `.nvmrc`, `.node-version`, `packageManager`
- `pm-runner.ts` — has spawn/exec helpers for package managers
- `native-binding.ts` + Rust NAPI — could host a version-manager-detector on the Rust side for zero-cost detection on startup

**What's new**:

- `src/toolchain.ts` — detector + adapter layer (~200 LOC). One adapter per supported manager (~30 LOC each × 5 managers = 150 LOC)
- `src/commands/toolchain.ts` — CLI (~100 LOC)
- Extend `runtime-check.ts` to suggest the detected manager's install command in error messages

**Estimated effort**: ~500-700 LOC. Medium complexity.

**Why not just embed proto?**

- proto is excellent but requires users to opt into the moonrepo ecosystem
- Most users already have `fnm`/`volta`/`mise` installed — vis should adapt to them, not replace them
- Shipping proto as a hidden dep would bloat the install (the proto binary is ~20MB) and violate principle of least surprise

**Priority note**: This is the most-requested improvement in moon-to-vis migrations
(since moon has it out of the box). But the current `vis doctor` warnings cover 80%
of the use case. A full v1 can wait until there's clear user demand.

---

## Implementation order (if picking up this work)

1. ~~**In-repo generators** (`vis generate`)~~ — **delivered**
2. ~~**SBOM** (`vis sbom`)~~ — **delivered**
3. ~~**Toolchain** (`vis toolchain`)~~ — **delivered** (autoInstall hook into `vis run` remains open)
4. **Plugin API** — only when third-party demand materializes
5. **Webhooks** — niche, CI providers cover this natively
6. **gRPC cache** — high effort, narrow audience (Bazel shops)

---

## Open — Tests

- [ ] Command integration tests (ci, docker, sync, action-graph, list, status) — these require mocking `runtime.runCommand` and `discoverWorkspace`
- [ ] Migration moon.ts test (requires mock YAML files + readYamlSync)
- [ ] End-to-end test: scaffold a temp workspace, run `vis run build`, verify cache hit on second run
