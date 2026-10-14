## @visulima/task-runner [2.0.0](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.1.0...@visulima/task-runner@2.0.0) (2026-10-14)

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

## @visulima/task-runner [1.1.0](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.6...@visulima/task-runner@1.1.0) (2026-10-09)

### Features

* **vis:** add affectedIgnore config option ([#937](https://github.com/visulima/visulima/issues/937)) ([3576acb](https://github.com/visulima/visulima/commit/3576acbf523007b0244815f34ca7e309f69396b7))

### Build System

* **deps:** combine open Dependabot dependency updates ([#926](https://github.com/visulima/visulima/issues/926)) ([1f276d6](https://github.com/visulima/visulima/commit/1f276d60e2b0c08059ccccfc9b7c8e5bd61f8c7c))

### Continuous Integration

* **cargo-test:** gate clippy and record fat-lto evidence ([#929](https://github.com/visulima/visulima/issues/929)) ([fb6bef8](https://github.com/visulima/visulima/commit/fb6bef801299981ae74b62f531c0254d5c710112))
* **task-runner,vis:** track native criterion benches on CodSpeed ([#866](https://github.com/visulima/visulima/issues/866)) ([846be71](https://github.com/visulima/visulima/commit/846be71ace30bc4e69b7458418dfa4a440f9f97b))

## @visulima/task-runner [1.0.6](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.5...@visulima/task-runner@1.0.6) (2026-09-03)

### Bug Fixes

* stop vis ci, cache, preflight and inference failing silently ([#854](https://github.com/visulima/visulima/issues/854)) ([45a97b0](https://github.com/visulima/visulima/commit/45a97b02684c8336662f23a3f2cd2f7227c14692))

## @visulima/task-runner [1.0.5](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.4...@visulima/task-runner@1.0.5) (2026-08-19)

### Bug Fixes

* restore commit groups in generated changelogs ([#850](https://github.com/visulima/visulima/issues/850)) ([409ff00](https://github.com/visulima/visulima/commit/409ff0034963eb2ec9ac1b7e85d52916fc1a661f))

### Build System

* **deps:** refresh catalog and package manifests ([#832](https://github.com/visulima/visulima/issues/832)) ([9b7590d](https://github.com/visulima/visulima/commit/9b7590d6496e633ba2c0681484ae4497eeb824c9))

## @visulima/task-runner [1.0.4](https://github.com/visulima/visulima/compare/%40visulima%2Ftask-runner%401.0.3...%40visulima%2Ftask-runner%401.0.4) (2026-08-08)


### Dependencies

* **@visulima/humanizer:** upgraded to 4.0.0
* **@visulima/path:** upgraded to 4.0.0

## @visulima/task-runner [1.0.3](https://github.com/visulima/visulima/compare/%40visulima%2Ftask-runner%401.0.2...%40visulima%2Ftask-runner%401.0.3) (2026-08-02)


### Dependencies

* **@visulima/humanizer:** upgraded to 3.1.0
* **@visulima/path:** upgraded to 3.1.0

## @visulima/task-runner [1.0.2](https://github.com/visulima/visulima/compare/%40visulima%2Ftask-runner%401.0.1...%40visulima%2Ftask-runner%401.0.2) (2026-07-27)

## @visulima/task-runner [1.0.1](https://github.com/visulima/visulima/compare/%40visulima%2Ftask-runner%401.0.0...%40visulima%2Ftask-runner%401.0.1) (2026-07-17)


### Dependencies

* **@visulima/humanizer:** upgraded to 3.0.1

## @visulima/task-runner 1.0.0 (2026-07-03)

### Features

* Add @visulima/task-runner , vis and find-ai-runner ([#594](https://github.com/visulima/visulima/issues/594)) ([034b5db](https://github.com/visulima/visulima/commit/034b5db8aadcc02e23abe007208c5196859c7755))
* Add comprehensive workspace configuration and command infrastructure ([#609](https://github.com/visulima/visulima/issues/609)) ([f4347bf](https://github.com/visulima/visulima/commit/f4347bfdcdd1b228cd9d842a927e446aaf23f035))
* Add native Rust bindings for package manager operations ([#596](https://github.com/visulima/visulima/issues/596)) ([2ec22d0](https://github.com/visulima/visulima/commit/2ec22d023eade3fed67fb811696fbd8f7b52569d))
* add service and tool projectType variants ([61858ad](https://github.com/visulima/visulima/commit/61858ad4c044b5f30318f282615c83f716667053)), closes [#21](https://github.com/visulima/visulima/issues/21)
* **task-runner, vis:** project constraints, CI partitioning, affected scopes ([29295e9](https://github.com/visulima/visulima/commit/29295e989ecdfe2019469d1917a6c90a92e17bcf))
* **task-runner,vis:** cache restoration fidelity ([a15cb22](https://github.com/visulima/visulima/commit/a15cb22bde832cfe76ee017722b8b9f9102dac8f))
* **task-runner,vis:** per-task pty + concurrency weight, abort cache gate, fspy scaffolds ([#656](https://github.com/visulima/visulima/issues/656)) ([ca64010](https://github.com/visulima/visulima/commit/ca64010b236903e08273680ea65dec7046fcd18b))
* **task-runner:** add concurrent process runner with Rust NAPI bindings ([c4f5d93](https://github.com/visulima/visulima/commit/c4f5d930e81a5eb641ceb3ab925c3b10a885bb6a))
* **task-runner:** add import-level boundary checking ([#694](https://github.com/visulima/visulima/issues/694)) ([7ad9817](https://github.com/visulima/visulima/commit/7ad9817ce3b5c1d95f54db025da114b8e21a0330))
* **task-runner:** add onRetry + onFingerprint hooks ([7e9dadf](https://github.com/visulima/visulima/commit/7e9dadfbe7101fd9b2878eb881d16c3ff5d766ac))
* **task-runner:** add per-target maxConcurrent and workspace concurrencyGroups ([985d5d1](https://github.com/visulima/visulima/commit/985d5d1d3a594f3b42cfa3f7735bc1bb8055563e))
* **task-runner:** add REAPI gRPC backend, cacheMode, and cache doctor ([03e6da9](https://github.com/visulima/visulima/commit/03e6da97beb84f6adc4a07a1c7ca4acf28be3b33))
* **task-runner:** add resolveTurboEnvCompat helper ([a8e73ef](https://github.com/visulima/visulima/commit/a8e73ef324dd8d1bc1f1f471f59f9292f9f01745))
* **task-runner:** add URI-based input format ([050b583](https://github.com/visulima/visulima/commit/050b5838c15590a3ccba0ca99ad585cbabc36d99))
* **task-runner:** allow embedders to override the data directory ([904875a](https://github.com/visulima/visulima/commit/904875a15751c57ebafa9c137fd11c2ade1a4b6a))
* **task-runner:** auto-capture outputs for compound build scripts ([e084434](https://github.com/visulima/visulima/commit/e0844344cf184177999a82b708299f08fbfd31ec))
* **task-runner:** expose worktree detection napi bindings ([3d67028](https://github.com/visulima/visulima/commit/3d670284090010616956a024a4e5465ee91bbcd4))
* **task-runner:** graceful Ctrl+Break on Windows SIGINT ([ae44b1c](https://github.com/visulima/visulima/commit/ae44b1c855839746092a91430eb49b216d1172ec))
* **task-runner:** output globs, auto-writes, parallel cache IO ([137f53f](https://github.com/visulima/visulima/commit/137f53f7f5a4d8c16df511c9d145b2c158025a32))
* **task-runner:** per-target hashMode "trace" opt-in ([#643](https://github.com/visulima/visulima/issues/643)) ([32353ff](https://github.com/visulima/visulima/commit/32353ff7a760ae9486e23cc4042fab46a2f2cc11))
* **task-runner:** require native addon, hard-fail on load failure ([a52dc4d](https://github.com/visulima/visulima/commit/a52dc4db71ca1f476f78b88625bb2ae7b0ddf932))
* **task-runner:** skip-on-warning incrementality ([2c79ab3](https://github.com/visulima/visulima/commit/2c79ab35d0513bf4e60f87d1ac3bc4e99296cb62)), closes [#22](https://github.com/visulima/visulima/issues/22) [rushstack#1402](https://github.com/visulima/rushstack/issues/1402)
* **task-runner:** surface native addon fallback loudly ([fd6e9d0](https://github.com/visulima/visulima/commit/fd6e9d045d9480e0e49a5d2aa6a240bf25a6799a))
* **task-runner:** surface native child pids for sigint cleanup ([3790bbd](https://github.com/visulima/visulima/commit/3790bbd5f88485f6c67c28548faf7a2a3791216c))
* **task-runner:** surface retryAttempts on TaskResult and TaskSummary ([f74e278](https://github.com/visulima/visulima/commit/f74e278fc98052398d46a064ad11e1c9956c9cfd))
* **task-runner:** tokens, when, and always tasks ([5ae6505](https://github.com/visulima/visulima/commit/5ae65055d97e97d7ad7ff9088996da37d964da3f))
* **task-runner:** vite-task parity + plugin-ready lifecycle hooks ([cfc7360](https://github.com/visulima/visulima/commit/cfc7360abf00524fbfc37b60df27970c325f91e1)), closes [pkg#task](https://github.com/visulima/pkg/issues/task)
* **task-runner:** warn when a cacheable task's inputs resolve to zero files ([3a4ecbb](https://github.com/visulima/visulima/commit/3a4ecbbef46b49afa4cb8b3e0b741fae0de42b3c))
* **vis:** add cache command for task runner cache ([#607](https://github.com/visulima/visulima/issues/607)) ([6752769](https://github.com/visulima/visulima/commit/67527692562b3dd9c03bb6a67c084ff1e694a560))
* **vis:** attested keyless-signed remote cache (Sigstore) ([4732610](https://github.com/visulima/visulima/commit/47326103a668ab99fcfc4e21f2c9efeaa5892944))
* **vis:** expand devcontainer command with templates, validation, and config properties ([807e730](https://github.com/visulima/visulima/commit/807e730a43f0ea644d016b4f5506706972d2ff41))
* **vis:** group CLI commands into logical categories for help output ([0a4cac8](https://github.com/visulima/visulima/commit/0a4cac859c8edf7aacdacca7b9a03219967d525a))
* **vis:** replace inline TUI with full-screen Nx-style interactive task runner ([1409aad](https://github.com/visulima/visulima/commit/1409aad879c713051bba12298a3feb1d5ba852f2))
* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

### Bug Fixes

* **ci:** make native-binding tests work with and without compiled binary ([9a40fb4](https://github.com/visulima/visulima/commit/9a40fb40d5cba9fcd2e0176eea8b7bf8d9792c7d))
* **ci:** publish native addons via local semantic-release plugin ([974beb2](https://github.com/visulima/visulima/commit/974beb2d021e7b2afc86b958bd2137be88d2f464))
* **release:** patch NAPI version-check string and ship fresh loader on release ([0676e33](https://github.com/visulima/visulima/commit/0676e336f453c9ae38c9f3a5fbbb675f9bff7ea0))
* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))
* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))
* **task-runner,tui:** guard null native events and increase CI test timeout ([e76a791](https://github.com/visulima/visulima/commit/e76a791d90043537e08be0545f706e35acaa555d))
* **task-runner:** 3 bug fixes ([ccf08a1](https://github.com/visulima/visulima/commit/ccf08a1faed664d4545b7594bba9afade782b2e5))
* **task-runner:** align NativeTaskHashDetails binding type to camelCase implicitDeps ([7d3fd91](https://github.com/visulima/visulima/commit/7d3fd91a4347e1ddd9aa926adcd578ca5fcec7d6))
* **task-runner:** atomic restoreOutputs and graceful REAPI shutdown ([a3f7088](https://github.com/visulima/visulima/commit/a3f7088c58560f9c98d9d68914ebaf0a458e319d)), closes [#inflightRpcs](https://github.com/visulima/visulima/issues/inflightRpcs) [#closeQuiescenceTimeoutMs](https://github.com/visulima/visulima/issues/closeQuiescenceTimeoutMs)
* **task-runner:** bound fspy drains so a lingering child can't hang the run ([#666](https://github.com/visulima/visulima/issues/666)) ([3f56348](https://github.com/visulima/visulima/commit/3f56348e1998b50e3b8496ce5f97a9a34932946d)), closes [vite-task#396](https://github.com/visulima/vite-task/issues/396) [vite-task#396](https://github.com/visulima/vite-task/issues/396) [vite-task#396](https://github.com/visulima/vite-task/issues/396) [vite-task#396](https://github.com/visulima/vite-task/issues/396) [vite-task#396](https://github.com/visulima/vite-task/issues/396)
* **task-runner:** close remaining audit findings ([28c5870](https://github.com/visulima/visulima/commit/28c587008a7f4be73c0e4695f443eccf1a9ed264)), closes [vite-task#358](https://github.com/visulima/vite-task/issues/358)
* **task-runner:** copy decompressed tar into offset-0 array before parse ([d3df40d](https://github.com/visulima/visulima/commit/d3df40d35d7c51ea665c11fe6bb8aed5e9e728da))
* **task-runner:** deno.json support, Windows Job Objects, docs, and review fixes ([4fb27f0](https://github.com/visulima/visulima/commit/4fb27f081b4b50b41dbb86b5b1a962b63f7a6df3))
* **task-runner:** finish piped task on child exit ([8e48a90](https://github.com/visulima/visulima/commit/8e48a905aecc31f12a0951b910067c7392981d46))
* **task-runner:** fix Windows cross-compilation by upgrading windows-sys to 0.61 ([b56b95e](https://github.com/visulima/visulima/commit/b56b95e2a39ca972398859e6eb87e528f4463d97))
* **task-runner:** flush partial output lines on idle, not at EOF ([5912661](https://github.com/visulima/visulima/commit/59126614ab5e07d3085a4194a360bd72437eceea))
* **task-runner:** fold dependency hashes into task cache key ([8ad36ce](https://github.com/visulima/visulima/commit/8ad36ce48478063d407c09a51263a7e1de11da4a))
* **task-runner:** harden native runner and respect caller FORCE_COLOR ([d1e7231](https://github.com/visulima/visulima/commit/d1e72317428501c1221ffb3c1a4a0e0c5bcfafc0))
* **task-runner:** harden remote-cache verify default and fix win32 shell detection ([3aadc80](https://github.com/visulima/visulima/commit/3aadc80d3132fa3ca19f4b844b3a88b7c0822b22))
* **task-runner:** harden scheduler, cache, and remote backends ([ce94b16](https://github.com/visulima/visulima/commit/ce94b16c7600967e2d47b1e18975a904f8aef779))
* **task-runner:** load native binding from package root after bundling ([b7b1d3e](https://github.com/visulima/visulima/commit/b7b1d3ee885e4f318642cfc086abcdca5d8025e8))
* **task-runner:** output-cache data loss + path-safety bugs ([aaa4007](https://github.com/visulima/visulima/commit/aaa4007ed3daea0151588c2ce42bc80eaceb40fd))
* **task-runner:** pass --import a file URL not a path ([63ac515](https://github.com/visulima/visulima/commit/63ac51556e41ddb08c83a74fddf993dbf2cd32e0))
* **task-runner:** pass implicitDeps with correct NAPI key so lockfile/dep changes invalidate cache ([d01f179](https://github.com/visulima/visulima/commit/d01f179ca4e434377b7ef20c3318ff1f66c436c5))
* **task-runner:** publish native binding packages with version lockstep via exec plugin ([12e342f](https://github.com/visulima/visulima/commit/12e342f1656ad0b595eaff627d3407c61c4ea7b6))
* **task-runner:** replace NUL in EDGE_SEPARATOR ([0e94f59](https://github.com/visulima/visulima/commit/0e94f59bb4e8a6f2ff215a26b0b52ef74309c84c))
* **task-runner:** resolve eslint errors ([f0a21a6](https://github.com/visulima/visulima/commit/f0a21a689bc9e1d8b091a513e21cb11b77103ba4))
* **task-runner:** resolve eslint errors in chrome-trace and task-hasher ([2cf6266](https://github.com/visulima/visulima/commit/2cf6266b8252bc24a6d900f49f97611d4d629ff3))
* **task-runner:** resolve workspace .bin binaries in spawned tasks ([69bd30c](https://github.com/visulima/visulima/commit/69bd30c95fb1e70aba1f7c5b4d3d17b8f0465c11))
* **task-runner:** revalidate in-memory file-hash cache ([65ea6d5](https://github.com/visulima/visulima/commit/65ea6d5cee8f160b5ccbec2246d1c94e6a480bb2))
* **task-runner:** strip Windows verbatim path prefix ([f03c2e0](https://github.com/visulima/visulima/commit/f03c2e0ac614a29f8b0912dc6ed7941f107ba5d9))
* **task-runner:** tolerate dev-only dependency cycles ([#664](https://github.com/visulima/visulima/issues/664)) ([9ad384e](https://github.com/visulima/visulima/commit/9ad384e34927b40823ae104d6b05a581dcd05705)), closes [#411](https://github.com/visulima/visulima/issues/411)
* **task-runner:** use JS fallback for onEvent streaming, fix StaticRender ref ([1a7165c](https://github.com/visulima/visulima/commit/1a7165cd9eb71472895cd08682983fa25703dc93))
* **tooling:** resolve eslint and formatting issues ([399d292](https://github.com/visulima/visulima/commit/399d29282be5b29bb26b4e5b24d45e2a6cdeeca3))
* **tsconfig:** add node types and fix implicit any parameter ([1744d82](https://github.com/visulima/visulima/commit/1744d82a07fca03f2e6ff660b918e9b2623acf69))
* **vis:** address review findings on watch UX bundle ([edee703](https://github.com/visulima/visulima/commit/edee7038fe23a488791682dd8ce5c469b40a3e8c))
* **vis:** enhance PATH inside ephemeral service bootstrap config ([30c6364](https://github.com/visulima/visulima/commit/30c6364cceff0d3c48fe5e7e4a996b77a1ed224c))
* **vis:** preserve probe error on close failure and clamp formatAge ([f1d71d6](https://github.com/visulima/visulima/commit/f1d71d63a5432fc2ed8c09c9a0a87e4e59b83b0b))

### Performance Improvements

* **task-runner:** single-pass http cache hydration ([5b93478](https://github.com/visulima/visulima/commit/5b93478dcdbcbad7c12a037e0fff06c67c3cd128))
* **task-runner:** use FxHashMap for native graph maps ([279bb76](https://github.com/visulima/visulima/commit/279bb768c2eb2928110d7b1694f433a44dc0ca90)), closes [nubjs/nub#17](https://github.com/nubjs/nub/issues/17)

### Documentation

* re-scope RFCs against what task-runner/vis already ship ([d6cf42c](https://github.com/visulima/visulima/commit/d6cf42c964b738c9872fb205b8c90b99bc7655e0))
* **task-runner,vis:** add nub MIT attribution to ported native code ([9305f59](https://github.com/visulima/visulima/commit/9305f592da38dd13a179ef1af75fb0c8f5d84693))
* **task-runner:** add design RFCs for the gap features ([18e4c96](https://github.com/visulima/visulima/commit/18e4c96619b0a4bfdbf4435ee4ef55a5b13ef055))
* **task-runner:** cover when/always, tokens, REAPI, hooks ([1515cd3](https://github.com/visulima/visulima/commit/1515cd349db41fcfe83ae86ed4d52df8dccbf985))

### Styles

* cs fixes ([2a960bb](https://github.com/visulima/visulima/commit/2a960bb1772c9dc70080e2d75d3a0d827034e294))

### Miscellaneous Chores

* add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))
* added og images ([02d9d1e](https://github.com/visulima/visulima/commit/02d9d1e47be3ce75679ea89e857dc4e4bfe4946b))
* **api-platform:** apply pending lint and source updates ([3fb0043](https://github.com/visulima/visulima/commit/3fb0043a4cf35f752ca89a09a077100ae0142da8))
* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* catalog refresh + task-runner binding bump to 1.0.0-alpha.8 ([ff4548a](https://github.com/visulima/visulima/commit/ff4548a5678c992048a57e73c310757733c04756))
* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* cs fixes ([#659](https://github.com/visulima/visulima/issues/659)) ([61f8912](https://github.com/visulima/visulima/commit/61f891274c1de22a36af256fc981b585b9ec6a6a))
* **deps:** bump rust crates to current majors ([3a1d9bb](https://github.com/visulima/visulima/commit/3a1d9bb7f6e2c6b2d3862e212ae62707d60815cc))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **release:** @visulima/task-runner@1.0.0-alpha.1 [skip ci]\n\n## @visulima/task-runner 1.0.0-alpha.1 (2026-03-26) ([6aa214b](https://github.com/visulima/visulima/commit/6aa214beb93fa2a82159566d875dbadb04b9fa0a))
* **release:** @visulima/task-runner@1.0.0-alpha.10 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.9...@visulima/task-runner@1.0.0-alpha.10) (2026-05-06) ([4a178c8](https://github.com/visulima/visulima/commit/4a178c8956c914c655696bb2c864da8e19b2be88))
* **release:** @visulima/task-runner@1.0.0-alpha.11 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.10...@visulima/task-runner@1.0.0-alpha.11) (2026-05-10) ([1b15816](https://github.com/visulima/visulima/commit/1b15816d95f8b8670935375bd17e2abedb790196))
* **release:** @visulima/task-runner@1.0.0-alpha.12 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.11...@visulima/task-runner@1.0.0-alpha.12) (2026-05-10) ([537ee00](https://github.com/visulima/visulima/commit/537ee007189ef715964b9233e7dedbc9079289cb))
* **release:** @visulima/task-runner@1.0.0-alpha.13 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.12...@visulima/task-runner@1.0.0-alpha.13) (2026-05-11) ([998f3b5](https://github.com/visulima/visulima/commit/998f3b577b83b91ab8cae28028942d5fe4ddd734))
* **release:** @visulima/task-runner@1.0.0-alpha.14 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.13...@visulima/task-runner@1.0.0-alpha.14) (2026-05-14) ([c423121](https://github.com/visulima/visulima/commit/c4231217aefac9c94a565a56cb6ea9b0733e86eb))
* **release:** @visulima/task-runner@1.0.0-alpha.15 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.15](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.14...@visulima/task-runner@1.0.0-alpha.15) (2026-05-19) ([3247398](https://github.com/visulima/visulima/commit/32473983194e0cf55d26b33162b56285af39bf18))
* **release:** @visulima/task-runner@1.0.0-alpha.16 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.16](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.15...@visulima/task-runner@1.0.0-alpha.16) (2026-05-27) ([309374e](https://github.com/visulima/visulima/commit/309374e1207b1bbf7c606b05022127872401a80a))
* **release:** @visulima/task-runner@1.0.0-alpha.17 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.17](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.16...@visulima/task-runner@1.0.0-alpha.17) (2026-05-29) ([912eece](https://github.com/visulima/visulima/commit/912eece5d1aabf485f230fe09f3bb99623ccdade))
* **release:** @visulima/task-runner@1.0.0-alpha.18 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.18](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.17...@visulima/task-runner@1.0.0-alpha.18) (2026-06-02) ([542b6df](https://github.com/visulima/visulima/commit/542b6df5e3c2ea0128a520835cec7e04ef8a519c))
* **release:** @visulima/task-runner@1.0.0-alpha.19 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.19](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.18...@visulima/task-runner@1.0.0-alpha.19) (2026-06-04) ([826aa77](https://github.com/visulima/visulima/commit/826aa778d7a1d95992d2b0fa40a2d82e683cda2a))
* **release:** @visulima/task-runner@1.0.0-alpha.2 [skip ci] ([91fe85e](https://github.com/visulima/visulima/commit/91fe85e43a7e9d27c1632753a0d5c54615ab4378))
* **release:** @visulima/task-runner@1.0.0-alpha.20 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.20](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.19...@visulima/task-runner@1.0.0-alpha.20) (2026-06-06) ([cd1a60f](https://github.com/visulima/visulima/commit/cd1a60fb7bd261e036e13eae087fc0017af569ad))
* **release:** @visulima/task-runner@1.0.0-alpha.21 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.21](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.20...@visulima/task-runner@1.0.0-alpha.21) (2026-06-07) ([c12ea85](https://github.com/visulima/visulima/commit/c12ea8553d00356634fd9043f514793da34b6f24))
* **release:** @visulima/task-runner@1.0.0-alpha.22 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.22](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.21...@visulima/task-runner@1.0.0-alpha.22) (2026-06-09) ([8011f72](https://github.com/visulima/visulima/commit/8011f72cddd6caef37e96830178edc45a89209a9))
* **release:** @visulima/task-runner@1.0.0-alpha.23 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.23](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.22...@visulima/task-runner@1.0.0-alpha.23) (2026-06-13) ([c011cd1](https://github.com/visulima/visulima/commit/c011cd15d84191752ff384bcac63c63324b2cf9e))
* **release:** @visulima/task-runner@1.0.0-alpha.24 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.24](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.23...@visulima/task-runner@1.0.0-alpha.24) (2026-06-19) ([026058a](https://github.com/visulima/visulima/commit/026058a4af6e7837820a4be01fc632a18c8fce13))
* **release:** @visulima/task-runner@1.0.0-alpha.25 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.25](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.24...@visulima/task-runner@1.0.0-alpha.25) (2026-06-23) ([ed0f718](https://github.com/visulima/visulima/commit/ed0f718e8a87fca94ff4e1d7ccdb4321b562aa8b))
* **release:** @visulima/task-runner@1.0.0-alpha.26 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.26](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.25...@visulima/task-runner@1.0.0-alpha.26) (2026-07-03) ([59df1a2](https://github.com/visulima/visulima/commit/59df1a288d5291b3d5c073599eff89f13286e94d))
* **release:** @visulima/task-runner@1.0.0-alpha.3 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.2...@visulima/task-runner@1.0.0-alpha.3) (2026-03-26) ([3a1b5bd](https://github.com/visulima/visulima/commit/3a1b5bd0e158dc67e03fc6351aed7c639ce59603))
* **release:** @visulima/task-runner@1.0.0-alpha.4 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.3...@visulima/task-runner@1.0.0-alpha.4) (2026-04-08) ([b7af021](https://github.com/visulima/visulima/commit/b7af021a0dcc283e092e5ea19a3ae7124f289f03))
* **release:** @visulima/task-runner@1.0.0-alpha.5 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.4...@visulima/task-runner@1.0.0-alpha.5) (2026-04-15) ([17a53e9](https://github.com/visulima/visulima/commit/17a53e9cc62f8f4ab2965d72be869c860f731e3d))
* **release:** @visulima/task-runner@1.0.0-alpha.6 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.5...@visulima/task-runner@1.0.0-alpha.6) (2026-04-21) ([89dd5b2](https://github.com/visulima/visulima/commit/89dd5b2af81b9906e13fed35e1cca4cf557476c8))
* **release:** @visulima/task-runner@1.0.0-alpha.7 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.6...@visulima/task-runner@1.0.0-alpha.7) (2026-04-22) ([1c038c4](https://github.com/visulima/visulima/commit/1c038c444c5bf491178f8f19e70cdd99124a2ea3))
* **release:** @visulima/task-runner@1.0.0-alpha.8 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.7...@visulima/task-runner@1.0.0-alpha.8) (2026-04-30) ([eb49f23](https://github.com/visulima/visulima/commit/eb49f23f69271a349535b7813694bc4d7ca526fc))
* **release:** @visulima/task-runner@1.0.0-alpha.9 [skip ci]\n\n## @visulima/task-runner [1.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.8...@visulima/task-runner@1.0.0-alpha.9) (2026-05-04) ([f4e0023](https://github.com/visulima/visulima/commit/f4e0023dca7cc167045d913511ff9f05d5d2f951))
* **repo:** apply eslint --fix and prettier --fix across packages ([#650](https://github.com/visulima/visulima/issues/650)) ([2e26a84](https://github.com/visulima/visulima/commit/2e26a84774f218f21345e9a8ecd68236b6542743)), closes [#620](https://github.com/visulima/visulima/issues/620)
* **repo:** sort package.json keys across all packages ([e1fd9ab](https://github.com/visulima/visulima/commit/e1fd9ab467ef96a98c777da1572ff6a50fcf7e71))
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))
* **task-runner:** add project.json for all native binding packages ([eb48812](https://github.com/visulima/visulima/commit/eb48812cb87c0990b9822d9314ccc0081e41d11f))
* **task-runner:** add tsconfig.eslint.json for type-aware linting ([83e0bf2](https://github.com/visulima/visulima/commit/83e0bf23511a169b801f6edf652a8be7ee968c24))
* **task-runner:** apply formatter and lint fixes ([70b4641](https://github.com/visulima/visulima/commit/70b4641b394897ebfc021425b992db936e320d8a))
* **task-runner:** apply formatter and lint fixes ([aee664f](https://github.com/visulima/visulima/commit/aee664f0a03ed9c1eb8bf7a6a91e62f601a3d5ff))
* **task-runner:** apply pending changes ([9d92517](https://github.com/visulima/visulima/commit/9d92517f1a54bc28a19cb8cbdb937cdc234e152d))
* **task-runner:** apply pending lint and source updates ([c01eb39](https://github.com/visulima/visulima/commit/c01eb393f991d8fc96f8ed87bfc71d90902ee659))
* **task-runner:** apply prettier formatting ([521afc2](https://github.com/visulima/visulima/commit/521afc22d94a2626c7246062cecfc0627f929ee4))
* **task-runner:** bump protobufjs to 8.0.3 ([cfbd5e7](https://github.com/visulima/visulima/commit/cfbd5e783e8773db790223f7dd8baea56685c1ca))
* **task-runner:** clear lint warnings ([05fa2b6](https://github.com/visulima/visulima/commit/05fa2b6fa259607933fc709dc871b5ef52294721))
* **task-runner:** enforce curly braces and apply lint fixes ([4fbd8ee](https://github.com/visulima/visulima/commit/4fbd8eefa1b56f428528b495b074d5c266fb6733))
* **task-runner:** expand inline if-return to block syntax ([0f48a96](https://github.com/visulima/visulima/commit/0f48a96ed11d7339c62f3f147c7b2c8fcc605b03))
* **task-runner:** fix lint errors ([0f5a6d0](https://github.com/visulima/visulima/commit/0f5a6d00bd321b98f9b4289923e151c59a5b7e58))
* **task-runner:** fix lint errors in test files ([5e7dc4f](https://github.com/visulima/visulima/commit/5e7dc4fcee277691034666a252d97503aa7be0a4))
* **task-runner:** housekeeping cleanup ([e837f11](https://github.com/visulima/visulima/commit/e837f1166b43bcfbccfdffe693248db498c0fe1d))
* **task-runner:** migrate .prettierrc.cjs to prettier.config.js ([cd1c045](https://github.com/visulima/visulima/commit/cd1c045e133f685a274924034ec70cf374edd5ba))
* **task-runner:** remove redundant extends from .releaserc.json ([8969dfa](https://github.com/visulima/visulima/commit/8969dfaeccf3a36e40ecb9ba659187f81dda4ce1))
* **task-runner:** track fspy_macos Cargo.lock ([7a69ff9](https://github.com/visulima/visulima/commit/7a69ff9bcbc25b2c6d8f249c66b135d1ff9a1577))
* **task-runner:** upgrade packem to 2.0.0-alpha.76 ([5f59c41](https://github.com/visulima/visulima/commit/5f59c4140f89019cc3756ac917e1bda7ded0beec))
* **tooling:** apply prettier and eslint formatting sweep ([c2c641d](https://github.com/visulima/visulima/commit/c2c641d40242e99030cb990fa01039db5e267667))
* update the jsr.json ([864ab7e](https://github.com/visulima/visulima/commit/864ab7e71c4b5ae82f64792d1ae8debfea2c539b))

### Code Refactoring

* replace inline import() types with top-level imports ([4569a4c](https://github.com/visulima/visulima/commit/4569a4ca04723da069f985855dcfab292f7347e1))
* resolve fallow dead-code across 13 packages ([8c458d2](https://github.com/visulima/visulima/commit/8c458d2eb17225ed48fc4bee4569e522912e8c3d))
* **task-runner,vis:** consolidate helpers and tighten branches ([d1290d1](https://github.com/visulima/visulima/commit/d1290d1f614036902c6803d8ff51df100fdd07ab))
* **task-runner,vis:** expose worktree helpers from task-runner ([12468d7](https://github.com/visulima/visulima/commit/12468d76bb03278ec56691ba0c6d9821c9482f94))
* **task-runner:** drop dead pure-JS hashing/worktree fallbacks ([405af22](https://github.com/visulima/visulima/commit/405af2277037e2141481e49cfbb932b7fdc88ea7)), closes [this.#native](https://github.com/visulima/this./issues/native)
* **task-runner:** reorder onDiagnostic before onFingerprint in types ([b3bba9a](https://github.com/visulima/visulima/commit/b3bba9aa996ff041cf46893d0504b024fecde65c))

### Tests

* fixed count ([6fdd45e](https://github.com/visulima/visulima/commit/6fdd45e3855b619d09d3f33ec7c4277e59ef84da))
* **task-runner:** add criterion benches (graph, file-hasher) ([26d7d5b](https://github.com/visulima/visulima/commit/26d7d5b3ec92744f973b7d6b82a655bde73cde98))
* **task-runner:** prove lockfile changes invalidate task hashes ([00c8494](https://github.com/visulima/visulima/commit/00c84942fe48a563fd77955c76cffa50e95ab2f3))
* **task-runner:** regression guard for vite-task[#411](https://github.com/visulima/visulima/issues/411) (peer-dep cycle) ([#665](https://github.com/visulima/visulima/issues/665)) ([41ed071](https://github.com/visulima/visulima/commit/41ed0710d103647137f0448d999f355451f80df4))
* **task-runner:** remove native binding guard from tests ([90f0dff](https://github.com/visulima/visulima/commit/90f0dffe85f4b83e76905a26d53b917365116b45))
* **task-runner:** skip default excludes for tmpdir-backed tracker tests ([0db0620](https://github.com/visulima/visulima/commit/0db06206173f0799244fafcc578b9fb0be9d2fb6))
* **task-runner:** split tests into unit/integration mirroring src layout ([ae78f99](https://github.com/visulima/visulima/commit/ae78f992d24626f3b23de56fa735aced47b1220e))
* **task-runner:** warm fetch to fix http cold-start timeout ([0d3d526](https://github.com/visulima/visulima/commit/0d3d52679eac6ab2afb64cbeee1cc48b67fa34a7))
* **vis,task-runner:** address review on native benches ([f89dd33](https://github.com/visulima/visulima/commit/f89dd335d103744308a48568e49577d2019aca35))

### Build System

* **deps:** update task-runner dependencies ([d201000](https://github.com/visulima/visulima/commit/d201000cccb5fcf481d3e8ed17be83d393eb5acc))
* regenerate NAPI-RS bindings as ESM ([f202caf](https://github.com/visulima/visulima/commit/f202caf3dc383a2ec24815c4935d8d68c29f33d0))
* switch NAPI-RS native builds to ESM output ([3d7cd61](https://github.com/visulima/visulima/commit/3d7cd615ad830392005915735c11771e0247ef3f))
* **task-runner:** move publish-native-addons to shared scripts/ ([73b5482](https://github.com/visulima/visulima/commit/73b5482e1ca0707aa8f191429deffbd7324a632d))

### Continuous Integration

* **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))
* integrate codspeed for benchmark tracking ([e758f3d](https://github.com/visulima/visulima/commit/e758f3da491cc00d3f8bbf10d7ba3fdf8deb5325))
* pin macos to 15, fix task-runner indent + backbuffer flake ([61cbf4f](https://github.com/visulima/visulima/commit/61cbf4fb09be40c567a4e0d2d4349ad24ea91afb))
* stabilize flaky tests and drop markdown lint ([91e110a](https://github.com/visulima/visulima/commit/91e110a30b1ef8ca16f0632253a9e4d13856d8f9))
* **task-runner:** use escaped newlines in git commit message template ([b3045b6](https://github.com/visulima/visulima/commit/b3045b6c2c5afc641c699932fbf90effe7c31563))


### Dependencies

* **@visulima/humanizer:** upgraded to 3.0.0
* **@visulima/path:** upgraded to 3.0.0

## @visulima/task-runner [1.0.0-alpha.26](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.25...@visulima/task-runner@1.0.0-alpha.26) (2026-07-03)

### Bug Fixes

* **task-runner:** copy decompressed tar into offset-0 array before parse ([d3df40d](https://github.com/visulima/visulima/commit/d3df40d35d7c51ea665c11fe6bb8aed5e9e728da))
* **task-runner:** fold dependency hashes into task cache key ([8ad36ce](https://github.com/visulima/visulima/commit/8ad36ce48478063d407c09a51263a7e1de11da4a))

### Styles

* cs fixes ([2a960bb](https://github.com/visulima/visulima/commit/2a960bb1772c9dc70080e2d75d3a0d827034e294))

### Miscellaneous Chores

* add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))

### Code Refactoring

* resolve fallow dead-code across 13 packages ([8c458d2](https://github.com/visulima/visulima/commit/8c458d2eb17225ed48fc4bee4569e522912e8c3d))

### Continuous Integration

* **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))

## @visulima/task-runner [1.0.0-alpha.25](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.24...@visulima/task-runner@1.0.0-alpha.25) (2026-06-23)

### Features

* **task-runner:** add import-level boundary checking ([#694](https://github.com/visulima/visulima/issues/694)) ([7ad9817](https://github.com/visulima/visulima/commit/7ad9817ce3b5c1d95f54db025da114b8e21a0330))

### Bug Fixes

* **task-runner:** finish piped task on child exit ([8e48a90](https://github.com/visulima/visulima/commit/8e48a905aecc31f12a0951b910067c7392981d46))

### Performance Improvements

* **task-runner:** use FxHashMap for native graph maps ([279bb76](https://github.com/visulima/visulima/commit/279bb768c2eb2928110d7b1694f433a44dc0ca90)), closes [nubjs/nub#17](https://github.com/nubjs/nub/issues/17)

### Documentation

* **task-runner,vis:** add nub MIT attribution to ported native code ([9305f59](https://github.com/visulima/visulima/commit/9305f592da38dd13a179ef1af75fb0c8f5d84693))

### Tests

* **task-runner:** add criterion benches (graph, file-hasher) ([26d7d5b](https://github.com/visulima/visulima/commit/26d7d5b3ec92744f973b7d6b82a655bde73cde98))
* **vis,task-runner:** address review on native benches ([f89dd33](https://github.com/visulima/visulima/commit/f89dd335d103744308a48568e49577d2019aca35))

## @visulima/task-runner [1.0.0-alpha.24](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.23...@visulima/task-runner@1.0.0-alpha.24) (2026-06-19)


### Dependencies

* **@visulima/humanizer:** upgraded to 3.0.0-alpha.15

## @visulima/task-runner [1.0.0-alpha.23](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.22...@visulima/task-runner@1.0.0-alpha.23) (2026-06-13)

### Features

* **task-runner:** require native addon, hard-fail on load failure ([a52dc4d](https://github.com/visulima/visulima/commit/a52dc4db71ca1f476f78b88625bb2ae7b0ddf932))

### Bug Fixes

* **task-runner:** align NativeTaskHashDetails binding type to camelCase implicitDeps ([7d3fd91](https://github.com/visulima/visulima/commit/7d3fd91a4347e1ddd9aa926adcd578ca5fcec7d6))
* **task-runner:** harden remote-cache verify default and fix win32 shell detection ([3aadc80](https://github.com/visulima/visulima/commit/3aadc80d3132fa3ca19f4b844b3a88b7c0822b22))
* **task-runner:** load native binding from package root after bundling ([b7b1d3e](https://github.com/visulima/visulima/commit/b7b1d3ee885e4f318642cfc086abcdca5d8025e8))
* **task-runner:** pass --import a file URL not a path ([63ac515](https://github.com/visulima/visulima/commit/63ac51556e41ddb08c83a74fddf993dbf2cd32e0))
* **task-runner:** pass implicitDeps with correct NAPI key so lockfile/dep changes invalidate cache ([d01f179](https://github.com/visulima/visulima/commit/d01f179ca4e434377b7ef20c3318ff1f66c436c5))
* **task-runner:** strip Windows verbatim path prefix ([f03c2e0](https://github.com/visulima/visulima/commit/f03c2e0ac614a29f8b0912dc6ed7941f107ba5d9))

### Performance Improvements

* **task-runner:** single-pass http cache hydration ([5b93478](https://github.com/visulima/visulima/commit/5b93478dcdbcbad7c12a037e0fff06c67c3cd128))

### Documentation

* re-scope RFCs against what task-runner/vis already ship ([d6cf42c](https://github.com/visulima/visulima/commit/d6cf42c964b738c9872fb205b8c90b99bc7655e0))
* **task-runner:** add design RFCs for the gap features ([18e4c96](https://github.com/visulima/visulima/commit/18e4c96619b0a4bfdbf4435ee4ef55a5b13ef055))

### Code Refactoring

* **task-runner:** drop dead pure-JS hashing/worktree fallbacks ([405af22](https://github.com/visulima/visulima/commit/405af2277037e2141481e49cfbb932b7fdc88ea7)), closes [this.#native](https://github.com/visulima/this./issues/native)
* **task-runner:** reorder onDiagnostic before onFingerprint in types ([b3bba9a](https://github.com/visulima/visulima/commit/b3bba9aa996ff041cf46893d0504b024fecde65c))

### Tests

* **task-runner:** prove lockfile changes invalidate task hashes ([00c8494](https://github.com/visulima/visulima/commit/00c84942fe48a563fd77955c76cffa50e95ab2f3))
* **task-runner:** warm fetch to fix http cold-start timeout ([0d3d526](https://github.com/visulima/visulima/commit/0d3d52679eac6ab2afb64cbeee1cc48b67fa34a7))

### Build System

* **deps:** update task-runner dependencies ([d201000](https://github.com/visulima/visulima/commit/d201000cccb5fcf481d3e8ed17be83d393eb5acc))

### Continuous Integration

* stabilize flaky tests and drop markdown lint ([91e110a](https://github.com/visulima/visulima/commit/91e110a30b1ef8ca16f0632253a9e4d13856d8f9))


### Dependencies

* **@visulima/humanizer:** upgraded to 3.0.0-alpha.14
* **@visulima/path:** upgraded to 3.0.0-alpha.13

## @visulima/task-runner [1.0.0-alpha.22](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.21...@visulima/task-runner@1.0.0-alpha.22) (2026-06-09)

### Features

* **task-runner:** surface native addon fallback loudly ([fd6e9d0](https://github.com/visulima/visulima/commit/fd6e9d045d9480e0e49a5d2aa6a240bf25a6799a))

### Bug Fixes

* **task-runner:** replace NUL in EDGE_SEPARATOR ([0e94f59](https://github.com/visulima/visulima/commit/0e94f59bb4e8a6f2ff215a26b0b52ef74309c84c))
* **task-runner:** revalidate in-memory file-hash cache ([65ea6d5](https://github.com/visulima/visulima/commit/65ea6d5cee8f160b5ccbec2246d1c94e6a480bb2))

## @visulima/task-runner [1.0.0-alpha.21](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.20...@visulima/task-runner@1.0.0-alpha.21) (2026-06-07)

### Features

* **task-runner:** warn when a cacheable task's inputs resolve to zero files ([3a4ecbb](https://github.com/visulima/visulima/commit/3a4ecbbef46b49afa4cb8b3e0b741fae0de42b3c))

## @visulima/task-runner [1.0.0-alpha.20](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.19...@visulima/task-runner@1.0.0-alpha.20) (2026-06-06)

### Bug Fixes

* **task-runner:** output-cache data loss + path-safety bugs ([aaa4007](https://github.com/visulima/visulima/commit/aaa4007ed3daea0151588c2ce42bc80eaceb40fd))

## @visulima/task-runner [1.0.0-alpha.19](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.18...@visulima/task-runner@1.0.0-alpha.19) (2026-06-04)

### Bug Fixes

* **task-runner:** 3 bug fixes ([ccf08a1](https://github.com/visulima/visulima/commit/ccf08a1faed664d4545b7594bba9afade782b2e5))


### Dependencies

* **@visulima/humanizer:** upgraded to 3.0.0-alpha.13
* **@visulima/path:** upgraded to 3.0.0-alpha.12

## @visulima/task-runner [1.0.0-alpha.18](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.17...@visulima/task-runner@1.0.0-alpha.18) (2026-06-02)

### Features

* **task-runner,vis:** per-task pty + concurrency weight, abort cache gate, fspy scaffolds ([#656](https://github.com/visulima/visulima/issues/656)) ([ca64010](https://github.com/visulima/visulima/commit/ca64010b236903e08273680ea65dec7046fcd18b))

### Bug Fixes

* **task-runner:** atomic restoreOutputs and graceful REAPI shutdown ([a3f7088](https://github.com/visulima/visulima/commit/a3f7088c58560f9c98d9d68914ebaf0a458e319d)), closes [#inflightRpcs](https://github.com/visulima/visulima/issues/inflightRpcs) [#closeQuiescenceTimeoutMs](https://github.com/visulima/visulima/issues/closeQuiescenceTimeoutMs)
* **task-runner:** bound fspy drains so a lingering child can't hang the run ([#666](https://github.com/visulima/visulima/issues/666)) ([3f56348](https://github.com/visulima/visulima/commit/3f56348e1998b50e3b8496ce5f97a9a34932946d)), closes [vite-task#396](https://github.com/visulima/vite-task/issues/396) [vite-task#396](https://github.com/visulima/vite-task/issues/396) [vite-task#396](https://github.com/visulima/vite-task/issues/396) [vite-task#396](https://github.com/visulima/vite-task/issues/396) [vite-task#396](https://github.com/visulima/vite-task/issues/396)
* **task-runner:** close remaining audit findings ([28c5870](https://github.com/visulima/visulima/commit/28c587008a7f4be73c0e4695f443eccf1a9ed264)), closes [vite-task#358](https://github.com/visulima/vite-task/issues/358)
* **task-runner:** harden native runner and respect caller FORCE_COLOR ([d1e7231](https://github.com/visulima/visulima/commit/d1e72317428501c1221ffb3c1a4a0e0c5bcfafc0))
* **task-runner:** harden scheduler, cache, and remote backends ([ce94b16](https://github.com/visulima/visulima/commit/ce94b16c7600967e2d47b1e18975a904f8aef779))
* **task-runner:** tolerate dev-only dependency cycles ([#664](https://github.com/visulima/visulima/issues/664)) ([9ad384e](https://github.com/visulima/visulima/commit/9ad384e34927b40823ae104d6b05a581dcd05705)), closes [#411](https://github.com/visulima/visulima/issues/411)

### Miscellaneous Chores

* cs fixes ([#659](https://github.com/visulima/visulima/issues/659)) ([61f8912](https://github.com/visulima/visulima/commit/61f891274c1de22a36af256fc981b585b9ec6a6a))
* **task-runner:** track fspy_macos Cargo.lock ([7a69ff9](https://github.com/visulima/visulima/commit/7a69ff9bcbc25b2c6d8f249c66b135d1ff9a1577))

### Tests

* **task-runner:** regression guard for vite-task[#411](https://github.com/visulima/visulima/issues/411) (peer-dep cycle) ([#665](https://github.com/visulima/visulima/issues/665)) ([41ed071](https://github.com/visulima/visulima/commit/41ed0710d103647137f0448d999f355451f80df4))

## @visulima/task-runner [1.0.0-alpha.17](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.16...@visulima/task-runner@1.0.0-alpha.17) (2026-05-29)

### Bug Fixes

* **task-runner:** flush partial output lines on idle, not at EOF ([5912661](https://github.com/visulima/visulima/commit/59126614ab5e07d3085a4194a360bd72437eceea))

## @visulima/task-runner [1.0.0-alpha.16](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.15...@visulima/task-runner@1.0.0-alpha.16) (2026-05-27)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))
* **task-runner:** resolve workspace .bin binaries in spawned tasks ([69bd30c](https://github.com/visulima/visulima/commit/69bd30c95fb1e70aba1f7c5b4d3d17b8f0465c11))
* **vis:** enhance PATH inside ephemeral service bootstrap config ([30c6364](https://github.com/visulima/visulima/commit/30c6364cceff0d3c48fe5e7e4a996b77a1ed224c))

### Miscellaneous Chores

* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **repo:** apply eslint --fix and prettier --fix across packages ([#650](https://github.com/visulima/visulima/issues/650)) ([2e26a84](https://github.com/visulima/visulima/commit/2e26a84774f218f21345e9a8ecd68236b6542743)), closes [#620](https://github.com/visulima/visulima/issues/620)
* **repo:** sort package.json keys across all packages ([e1fd9ab](https://github.com/visulima/visulima/commit/e1fd9ab467ef96a98c777da1572ff6a50fcf7e71))
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))

### Continuous Integration

* pin macos to 15, fix task-runner indent + backbuffer flake ([61cbf4f](https://github.com/visulima/visulima/commit/61cbf4fb09be40c567a4e0d2d4349ad24ea91afb))


### Dependencies

* **@visulima/path:** upgraded to 3.0.0-alpha.11

## @visulima/task-runner [1.0.0-alpha.15](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.14...@visulima/task-runner@1.0.0-alpha.15) (2026-05-19)

### Features

* **task-runner:** auto-capture outputs for compound build scripts ([e084434](https://github.com/visulima/visulima/commit/e0844344cf184177999a82b708299f08fbfd31ec))
* **task-runner:** per-target hashMode "trace" opt-in ([#643](https://github.com/visulima/visulima/issues/643)) ([32353ff](https://github.com/visulima/visulima/commit/32353ff7a760ae9486e23cc4042fab46a2f2cc11))
* **vis:** attested keyless-signed remote cache (Sigstore) ([4732610](https://github.com/visulima/visulima/commit/47326103a668ab99fcfc4e21f2c9efeaa5892944))

## @visulima/task-runner [1.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.13...@visulima/task-runner@1.0.0-alpha.14) (2026-05-14)

### Bug Fixes

* **release:** patch NAPI version-check string and ship fresh loader on release ([0676e33](https://github.com/visulima/visulima/commit/0676e336f453c9ae38c9f3a5fbbb675f9bff7ea0))

### Miscellaneous Chores

* **tooling:** apply prettier and eslint formatting sweep ([c2c641d](https://github.com/visulima/visulima/commit/c2c641d40242e99030cb990fa01039db5e267667))

### Tests

* fixed count ([6fdd45e](https://github.com/visulima/visulima/commit/6fdd45e3855b619d09d3f33ec7c4277e59ef84da))

## @visulima/task-runner [1.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.12...@visulima/task-runner@1.0.0-alpha.13) (2026-05-11)

### Features

* **task-runner:** add resolveTurboEnvCompat helper ([a8e73ef](https://github.com/visulima/visulima/commit/a8e73ef324dd8d1bc1f1f471f59f9292f9f01745))
* **task-runner:** surface retryAttempts on TaskResult and TaskSummary ([f74e278](https://github.com/visulima/visulima/commit/f74e278fc98052398d46a064ad11e1c9956c9cfd))

## @visulima/task-runner [1.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.11...@visulima/task-runner@1.0.0-alpha.12) (2026-05-10)

### Features

* **task-runner:** add onRetry + onFingerprint hooks ([7e9dadf](https://github.com/visulima/visulima/commit/7e9dadfbe7101fd9b2878eb881d16c3ff5d766ac))

## @visulima/task-runner [1.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.10...@visulima/task-runner@1.0.0-alpha.11) (2026-05-10)

### Features

* add service and tool projectType variants ([61858ad](https://github.com/visulima/visulima/commit/61858ad4c044b5f30318f282615c83f716667053)), closes [#21](https://github.com/visulima/visulima/issues/21)
* **task-runner:** allow embedders to override the data directory ([904875a](https://github.com/visulima/visulima/commit/904875a15751c57ebafa9c137fd11c2ade1a4b6a))
* **task-runner:** surface native child pids for sigint cleanup ([3790bbd](https://github.com/visulima/visulima/commit/3790bbd5f88485f6c67c28548faf7a2a3791216c))

### Miscellaneous Chores

* **task-runner:** bump protobufjs to 8.0.3 ([cfbd5e7](https://github.com/visulima/visulima/commit/cfbd5e783e8773db790223f7dd8baea56685c1ca))

## @visulima/task-runner [1.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.9...@visulima/task-runner@1.0.0-alpha.10) (2026-05-06)

### Features

* **task-runner:** add per-target maxConcurrent and workspace concurrencyGroups ([985d5d1](https://github.com/visulima/visulima/commit/985d5d1d3a594f3b42cfa3f7735bc1bb8055563e))

### Miscellaneous Chores

* **task-runner:** clear lint warnings ([05fa2b6](https://github.com/visulima/visulima/commit/05fa2b6fa259607933fc709dc871b5ef52294721))
* **task-runner:** fix lint errors ([0f5a6d0](https://github.com/visulima/visulima/commit/0f5a6d00bd321b98f9b4289923e151c59a5b7e58))
* **task-runner:** fix lint errors in test files ([5e7dc4f](https://github.com/visulima/visulima/commit/5e7dc4fcee277691034666a252d97503aa7be0a4))
* **task-runner:** housekeeping cleanup ([e837f11](https://github.com/visulima/visulima/commit/e837f1166b43bcfbccfdffe693248db498c0fe1d))

### Continuous Integration

* integrate codspeed for benchmark tracking ([e758f3d](https://github.com/visulima/visulima/commit/e758f3da491cc00d3f8bbf10d7ba3fdf8deb5325))

## @visulima/task-runner [1.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.8...@visulima/task-runner@1.0.0-alpha.9) (2026-05-04)

### Features

* **task-runner,vis:** cache restoration fidelity ([a15cb22](https://github.com/visulima/visulima/commit/a15cb22bde832cfe76ee017722b8b9f9102dac8f))
* **task-runner:** add REAPI gRPC backend, cacheMode, and cache doctor ([03e6da9](https://github.com/visulima/visulima/commit/03e6da97beb84f6adc4a07a1c7ca4acf28be3b33))
* **task-runner:** add URI-based input format ([050b583](https://github.com/visulima/visulima/commit/050b5838c15590a3ccba0ca99ad585cbabc36d99))
* **task-runner:** skip-on-warning incrementality ([2c79ab3](https://github.com/visulima/visulima/commit/2c79ab35d0513bf4e60f87d1ac3bc4e99296cb62)), closes [#22](https://github.com/visulima/visulima/issues/22) [rushstack#1402](https://github.com/visulima/rushstack/issues/1402)

### Bug Fixes

* **vis:** preserve probe error on close failure and clamp formatAge ([f1d71d6](https://github.com/visulima/visulima/commit/f1d71d63a5432fc2ed8c09c9a0a87e4e59b83b0b))

### Documentation

* **task-runner:** cover when/always, tokens, REAPI, hooks ([1515cd3](https://github.com/visulima/visulima/commit/1515cd349db41fcfe83ae86ed4d52df8dccbf985))

### Miscellaneous Chores

* catalog refresh + task-runner binding bump to 1.0.0-alpha.8 ([ff4548a](https://github.com/visulima/visulima/commit/ff4548a5678c992048a57e73c310757733c04756))
* **deps:** bump rust crates to current majors ([3a1d9bb](https://github.com/visulima/visulima/commit/3a1d9bb7f6e2c6b2d3862e212ae62707d60815cc))

### Code Refactoring

* **task-runner,vis:** consolidate helpers and tighten branches ([d1290d1](https://github.com/visulima/visulima/commit/d1290d1f614036902c6803d8ff51df100fdd07ab))
* **task-runner,vis:** expose worktree helpers from task-runner ([12468d7](https://github.com/visulima/visulima/commit/12468d76bb03278ec56691ba0c6d9821c9482f94))

### Tests

* **task-runner:** split tests into unit/integration mirroring src layout ([ae78f99](https://github.com/visulima/visulima/commit/ae78f992d24626f3b23de56fa735aced47b1220e))

## @visulima/task-runner [1.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.7...@visulima/task-runner@1.0.0-alpha.8) (2026-04-30)

### Features

* **task-runner:** expose worktree detection napi bindings ([3d67028](https://github.com/visulima/visulima/commit/3d670284090010616956a024a4e5465ee91bbcd4))
* **task-runner:** graceful Ctrl+Break on Windows SIGINT ([ae44b1c](https://github.com/visulima/visulima/commit/ae44b1c855839746092a91430eb49b216d1172ec))
* **task-runner:** tokens, when, and always tasks ([5ae6505](https://github.com/visulima/visulima/commit/5ae65055d97e97d7ad7ff9088996da37d964da3f))

### Bug Fixes

* **vis:** address review findings on watch UX bundle ([edee703](https://github.com/visulima/visulima/commit/edee7038fe23a488791682dd8ce5c469b40a3e8c))

### Miscellaneous Chores

* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **task-runner:** upgrade packem to 2.0.0-alpha.76 ([5f59c41](https://github.com/visulima/visulima/commit/5f59c4140f89019cc3756ac917e1bda7ded0beec))

## @visulima/task-runner [1.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.6...@visulima/task-runner@1.0.0-alpha.7) (2026-04-22)

### Bug Fixes

* **ci:** publish native addons via local semantic-release plugin ([974beb2](https://github.com/visulima/visulima/commit/974beb2d021e7b2afc86b958bd2137be88d2f464))
* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))

### Miscellaneous Chores

* update the jsr.json ([864ab7e](https://github.com/visulima/visulima/commit/864ab7e71c4b5ae82f64792d1ae8debfea2c539b))


### Dependencies

* **@visulima/humanizer:** upgraded to 3.0.0-alpha.11
* **@visulima/path:** upgraded to 3.0.0-alpha.10

## @visulima/task-runner [1.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.5...@visulima/task-runner@1.0.0-alpha.6) (2026-04-21)

### Features

* **task-runner:** output globs, auto-writes, parallel cache IO ([137f53f](https://github.com/visulima/visulima/commit/137f53f7f5a4d8c16df511c9d145b2c158025a32))
* **task-runner:** vite-task parity + plugin-ready lifecycle hooks ([cfc7360](https://github.com/visulima/visulima/commit/cfc7360abf00524fbfc37b60df27970c325f91e1)), closes [pkg#task](https://github.com/visulima/pkg/issues/task)

### Bug Fixes

* **task-runner:** resolve eslint errors in chrome-trace and task-hasher ([2cf6266](https://github.com/visulima/visulima/commit/2cf6266b8252bc24a6d900f49f97611d4d629ff3))

### Miscellaneous Chores

* **api-platform:** apply pending lint and source updates ([3fb0043](https://github.com/visulima/visulima/commit/3fb0043a4cf35f752ca89a09a077100ae0142da8))
* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* **task-runner:** apply formatter and lint fixes ([70b4641](https://github.com/visulima/visulima/commit/70b4641b394897ebfc021425b992db936e320d8a))
* **task-runner:** apply formatter and lint fixes ([aee664f](https://github.com/visulima/visulima/commit/aee664f0a03ed9c1eb8bf7a6a91e62f601a3d5ff))
* **task-runner:** apply pending changes ([9d92517](https://github.com/visulima/visulima/commit/9d92517f1a54bc28a19cb8cbdb937cdc234e152d))
* **task-runner:** apply pending lint and source updates ([c01eb39](https://github.com/visulima/visulima/commit/c01eb393f991d8fc96f8ed87bfc71d90902ee659))
* **task-runner:** enforce curly braces and apply lint fixes ([4fbd8ee](https://github.com/visulima/visulima/commit/4fbd8eefa1b56f428528b495b074d5c266fb6733))

### Code Refactoring

* replace inline import() types with top-level imports ([4569a4c](https://github.com/visulima/visulima/commit/4569a4ca04723da069f985855dcfab292f7347e1))

### Tests

* **task-runner:** remove native binding guard from tests ([90f0dff](https://github.com/visulima/visulima/commit/90f0dffe85f4b83e76905a26d53b917365116b45))
* **task-runner:** skip default excludes for tmpdir-backed tracker tests ([0db0620](https://github.com/visulima/visulima/commit/0db06206173f0799244fafcc578b9fb0be9d2fb6))

## @visulima/task-runner [1.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.4...@visulima/task-runner@1.0.0-alpha.5) (2026-04-15)

### Features

* Add comprehensive workspace configuration and command infrastructure ([#609](https://github.com/visulima/visulima/issues/609)) ([f4347bf](https://github.com/visulima/visulima/commit/f4347bfdcdd1b228cd9d842a927e446aaf23f035))
* **vis:** add cache command for task runner cache ([#607](https://github.com/visulima/visulima/issues/607)) ([6752769](https://github.com/visulima/visulima/commit/67527692562b3dd9c03bb6a67c084ff1e694a560))

### Bug Fixes

* **tooling:** resolve eslint and formatting issues ([399d292](https://github.com/visulima/visulima/commit/399d29282be5b29bb26b4e5b24d45e2a6cdeeca3))


### Dependencies

* **@visulima/humanizer:** upgraded to 3.0.0-alpha.10
* **@visulima/path:** upgraded to 3.0.0-alpha.9

## @visulima/task-runner [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.3...@visulima/task-runner@1.0.0-alpha.4) (2026-04-08)

### Features

* Add native Rust bindings for package manager operations ([#596](https://github.com/visulima/visulima/issues/596)) ([2ec22d0](https://github.com/visulima/visulima/commit/2ec22d023eade3fed67fb811696fbd8f7b52569d))
* **task-runner, vis:** project constraints, CI partitioning, affected scopes ([29295e9](https://github.com/visulima/visulima/commit/29295e989ecdfe2019469d1917a6c90a92e17bcf))
* **task-runner:** add concurrent process runner with Rust NAPI bindings ([c4f5d93](https://github.com/visulima/visulima/commit/c4f5d930e81a5eb641ceb3ab925c3b10a885bb6a))
* **vis:** expand devcontainer command with templates, validation, and config properties ([807e730](https://github.com/visulima/visulima/commit/807e730a43f0ea644d016b4f5506706972d2ff41))
* **vis:** group CLI commands into logical categories for help output ([0a4cac8](https://github.com/visulima/visulima/commit/0a4cac859c8edf7aacdacca7b9a03219967d525a))
* **vis:** replace inline TUI with full-screen Nx-style interactive task runner ([1409aad](https://github.com/visulima/visulima/commit/1409aad879c713051bba12298a3feb1d5ba852f2))

### Bug Fixes

* **ci:** make native-binding tests work with and without compiled binary ([9a40fb4](https://github.com/visulima/visulima/commit/9a40fb40d5cba9fcd2e0176eea8b7bf8d9792c7d))
* **task-runner,tui:** guard null native events and increase CI test timeout ([e76a791](https://github.com/visulima/visulima/commit/e76a791d90043537e08be0545f706e35acaa555d))
* **task-runner:** deno.json support, Windows Job Objects, docs, and review fixes ([4fb27f0](https://github.com/visulima/visulima/commit/4fb27f081b4b50b41dbb86b5b1a962b63f7a6df3))
* **task-runner:** fix Windows cross-compilation by upgrading windows-sys to 0.61 ([b56b95e](https://github.com/visulima/visulima/commit/b56b95e2a39ca972398859e6eb87e528f4463d97))
* **task-runner:** resolve eslint errors ([f0a21a6](https://github.com/visulima/visulima/commit/f0a21a689bc9e1d8b091a513e21cb11b77103ba4))
* **task-runner:** use JS fallback for onEvent streaming, fix StaticRender ref ([1a7165c](https://github.com/visulima/visulima/commit/1a7165cd9eb71472895cd08682983fa25703dc93))
* **tsconfig:** add node types and fix implicit any parameter ([1744d82](https://github.com/visulima/visulima/commit/1744d82a07fca03f2e6ff660b918e9b2623acf69))

### Miscellaneous Chores

* added og images ([02d9d1e](https://github.com/visulima/visulima/commit/02d9d1e47be3ce75679ea89e857dc4e4bfe4946b))
* **task-runner:** add tsconfig.eslint.json for type-aware linting ([83e0bf2](https://github.com/visulima/visulima/commit/83e0bf23511a169b801f6edf652a8be7ee968c24))
* **task-runner:** apply prettier formatting ([521afc2](https://github.com/visulima/visulima/commit/521afc22d94a2626c7246062cecfc0627f929ee4))
* **task-runner:** expand inline if-return to block syntax ([0f48a96](https://github.com/visulima/visulima/commit/0f48a96ed11d7339c62f3f147c7b2c8fcc605b03))
* **task-runner:** migrate .prettierrc.cjs to prettier.config.js ([cd1c045](https://github.com/visulima/visulima/commit/cd1c045e133f685a274924034ec70cf374edd5ba))

### Build System

* regenerate NAPI-RS bindings as ESM ([f202caf](https://github.com/visulima/visulima/commit/f202caf3dc383a2ec24815c4935d8d68c29f33d0))
* switch NAPI-RS native builds to ESM output ([3d7cd61](https://github.com/visulima/visulima/commit/3d7cd615ad830392005915735c11771e0247ef3f))
* **task-runner:** move publish-native-addons to shared scripts/ ([73b5482](https://github.com/visulima/visulima/commit/73b5482e1ca0707aa8f191429deffbd7324a632d))


### Dependencies

* **@visulima/humanizer:** upgraded to 3.0.0-alpha.9
* **@visulima/path:** upgraded to 3.0.0-alpha.8

## @visulima/task-runner [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.2...@visulima/task-runner@1.0.0-alpha.3) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

### Miscellaneous Chores

* **task-runner:** remove redundant extends from .releaserc.json ([8969dfa](https://github.com/visulima/visulima/commit/8969dfaeccf3a36e40ecb9ba659187f81dda4ce1))

### Continuous Integration

* **task-runner:** use escaped newlines in git commit message template ([b3045b6](https://github.com/visulima/visulima/commit/b3045b6c2c5afc641c699932fbf90effe7c31563))


### Dependencies

* **@visulima/humanizer:** upgraded to 3.0.0-alpha.8
* **@visulima/path:** upgraded to 3.0.0-alpha.7

## @visulima/task-runner [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.1...@visulima/task-runner@1.0.0-alpha.2) (2026-03-26)

### Bug Fixes

* **task-runner:** publish native binding packages with version lockstep via exec plugin ([12e342f](https://github.com/visulima/visulima/commit/12e342f1656ad0b595eaff627d3407c61c4ea7b6))

### Miscellaneous Chores

* **task-runner:** add project.json for all native binding packages ([eb48812](https://github.com/visulima/visulima/commit/eb48812cb87c0990b9822d9314ccc0081e41d11f))

## @visulima/task-runner 1.0.0-alpha.1 (2026-03-26)

### Features

* Add @visulima/task-runner , vis and find-ai-runner ([#594](https://github.com/visulima/visulima/issues/594)) ([034b5db](https://github.com/visulima/visulima/commit/034b5db8aadcc02e23abe007208c5196859c7755))


### Dependencies

* **@visulima/humanizer:** upgraded to 3.0.0-alpha.7
* **@visulima/path:** upgraded to 3.0.0-alpha.6
