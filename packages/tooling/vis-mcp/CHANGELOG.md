## @visulima/vis-mcp [3.0.0](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@2.0.0...@visulima/vis-mcp@3.0.0) (2026-10-15)

### ⚠ BREAKING CHANGES

* Deno is no longer a supported runtime or package manager.
vis targets node/bun runtimes and aube/npm/pnpm/yarn package managers; the
deno-lint/deno-fmt adapters and deno inference targets are removed.

* fix: resolve eslint errors after deno removal

- vis: use a block body for applyIgnoreScripts (arrow-body-style)
- is-ansi-color-supported: drop stale eslint-disable directives and
  replace the raw-release if/else with a ternary (unicorn/prefer-ternary)

* docs(cron-parser): remove remaining deno runtime mentions

These doc/config files arrived with main's dialect-gating commit after this
branch's base, so they still listed Deno as a supported runtime.

* feat!: remove deno runtime and tooling support

Deno is being wound down: Cloudflare is acquiring the Deno team, the runtime
gets one more year of monthly maintenance before development ends, and Deno
Deploy shuts down. Drop Deno as a supported runtime, package manager, and
lint/fmt/inference target across the monorepo.

- vis: remove the deno runtime path, deno-lint/deno-fmt adapters, the
  deno.json inference detector, Deno PM handling (TypeScript + Rust native
  resolver), and the devcontainer deno mount; regenerate the JSON schemas.
- libraries: drop Deno runtime detection from cerebro, ono,
  is-ansi-color-supported, and task-runner command parsing; remove Deno
  wording from package docs and READMEs.
- delete the examples/deno directories (ono, pail, storage) and Deno docs.
- keep JSR publishing (registry usable from Node), license/attribution
  comments, the secret-scanner Deno-token rule, and the historical RFCs.
* Deno is no longer a supported runtime or package manager.
vis targets node/bun runtimes and aube/npm/pnpm/yarn package managers; the
deno-lint/deno-fmt adapters and deno inference targets are removed.

* fix: resolve eslint errors after deno removal

- vis: use a block body for applyIgnoreScripts (arrow-body-style)
- is-ansi-color-supported: drop stale eslint-disable directives and
  replace the raw-release if/else with a ternary (unicorn/prefer-ternary)

* chore(vis): tidy deno-removal leftovers from review

* fix(vis): drop unused logger from x handler, restore bun typing

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* docs: add migration notes for removed deno exports

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* feat(vis): warn on stale adapter ids and deno-only projects

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* refactor(vis): derive runtime ids and reuse bun detection

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* refactor(vis): drop jsr deno option and deno auth reference

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* fix(vis): restore runtime id schema description

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* refactor(vis): remove jsr publishing support

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* feat(bytes): port @std/bytes helpers back in

Carries the Uint8Array helpers from @std/bytes@1.0.6 (MIT, Copyright the Deno authors)
into src/std-bytes.ts and re-exports them from the package entry. Keeps the public API that
the Deno-removal commit dropped, without the jsr: devDependency. Docs and AGENTS notes are
restored to describe the ported functions.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* docs(bytes): attribute ported @std/bytes source

The license file still listed @jsr/std__bytes as a bundled dependency.
Replace it with the MIT notice for the ported src/std-bytes.ts, placed outside
the generated dependency blocks.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* fix(cron-parser): keep reviewed docs and 1.1.0 version

The rebase onto the remote branch dropped the reviewed dialect sentence in the README and
the installation table row, and the release commit's 1.1.0 version bump.

### Features

