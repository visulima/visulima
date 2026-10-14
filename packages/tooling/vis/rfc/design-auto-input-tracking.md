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
- A clean target that would run with syscall tracking (`hashMode: "trace"`, or a
  workspace `autoFingerprint`) fails before the run starts. Tracked runs bypass
  the executor that builds the clean environment.
- `NODE_OPTIONS` and `npm_config_*` are dropped under clean mode unless
  allow-listed.

Finding outside this change (already true under `inherit`): tasks on the
tracked path run without the vis executor, so they never receive
`VIS_TASK_SLOTS`, `VIS_ARG_*`, `envFile` values or service env. Reproduced with
a `hashMode: "trace"` target that printed `VIS_TASK_SLOTS` as absent, next to a
declared target that printed `1`. Fixing it means passing the vis environment
into `TrackedTaskExecutor.execute`, which belongs to the trace work in G1 and G4.

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
   `when`, `always`, trace hashing, auto-fingerprinting and custom shells are
   refused with a warning. Limitation: a partial cache hit does not restore an
   earlier segment's files, so a later segment that reads one can fail on a
   clean checkout. The caching guide tells users to split such chains into
   separate targets. Integration tests cover the last-segment and
   first-segment key behaviour, the failing middle segment, the unsupported
   construct, trace and auto-fingerprint refusal, output restore on a full hit,
   and output replay order. A vis-level test covers the option forwarding, the
   last-segment-only forwarded arguments, and the dry-run plan.
3. Trace mode per segment, after the tracker can attribute accesses to a
   segment. Depends on G1. **Not started.**

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

## Not doing

- Replacing the Node preload with a native shim for macOS shell commands. This
  needs a native build of the tracker, and the coverage gain is limited to the
  Node-only case the preload already handles.
- Windows shell-command coverage. The IAT hook has the same limit as on macOS.

## Ordering

| Stage | Item                                       | Native code | Breaking                                            | Status |
| ----- | ------------------------------------------ | ----------- | --------------------------------------------------- | ------ |
| 1     | G1-B declared fallback for empty trace     | no          | no                                                  | done   |
| 1     | G4 tracker kind in the trace key           | no          | new trace keys after upgrade; old entries still hit | done   |
| 2     | G3.1 compound parser, refusing unsupported | no          | no                                                  | done   |
| 2     | G3.2 opt-in `splitCompound`, declared mode | no          | no                                                  | done   |
| 3     | G2-B opt-in clean env                      | no          | opt-in                                              | done   |
| 3     | G2-C doctor env coverage check             | no          | no                                                  | done   |
| 3     | G3.3 trace-mode segments                   | no          | no                                                  | open   |

## References

- Existing tracker RFCs: [`task-runner` seccomp](../../task-runner/rfc/design-fspy-seccomp-unotify.md),
  [`task-runner` Windows detours](../../task-runner/rfc/design-fspy-windows-detours.md).
- Trace-mode types: `packages/tooling/task-runner/src/types.ts` (`hashMode`,
  `autoFingerprint`, `fingerprintEnvPatterns`, `untrackedEnvVars`).
- Miss reasons: `packages/tooling/task-runner/src/fingerprint.ts`
  (`describeCacheMissReason`), `src/run-summary.ts` (`cacheMissReasons`).
