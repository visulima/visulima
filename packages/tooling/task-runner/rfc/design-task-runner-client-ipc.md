# Design — Cooperative cache hints via `@visulima/task-runner-client`

Spec for a small, zero-dependency client package that lets a tool _tell_ the runner what to track — the cooperative counterpart to the transparent `seccomp`/`strace` observation in `file-access-tracker.ts`. Modelled on voidzero's [`vite-task-client`](https://github.com/voidzero-dev/vite-task/tree/main/packages/vite-task-client), but adapted to our post-exit fingerprint pipeline instead of their injected-napi-addon-with-IPC-backchannel design.

## Why

Auto-fingerprinting today is purely _observational_: the tracker watches syscalls and infers inputs/outputs with zero cooperation from the child. That's the right default — it works on unmodified tools — but it can't close three correctness gaps that only the tool itself knows about:

| Gap                                                                                     | Observation can't fix it because…                                           | Cooperative hint     |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------- |
| Tool-private caches read on every run (`node_modules/.cache/eslint`, `.eslintcache`)    | the read is real; only the tool knows it's noise, not a true input          | `ignoreInput(path)`  |
| Scratch/temp files written inside the workspace that aren't real build outputs          | the write is real; only the tool knows it's transient                       | `ignoreOutput(path)` |
| A run that's non-deterministic this time (network flake, `--watch` aborted, debug mode) | the result _looks_ cacheable; only the tool knows it shouldn't be           | `disableCache()`     |
| An env var consumed deep inside the tool that isn't in the config `env` patterns        | the runner never sees the read; the value silently isn't a cache dependency | `getEnv` / `getEnvs` |

