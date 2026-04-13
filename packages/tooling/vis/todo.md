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
- [x] SBOM generation (`vis sbom`) — see [SBOM generation](#sbom-generation-vis-sbom) below

---

## Open — Tier 3

### SBOM generation (`vis sbom`)

CycloneDX 1.6 SBOM generator — first monorepo tool to ship
this (moon, Nx, Turborepo all lack SBOM support).

**Why**: Executive Order 14028, EU Cyber Resilience Act, and PCI DSS 4.0
all mandate SBOMs for software supply chains. cdxgen exists but is heavy
(200+ deps, slow on large repos) and not monorepo-aware.

**Delivered**:
- ✅ CycloneDX 1.6 JSON + XML output (ECMA-424 standard) — XML goes through `jstoxml` (already used by `packages/api/api-platform` and `packages/error-debugging/error-handler`)
- ✅ Walks the workspace project graph (`discoverWorkspace` + `buildProjectGraph`)
- ✅ Per project: reads `package.json` → name, version, license, author, description, homepage/vcs/issue-tracker references
- ✅ Lockfile parsing lives in `@visulima/package/lockfile` (`parseNpmLockFile`, `parsePnpmLockFile`, `parseYarnLockFile`, `parseLockFile(Sync)`, `decodeSriIntegrity`) — shared with any other consumer that needs name/version/SRI-integrity from pnpm/npm/yarn lockfiles. `src/sbom/lockfile.ts` is now a thin adapter that translates the package-agnostic `{ algorithm, hex }` shape into CycloneDX's `{ alg, content }`.
- ✅ `src/sbom/purl.ts` — zero-dep `pkg:npm/…` Package URL builder with proper percent-encoding
- ✅ `src/sbom/license.ts` — minimal SPDX normaliser covering the ~95 % of npm packages whose `license` field is a known SPDX ID; falls back to `NamedLicense` for everything else, preserves SPDX expressions verbatim
- ✅ `src/sbom/cyclonedx.ts` — pure builder; output round-trips through `assertValidBom()` (vendored 1.6.1 schema)
- ✅ `src/commands/sbom.ts` — `vis sbom` Cerebro command with `--focus`, `--format=json|xml`, `--output=<path>|-`, `--include-dev`
- ✅ Tests:
  - `__tests__/sbom/cyclonedx.test.ts` — schema-validates emitted BOMs end-to-end (single project + registry dep, dev/prod filtering, project-to-project edges, focus closure, XML serialisation)
  - `__tests__/sbom/lockfile.test.ts` — npm/pnpm/yarn parser cases + SRI decoding
  - `__tests__/sbom/purl.test.ts` — scoped/unscoped/lowercase/percent-encoding cases
  - `__tests__/sbom/license.test.ts` — SPDX normalization, expression detection, legacy object/array forms

**Full-closure walk now lands** ✅:
- Each parser in `@visulima/package` now also captures per-entry `dependencies` / `peerDependencies` / `optionalDependencies` (npm/pnpm/yarn/bun).
- `src/sbom/resolve-specifier.ts` matches a `name + specifier` pair against the lockfile's `name → versions` index, preferring `semver.maxSatisfying` for ranges and exact-match for already-resolved specs (pnpm).
- `buildCycloneDxBom` performs a BFS over the lockfile graph seeded from each in-scope project's direct deps. Transitive packages (e.g. a `body-parser` pulled in by `express`) now appear as standalone components, and registry-to-registry edges land in `dependencies[]`.
- `--include-dev` filters transitively (dev-only sub-trees aren't walked when the flag is unset).
- pnpm peer-disambiguated `.pnpm/foo@1.0.0_react@18.0.0/` install dirs are now discovered by the licence lookup (slow-path scan when the un-suffixed dir is absent).

**Known limitations** (deferred):
- `scope: "excluded"` and `scope: "optional"` are not yet differentiated from `scope: "required"` on registry components — every registry component is emitted as `"required"`. (Distinguishing `optional` would require tracking which seed map a transitive dep arrived through.)
- Yarn Berry's XXH64 `checksum:` field is dropped (CycloneDX 1.6 only allows the algorithms in `HashAlgorithm`); only Yarn Classic's SRI `integrity` field flows through.
- Yarn Berry per-entry dep maps aren't extracted (only the v1 layout is — Berry uses an array-of-strings form). The closure walk still includes Berry packages via the seed-then-walk loop, but registry-to-registry edges from Berry entries are absent.

---

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

### In-repo generators (`vis generate <template>`)

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

### Toolchain management (`vis toolchain` — auto-install runtimes)

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

1. **In-repo generators** (`vis generate`) — medium effort, clear demand, moon-template-compatible means easy migration
2. **SBOM** (`vis sbom`) — medium effort, no competitor has it, regulatory tailwind
3. **Toolchain** (`vis toolchain`) — medium-high effort, completes the moon parity story
4. **Plugin API** — only when third-party demand materializes
5. **Webhooks** — niche, CI providers cover this natively
6. **gRPC cache** — high effort, narrow audience (Bazel shops)

---

## Open — Tests

- [ ] Command integration tests (ci, docker, sync, action-graph, list, status) — these require mocking `runtime.runCommand` and `discoverWorkspace`
- [ ] Migration moon.ts test (requires mock YAML files + readYamlSync)
- [ ] End-to-end test: scaffold a temp workspace, run `vis run build`, verify cache hit on second run
