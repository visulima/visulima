# nypm vs vis — feature gaps

Comparison of [unjs/nypm](https://github.com/unjs/nypm) against `vis`'s PM
layer (`packages/tooling/vis/src/pm/*`, `src/util/aube-resolver.ts`,
`native/src/pm_detect.rs`, `native/src/pm_resolve.rs`).

**Scope note.** nypm is an embedder-facing PM library (used by Nuxt and
similar). vis is a CLI runner. "Missing" here means features nypm has
that would benefit vis users — split into behavior gaps (worth porting)
and API surface gaps (only matter if vis becomes a library).

---

## Behavior gaps worth fixing

### 1. ~~No deno support in PM dispatch~~ — **shipped**

Deno is now a first-class peer to npm/pnpm/yarn/bun across detection
(`pm_detect.rs`: `deno.lock`, `deno.json`/`deno.jsonc`, `packageManager:
deno@…`, `npm_config_user_agent`), every resolver in `pm_resolve.rs`
(`install`, `add`, `remove`, `outdated`, `dedupe` → reinstall fallback,
`why` → `deno info`, `link` → no-op + warning, `dlx` → `deno run -A`,
`exec` → `deno task`, `pm` umbrella maps to nearest deno equivalents),
and the TS dispatcher in `pm-runner.ts`/`package-manager.ts`.

### 2. ~~No corepack passthrough~~ — **shipped**

`install.corepack` config (`"auto" | true | false`, default `"auto"`)
threads through every PM dispatcher. `applyCorepack` in
`pm-runner.ts` rewrites `{ bin: "pnpm", args: [...] }` into
`{ bin: "corepack", args: ["pnpm", ...] }` for npm/pnpm/yarn when
corepack is on PATH and `packageManager` is pinned. bun, deno, and
aube are skipped — corepack does not manage them.

### 3. No `npm_config_user_agent` fallback in detection

`pm_detect.rs` priority is packageManager → lockfile → config file →
default pnpm. nypm also reads `npm_config_user_agent`, which every PM
sets when running scripts. A tool invoked from `pnpm run x` knows it's
pnpm even without a lockfile. Useful for vis subprocesses.

### 4. `detectPackageManager` has no opt-out flags

`detect_package_manager(cwd)` is fixed-priority. nypm exposes
`ignorePackageJSON`, `ignoreLockFile`, `ignoreArgv`. Cheap to add,
useful for tests and override scenarios.

### 5. `buildMeta` / corepack SHA discarded

`pm_detect.rs:77` does `parts[1].split('+').next()` and drops the
integrity hash. nypm preserves it as `buildMeta` so callers can verify
a corepack pin. Low-effort retention.

### 7. ~~No `installPeerDependencies` option on add~~ — **shipped**

`vis add --auto-install-peers` now mirrors nypm's `installPeerDependencies`.
After the primary `add` succeeds, vis reads each freshly-installed
package's `package.json`, collects its non-optional `peerDependencies`
(entries flagged `optional: true` in `peerDependenciesMeta` are
skipped), and recursively adds the peers that aren't already present
in the workspace. Opt-in (matches nypm's default). Deno is excluded —
it has no peer-dependency concept.

### 8. ~~Unified `dry` / `silent` / `env` only partially wired~~ — **shipped**

`RunOverrides { dry?, env? }` plus a `silent?` extra threads through
every `runResolved` / `resolveAndRun` call site. `applyDryRun` and
`applySilent` post-process the resolved command per-PM. `env` triggers
a `spawnSync` fallback so per-call env injection works without
changing the Rust ABI.

### 9. `bun dedupe` / `deno dedupe` fallback

nypm deletes the lockfile and reinstalls because bun and deno don't
ship a `dedupe` subcommand. `resolve_dedupe` in vis dispatches to
whatever the PM provides; bun will error.

**Action:** either error early with a clear message, or implement the
rm-lockfile + reinstall fallback that nypm uses.

---

## API surface gaps (only if vis becomes a library)

### 6. No `ensureDependencyInstalled(name)` equivalent — **out of scope**

Embedder API (Nuxt-style: "make sure vitest is in devDeps before I run
my generator"). vis is a CLI, not a library, so it has no need for an
idempotent check-then-add helper exposed to callers. The underlying
primitives (`collectExistingDeps`, `runAdd`) remain available
internally if a future `vis generate` step ever needs them.

### 10. No public command-generator export — **out of scope**

vis is a CLI runner, not a PM library. The resolvers stay
NAPI-internal; `aube-resolver.ts` stays out of `package.json` exports.
Embedders that want this surface should depend on nypm directly.

### 11. No programmatic `runScript(name)` — **out of scope**

Same reasoning: vis is invoked from the shell, not imported. CLI
callers use `vis run <script>`.

---

## What vis already does better than nypm

For context, vis exceeds nypm on:

- workspace filters (`--filter`)
- `why`, `outdated`
- `link` / `unlink`
- `info` with version-aware bun branching
- lockfile drift detection (`detectLockfileDrift`)
- override management (`pm/overrides.ts`)
- aube installer integration
- `--prefer-offline` post-process
- `--ignore-scripts` post-process
- native Rust resolution

This is not a "vis is behind" report — these are the specific holes if
feature-parity with nypm is the goal.

---

## Recommendation

| Priority     | Item                                | Effort | Status                                      |
| ------------ | ----------------------------------- | ------ | ------------------------------------------- |
| High         | 1. deno support                     | M      | **shipped**                                 |
| High         | 2. corepack passthrough             | S      | **shipped** (`install.corepack`)            |
| High         | 3. `npm_config_user_agent` fallback | S      | **shipped** (in pm_detect.rs)               |
| High         | 7. `--auto-install-peers` on add    | S      | **shipped**                                 |
| Med          | 4. detect opt-out flags             | S      | **shipped** (`DetectPackageManagerOptions`) |
| Med          | 5. `buildMeta` retention            | XS     | **shipped**                                 |
| Med          | 8. unified `dry` / `silent` / `env` | M      | **shipped** (`RunOverrides`)                |
| Low          | 9. bun/deno dedupe fallback         | S      | **shipped** (deno reinstall fallback)       |
| Library-only | 6. `ensureDependencyInstalled`      | S      | **out of scope** (vis is a CLI)             |
| Library-only | 10. public command generators       | M      | **out of scope** (vis is a CLI)             |
| Library-only | 11. programmatic `runScript`        | XS     | **out of scope** (vis is a CLI)             |