The runner already has every **sink** for these hints (see [Integration](#integration-with-the-orchestrator)); what's missing is a way for the child to reach them. `vite-task-client` is _not_ reusable for this — it's an empty typed stub whose implementation lives in voidzero's proprietary runner addon, and it relies on a synchronous IPC back-channel we don't have. We mirror its **API shape** (so tools written against it work under our runner unchanged) on top of a transport that fits our pipeline.

Bonus over the syscall tracker: cooperative hints work on **every platform**, not just Linux. A Windows or macOS tool that adopts the client gets correct fingerprints today, long before the Detours/`fsmonitor` observation paths land.

## Approach

The key realisation: **we don't need a live IPC back-channel.** Two observations collapse the problem to a flat file.

1. **`getEnv` needs no synchronous round-trip.** vite-task's addon does blocking IPC because their child's env may be sandboxed/empty. Ours isn't — the runner already passes the full resolved env into the child (`withEnhancedPath({ ...process.env, ...options.env })` in every spawn branch). So `getEnv(name)` returns `process.env[name]` directly; the only thing that must reach the runner is the _dependency registration_ ("this run depends on `FOO`"), which is fire-and-forget.

2. **The fingerprint is computed after the child exits.** `createFingerprint(accesses, …)` runs once, post-exit, in `task-orchestrator.ts`. So hints don't need to be processed live — they only need to be _readable_ by the time that call happens.

That makes the transport a **per-task append-only NDJSON hints file** — the exact pattern `#runWithStrace` already uses for its trace log. No socket, no server, no lifecycle race, no sync-over-socket hackery.

```text
+-------------------------+        spawn (env: TASK_RUNNER_HINTS=<file>)
| task-runner (node)      | -------------------------------------------+
|  FileAccessTracker.track|                                            |
+-----------+-------------+                                            v
            |                                          +--------------------------------+
            |                                          | child process (the tool)       |
            |                                          |  import @visulima/task-runner-* |
            |                                          |  ignoreInput("…/.cache/x")      |
            |  (child exits)                           |  getEnv("API_URL")  ── reads ───+──> process.env
            v                                          |  disableCache()                 |
+-------------------------+                            |    each call: appendFileSync(   |
|  read + parse NDJSON     | <------- hints file ------+--      hintsFile, line + "\n")  |
|  fold into fingerprint   |                            +--------------------------------+
|  inputs; unlink file     |
+-------------------------+
```

Append-only + `appendFileSync` means the hint is durable the instant the call returns — even if the tool crashes or is SIGKILLed, the runner still sees every hint emitted before death. No flush-on-exit handler, no dropped-buffer risk.

### Client API

Ship `@visulima/task-runner-client` — zero runtime dependencies, dual ESM/CJS (tools spawned as task commands are a mix of both), tiny. API is a superset-compatible mirror of `vite-task-client`:

```ts
/** Drop reads under `path` from this run's inferred cache inputs. No-op outside a runner. */
export function ignoreInput(path: string): void;

/** Drop writes under `path` from this run's inferred cache outputs. No-op outside a runner. */
export function ignoreOutput(path: string): void;

/** Mark this run non-deterministic — the runner will not cache it. No-op outside a runner. */
export function disableCache(): void;

/**
 * Return process.env[name] AND (with tracked: true, the default) register `name`
 * as a cache dependency so a change to its value busts this task's cache entry.
 * Returns undefined outside a runner only if the var is genuinely unset.
 */
export function getEnv(name: string, options?: { tracked?: boolean }): string | undefined;

/**
 * Return every env whose name matches the glob `pattern` (e.g. "VITE_*") as an object,
 * AND (tracked: true default) register the pattern as a cache dependency.
 */
export function getEnvs(pattern: string, options?: { tracked?: boolean }): Record<string, string>;
```

Implementation sketch — the whole module is ~40 lines:

```ts
const HINTS = process.env.TASK_RUNNER_HINTS; // set by the runner; absent ⇒ every call is a no-op

const emit = (msg: object): void => {
    if (!HINTS) return;
    try {
        appendFileSync(HINTS, JSON.stringify(msg) + "\n");
    } catch {
        // Never let a hint failure break the user's task.
    }
};

export const ignoreInput = (path: string): void => emit({ op: "ignoreInput", path });
export const ignoreOutput = (path: string): void => emit({ op: "ignoreOutput", path });
export const disableCache = (): void => emit({ op: "disableCache" });

export const getEnv = (name: string, options = {}): string | undefined => {
    if (options.tracked !== false) emit({ op: "trackEnv", name });
    return process.env[name];
};

export const getEnvs = (pattern: string, options = {}): Record<string, string> => {
    if (options.tracked !== false) emit({ op: "trackEnvPattern", pattern });
    // resolve glob against process.env locally — runner re-resolves at hash time
    return matchEnv(pattern, process.env);
};
```

Path hints are resolved relative to the child's `cwd` on the runner side (same as `file-access-tracker.ts` does for relative strace/seccomp paths), so the client never has to resolve absolute paths.

### Wire protocol

Newline-delimited JSON, append-only, one object per call. Stable, versioned, forward-compatible (unknown `op`s are skipped by the reader with a debug log).

| `op`              | Fields    | Sink                                                          |
| ----------------- | --------- | ------------------------------------------------------------- |
| `ignoreInput`     | `path`    | drop matching `read`/`stat`/`readdir` accesses                |
| `ignoreOutput`    | `path`    | drop matching `write` accesses from `accesses` + `autoWrites` |
| `disableCache`    | —         | skip caching for this run                                     |
| `trackEnv`        | `name`    | append to this task's fingerprint env set                     |
| `trackEnvPattern` | `pattern` | append to this task's fingerprint env-pattern set             |

The runner sets two env vars before spawning the child, alongside the existing `withEnhancedPath` work:

- `TASK_RUNNER_HINTS` — absolute path to the per-task NDJSON file under `node_modules/.cache/task-runner/`, mirroring the strace trace-file location.
- `TASK_RUNNER_PROTOCOL` — integer, currently `1`. Lets a future client gracefully degrade against an older runner.

### Integration with the tracker

`FileAccessTracker.track()` gains one responsibility: allocate the hints file, export the env vars, and return its parsed contents alongside the accesses.

```ts
public async track(command, options): Promise<TrackingResult & { hints: Hint[] }>;
```

- File lives next to where `#runWithStrace` already mkdirs (`node_modules/.cache/task-runner`), named `hints-<uniqueId()>.ndjson`.
- The two extra env vars are merged into every spawn branch (`seccomp`, `strace`, `no-tracking`) — one helper, three call sites.
- After the child exits (in each branch's resolve), read the file if present, parse line-by-line (tolerant: skip malformed lines), `rm({ force: true })` it — same cleanup discipline as the trace file.
- Hints are returned _raw_; the orchestrator owns folding them into the fingerprint so the no-tracking/synthetic-reads branch can apply them too.

### Integration with the orchestrator

This is where it gets cheap — every sink already exists in `task-orchestrator.ts`. Folding happens immediately before the existing `createFingerprint` call (`task-orchestrator.ts:795`):

- **`ignoreInput` / `ignoreOutput`** → filter `trackedResult.accesses` (and the derived `autoWrites`, line 793) by the hint paths before `createFingerprint`. Reuses the same workspace-prefix + glob predicate as `#shouldExclude`.
- **`trackEnv` / `trackEnvPattern`** → concatenate onto `this.#fingerprintEnvPatterns` for _this task only_ before passing into `createFingerprint(…, patterns, …)`. `FingerprintManager` already turns patterns into `envHashes` (`fingerprint.ts:135`), and `env-changed` detection (`fingerprint.ts:232`) already busts on value change. **Zero changes to the hasher.**
- **`disableCache`** → set `result.cacheDisabledByTask = true` and extend the cache-write guard at `task-orchestrator.ts:849` with `&& !cacheDisabledByTask`. Semantically identical to the existing `task.cache !== false` gate, just sourced from the run instead of config. Surface it through the lifecycle (`printCacheDisabledByTask?.`) so `--summarize` and the cache-diagnostics path can explain the skip — matching how `emptyFingerprint`/`selfModified` already report.

No new native code, no new IPC server, no changes to `native-binding.ts`.

### `vis` integration

`vis` itself needs **nothing new** — it already contributes to fingerprints via `FingerprintContributor` / the `task:fingerprint` hook (`vis/src/util/hooks.ts:91`). The client is for **third-party tools spawned as task commands** (eslint, custom codegen, a bespoke bundler), not for vis's own plumbing. vis benefits transparently: any tool in a user's pipeline that adopts the client produces more accurate cache keys, and `vis run --summarize` / cache-diagnostics gain `disabledByTask` / `ignoredInput` / `trackedEnv` provenance lines for free once the orchestrator surfaces them.

## Plan

1. **Package scaffold** — `packages/tooling/task-runner-client/` following the standard layout (`src/index.ts`, dual ESM/CJS via packem, `project.json` with `type:package` + `category:dev-tools`, `.releaserc.json`). Zero `dependencies`. ~40 LOC + glob matcher.
2. **Protocol module** in `task-runner` — `src/cache-hints.ts`: `Hint` type, env-var names, NDJSON parse/serialise, `applyHints(accesses, autoWrites, patterns, hints)` pure function. Unit-tested in isolation.
3. **Tracker wiring** — allocate hints file + export env vars in all three `track()` branches; return parsed hints. Reuse trace-file mkdir/cleanup.
4. **Orchestrator wiring** — fold hints before `createFingerprint`; add `cacheDisabledByTask` gate + lifecycle method; thread per-task env patterns.
5. **Lifecycle + summary** — `printCacheDisabledByTask?.`, plus run-summary fields (`disabledByTask`, `ignoredInputs`, `ignoredOutputs`, `trackedEnv`).
6. **Tests** — client no-op when env unset; each `op` round-trips through file → `applyHints`; `disableCache` skips `cache.put`; `ignoreInput` removes a read from the fingerprint; `getEnv` tracking busts on value change; malformed-line tolerance; crash-mid-run still yields prior hints.
7. **Docs** — README for the client package + a section in `task-runner`'s README cross-linking the two fingerprint philosophies (observe vs. cooperate).

## Non-goals

- **No live/synchronous IPC.** `getEnv` returns from `process.env`; everything else is fire-and-forget. If a future need arises for the runner to answer the child mid-run (e.g. dynamic secrets), that's a separate RFC and would justify the socket + native addon vite-task uses.
- **No sandboxing or value injection.** Unlike vite-task's runner, we don't strip the child's env, so the client never has to _fetch_ values — only register dependencies. We won't add value-injection just for parity.
- **Not a replacement for observation.** Cooperative hints _refine_ the syscall-tracked fingerprint; they don't replace it. A tool that emits no hints behaves exactly as today.
- **No client auto-install.** The client is opt-in for tool authors; the runner never injects it.

## Risks

- **Trust boundary.** Hints are advisory and tool-supplied — a buggy `ignoreInput("/")` could mask a real input and produce a false cache hit. Mitigation: clamp every hint path to the workspace root (reuse `#shouldExclude`'s prefix check), and record applied hints in the run summary so a stale hit is debuggable. `disableCache` is always safe (it only _removes_ caching).
- **Append-file contention.** Multiple child processes (forks) sharing one `TASK_RUNNER_HINTS` file all `appendFileSync` to it. POSIX `O_APPEND` writes under the pipe-buf size (~4 KB) are atomic, and our lines are far smaller — so interleaving is safe. Document the per-line size ceiling in the client.
- **Windows append atomicity.** `appendFileSync` maps to `FILE_APPEND_DATA`, which is atomic per write on NTFS for small writes. Validate under the Job-Object spawn path; fall back to per-pid hint files (`hints-<id>-<pid>.ndjson`, globbed on read) if contention shows up.
- **Protocol drift vs. vite-task.** Their client may add ops we don't implement. We skip unknown ops with a debug log rather than erroring, so a vite-task-targeted tool degrades gracefully instead of crashing.
- **Stale hint files.** A SIGKILLed runner could orphan a `hints-*.ndjson`. Same exposure the strace trace file already has; the existing cache-dir cleanup covers it.