* remove deno runtime and tooling support ([#973](https://github.com/visulima/visulima/issues/973)) ([26fada1](https://github.com/visulima/visulima/commit/26fada1ac04731cba9db8f74fe20849c0a15db74))


### Dependencies

* **@visulima/vis:** upgraded to 6.0.0

## @visulima/vis-mcp [2.0.0](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.47...@visulima/vis-mcp@2.0.0) (2026-10-14)

### ⚠ BREAKING CHANGES

* **vis:** vis run <target> now exits 1 when no project defines the
target. Scripts that relied on the silent exit 0 must pass --if-present.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

* feat(task-runner): add tracker kind to trace key

The trace key now includes which mechanism observed the file accesses:
seccomp, strace, interpose, iat or preload. The same workspace traced on
Linux and macOS can no longer produce the same key for different
observations.

Upgrade notes:
- Traced entries written after this change are keyed on the new digest.
  Entries written before it stay reachable through the task index and
  are validated against their files as before, so there is no forced
  miss on upgrade.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* feat(task-runner): fall back to declared hash

A traced task whose tracker observed no workspace access was never
cached. That left targets which declare inputs uncached on hosts without
a working tracker. When the target declares inputs, such a run is now
keyed on its declared hash instead. Targets without inputs keep the
previous behaviour: no cache entry and a warning.

The declared hash is computed only when the tracker is empty, so traced
runs that observe files do no extra hashing. A fallback entry is stored
without a fingerprint, and the next run validates it by recomputing the
declared hash. A changed hash is reported as declared-changed. The task
result and the run summary record hashSource: "declared-fallback".

Upgrade notes:
- Existing entries are unchanged. Only runs that observe no workspace
  access, for targets that declare inputs, gain a cache entry.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* feat(vis): show declared-fallback key in cache why

cache why and cache hash now say when a traced run was keyed on its
declared hash, and the JSON output carries hashSource. The vis config
schema is regenerated for the updated autoFingerprint description.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* docs(vis): describe declared fallback and trace key

The caching guide and configuration reference now explain when an empty
trace is keyed on the declared hash, how a trace key is built, and what
cache why reports. The RFC marks G1-B and G4 done.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* docs(task-runner): describe declared fallback for empty traces

The empty-fingerprint section now explains both outcomes: a target that
declares inputs is keyed on its declared hash, and one that does not is
left uncached with a warning.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* docs(vis): correct trace caching claim in why-vis

A run the tracker cannot observe is keyed on its declared inputs when
the target declares them. It is not cached otherwise.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* feat(task-runner): parse top-level && chains

Add splitCompoundCommand, a quote-aware splitter that cuts a shell
command on top-level && only. Anything it does not model (;, ||, a
background &, subshells, command substitution, heredocs, comments,
empty segments, cd/export/source/set/trap/exec and VAR=value prefixes)
leaves the whole command unsplit and reports why.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* feat(task-runner): add splitCompound segment chains

Add the splitCompound target option. A declared-mode target whose
* **vis:** `vis run` with --filter, --query or --tag that selects no
project now exits 1. Scripts that relied on the silent exit 0 must pass
--if-present.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* test(vis): keep empty --affected results exit 0

Pins the behaviour the empty-selection fix must not change: when a --tag
selects a project that --affected then excludes, the run prints "No
projects affected by the changes." and returns. A mutation that throws
there fails the test.

The fixture repo runs with GIT_* variables cleared, so it cannot act on
the repository that a git hook is committing.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* fix(vis): let ci and affected opt out of empty runs

vis run now fails when a target, --query or tag selects no projects, and
vis ci / vis affected hand their --query to it. A job whose query can
legitimately match nothing had no way to say so. Add --if-present to both
and forward it to vis run.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

* fix(task-runner): match excludes inside the workspace

The tracker tested its exclude patterns (/dev/, /tmp/, /etc/, ...) against
the absolute path before checking containment. A workspace under any of
those directory names, such as ~/dev/project or a /tmp CI checkout,
recorded no accesses at all on the strace, seccomp, interpose and IAT
paths, so traced caching never engaged. The Windows IAT check was also a
lowercase startsWith without a separator boundary, so a workspace /ws/app
accepted /ws/app-other.

Every path now goes through resolveAccessPath: containment first, then the
patterns against the path inside the workspace.

Upgrade notes: traced targets in a workspace under a dev, tmp or etc
directory now cache where they previously never did. The IAT path no longer
accepts sibling directories that share the workspace prefix.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

* fix(task-runner): key unset env names apart from empty ones

A traced key recorded an unset name and an empty value the same way, so a
name that went from unset to "" hit a stale entry. An unset name now keys
differently from an empty one, using the same presence scheme as the
declared hasher.

validate takes the env to check against. It defaults to process.env, so
existing callers see no change; the next commit passes the child env.

Upgrade notes: traced entries that key an env name miss once after
upgrading, because the stored env key format changed.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* fix(task-runner): key traced runs on the child env

A traced run keyed the parent's env values, so a value the child receives
from another source (an envFile, service env, VIS_ARG_* or a per-target env)
was not in the key, and changing it left a stale hit.

The key now reads the names it covers from the resolved child env
(TaskRunnerContext.resolveChildEnv). A name the clean policy hides hashes as
unset. Validation reads the same env, so a hit needs the values the child
will see. Untracked names stay out of the key, and the key does not cover
the whole environment.

The key also covers the command the run spawns. TaskRunnerContext.resolveCommand
supplies it, so caller-side arguments and shell wrapping change the key.
Without it the project target command is used, as before.

TaskRunnerContext.preTraceCheck runs on a cache miss before tracking. A
returned message fails the task with exit code 1; the child does not spawn
and nothing is cached.

Upgrade notes: a traced key changes when the spawned command differs from
the configured one. Traced entries that key an env name also miss once,
as in the previous commit.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* fix(vis): traced targets run the executor command

A traced target ran the raw project command. Forwarded arguments
(`vis run build -- --flag`) and `affectedFiles: "args"` paths never reached
the child, `${...}` tokens and a custom `shell` did not apply, and
`strictEnv` was not checked.

The executor and the traced run now share one resolver for the spawned
command, and one strict-env check that reads the child env the spawn gets.
Both spawn the same string, and the traced key hashes it, so the arguments
and affected files change the key.

Upgrade notes:
- Traced targets now receive forwarded arguments and `affectedFiles: "args"`
  paths. A traced run with these misses once, since the key includes them.
- Traced targets now run their configured command, with tokens expanded and
  any custom shell applied, as the executor does. They used to run the raw
  project command.
- `strictEnv` (flag or config) now fails a traced target that references an
  unset variable, before the child starts. A traced target that passed with
  an unset reference now fails.
- Traced keys hash the env values the child receives (see the task-runner
  commits), so traced targets with env names in the key miss once.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* docs(vis): document the traced key and strict env

The caching guide lists what a traced key covers: the spawned command and
the env values the child receives for the names the key covers. The run
guide says the strict-env check runs for traced targets too. The RFC
records the resolution and the gaps that remain: the declared hasher still
reads process.env for fingerprintEnv and envVars, and persistent targets and
the TUI retry spawn the raw command, so forwarded arguments do not reach them.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* fix(vis): persistent and retried tasks keep args

Persistent targets and a TUI retry spawned the raw override command, so
forwarded arguments, affectedFiles args and a custom shell were dropped
while the first attempt of the same task had them. Both now spawn the
command the executor and the traced run use.

Upgrade notes: vis run <persistent> -- <args> now passes the arguments to
the persistent command.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

* fix(task-runner): key declared env on the child env

The declared hasher read fingerprintEnv, envVars, env:// inputs,
autoEnvVars and framework names from the parent's process.env, but the
child also gets values from envFile layering, service env, task arguments
and per-target env. A cached target keyed on a variable only its env file
defines kept serving a stale hit after the file changed, and fingerprintEnv
wildcards never matched names the parent lacked.

The hasher takes a childEnv resolver, supplied from resolveChildEnv, and
keys and expands patterns against the environment the task will receive.
globalEnv is workspace-wide and still reads the parent's.

Upgrade notes: a declared target whose child sees a different value than
the parent for a keyed name gets one new key, and so one cache miss. Keys
for names with equal values are unchanged.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

* fix(vis): doctor no longer crashes without a lockfile

vis doctor looked the package manager up twice with a strict resolver that
throws when a workspace has no lockfile and no packageManager field, the
state of every new project. It crashed with a stack trace instead of
reporting. Reuse the tolerant detection the command already performed.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

* docs(vis-mcp): fix lint and cache tool text

The lint description listed the default adapters without the opt-in
typecheck adapter. cache_why and cache_hash described hashDetails only,
but trace-mode tasks have no hashDetails: their reasons are in
task.cacheMissReasons and their tracked state is in trackedFingerprint.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* docs(vis): cover run, cache and lint in the skill

Add the tools the table left out, correct the tool count, and document
the empty-selection exit code, the opt-in typecheck adapter, the trace
miss reasons, and the doctor env coverage check. Replace the cache-miss
flow's invented status and stderr fields with the real summary fields.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* docs(vis): sync ai guide tool reference

The guide listed eight tools and described a run_task tool that does
not exist. Add the five missing tools and the trace-mode fields that
cache_why and cache_hash return.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* fix(vis-mcp): read the run summary vis really writes

list_runs read runId, startedAt, status and tasks[].status, none of which
the run summary has: it carries id, startTime, stats and per-task
exitCode. Every run therefore showed as a success with no failures and no
start time, including failed ones, and get_run_logs echoed an undefined
run id. Read the real fields, fall back to the old spellings, and test
against a summary shaped like the one vis writes.

Upgrade notes: list_runs now reports failed runs as failures, with their
start time and task counts.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

* feat(task-runner): chain trace keys per segment

A `splitCompound` target with `hashMode: "trace"` (or workspace
`autoFingerprint`) was refused and ran whole. It now splits like a declared
target. Each segment runs through the tracker on its own command, and its
trace key folds in the trace key of the segment before it.

- fingerprint: `TaskFingerprint.chainKey` holds the predecessor's trace key.
  It joins `hashFingerprint` only when set, so keys of ordinary tasks do not
  move (a test pins two of them). `validateChain` checks it on lookup, after
  the command and tracker checks and before any file is hashed, and a moved
  predecessor misses with `chain-changed`.
- orchestrator: a segment after the first keys on its predecessor's trace key.
  A segment whose predecessor has no key this run is neither served nor stored.
  A traced segment publishes its key on a hit as well as on a store.
- default resolver: reads a segment's command from `overrides`, so the tracker
  and the tracker-kind prediction see that segment's command, not the chain.
- Refusals kept: `{ auto: true }` outputs, `when`, `always`, custom shell and
  unsupported shell syntax. The trace and auto-fingerprint refusals are removed.

Upgrade notes:

- Targets that set `splitCompound` together with `hashMode: "trace"` or
  `taskRunner.autoFingerprint` now run as `target#n` segments. They used to run
  whole. Their first run after upgrading misses, because the segment entries
  are new.
- Keys of targets that do not split are unchanged, both traced and declared.
- `vis run --dry-run` lists the segments of these targets, each marked `(trace)`.
- `SplitCompoundOptions` (exported from `@visulima/task-runner`) no longer has
  `autoFingerprint`. Passing it is now a type error. It had no effect once the
  split refusal was gone.
- The `splitCompound` description in the vis config schemas is regenerated.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* fix(vis): give segments their target's service env

The service env of a run is keyed on the target's id, before a
`splitCompound` target is split. A segment runs under its own id
(`target#n`), so its spawn found no service env. A split target therefore
lost the variables of the services it depends on, in declared mode as well
as traced mode.

`resolveTaskSpawn` now reads a segment's entry from the target it runs in
place of. Every spawn path reads through that function, so the executor, the
persistent launch and the retry get the same environment.

Upgrade notes:

- A `splitCompound` target's segments now receive the service env they used
  to miss. A segment's key changes once after upgrading only when it names a
  service variable, because keys cover the env values the child receives.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* test(vis): cover traced segments through vis run

Runs a `hashMode: "trace"` target with `splitCompound` through the run
handler. Covers the last-segment-only re-run, the re-run of every segment
when the first segment's input changes, forwarded arguments on the last
segment only, and the `(trace)` annotation on each segment in the dry-run
plan.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* docs(vis): document traced segment keys

The `splitCompound` option no longer refuses trace hashing. The run option
row and the caching guide now describe how a traced segment's key chains to
its predecessor, and the cases where a segment is neither served nor stored.
The RFC marks G3.3 done and records the chain, the kept refusals and the
limits found while implementing it.

Upgrade notes:

- The caching guide and the run option table no longer list trace hashing as
  a reason the split is refused. Targets that combine `splitCompound` with
  `hashMode: "trace"` split as described in the previous commits.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* fix(vis): annotate traced tasks under auto-fingerprint

The dry-run plan marked a task `(trace)` only when its own `hashMode` was
`"trace"`. Under `taskRunner.autoFingerprint` the engine traces every task,
segments included, so their plan lines showed no trace mark.

The annotation now follows the engine: `hashMode: "trace"` or the workspace
switch.

Tests cover the dry-run annotation under the workspace switch, and
`vis cache why` on a segment that missed because the segment before it moved.

Upgrade notes:

- Under `taskRunner.autoFingerprint`, `vis run --dry-run` now marks every task
  `(trace)`, including targets that do not split. Before, only per-target trace
  targets were marked. The run itself is unchanged.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* test(task-runner): guard segment tests for win32

Two segment tests use a bare `true` command as a segment whose tracker sees
nothing. `true` is a POSIX builtin that cmd.exe lacks, so they now skip on
win32. The clean-environment test passes the platform's essential names
(SystemRoot on Windows) to the child, so node can start there.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* docs(vis): correct the chain miss reason in the RFC

A moved predecessor misses with `chain-changed`, which `vis cache why` prints
as `Previous segment changed`. The reason does not name the predecessor, so
the RFC no longer says it does.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* fix(vis): report target properties under options

splitCompound, hashMode, fingerprintEnv and the other target-level
properties are read from the target, not from its options bag. Written
under options they parsed fine and did nothing, and the run.mdx options
table listed splitCompound there. Warn when a run finds one under options,
and move splitCompound out of the options table with a note on which keys
are target-level.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

* fix(task-runner): key dependents on traced hits

A traced task published its key only when it ran and stored, not when
it was served from cache. A declared task that dependsOn it then folded
the traced key on a cold run and nothing on a warm one, so its key
flipped with whether the dependency ran. Worse, the key without the
dependency was shared across dependency states, so after the dependency
changed and then hit again the dependent was served output built from
the older state.

Publish the key on every traced hit, as segments already did.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

* fix(vis): replace every match in two rewrites

CodeQL flagged two string replaces that rewrite only the first match.
Neither input holds a second match today, but replaceAll states the
intent and keeps the code scan green.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

* fix(vis): check referenced tsconfigs in build mode

tsc -b rejects --noEmit once one project references another (TS6310),
so a solution-style workspace whose projects import each other could
never pass the type check. Drop the flag in build mode and document
that it writes each project's own outDir and tsbuildinfo.

Also decide config ownership with a relative path, so a root with
Windows separators still finds its own tsconfig.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

* fix(vis): keep the GitLab token off self-hosted hosts

GITLAB_TOKEN belongs to gitlab.com, but a gitlab://host source names a
host the template author chose, so the token was sent wherever the URL
pointed. Skip the environment token there; create.auth, a token in the
URL and GIGET_AUTH still apply.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

* fix(vis): apply review fixes to create, doctor, run

- resolve a create.defaultTemplate alias before the org preflight
- pass the config to the task overlay loader in the env check
- keep doctor running when the env coverage check throws
- retry a split target by segment id
- declare if-present with negatable() and drop the tag claim from ci
- correct the clean-env note for traced targets and the splitCompound
  and if-present wording in the docs

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

* test: fix windows paths, quoting and env names

- pass a file path to node as an argument, not inside a JS string
- quote only values that contain whitespace, as cmd drops the first
  and last quote of a command that starts with one
- match env names without regard to case and allow the names Windows
  adds to every process
- compare paths in the normalised form the code returns
- expect cmd to leave $VAR unexpanded

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

### Features

* **vis:** git templates, clean env cache keys, trace segments ([#969](https://github.com/visulima/visulima/issues/969)) ([f16cf03](https://github.com/visulima/visulima/commit/f16cf038f9827abcf814fa1c2a5821c004d6d746)), closes [id#1](https://github.com/visulima/id/issues/1) [id#2](https://github.com/visulima/id/issues/2)


### Dependencies

* **@visulima/vis:** upgraded to 5.0.0

## @visulima/vis-mcp [1.0.47](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.46...@visulima/vis-mcp@1.0.47) (2026-10-14)


### Dependencies

* **@visulima/vis:** upgraded to 4.3.1

## @visulima/vis-mcp [1.0.46](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.45...@visulima/vis-mcp@1.0.46) (2026-10-13)


### Dependencies

* **@visulima/fs:** upgraded to 6.1.0
* **@visulima/vis:** upgraded to 4.3.0

## @visulima/vis-mcp [1.0.45](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.44...@visulima/vis-mcp@1.0.45) (2026-10-09)


### Dependencies

* **@visulima/vis:** upgraded to 4.2.0

## @visulima/vis-mcp [1.0.44](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.43...@visulima/vis-mcp@1.0.44) (2026-10-07)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.29

## @visulima/vis-mcp [1.0.43](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.42...@visulima/vis-mcp@1.0.43) (2026-10-05)


### Dependencies

* **@visulima/vis:** upgraded to 4.1.20

## @visulima/vis-mcp [1.0.42](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.41...@visulima/vis-mcp@1.0.42) (2026-10-05)


### Dependencies

* **zod:** 4.4.3 → 4.6.5

## @visulima/vis-mcp [1.0.41](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.40...@visulima/vis-mcp@1.0.41) (2026-10-04)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.28
* **@visulima/vis:** upgraded to 4.1.19

## @visulima/vis-mcp [1.0.40](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.39...@visulima/vis-mcp@1.0.40) (2026-10-04)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.27
* **@visulima/vis:** upgraded to 4.1.18

## @visulima/vis-mcp [1.0.39](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.38...@visulima/vis-mcp@1.0.39) (2026-10-04)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.26
* **@visulima/vis:** upgraded to 4.1.17

## @visulima/vis-mcp [1.0.38](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.37...@visulima/vis-mcp@1.0.38) (2026-10-03)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.25
* **@visulima/vis:** upgraded to 4.1.16

## @visulima/vis-mcp [1.0.37](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.36...@visulima/vis-mcp@1.0.37) (2026-10-03)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.24
* **@visulima/vis:** upgraded to 4.1.15

## @visulima/vis-mcp [1.0.36](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.35...@visulima/vis-mcp@1.0.36) (2026-10-03)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.23
* **@visulima/vis:** upgraded to 4.1.14

## @visulima/vis-mcp [1.0.35](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.34...@visulima/vis-mcp@1.0.35) (2026-10-03)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.22
* **@visulima/vis:** upgraded to 4.1.13

## @visulima/vis-mcp [1.0.34](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.33...@visulima/vis-mcp@1.0.34) (2026-10-02)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.21
* **@visulima/vis:** upgraded to 4.1.12

## @visulima/vis-mcp [1.0.33](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.32...@visulima/vis-mcp@1.0.33) (2026-10-01)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.20
* **@visulima/vis:** upgraded to 4.1.11

## @visulima/vis-mcp [1.0.32](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.31...@visulima/vis-mcp@1.0.32) (2026-09-30)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.19
* **@visulima/vis:** upgraded to 4.1.10

## @visulima/vis-mcp [1.0.31](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.30...@visulima/vis-mcp@1.0.31) (2026-09-29)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.18
* **@visulima/vis:** upgraded to 4.1.9

## @visulima/vis-mcp [1.0.30](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.29...@visulima/vis-mcp@1.0.30) (2026-09-28)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.17
* **@visulima/vis:** upgraded to 4.1.8

## @visulima/vis-mcp [1.0.29](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.28...@visulima/vis-mcp@1.0.29) (2026-09-27)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.16
* **@visulima/vis:** upgraded to 4.1.7

## @visulima/vis-mcp [1.0.28](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.27...@visulima/vis-mcp@1.0.28) (2026-09-26)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.15
* **@visulima/vis:** upgraded to 4.1.6

## @visulima/vis-mcp [1.0.27](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.26...@visulima/vis-mcp@1.0.27) (2026-09-25)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.14
* **@visulima/vis:** upgraded to 4.1.5

## @visulima/vis-mcp [1.0.26](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.25...@visulima/vis-mcp@1.0.26) (2026-09-24)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.13
* **@visulima/vis:** upgraded to 4.1.4

## @visulima/vis-mcp [1.0.25](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.24...@visulima/vis-mcp@1.0.25) (2026-09-23)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.12
* **@visulima/vis:** upgraded to 4.1.3

## @visulima/vis-mcp [1.0.24](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.23...@visulima/vis-mcp@1.0.24) (2026-09-22)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.11
* **@visulima/vis:** upgraded to 4.1.2

## @visulima/vis-mcp [1.0.23](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.22...@visulima/vis-mcp@1.0.23) (2026-09-21)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.10
* **@visulima/vis:** upgraded to 4.1.1

## @visulima/vis-mcp [1.0.22](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.21...@visulima/vis-mcp@1.0.22) (2026-09-21)

### Miscellaneous Chores

* point every Discord link at the anolilab server ([#858](https://github.com/visulima/visulima/issues/858)) ([4002bfc](https://github.com/visulima/visulima/commit/4002bfcd8d3c748d7008efe208e6aaae7bd18753))


### Dependencies

* **@visulima/fs:** upgraded to 6.0.9
* **@visulima/vis:** upgraded to 4.1.0

## @visulima/vis-mcp [1.0.21](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.20...@visulima/vis-mcp@1.0.21) (2026-09-07)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.8
* **@visulima/vis:** upgraded to 4.0.2

## @visulima/vis-mcp [1.0.20](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.19...@visulima/vis-mcp@1.0.20) (2026-09-06)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.7
* **@visulima/vis:** upgraded to 4.0.1

## @visulima/vis-mcp [1.0.19](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.18...@visulima/vis-mcp@1.0.19) (2026-09-03)

### Bug Fixes

* stop vis ci, cache, preflight and inference failing silently ([#854](https://github.com/visulima/visulima/issues/854)) ([45a97b0](https://github.com/visulima/visulima/commit/45a97b02684c8336662f23a3f2cd2f7227c14692))


### Dependencies

* **@visulima/fs:** upgraded to 6.0.6
* **@visulima/vis:** upgraded to 4.0.0

## @visulima/vis-mcp [1.0.18](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.17...@visulima/vis-mcp@1.0.18) (2026-08-19)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.5
* **@visulima/vis:** upgraded to 3.0.6

## @visulima/vis-mcp [1.0.17](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.16...%40visulima%2Fvis-mcp%401.0.17) (2026-08-19)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.4
* **@visulima/vis:** upgraded to 3.0.5

## @visulima/vis-mcp [1.0.16](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.15...%40visulima%2Fvis-mcp%401.0.16) (2026-08-19)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.3
* **@visulima/vis:** upgraded to 3.0.4

## @visulima/vis-mcp [1.0.15](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.14...%40visulima%2Fvis-mcp%401.0.15) (2026-08-18)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.2
* **@visulima/vis:** upgraded to 3.0.3

## @visulima/vis-mcp [1.0.14](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.13...%40visulima%2Fvis-mcp%401.0.14) (2026-08-17)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.1
* **@visulima/vis:** upgraded to 3.0.2

## @visulima/vis-mcp [1.0.13](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.12...%40visulima%2Fvis-mcp%401.0.13) (2026-08-17)


### Dependencies

* **@visulima/vis:** upgraded to 3.0.1

## @visulima/vis-mcp [1.0.12](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.11...%40visulima%2Fvis-mcp%401.0.12) (2026-08-08)


### Dependencies

* **@visulima/fs:** upgraded to 6.0.0
* **@visulima/path:** upgraded to 4.0.0
* **@visulima/vis:** upgraded to 3.0.0

## @visulima/vis-mcp [1.0.11](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.10...%40visulima%2Fvis-mcp%401.0.11) (2026-08-02)


### Dependencies

* **@visulima/fs:** upgraded to 5.1.0
* **@visulima/path:** upgraded to 3.1.0
* **@visulima/vis:** upgraded to 2.0.2

## @visulima/vis-mcp [1.0.10](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.9...%40visulima%2Fvis-mcp%401.0.10) (2026-07-27)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.11
* **@visulima/vis:** upgraded to 2.0.1

## @visulima/vis-mcp [1.0.9](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.8...%40visulima%2Fvis-mcp%401.0.9) (2026-07-27)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.10
* **@visulima/vis:** upgraded to 2.0.0

## @visulima/vis-mcp [1.0.8](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.7...%40visulima%2Fvis-mcp%401.0.8) (2026-07-27)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.8
* **@visulima/vis:** upgraded to 1.0.8

## @visulima/vis-mcp [1.0.7](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.6...%40visulima%2Fvis-mcp%401.0.7) (2026-07-26)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.7
* **@visulima/vis:** upgraded to 1.0.7

## @visulima/vis-mcp [1.0.6](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.5...%40visulima%2Fvis-mcp%401.0.6) (2026-07-26)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.6
* **@visulima/vis:** upgraded to 1.0.6

## @visulima/vis-mcp [1.0.5](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.4...%40visulima%2Fvis-mcp%401.0.5) (2026-07-19)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.5
* **@visulima/vis:** upgraded to 1.0.5

## @visulima/vis-mcp [1.0.4](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.3...%40visulima%2Fvis-mcp%401.0.4) (2026-07-17)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.4
* **@visulima/vis:** upgraded to 1.0.4

## @visulima/vis-mcp [1.0.3](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.2...%40visulima%2Fvis-mcp%401.0.3) (2026-07-17)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.3
* **@visulima/vis:** upgraded to 1.0.3

## @visulima/vis-mcp [1.0.2](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.1...%40visulima%2Fvis-mcp%401.0.2) (2026-07-15)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.2
* **@visulima/vis:** upgraded to 1.0.2

## @visulima/vis-mcp [1.0.1](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.0...%40visulima%2Fvis-mcp%401.0.1) (2026-07-15)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.1
* **@visulima/vis:** upgraded to 1.0.1

## @visulima/vis-mcp 1.0.0 (2026-07-03)

### ⚠ BREAKING CHANGES

* **vis:** the following security.* keys were renamed:
- security.minimumReleaseAge          -> security.policies.first_seen.minutes
- security.minimumReleaseAgeExclude   -> security.policies.first_seen.exclude
- security.trustPolicy                -> security.policies.publisher_change.mode
- security.trustPolicyExclude         -> security.policies.publisher_change.exclude
- security.trustPolicyIgnoreAfter     -> security.policies.publisher_change.ignoreAfter
- security.allowBuilds                -> security.policies.install_scripts.allow
- security.strictDepBuilds            -> security.policies.install_scripts.strict
- security.socket.minimumScore        -> security.policies.score.minimum
- security.socket.acceptedRisks       -> security.acceptedRisks
- security.audit.failOn               -> security.policies.vulnerability.failOn
- security.audit.usage                -> security.policies.vulnerability.usage

AcceptedRisk now carries optional policies[] and expiresAt fields so
risks can be scoped per-policy and time-boxed. Native PM sync writers
keep emitting pnpm-native field names since pnpm owns that schema.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* chore(vis): address coderabbit review feedback

- Add JSDoc to exported items across hook builtins, advisories, audit, docker
- Document OSV `last_affected` inclusive-upper semantics with a focused test
- Annotate NAPI u64→u32 truncations with JS Number range rationale
- Switch vis-mcp tool payloads to zod schemas with `.catchall(z.unknown())`
  so unknown CLI fields stay forward-compatible
- Fence RFC code blocks with explicit languages and tidy hook-command
  formatting (multi-line type, implicit-return arrows)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* chore(vis): address second-round coderabbit feedback on policies rename

- Drift report labels now reference `security.policies.*` paths so the
  hint matches the keys users edit
- `defineConfig` JSDoc examples use the new `security.policies` shape
- `mergeSecurityDefaults` deep-merges every defaulted sub-policy
  generically; `mergeVisConfigs` deep-merges `policies` and
  `acceptedRisks` so presets aren't clobbered
- Config-writer scopes its `allow:` match to follow an
  `install_scripts:` opener
- JSDoc clarifications for `audit.advisories.source` default,
  `acceptedRisks.expiresAt`/`acceptedScore` ranges, `malware.mode`
  cross-field default, and the current `policies.score.minimum`
  wiring gap

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* chore(vis): finish coderabbit round-2 fixes — camelCase policies + wire score.minimum

- Rename `PolicyName` union to camelCase (`firstSeen`, `installScripts`,
  `publisherChange`, `unexpectedDeps`). Updates every consumer in src/,
  test fixtures, schemas, and docs. JSON schema regenerated.
- Add `types` mapping to the `#native` package.json import so TypeScript
  resolves `index.d.ts` when consumers import the alias.
- Thread `socketOptions.minimumScore` through `audit`, `doctor`, `check`,
  `update`, `add`, `formatSecurityOverview`, `formatSummary`, and
  `applyFilter`. `buildSocketOptions` now resolves the effective minimum
  once (from `security.policies.score.minimum` or
  `DEFAULT_LOW_SCORE_THRESHOLD`) so every consumer sees the same value
  instead of comparing scores against the hard-coded constant.
- Update the JSDoc on `policies.score.minimum` to reflect the new wiring.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* feat(vis): add Socket-style policy engine with 4 offline-clean policies

Introduce a unified `evaluatePolicies()` engine under `src/security/policies/`
with four offline-clean modules: license, install_scripts, vulnerability,
and unexpected_deps (baseline mode). Each policy emits PolicyDecisions
(block/warn/info) keyed by package, with per-policy accepted-risk scoping
and expiresAt support reused from the shared matcher.

Wires the engine into `vis audit`: a new `--policies <names>` flag
(comma-list, `all`, or `none`) narrows evaluation. Block-severity
decisions feed into `--exit-code` and `--fail-on`. JSON output gains
`policies[]` + `summary.policyBlocks`. SARIF and HTML formatters render
policy decisions alongside vulnerabilities; CSAF and CycloneDX-VEX are
intentionally left untouched (vuln-specific data models).

Adds `readNodeModulesManifests()` to walk `node_modules/` (including the
pnpm `.pnpm/` content-addressed store) and surface license + scripts +
maintainers metadata for the offline policies.

33 new unit + integration tests; full vitest suite (3582/3582) green;
`tsc --noEmit` clean.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* fix(vis): close three audit policy gating gaps surfaced by CodeRabbit

- applyExitGate's fallthrough call to applyFailOnGate was dropping the
  policyDecisions argument, so `vis audit --format sarif --fail-on high`
  exited 0 when the only signal was a block-severity policy decision.
  Forward the argument.
- Unknown --policies tokens were silently swallowed when format was
  json/sarif/csaf/cyclonedx-vex, so a typoed CI invocation reduced
  enforcement with no log. Always emit the warning to stderr and
  surface the tokens in JSON output as `warnings[]`.
- Vulnerability-policy block decisions whose advisory was masked by
  --severity used to exit 1 with no visible reason. Surface those
  decisions in the human-readable "Policy Decisions" section so the
  gate is always traceable.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* fix(vis): correct npm/yarn min-release-age native config writers

npm CLI types `min-release-age` as `Number` in days, not a duration string —
vis wrote `48h`/`15m`, which npm's parseInt would silently read as 48/15 days.
Write integer days rounded up so the native gate is never weaker than vis-config.

Yarn Berry silently treats day suffixes in `npmMinimalAgeGate` as minutes

### Features

* **vis-mcp:** add audit/advisory/lint/fmt/list_runs tools and structured output ([4918e4b](https://github.com/visulima/visulima/commit/4918e4bb176508065bc8a578141beb79316c530d))
* **vis-mcp:** add list_templates and describe_template tools ([549ea7e](https://github.com/visulima/visulima/commit/549ea7edbe88e3dde40e09cf5f5eaea80bb8fd58))
* **vis-mcp:** add MCP server package for AI-agent integration ([a8d5022](https://github.com/visulima/visulima/commit/a8d5022ba905481985378c0ac01e7f654608ec2b))
* **vis:** lint + fmt orchestrator ([3a78ed7](https://github.com/visulima/visulima/commit/3a78ed709922e6a35648e0d0eb3f41cc49f89b7a))
* **vis:** offline OSV scanner + unified security.policies ([#632](https://github.com/visulima/visulima/issues/632)) ([6461902](https://github.com/visulima/visulima/commit/646190243bf51bb6df172665d70fd501644e7bc3)), closes [#631](https://github.com/visulima/visulima/issues/631) [#631](https://github.com/visulima/visulima/issues/631) [yarnpkg/berry#6991](https://github.com/yarnpkg/berry/issues/6991)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))
* **tests:** revert unsafe vitest autofixes from the lint sweep ([378f27c](https://github.com/visulima/visulima/commit/378f27caa370f1d3188aef2ed36d46839abc88c4))
* **vis-mcp:** 1 bug fix ([33cd25e](https://github.com/visulima/visulima/commit/33cd25ecbcea0185e4cab1e3d49ba0fd41206d67))
* **vis:** unbreak full build — exclude variable-import modules from dynamic-import-vars ([#712](https://github.com/visulima/visulima/issues/712)) ([29d46eb](https://github.com/visulima/visulima/commit/29d46eb719de11ab8f09e5303748264607b04fe3)), closes [#697](https://github.com/visulima/visulima/issues/697) [#697](https://github.com/visulima/visulima/issues/697) [#697](https://github.com/visulima/visulima/issues/697) [#697](https://github.com/visulima/visulima/issues/697)

### Miscellaneous Chores

* add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))
* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))
* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **release:** @visulima/vis-mcp@1.0.0-alpha.1 [skip ci]\n\n## @visulima/vis-mcp 1.0.0-alpha.1 (2026-05-04) ([4bea1b6](https://github.com/visulima/visulima/commit/4bea1b639140431c9fa25656d4a2225ddb1073d1))
* **release:** @visulima/vis-mcp@1.0.0-alpha.10 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.9...@visulima/vis-mcp@1.0.0-alpha.10) (2026-05-14) ([aa118b9](https://github.com/visulima/visulima/commit/aa118b9acab23ace6523bc1b1b6ed2b5b5c4b69f))
* **release:** @visulima/vis-mcp@1.0.0-alpha.11 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.10...@visulima/vis-mcp@1.0.0-alpha.11) (2026-05-16) ([e1c0f42](https://github.com/visulima/visulima/commit/e1c0f42676885a1ae0dbe867f2d3750ea2b60816))
* **release:** @visulima/vis-mcp@1.0.0-alpha.12 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.11...@visulima/vis-mcp@1.0.0-alpha.12) (2026-05-19) ([df08589](https://github.com/visulima/visulima/commit/df085896065d7ee11b0ac48119cbc4d18542bce2))
* **release:** @visulima/vis-mcp@1.0.0-alpha.13 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.12...@visulima/vis-mcp@1.0.0-alpha.13) (2026-05-20) ([6ac5046](https://github.com/visulima/visulima/commit/6ac50469ba4193756ce27e60010bf7725dd214e9))
* **release:** @visulima/vis-mcp@1.0.0-alpha.14 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.13...@visulima/vis-mcp@1.0.0-alpha.14) (2026-05-26) ([a816f32](https://github.com/visulima/visulima/commit/a816f32ca84ad91e6a36fa852453dfdb095e218c))
* **release:** @visulima/vis-mcp@1.0.0-alpha.15 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.15](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.14...@visulima/vis-mcp@1.0.0-alpha.15) (2026-05-27) ([8c626df](https://github.com/visulima/visulima/commit/8c626df8cfe37b190c7199446012be356b380dbb))
* **release:** @visulima/vis-mcp@1.0.0-alpha.16 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.16](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.15...@visulima/vis-mcp@1.0.0-alpha.16) (2026-05-29) ([7f98d00](https://github.com/visulima/visulima/commit/7f98d002e55a7c70f70ef4648bc6622bb4bb2686))
* **release:** @visulima/vis-mcp@1.0.0-alpha.17 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.17](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.16...@visulima/vis-mcp@1.0.0-alpha.17) (2026-06-02) ([5e112bb](https://github.com/visulima/visulima/commit/5e112bbcfc982bafa6a18d38916d172dbe209717))
* **release:** @visulima/vis-mcp@1.0.0-alpha.18 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.18](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.17...@visulima/vis-mcp@1.0.0-alpha.18) (2026-06-03) ([8cb3d99](https://github.com/visulima/visulima/commit/8cb3d990a30e5765f52b2a558064c7e2cd29d759))
* **release:** @visulima/vis-mcp@1.0.0-alpha.19 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.19](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.18...@visulima/vis-mcp@1.0.0-alpha.19) (2026-06-04) ([8210e8c](https://github.com/visulima/visulima/commit/8210e8cad57916e4b8736dcb95e640a40dda713f))
* **release:** @visulima/vis-mcp@1.0.0-alpha.2 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.1...@visulima/vis-mcp@1.0.0-alpha.2) (2026-05-06) ([fcf91fa](https://github.com/visulima/visulima/commit/fcf91fa4c22cf3314b57bd45a28e67281351e65d))
* **release:** @visulima/vis-mcp@1.0.0-alpha.20 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.20](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.19...@visulima/vis-mcp@1.0.0-alpha.20) (2026-06-04) ([7000c46](https://github.com/visulima/visulima/commit/7000c4608e54de019a93562c2255c96fca1afb7d))
* **release:** @visulima/vis-mcp@1.0.0-alpha.21 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.21](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.20...@visulima/vis-mcp@1.0.0-alpha.21) (2026-06-06) ([3abc667](https://github.com/visulima/visulima/commit/3abc66722bea0d69730b60bec445cd1e2b9ae948))
* **release:** @visulima/vis-mcp@1.0.0-alpha.22 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.22](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.21...@visulima/vis-mcp@1.0.0-alpha.22) (2026-06-07) ([3062334](https://github.com/visulima/visulima/commit/306233441335f5e36b6ffc386f9233c98b529631))
* **release:** @visulima/vis-mcp@1.0.0-alpha.23 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.23](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.22...@visulima/vis-mcp@1.0.0-alpha.23) (2026-06-07) ([9262893](https://github.com/visulima/visulima/commit/92628936ed49da4277a06ffea13163f87278cbd2))
* **release:** @visulima/vis-mcp@1.0.0-alpha.24 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.24](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.23...@visulima/vis-mcp@1.0.0-alpha.24) (2026-06-08) ([8f8c3dc](https://github.com/visulima/visulima/commit/8f8c3dcedab8d80818a07b35642f09b1791801ed))
* **release:** @visulima/vis-mcp@1.0.0-alpha.25 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.25](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.24...@visulima/vis-mcp@1.0.0-alpha.25) (2026-06-09) ([fd66314](https://github.com/visulima/visulima/commit/fd6631451ed09ec1096800d06f09bd3d70e609f6))
* **release:** @visulima/vis-mcp@1.0.0-alpha.26 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.26](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.25...@visulima/vis-mcp@1.0.0-alpha.26) (2026-06-13) ([9bcbaa2](https://github.com/visulima/visulima/commit/9bcbaa2ab0334786180881c36d85cad6782f715d))
* **release:** @visulima/vis-mcp@1.0.0-alpha.27 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.27](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.26...@visulima/vis-mcp@1.0.0-alpha.27) (2026-06-15) ([13222ff](https://github.com/visulima/visulima/commit/13222ffedbc93110bc557e9574470d9d2076490b))
* **release:** @visulima/vis-mcp@1.0.0-alpha.28 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.28](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.27...@visulima/vis-mcp@1.0.0-alpha.28) (2026-06-16) ([41bbb5f](https://github.com/visulima/visulima/commit/41bbb5f5aaf36382dfeb5dcf97565c23dfceb3ac))
* **release:** @visulima/vis-mcp@1.0.0-alpha.29 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.29](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.28...@visulima/vis-mcp@1.0.0-alpha.29) (2026-06-16) ([6b911f6](https://github.com/visulima/visulima/commit/6b911f682352b8c3cea5f589f9e11c336c4192ce))
* **release:** @visulima/vis-mcp@1.0.0-alpha.3 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.2...@visulima/vis-mcp@1.0.0-alpha.3) (2026-05-06) ([30cfcda](https://github.com/visulima/visulima/commit/30cfcdabff162902ed53e018420f53967c6d2d9a))
* **release:** @visulima/vis-mcp@1.0.0-alpha.30 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.30](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.29...@visulima/vis-mcp@1.0.0-alpha.30) (2026-06-17) ([ba5f8d2](https://github.com/visulima/visulima/commit/ba5f8d261ab2f0907ae0a8e46f54c0217205bf0e))
* **release:** @visulima/vis-mcp@1.0.0-alpha.31 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.31](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.30...@visulima/vis-mcp@1.0.0-alpha.31) (2026-06-19) ([ec79624](https://github.com/visulima/visulima/commit/ec7962425122ed9cbd534a159da1909fc290da0b))
* **release:** @visulima/vis-mcp@1.0.0-alpha.32 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.32](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.31...@visulima/vis-mcp@1.0.0-alpha.32) (2026-06-19) ([581a6ef](https://github.com/visulima/visulima/commit/581a6ef35da1471486c6f8e1f63603a5b29d4e8e))
* **release:** @visulima/vis-mcp@1.0.0-alpha.33 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.33](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.32...@visulima/vis-mcp@1.0.0-alpha.33) (2026-06-20) ([d23610f](https://github.com/visulima/visulima/commit/d23610f925906eae32512f8cece804d6d17e980c))
* **release:** @visulima/vis-mcp@1.0.0-alpha.34 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.34](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.33...@visulima/vis-mcp@1.0.0-alpha.34) (2026-06-23) ([a90381f](https://github.com/visulima/visulima/commit/a90381f477ffb2638ac37a7cdfc6bb25a28d89be))
* **release:** @visulima/vis-mcp@1.0.0-alpha.35 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.35](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.34...@visulima/vis-mcp@1.0.0-alpha.35) (2026-06-30) ([a4ccaf6](https://github.com/visulima/visulima/commit/a4ccaf66eba5dbd6e81567e369c2bed6902ad8ff))
* **release:** @visulima/vis-mcp@1.0.0-alpha.36 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.36](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.35...@visulima/vis-mcp@1.0.0-alpha.36) (2026-07-01) ([beca008](https://github.com/visulima/visulima/commit/beca00876cd9282fb703063c3074e6ea8843af85))
* **release:** @visulima/vis-mcp@1.0.0-alpha.37 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.37](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.36...@visulima/vis-mcp@1.0.0-alpha.37) (2026-07-03) ([105c996](https://github.com/visulima/visulima/commit/105c996f6433c5609bdbeb7b045508a8da5acda5))
* **release:** @visulima/vis-mcp@1.0.0-alpha.4 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.3...@visulima/vis-mcp@1.0.0-alpha.4) (2026-05-07) ([1783ff4](https://github.com/visulima/visulima/commit/1783ff4dfcdfa2930876d1a21ebc4494fa25e26d))
* **release:** @visulima/vis-mcp@1.0.0-alpha.5 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.4...@visulima/vis-mcp@1.0.0-alpha.5) (2026-05-07) ([11fdc83](https://github.com/visulima/visulima/commit/11fdc83848f17c272730dc8f4dc87270f78d434c))
* **release:** @visulima/vis-mcp@1.0.0-alpha.6 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.5...@visulima/vis-mcp@1.0.0-alpha.6) (2026-05-10) ([94bb50c](https://github.com/visulima/visulima/commit/94bb50cb28bf9a4d0630d7da703f9c09de17b1f3))
* **release:** @visulima/vis-mcp@1.0.0-alpha.7 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.6...@visulima/vis-mcp@1.0.0-alpha.7) (2026-05-10) ([299de51](https://github.com/visulima/visulima/commit/299de51d78febde7024b30ce8242703b75fb06b4))
* **release:** @visulima/vis-mcp@1.0.0-alpha.8 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.7...@visulima/vis-mcp@1.0.0-alpha.8) (2026-05-11) ([de533a9](https://github.com/visulima/visulima/commit/de533a9dd9f32d2dc90d2f8a9f322fc950f1eaaf))
* **release:** @visulima/vis-mcp@1.0.0-alpha.9 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.8...@visulima/vis-mcp@1.0.0-alpha.9) (2026-05-11) ([308df7f](https://github.com/visulima/visulima/commit/308df7f556442ff017635a31f4fc19326c7efec7))
* **repo:** apply eslint --fix and prettier --fix across packages ([#650](https://github.com/visulima/visulima/issues/650)) ([2e26a84](https://github.com/visulima/visulima/commit/2e26a84774f218f21345e9a8ecd68236b6542743)), closes [#620](https://github.com/visulima/visulima/issues/620)
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))
* **vis-mcp:** adopt zod v4 catalog and bump @modelcontextprotocol/sdk ([a84ceb1](https://github.com/visulima/visulima/commit/a84ceb1efcfb368c361eb738006f2e7f113ac4c7))
* **vis-mcp:** bump eslint-plugin-zod and sort package.json keys ([787abc4](https://github.com/visulima/visulima/commit/787abc46e1b637fdb8968a492cd923537e404fbe))
* **vis-mcp:** housekeeping cleanup ([947eff5](https://github.com/visulima/visulima/commit/947eff503b5e170194f7f8e21bea2ab82b0786bf))

### Code Refactoring

* **vis-mcp:** reformat source and README for prettier line-length ([5b41e65](https://github.com/visulima/visulima/commit/5b41e65dceb622cecf554b938261fb7c550a47bd))

### Tests

* improve coverage across packages ([91bd6d3](https://github.com/visulima/visulima/commit/91bd6d3b61736e3c8bd1fc59b0b5955f76a5d323))
* **repo:** cover bin entry points in dist integration suite ([7479ef1](https://github.com/visulima/visulima/commit/7479ef113cf5ccef25692619082afb1b6a0eecab))
* **vis-mcp:** assert error payloads are strings ([cf18663](https://github.com/visulima/visulima/commit/cf1866327423e77b6a99d6e6e41ebc9f10995dc2))
* **vis-mcp:** cover cli-failure catch paths, resolveVisBin fallback, and version/exec edge branches ([a46fa08](https://github.com/visulima/visulima/commit/a46fa08c991ceeab1e5d4ae575768581aba7bdec))

### Build System

* **deps:** update vis-mcp dependencies ([5f27664](https://github.com/visulima/visulima/commit/5f2766405b74001dee44f90722e65608a71434ac))

### Continuous Integration

* **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0
* **@visulima/path:** upgraded to 3.0.0
* **@visulima/vis:** upgraded to 1.0.0

## @visulima/vis-mcp [1.0.0-alpha.37](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.36...@visulima/vis-mcp@1.0.0-alpha.37) (2026-07-03)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.47

## @visulima/vis-mcp [1.0.0-alpha.36](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.35...@visulima/vis-mcp@1.0.0-alpha.36) (2026-07-01)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.46

## @visulima/vis-mcp [1.0.0-alpha.35](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.34...@visulima/vis-mcp@1.0.0-alpha.35) (2026-06-30)

### Miscellaneous Chores

* add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))

### Continuous Integration

* **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.33
* **@visulima/vis:** upgraded to 1.0.0-alpha.45

## @visulima/vis-mcp [1.0.0-alpha.34](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.33...@visulima/vis-mcp@1.0.0-alpha.34) (2026-06-23)

### Bug Fixes

* **vis:** unbreak full build — exclude variable-import modules from dynamic-import-vars ([#712](https://github.com/visulima/visulima/issues/712)) ([29d46eb](https://github.com/visulima/visulima/commit/29d46eb719de11ab8f09e5303748264607b04fe3)), closes [#697](https://github.com/visulima/visulima/issues/697) [#697](https://github.com/visulima/visulima/issues/697) [#697](https://github.com/visulima/visulima/issues/697) [#697](https://github.com/visulima/visulima/issues/697)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.44

## @visulima/vis-mcp [1.0.0-alpha.33](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.32...@visulima/vis-mcp@1.0.0-alpha.33) (2026-06-20)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.43

## @visulima/vis-mcp [1.0.0-alpha.32](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.31...@visulima/vis-mcp@1.0.0-alpha.32) (2026-06-19)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.42

## @visulima/vis-mcp [1.0.0-alpha.31](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.30...@visulima/vis-mcp@1.0.0-alpha.31) (2026-06-19)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.41

## @visulima/vis-mcp [1.0.0-alpha.30](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.29...@visulima/vis-mcp@1.0.0-alpha.30) (2026-06-17)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.40

## @visulima/vis-mcp [1.0.0-alpha.29](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.28...@visulima/vis-mcp@1.0.0-alpha.29) (2026-06-16)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.39

## @visulima/vis-mcp [1.0.0-alpha.28](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.27...@visulima/vis-mcp@1.0.0-alpha.28) (2026-06-16)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.38

## @visulima/vis-mcp [1.0.0-alpha.27](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.26...@visulima/vis-mcp@1.0.0-alpha.27) (2026-06-15)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.37

## @visulima/vis-mcp [1.0.0-alpha.26](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.25...@visulima/vis-mcp@1.0.0-alpha.26) (2026-06-13)

### Features

* **vis-mcp:** add audit/advisory/lint/fmt/list_runs tools and structured output ([4918e4b](https://github.com/visulima/visulima/commit/4918e4bb176508065bc8a578141beb79316c530d))

### Code Refactoring

* **vis-mcp:** reformat source and README for prettier line-length ([5b41e65](https://github.com/visulima/visulima/commit/5b41e65dceb622cecf554b938261fb7c550a47bd))

### Tests

* **vis-mcp:** assert error payloads are strings ([cf18663](https://github.com/visulima/visulima/commit/cf1866327423e77b6a99d6e6e41ebc9f10995dc2))

### Build System

* **deps:** update vis-mcp dependencies ([5f27664](https://github.com/visulima/visulima/commit/5f2766405b74001dee44f90722e65608a71434ac))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.32
* **@visulima/path:** upgraded to 3.0.0-alpha.13
* **@visulima/vis:** upgraded to 1.0.0-alpha.36

## @visulima/vis-mcp [1.0.0-alpha.25](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.24...@visulima/vis-mcp@1.0.0-alpha.25) (2026-06-09)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.35

## @visulima/vis-mcp [1.0.0-alpha.24](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.23...@visulima/vis-mcp@1.0.0-alpha.24) (2026-06-08)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.34

## @visulima/vis-mcp [1.0.0-alpha.23](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.22...@visulima/vis-mcp@1.0.0-alpha.23) (2026-06-07)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.33

## @visulima/vis-mcp [1.0.0-alpha.22](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.21...@visulima/vis-mcp@1.0.0-alpha.22) (2026-06-07)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.32

## @visulima/vis-mcp [1.0.0-alpha.21](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.20...@visulima/vis-mcp@1.0.0-alpha.21) (2026-06-06)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.31

## @visulima/vis-mcp [1.0.0-alpha.20](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.19...@visulima/vis-mcp@1.0.0-alpha.20) (2026-06-04)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.31
* **@visulima/vis:** upgraded to 1.0.0-alpha.30

## @visulima/vis-mcp [1.0.0-alpha.19](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.18...@visulima/vis-mcp@1.0.0-alpha.19) (2026-06-04)

### Bug Fixes

* **vis-mcp:** 1 bug fix ([33cd25e](https://github.com/visulima/visulima/commit/33cd25ecbcea0185e4cab1e3d49ba0fd41206d67))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.30
* **@visulima/path:** upgraded to 3.0.0-alpha.12
* **@visulima/vis:** upgraded to 1.0.0-alpha.29

## @visulima/vis-mcp [1.0.0-alpha.18](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.17...@visulima/vis-mcp@1.0.0-alpha.18) (2026-06-03)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.28

## @visulima/vis-mcp [1.0.0-alpha.17](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.16...@visulima/vis-mcp@1.0.0-alpha.17) (2026-06-02)

### Features

* **vis:** lint + fmt orchestrator ([3a78ed7](https://github.com/visulima/visulima/commit/3a78ed709922e6a35648e0d0eb3f41cc49f89b7a))

### Bug Fixes

* **tests:** revert unsafe vitest autofixes from the lint sweep ([378f27c](https://github.com/visulima/visulima/commit/378f27caa370f1d3188aef2ed36d46839abc88c4))

### Miscellaneous Chores

* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))

### Tests

* **vis-mcp:** cover cli-failure catch paths, resolveVisBin fallback, and version/exec edge branches ([a46fa08](https://github.com/visulima/visulima/commit/a46fa08c991ceeab1e5d4ae575768581aba7bdec))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.29
* **@visulima/vis:** upgraded to 1.0.0-alpha.27

## @visulima/vis-mcp [1.0.0-alpha.16](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.15...@visulima/vis-mcp@1.0.0-alpha.16) (2026-05-29)

### Tests

* improve coverage across packages ([91bd6d3](https://github.com/visulima/visulima/commit/91bd6d3b61736e3c8bd1fc59b0b5955f76a5d323))


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.26

## @visulima/vis-mcp [1.0.0-alpha.15](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.14...@visulima/vis-mcp@1.0.0-alpha.15) (2026-05-27)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Miscellaneous Chores

* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.28
* **@visulima/path:** upgraded to 3.0.0-alpha.11
* **@visulima/vis:** upgraded to 1.0.0-alpha.25

## @visulima/vis-mcp [1.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.13...@visulima/vis-mcp@1.0.0-alpha.14) (2026-05-26)

### Miscellaneous Chores

* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **repo:** apply eslint --fix and prettier --fix across packages ([#650](https://github.com/visulima/visulima/issues/650)) ([2e26a84](https://github.com/visulima/visulima/commit/2e26a84774f218f21345e9a8ecd68236b6542743)), closes [#620](https://github.com/visulima/visulima/issues/620)

### Tests

* **repo:** cover bin entry points in dist integration suite ([7479ef1](https://github.com/visulima/visulima/commit/7479ef113cf5ccef25692619082afb1b6a0eecab))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.26
* **@visulima/vis:** upgraded to 1.0.0-alpha.24

## @visulima/vis-mcp [1.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.12...@visulima/vis-mcp@1.0.0-alpha.13) (2026-05-20)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.25
* **@visulima/vis:** upgraded to 1.0.0-alpha.23

## @visulima/vis-mcp [1.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.11...@visulima/vis-mcp@1.0.0-alpha.12) (2026-05-19)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.24
* **@visulima/vis:** upgraded to 1.0.0-alpha.22

## @visulima/vis-mcp [1.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.10...@visulima/vis-mcp@1.0.0-alpha.11) (2026-05-16)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.23
* **@visulima/vis:** upgraded to 1.0.0-alpha.21

## @visulima/vis-mcp [1.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.9...@visulima/vis-mcp@1.0.0-alpha.10) (2026-05-14)

### ⚠ BREAKING CHANGES

* **vis:** the following security.* keys were renamed:
- security.minimumReleaseAge          -> security.policies.first_seen.minutes
- security.minimumReleaseAgeExclude   -> security.policies.first_seen.exclude
- security.trustPolicy                -> security.policies.publisher_change.mode
- security.trustPolicyExclude         -> security.policies.publisher_change.exclude
- security.trustPolicyIgnoreAfter     -> security.policies.publisher_change.ignoreAfter
- security.allowBuilds                -> security.policies.install_scripts.allow
- security.strictDepBuilds            -> security.policies.install_scripts.strict
- security.socket.minimumScore        -> security.policies.score.minimum
- security.socket.acceptedRisks       -> security.acceptedRisks
- security.audit.failOn               -> security.policies.vulnerability.failOn
- security.audit.usage                -> security.policies.vulnerability.usage

AcceptedRisk now carries optional policies[] and expiresAt fields so
risks can be scoped per-policy and time-boxed. Native PM sync writers
keep emitting pnpm-native field names since pnpm owns that schema.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* chore(vis): address coderabbit review feedback

- Add JSDoc to exported items across hook builtins, advisories, audit, docker
- Document OSV `last_affected` inclusive-upper semantics with a focused test
- Annotate NAPI u64→u32 truncations with JS Number range rationale
- Switch vis-mcp tool payloads to zod schemas with `.catchall(z.unknown())`
  so unknown CLI fields stay forward-compatible
- Fence RFC code blocks with explicit languages and tidy hook-command
  formatting (multi-line type, implicit-return arrows)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* chore(vis): address second-round coderabbit feedback on policies rename

- Drift report labels now reference `security.policies.*` paths so the
  hint matches the keys users edit
- `defineConfig` JSDoc examples use the new `security.policies` shape
- `mergeSecurityDefaults` deep-merges every defaulted sub-policy
  generically; `mergeVisConfigs` deep-merges `policies` and
  `acceptedRisks` so presets aren't clobbered
- Config-writer scopes its `allow:` match to follow an
  `install_scripts:` opener
- JSDoc clarifications for `audit.advisories.source` default,
  `acceptedRisks.expiresAt`/`acceptedScore` ranges, `malware.mode`
  cross-field default, and the current `policies.score.minimum`
  wiring gap

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* chore(vis): finish coderabbit round-2 fixes — camelCase policies + wire score.minimum

- Rename `PolicyName` union to camelCase (`firstSeen`, `installScripts`,
  `publisherChange`, `unexpectedDeps`). Updates every consumer in src/,
  test fixtures, schemas, and docs. JSON schema regenerated.
- Add `types` mapping to the `#native` package.json import so TypeScript
  resolves `index.d.ts` when consumers import the alias.
- Thread `socketOptions.minimumScore` through `audit`, `doctor`, `check`,
  `update`, `add`, `formatSecurityOverview`, `formatSummary`, and
  `applyFilter`. `buildSocketOptions` now resolves the effective minimum
  once (from `security.policies.score.minimum` or
  `DEFAULT_LOW_SCORE_THRESHOLD`) so every consumer sees the same value
  instead of comparing scores against the hard-coded constant.
- Update the JSDoc on `policies.score.minimum` to reflect the new wiring.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* feat(vis): add Socket-style policy engine with 4 offline-clean policies

Introduce a unified `evaluatePolicies()` engine under `src/security/policies/`
with four offline-clean modules: license, install_scripts, vulnerability,
and unexpected_deps (baseline mode). Each policy emits PolicyDecisions
(block/warn/info) keyed by package, with per-policy accepted-risk scoping
and expiresAt support reused from the shared matcher.

Wires the engine into `vis audit`: a new `--policies <names>` flag
(comma-list, `all`, or `none`) narrows evaluation. Block-severity
decisions feed into `--exit-code` and `--fail-on`. JSON output gains
`policies[]` + `summary.policyBlocks`. SARIF and HTML formatters render
policy decisions alongside vulnerabilities; CSAF and CycloneDX-VEX are
intentionally left untouched (vuln-specific data models).

Adds `readNodeModulesManifests()` to walk `node_modules/` (including the
pnpm `.pnpm/` content-addressed store) and surface license + scripts +
maintainers metadata for the offline policies.

33 new unit + integration tests; full vitest suite (3582/3582) green;
`tsc --noEmit` clean.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* fix(vis): close three audit policy gating gaps surfaced by CodeRabbit

- applyExitGate's fallthrough call to applyFailOnGate was dropping the
  policyDecisions argument, so `vis audit --format sarif --fail-on high`
  exited 0 when the only signal was a block-severity policy decision.
  Forward the argument.
- Unknown --policies tokens were silently swallowed when format was
  json/sarif/csaf/cyclonedx-vex, so a typoed CI invocation reduced
  enforcement with no log. Always emit the warning to stderr and
  surface the tokens in JSON output as `warnings[]`.
- Vulnerability-policy block decisions whose advisory was masked by
  --severity used to exit 1 with no visible reason. Surface those
  decisions in the human-readable "Policy Decisions" section so the
  gate is always traceable.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* fix(vis): correct npm/yarn min-release-age native config writers

npm CLI types `min-release-age` as `Number` in days, not a duration string —
vis wrote `48h`/`15m`, which npm's parseInt would silently read as 48/15 days.
Write integer days rounded up so the native gate is never weaker than vis-config.

Yarn Berry silently treats day suffixes in `npmMinimalAgeGate` as minutes

### Features

* **vis:** offline OSV scanner + unified security.policies ([#632](https://github.com/visulima/visulima/issues/632)) ([6461902](https://github.com/visulima/visulima/commit/646190243bf51bb6df172665d70fd501644e7bc3)), closes [#631](https://github.com/visulima/visulima/issues/631) [#631](https://github.com/visulima/visulima/issues/631) [yarnpkg/berry#6991](https://github.com/yarnpkg/berry/issues/6991)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.22
* **@visulima/vis:** upgraded to 1.0.0-alpha.20

## @visulima/vis-mcp [1.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.8...@visulima/vis-mcp@1.0.0-alpha.9) (2026-05-11)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.21
* **@visulima/vis:** upgraded to 1.0.0-alpha.19

## @visulima/vis-mcp [1.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.7...@visulima/vis-mcp@1.0.0-alpha.8) (2026-05-11)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.20
* **@visulima/vis:** upgraded to 1.0.0-alpha.18

## @visulima/vis-mcp [1.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.6...@visulima/vis-mcp@1.0.0-alpha.7) (2026-05-10)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.19
* **@visulima/vis:** upgraded to 1.0.0-alpha.17

## @visulima/vis-mcp [1.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.5...@visulima/vis-mcp@1.0.0-alpha.6) (2026-05-10)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.18
* **@visulima/vis:** upgraded to 1.0.0-alpha.16

## @visulima/vis-mcp [1.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.4...@visulima/vis-mcp@1.0.0-alpha.5) (2026-05-07)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.17
* **@visulima/vis:** upgraded to 1.0.0-alpha.15

## @visulima/vis-mcp [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.3...@visulima/vis-mcp@1.0.0-alpha.4) (2026-05-07)

### Miscellaneous Chores

* **vis-mcp:** bump eslint-plugin-zod and sort package.json keys ([787abc4](https://github.com/visulima/visulima/commit/787abc46e1b637fdb8968a492cd923537e404fbe))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.16
* **@visulima/vis:** upgraded to 1.0.0-alpha.14

## @visulima/vis-mcp [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.2...@visulima/vis-mcp@1.0.0-alpha.3) (2026-05-06)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.15
* **@visulima/vis:** upgraded to 1.0.0-alpha.13

## @visulima/vis-mcp [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.1...@visulima/vis-mcp@1.0.0-alpha.2) (2026-05-06)

### Miscellaneous Chores

* **vis-mcp:** housekeeping cleanup ([947eff5](https://github.com/visulima/visulima/commit/947eff503b5e170194f7f8e21bea2ab82b0786bf))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.14
* **@visulima/vis:** upgraded to 1.0.0-alpha.12

## @visulima/vis-mcp 1.0.0-alpha.1 (2026-05-04)

### Features

* **vis-mcp:** add list_templates and describe_template tools ([549ea7e](https://github.com/visulima/visulima/commit/549ea7edbe88e3dde40e09cf5f5eaea80bb8fd58))
* **vis-mcp:** add MCP server package for AI-agent integration ([a8d5022](https://github.com/visulima/visulima/commit/a8d5022ba905481985378c0ac01e7f654608ec2b))

### Miscellaneous Chores

* **vis-mcp:** adopt zod v4 catalog and bump @modelcontextprotocol/sdk ([a84ceb1](https://github.com/visulima/visulima/commit/a84ceb1efcfb368c361eb738006f2e7f113ac4c7))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.13
* **@visulima/vis:** upgraded to 1.0.0-alpha.11
