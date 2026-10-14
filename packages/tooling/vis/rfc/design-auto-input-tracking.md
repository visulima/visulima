# Design: automatic input tracking, clean env, and compound-command splitting

Status: draft. Written after the trace-mode work in `@visulima/task-runner`
(per-target `hashMode: "trace"`, `vis run --hash-mode`, persisted miss reasons,
per-target env options). This RFC records what already exists, the gaps that
remain, and a staged plan. Nothing here requires new native code for stages 1
and 2; stage 3 is optional.

## Current state

**Automatic input tracking is shipped, opt-in.**

- Per target: `hashMode: "trace"` in `vis.config.ts` (or `project.json`).
- Per run: `vis run <target> --hash-mode trace` (`--hash-mode declared` overrides
  a configured trace target).
- Workspace: `taskRunner.autoFingerprint: true`.

The default stays `"declared"`. Tracing is opt-in because the observed read set
depends on the platform, so a trace key is not portable between machines.

**Tracker dispatch** (`packages/tooling/task-runner/src/tracked-executor.ts`):

1. Linux: `strace`, or the bundled seccomp helper. Full syscall coverage,
   child processes included.
2. macOS (DYLD interpose) and Windows (IAT hook): used only for commands run
   directly, without a shell. Shell-syntax commands cannot be injected.
3. Everywhere: a Node preload shim. It sees `fs` calls made by Node processes
   only.

**Miss explanations** (added with this change):

- A traced miss records its reasons on the run summary (`cacheMissReasons`,
  capped at 50): changed file, deleted file, created file, changed env var,
  changed command arguments, or `no-fingerprint` on a first run.
- `vis cache why <task>` prints those reasons for traced tasks, and diffs
  `hashDetails` for declared ones.
- `vis cache hash <task>` prints the files, env names and missing paths that a
  traced run tracked. They are read from the cache entry for the run's hash.

**Env options**: `fingerprintEnv` and `untrackedEnv` per target, and
`fingerprintEnvPatterns` / `untrackedEnvVars` workspace-wide. All accept `*`
wildcards. Explicit `env://` inputs and `envVars` / `globalEnv` are never
filtered.

## Gaps

### G1. An empty tracker means "do not cache", not "fall back to declared"

**Status: done (option B).** Stage 1 implements option B below.

`TrackedTaskExecutor.isTrackingSupported` returns `true` unconditionally. When
the tracker observes no workspace access, the orchestrator sets
`emptyFingerprint`, prints a warning, and skips the cache write. A target that
declares `inputs` therefore gets no caching in that environment, even though
its declared key would be valid.

The `autoFingerprint` doc comment in `types.ts` was corrected earlier to say that
an empty run is not cached. Stage 1 changes that behaviour, so the comment now
describes the fallback.

Options:

- **A.** Keep the current behaviour (no cache, warning). Simple and safe. Cost:
  silent slowness on hosts without strace, which the warning only partly
  surfaces.
- **B.** When the tracker is empty and the target declares `inputs`, key the
  run on the declared hash. Only then is the declared key authoritative, since
  the declared path already computes it. Targets without `inputs` stay on
  option A.
- **C.** Compute the declared hash for every traced run and record both keys.
  Doubles hashing work. Only worth it for diagnostics.

**Recommendation: B.** Implemented. The declared hash is computed after the run,
and only when the tracker was empty. Nothing tracked means the run used no
workspace input, so the inputs hashed afterwards are the ones it used. The
lookup computes the declared hash only for an indexed fallback entry (one with
no fingerprint), so non-fallback runs do no extra hashing. `TaskResult.hashSource`
(`"declared-fallback"`) records the key, and `vis cache why` prints it.

The fallback used to be visible only in `vis cache why` and the run summary. The
run that stores a fallback entry now also fires `printDeclaredFallback(task)`,
and vis prints one informational line for it, so the choice is visible while the
run is still on screen. It is never a warning, it fails nothing, and quiet output
hides it. A cache hit does not print it.

### G2. No clean-environment default

Every task inherits the full `process.env`. Env vars the command reads but that
are not in any key source can change its output without busting the cache. Two
mitigations already exist: `strictEnv` fails a task that references an unset
variable, and `autoEnvVars` keys on referenced variables. Neither covers a
variable the command reads implicitly (through a config file or a library).

Options:

