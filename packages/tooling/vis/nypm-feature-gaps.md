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

### 2. No corepack passthrough

vis treats corepack as a _version manager_
(`runtime/toolchain.ts`, `SUPPORTED_MANAGERS`), but `runResolved`
invokes `pnpm` / `yarn` directly. If `packageManager` field pins
`pnpm@9.x` and the user only has corepack on PATH, vis runs whichever
shim wins.

nypm has an opt-in `corepack: true` that prefixes commands with
`corepack`.

**Action:** add `install.corepack` config, or auto-detect when
`packageManager` field is present and `corepack` is on PATH.

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

### 6. No `ensureDependencyInstalled(name)` equivalent

Common embedder need: "make sure `vitest` is in devDeps; if not, add
it." vis has `add` but no idempotent check-then-add. The `generate`
runner could use it internally.

### 7. ~~No `installPeerDependencies` option on add~~ — **shipped**

`vis add --auto-install-peers` now mirrors nypm's `installPeerDependencies`.
After the primary `add` succeeds, vis reads each freshly-installed
package's `package.json`, collects its non-optional `peerDependencies`
(entries flagged `optional: true` in `peerDependenciesMeta` are
skipped), and recursively adds the peers that aren't already present
in the workspace. Opt-in (matches nypm's default). Deno is excluded —
it has no peer-dependency concept.

### 8. Unified `dry` / `silent` / `env` only partially wired

`--dry-run` exists on update (`pm_resolve.rs:486`); `silent` exists on
`InstallOptions` / `DlxOptions` only. nypm passes them uniformly.
`execPmCommandInteractive` also has no per-call env injection (process
env only).

### 9. `bun dedupe` / `deno dedupe` fallback

nypm deletes the lockfile and reinstalls because bun and deno don't
ship a `dedupe` subcommand. `resolve_dedupe` in vis dispatches to
whatever the PM provides; bun will error.

**Action:** either error early with a clear message, or implement the
rm-lockfile + reinstall fallback that nypm uses.

---

## API surface gaps (only if vis becomes a library)

### 10. No public command-generator export

nypm ships `installDependenciesCommand`, `addDependencyCommand`,
`runScriptCommand`, `dlxCommand` returning `{ bin, args }`. vis's
resolvers are NAPI-internal and `aube-resolver.ts` is not in
`package.json` `exports`. If third parties should embed vis's PM logic
(the way Nuxt embeds nypm), expose them under `@visulima/vis/pm`.

### 11. No programmatic `runScript(name)`

`vis run` is CLI-only. nypm's `runScript("build")` resolves to
`pnpm run build` / `yarn build` / `bun run build` etc. A thin wrapper
over `resolvePmCommand` with `subcommand="run"` would suffice.

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
| High         | 2. corepack passthrough             | S      | open                                        |
| High         | 3. `npm_config_user_agent` fallback | S      | **shipped** (in pm_detect.rs)               |
| High         | 6. `ensureDependencyInstalled`      | S      | open                                        |
| Med          | 4. detect opt-out flags             | S      | **shipped** (`DetectPackageManagerOptions`) |
| Med          | 5. `buildMeta` retention            | XS     | **shipped**                                 |
| Med          | 8. unified `dry` / `silent` / `env` | M      | open                                        |
| Low          | 9. bun/deno dedupe fallback         | S      | **shipped** (deno reinstall fallback)       |
| Library-only | 10. public command generators       | M      | open                                        |
| Library-only | 11. programmatic `runScript`        | XS     | open                                        |
| High         | 7. `--auto-install-peers` on add    | S      | **shipped**                                 |
