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

---

## Open — Tier 3

### SBOM generation (`vis sbom`)

Build a lightweight CycloneDX SBOM generator — first monorepo tool to ship
this (moon, Nx, Turborepo all lack SBOM support).

**Why**: Executive Order 14028, EU Cyber Resilience Act, and PCI DSS 4.0
all mandate SBOMs for software supply chains. cdxgen exists but is heavy
(200+ deps, slow on large repos) and not monorepo-aware.

**Scope**:
- CycloneDX 1.6 JSON output (the ECMA-424 standard)
- Walk the workspace project graph (`discoverWorkspace` + `buildProjectGraph`)
- For each project: read `package.json` → name, version, license, author, description
- For each resolved dependency: read from lockfile (task-runner already parses pnpm-lock.yaml, package-lock.json, yarn.lock) → name, resolved version, integrity hash
- Emit `components[]` with `type: "library"`, `bom-ref`, `purl` (Package URL scheme: `pkg:npm/name@version`)
- Emit `dependencies[]` mirroring the project graph edges
- Top-level `metadata.component` = the workspace root or a focused project
- `--focus=<project>` flag to scope the SBOM to a single project's transitive closure (reuse `resolveFocusProjects` from `docker.ts`)
- `--format=json|xml` (JSON default, XML via simple template — CycloneDX XML is well-defined)
- `--output=<path>` or stdout
- `--include-dev` flag (default: production only, matching industry practice)

**Building blocks already in vis**:
- `discoverWorkspace()` — project list + roots
- `buildProjectGraph()` — dependency edges with type (static/dev/peer)
- `lockfile-hasher.ts` in task-runner — parses pnpm/npm/yarn lockfiles and extracts resolved versions
- `resolveFocusProjects()` in `docker.ts` — transitive closure computation

**What's missing**:
- CycloneDX JSON schema conformance (straightforward — it's well-documented)
- PURL generation (`pkg:npm/${scope}/${name}@${version}`)
- License SPDX identifier normalization (map common license strings to SPDX IDs)
- Integrity hash extraction from lockfiles (sha512 from `integrity` field)

**Estimated effort**: ~200-300 LOC for the core generator + ~50 LOC for the CLI command.

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

`vis create` handles remote templates (via giget). This is for in-repo
scaffolding — generate a new component, service, or package from a local
template directory.

**Scope**:
- Template directory: `.vis/templates/<name>/`
- `template.yml` schema: variables (with prompts), file mappings, conditional files
- Variable interpolation in file contents and filenames
- `--dry-run` and `--defaults` flags (skip prompts, use defaults)

**Effort**: Medium (~300 LOC for template engine + prompts).

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

### Toolchain management (skipped by request)

Integrate with `proto`, `fnm`, or `volta` to auto-download and pin
Node/Bun/Deno versions per project. `vis doctor` already warns on mismatches;
this would auto-fix them.

---

## Open — Tests

- [ ] Command integration tests (ci, docker, sync, action-graph, list, status) — these require mocking `runtime.runCommand` and `discoverWorkspace`
- [ ] Migration moon.ts test (requires mock YAML files + readYamlSync)
- [ ] End-to-end test: scaffold a temp workspace, run `vis run build`, verify cache hit on second run
