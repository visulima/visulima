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

`TrackedTaskExecutor.isTrackingSupported` returns `true` unconditionally. When
the tracker observes no workspace access, the orchestrator sets
`emptyFingerprint`, prints a warning, and skips the cache write. A target that
declares `inputs` therefore gets no caching in that environment, even though
its declared key would be valid.

The `autoFingerprint` doc comment in `types.ts` claims a fallback to declared
inputs. That was inaccurate and is corrected alongside this RFC.

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

**Recommendation: B.** It is a TS-only change in `task-orchestrator.ts`. It
needs the declared hash computed before the trace lookup, and a result flag
(`hashSource: "declared-fallback"`) so `cache why` can say which key was used.

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

1. Parser only, in `command-parser/`: split top-level `&&` with quote-aware
   tokenising, refuse on `cd`, `export`, `VAR=` prefixes and any unsupported
   construct. Unit tests on the parser alone. No behaviour change.
2. Opt-in `splitCompound: true` on a target, declared mode only, with the
   chained key. Integration tests on a two-segment fixture.
3. Trace mode per segment, after the tracker can attribute accesses to a
   segment. Depends on G1.

### G4. Trace keys are not portable across platforms

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

| Stage | Item                                       | Native code | Breaking                    |
| ----- | ------------------------------------------ | ----------- | --------------------------- |
| 1     | G1-B declared fallback for empty trace     | no          | no                          |
| 1     | G4 tracker kind in the trace key           | no          | cache miss once per upgrade |
| 2     | G3.1 compound parser, refusing unsupported | no          | no                          |
| 2     | G3.2 opt-in `splitCompound`, declared mode | no          | no                          |
| 3     | G2-B opt-in clean env                      | no          | opt-in                      |
| 3     | G3.3 trace-mode segments                   | no          | no                          |

## References

- Existing tracker RFCs: [`task-runner` seccomp](../../task-runner/rfc/design-fspy-seccomp-unotify.md),
  [`task-runner` Windows detours](../../task-runner/rfc/design-fspy-windows-detours.md).
- Trace-mode types: `packages/tooling/task-runner/src/types.ts` (`hashMode`,
  `autoFingerprint`, `fingerprintEnvPatterns`, `untrackedEnvVars`).
- Miss reasons: `packages/tooling/task-runner/src/fingerprint.ts`
  (`describeCacheMissReason`), `src/run-summary.ts` (`cacheMissReasons`).