- **A.** Keep inherit-by-default and document it. No behaviour change.
- **B.** Opt-in `taskRunner.env: { mode: "clean", allow: [...] }`. The child
  receives only the allow-list, `PATH`, `HOME`, `TERM`, and the
  `VIS_*` / `CI` variables vis sets itself. Breaking for any target that relies
  on inherited variables, so it must be opt-in per workspace.
- **C.** Per target, as in B, plus a `vis doctor` check that reports targets
  whose command references env not present in any key source.

**Recommendation: B with C later.** The allow-list must include everything vis
itself injects (`VIS_TASK_SLOTS`, service env, run-argument env). Those are the
main correctness risk.

**Status: B and C done.** `taskRunner.env` sets the workspace
policy and `options.env` overrides it per target. `vis run` applies the policy
on every spawn path: the executor, persistent targets and the TUI retry. The
names vis sets on its own process and the names it injects per task are listed
in `vis/src/commands/run/task-env.ts` (`VIS_PARENT_ENV_NAMES`,
`VIS_TASK_INJECTED_NAMES`). A source scan fails on a `process.env` write that
is neither allow-listed nor exempt with a reason. Docs: `commands/run.mdx`
("Clean child environment") and `guides/caching.mdx`.

Decisions taken while implementing B:

- Clean mode forces the JS spawner. The native addon always copies the parent
  environment, so `ConcurrentCommandConfig.inheritEnv: false` is honoured only
  there.
- A name the clean child cannot see hashes as unset. The hasher applies this
  only when the executor is given the `childEnvPolicy` hook, because that hook
  says the executor enforces the policy. Without it every name is keyed as the
  parent sees it. Keying an omitted name gives a stale hit, while an extra name
  only costs a miss.
- A clean target that runs with syscall tracking gets the same child environment as an
  executor task. The orchestrator asks the caller for it (`TaskRunnerContext.resolveChildEnv`),
  so a traced run and an executor run cannot diverge. The native trackers (seccomp,
  interpose, IAT) inherit the parent environment and are not used under clean: Linux
  traces with strace, other platforms with the Node preload. Its fingerprint keys only
  the names the clean child can see.
- `NODE_OPTIONS` and `npm_config_*` are dropped under clean mode unless
  allow-listed.

Resolved: traced and persistent tasks now receive the vis environment (`VIS_TASK_SLOTS`,
`VIS_ARG_*`, `envFile` values, service env, `INIT_CWD`, affected-files env) through the
same function as the executor (`resolveTaskSpawn`). The TUI retry of an interactive task
still injects nothing; it only decides inheritance.

Resolved for traced targets: the key now hashes the values the child receives, not the
parent's. The names it covers (`fingerprintEnv`, the tracker's `getEnv` hints) are read from
the resolved child env, presence-distinct (unset and empty differ), and a name the clean
policy hides hashes as unset. A change to an `envFile` value that a key names busts the
key. The key also covers the spawned command (forwarded args, `affectedFiles: "args"`
paths, custom shell), built by the same resolver the executor uses. The `strictEnv` check
runs before a traced child spawns, against the same child env, and a failure is not cached.
Declared targets follow the same rule: `envVars`, `fingerprintEnv` (including wildcard
patterns), `env://` inputs, `autoEnvVars` and framework-inferred names are read from the
child env the task receives, so a value that only an `envFile` defines now busts the key.
`globalEnv` is workspace-wide and still reads the parent environment.

Gap found while resolving the above, not changed here: the declared hasher still reads
`process.env` for `envVars` and `fingerprintEnv`, so an `envFile` value that a declared
target names is not keyed. Persistent targets and the TUI retry spawn the raw
`overrides.command`, so forwarded arguments do not reach them.

Known gap: under clean, a traced run on macOS uses the Node preload instead of DYLD
interpose. The native addon starts each child from the parent environment and adds to it,
so it cannot honour a complete environment. Fixing that needs an explicit environment
clear in the native spawners (`native/src/macos.rs`, seccomp, Windows). Not done.

C is done: `vis doctor` lists, per declared target, the names its command
references (`$VAR`, `${VAR}`, `%VAR%`) that no key source covers. The check
reads the same discovery as `vis run`, exempts untracked, built-in and
vis-owned names, and skips trace-mode, uncached, `always` and clean-hidden
names. Docs: `commands/doctor.mdx` ("Env Coverage"). Only `--exit-code
--strict` fails on a gap.

Gap found while building C, not changed here: the built-in untracked patterns
(`CI_*`, `GITHUB_*`, …) reach only the trace-mode orchestrator. The declared
hasher gets just the user list, so under `autoEnvVars` a referenced CI name is
keyed. The doctor check exempts those names, so it does not report that case.

### G3. Compound commands cache as one unit

`cmd1 && cmd2 && cmd3` is a single task with one key. Changing `cmd3` reruns
`cmd1` and `cmd2`, and a hit restores all three. `command-parser/` only expands
`npm:` shortcuts, `npm run watch-*` wildcards and `{1}` placeholders. It has no
shell-segment awareness, so this is not a small addition.

Design sketch:

- **Scope.** Split only on top-level `&&`. Do not split `;`, `||`, `|`, `&`,
  subshells `( … )`, command substitution `$( … )`, or anything inside quotes.
  A command containing any unsupported construct stays whole.
- **Segments.** Each segment becomes a synthetic child of the task with an id
  such as `app:build#1`, and it has its own key.
- **Chaining.** Segment _n_'s key folds in segment _n−1_'s key. Earlier segments
  can change the working directory or the environment, so a segment must not
  hit on its own inputs alone.
- **Shell state.** `cd` changes the working directory for later segments.
  `export X=…` and `VAR=… cmd` change the env. The parser must either model
  these or refuse to split when they appear. Refusing is the first stage.
- **Failure.** A failing segment stops the chain, as `&&` already does. Later
  segments are neither run nor cached.
- **Outputs.** Declared outputs attach to the last segment. An earlier segment
  that writes an output must declare it, or the chain is refused.

Staged:

1. **Done.** Parser only, in `command-parser/`: `splitCompoundCommand` splits
   top-level `&&` with quote-aware tokenising and refuses (returns the command
   whole, with a reason) on `cd`, `export`, `VAR=` prefixes and any other
   unsupported construct. Unit tests on the parser alone. No behaviour change.
2. **Done.** Opt-in `splitCompound: true` on a target, declared mode only. The
   engine rewrites the task into chained segment tasks (`target#1`, `target#2`),
   each folding in the previous segment's key. A failing segment stops the chain.
   Declared outputs attach to the last segment. `{ auto: true }` outputs,
   `when`, `always`, and custom shells are refused with a warning. Stage 3
   lifted the trace-hashing and auto-fingerprinting refusals. Limitation: a partial cache hit does not restore an
   earlier segment's files, so a later segment that reads one can fail on a
   clean checkout. The caching guide tells users to split such chains into
   separate targets. Integration tests cover the last-segment and
   first-segment key behaviour, the failing middle segment, the unsupported
   construct, trace and auto-fingerprint refusal, output restore on a full hit,
   and output replay order. A vis-level test covers the option forwarding, the
   last-segment-only forwarded arguments, and the dry-run plan.
3. **Done.** Trace mode per segment. Each segment is a task of its own, so the
   tracker runs on its own command and its reads belong to that segment. No
   attribution across segments is needed.

    The trace key chains. A segment's fingerprint carries `chainKey`, the trace
    key its predecessor settled on in this run. `hashFingerprint` folds it in
    only when it is set, so the key of every other task is unchanged (a test
    pins two keys from before this change). On lookup, `validateChain` compares
    the stored key with the current predecessor's, after the command and tracker
    checks and before any file is hashed. A moved predecessor misses with
    `chain-changed`, and the miss names the segment that moved in `vis cache why`.

    The predecessor's key is its `hash`. A traced segment sets `hash` on a hit as
    well as on a store, so the segment after it can fold it. The orchestrator
    sets it only for segments, which leaves the declared dependents of other
    traced targets as they were (see the limits below).

    A segment whose predecessor has no key this run is neither served nor stored.
    That happens when the predecessor modified its own input, when its tracker saw
    nothing and it declares no `inputs`, or when it set `disableCache`. The chain
    before such a segment is unknown.

    Two existing pieces had to be made segment-aware. The default command resolver
    now reads a segment's command from its overrides, so the tracker and the
    tracker-kind prediction see the segment's command and not the whole chain. The
    service env is keyed on the target's id, so a segment's spawn resolves its
    target's entry.

    Refusals kept: `{ auto: true }` outputs (write tracking covers the whole
    target), `when`, `always`, a custom shell, and every unsupported construct.
    The trace-mode and auto-fingerprint refusals are removed.

    Limits:

    - A partial hit does not restore an earlier segment's files. This is the same
      as declared mode.
    - An unkeyed predecessor makes its successors re-run on every run until a
      keyed run comes through.
    - Found while implementing, not changed here: a declared dependent of a traced
      target folds that target's key only on runs where it stored. A hit leaves
      `hash` unset, so the dependent's key flips with the hit and misses on the
      next run. Fixing it changes keys for targets that are not split, so it
      needs its own upgrade note.
    - Found while testing, not changed here: the Node preload tracker loses the
      reads of a process that calls `process.exit()`, so the run is observed as
      empty. The integration tests set `process.exitCode` instead.

### G4. Trace keys are not portable across platforms

**Status: done.** The trace key includes the tracker kind (`seccomp`, `strace`,
`interpose`, `iat`, `preload`); see `hashFingerprint` in `fingerprint.ts`.

A trace key depends on which files the tracker can see, so the same workspace
can produce different keys on Linux and macOS. The existing cache is local, so
this only matters for a shared remote cache. Options: refuse to upload traced
entries to a remote cache (simplest), or include the tracker kind in the key
(`tracker: "strace" | "interpose" | "preload"`). The second option is one line
in `task-hasher` and avoids accidental cross-platform hits.

**Recommendation:** include the tracker kind in the key as part of stage 1 of G1.

**Lookup check (done).** The key only helps a remote cache. A local lookup goes
through the task index, which returns the last stored entry, and that entry can
come from a different tracker. Its file hashes then say nothing about this run,
because a different mechanism sees a different set of files. So the lookup
rejects such an entry with `tracker-changed` before any file is hashed.

- **When the kind is known.** The kind is decided before the run, not after it.
  `TrackedTaskExecutor.trackerKindFor(command)` applies the same host checks and
  command shape that `execute` dispatches on, so the lookup can compare the
  kinds without running the command. Validating after the run would have to run
  the command just to learn that the stored entry is stale, and it could never
  short-circuit a hit. A parity test pins the prediction to `execute` on every
  dispatch branch.
- **Command-less tasks.** A task with no shell command runs without a tracker,
  so its prediction is `undefined`. A stored trace that recorded a tracker
  misses against it.
- **Older entries.** An entry with no recorded tracker (written before the kind
  joined the key) still hits, and its file hashes decide as before.
- **Declared-fallback entries.** They are keyed on the declared hash, which does
  not depend on the tracker, so they are not checked against it.
- **Cost.** A tracker change is one miss. The re-run stores its entry under the
  new kind, so alternating between two trackers misses on each change.

## Not doing

- Replacing the Node preload with a native shim for macOS shell commands. This
  needs a native build of the tracker, and the coverage gain is limited to the
  Node-only case the preload already handles.
- Windows shell-command coverage. The IAT hook has the same limit as on macOS.

## Ordering

| Stage | Item                                       | Native code | Breaking                                                      | Status |
| ----- | ------------------------------------------ | ----------- | ------------------------------------------------------------- | ------ |
| 1     | G1-B declared fallback for empty trace     | no          | no                                                            | done   |
| 1     | G4 tracker kind in the trace key           | no          | new trace keys after upgrade; old entries still hit           | done   |
| 1     | G4 validate stored trace against tracker   | no          | one miss when the tracker kind changes; old entries still hit | done   |
| 2     | G3.1 compound parser, refusing unsupported | no          | no                                                            | done   |
| 2     | G3.2 opt-in `splitCompound`, declared mode | no          | no                                                            | done   |
| 3     | G2-B opt-in clean env                      | no          | opt-in                                                        | done   |
| 3     | G2-C doctor env coverage check             | no          | no                                                            | done   |
| 3     | G3.3 trace-mode segments                   | no          | no                                                            | done   |

## References

- Existing tracker RFCs: [`task-runner` seccomp](../../task-runner/rfc/design-fspy-seccomp-unotify.md),
  [`task-runner` Windows detours](../../task-runner/rfc/design-fspy-windows-detours.md).
- Trace-mode types: `packages/tooling/task-runner/src/types.ts` (`hashMode`,
  `autoFingerprint`, `fingerprintEnvPatterns`, `untrackedEnvVars`).
- Miss reasons: `packages/tooling/task-runner/src/fingerprint.ts`
  (`describeCacheMissReason`), `src/run-summary.ts` (`cacheMissReasons`).
