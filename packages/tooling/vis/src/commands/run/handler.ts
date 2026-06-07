import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { readFileSync, removeSync } from "@visulima/fs";
import type {
    ConcurrentCommandInput,
    LifeCycleInterface,
    LogMode,
    ProcessEvent,
    TargetConfiguration,
    Task,
    TaskResults,
    TaskRunnerOptions,
    TaskTarget,
} from "@visulima/task-runner";
import {
    CompositeLifeCycle,
    createLogReporter,
    createTaskGraph,
    defaultTaskRunner,
    enforceProjectConstraints,
    expandTokensInString,
    generateRunSummary,
    getLastRunSummaryPath,
    parsePartition,
    readLastRunSummary,
    resolveTurboEnvCompat,
    reverseTaskGraph,
    runConcurrently,
    TaskScheduler,
    TerminalBuffer,
    writeChromeTrace,
    writeRunSummary,
} from "@visulima/task-runner";
import type { Hookable } from "hookable";
import isInCi from "is-in-ci";

import { applyBranchScope, resolveSharedCacheDirectory } from "../../cache/cache-directory";
import { buildProjectGraph, discoverWorkspace, loadVisTaskConfigsForWorkspace } from "../../config/workspace";
import { runLockfilePreflight } from "../../preflight/lockfile";
import { maybePromptViteClientOverride } from "../../preflight/vite-client-override";
import { FailureLogLifeCycle } from "../../report/failure-log";
import { analyzeFlakiness, formatFlakinessTable } from "../../report/flakiness";
import { compareDuration, formatTimingSummary, loadRunSummaries } from "../../report/run-report";
import { runToolchainPreflight } from "../../runtime/toolchain";
import { runReadiness } from "../../services/readiness";
import { deleteEntry, readAllEntries } from "../../services/registry";
import type { ServiceEntry } from "../../services/types";
import { decidePty } from "../../task/pty-decision";
import { filterProjectsByQuery, resolveSelector } from "../../task/selectors";
import { resolveSkipCachePatterns } from "../../task/skip-cache";
import { checkStrictEnv, formatStrictEnvError } from "../../task/strict-env";
import {
    buildAliasMap,
    collectAvailableTargets,
    formatTargetList,
    promptTargetInteractively,
    resolveTargetAlias,
    suggestTargets,
} from "../../task/target-discovery";
import type { VisTargetConfiguration, VisTargetOptions } from "../../task/target-options";
import { detectCurrentOs, loadEnvFile, matchesRunnerTags, resolveTargetShell, resolveTaskCwd, shouldRunInCI } from "../../task/target-options";
import { ServiceDockStore } from "../../tui/components/service-dock/service-dock-store";
import type { TaskStore } from "../../tui/components/task-store";
import { createDynamicOutputRenderer } from "../../tui/dynamic-life-cycle";
import { parseOutputStyle, StaticOutputLifeCycle } from "../../tui/static-life-cycle";
import type { StdinEntry } from "../../tui/types";
import type { VisHooks } from "../../util/hooks";
import { createVisHooks, HookableLifeCycle, registerPlugins } from "../../util/hooks";
import { appendToShellHistory } from "../../util/shell-history";
import { scheduleTimeoutKill } from "../../util/signal-escalation";
import { cleanupLegacyTaskRunnerLayout, getVisWorkspaceDataDir } from "../../util/vis-paths";
import { collectTrackedWatchTargets, createTrackedFileFilter, startWatcher } from "../../watch/watch";
import { applyProjectFilter } from "../../watch/watch-filter";
import type { KeybindHandle } from "../../watch/watch-keybinds";
import { installKeybinds, writeHelp } from "../../watch/watch-keybinds";
import { applyServiceRegistry } from "./apply-service-registry";
import type { RunOptions } from "./index";
import type { ServiceBridgeEntry } from "./service-event-bridge";
import { ServiceEventBridge } from "./service-event-bridge";
import { buildBootstrapPaths, extractPreflightTasks, injectServiceTasks, resolveServicesPolicy } from "./service-preflight";
import { resolveTaskArguments } from "./task-arguments";

const AFFECTED_FILES_ENV = "VIS_AFFECTED_FILES";

/**
 * Per-service readiness re-check budget for the auto-attach probe.
 * Short on purpose — we run this once per registered service on every
 * `vis run`, so a slow probe would tax interactive workflows. If the
 * service can't respond inside this budget, treat it as unhealthy and
 * tell the operator to restart.
 */
const SERVICE_PROBE_TIMEOUT_MS = 2000;

interface PersistentTasksLifecycleHooks {
    /** Resolves when the TUI exits (user pressed `q`/Ctrl+C); triggers an abort. */
    abortSignal?: Promise<void>;
    lifeCycle: LifeCycleInterface;
    /** Registry of writable stdin entries keyed by task ID, for interactive PTY input. */
    stdinRegistry?: Map<string, StdinEntry>;
    store: TaskStore;
}

/**
 * Runs persistent tasks (dev servers, watch mode) as a concurrent batch.
 * Persistent tasks never cache and never return a "result" — they run
 * until interrupted or until all of them exit.
 *
 * When invoked from the TTY path, `lifecycleHooks` is supplied so output
 * streams into the dynamic TUI store and the `done` state is suspended
 * until the persistent tasks exit. Without it, an `onEvent` no-op still
 * forces the JS fallback in `runConcurrently` (the variant with
 * hardened SIGINT/SIGTERM/exit cleanup).
 */
const runPersistentTasks = async (
    tasks: Task[],
    workspaceRoot: string,
    affectedFiles: string[] | undefined,
    initCwd: string,
    lifecycleHooks?: PersistentTasksLifecycleHooks,
    serviceEnvByTaskId?: ReadonlyMap<string, Record<string, string>>,
): Promise<void> => {
    const commands = tasks
        .map((task) => {
            const command = task.overrides["command"] as string | undefined;

            if (!command) {
                return undefined;
            }

            const visOptions = task.overrides["visOptions"] as VisTargetOptions | undefined;
            const cwd = resolveTaskCwd(workspaceRoot, task.projectRoot, Boolean(visOptions?.runFromWorkspaceRoot));

            const envFileVars = visOptions?.envFile ? loadEnvFile(cwd, visOptions.envFile) : {};
            const affectedEnv
                = affectedFiles && (visOptions?.affectedFiles === "env" || visOptions?.affectedFiles === "both")
                    ? { [AFFECTED_FILES_ENV]: affectedFiles.join("\n") }
                    : {};
            const serviceEnv = serviceEnvByTaskId?.get(task.id) ?? {};

            // Persistent tasks are dev servers / watchers. Under the live
            // TUI run them through a PTY by default so TTY-aware CLIs
            // (convex, vite, next, …) emit their full interactive output
            // instead of detecting a pipe and going quiet — only the first
            // unconditional line would otherwise reach us. Opt out with
            // `visOptions.pty: false`. The non-TUI path keeps pipe mode:
            // there's no terminal to emulate and output is line-oriented.
            //
            // Per-target `task.pty` (carried over from
            // TargetConfiguration.pty) wins over both workspace toggles —
            // a single target can force PTY (e.g. vitest, prettier with
            // colors) or suppress it (`pty: false`) regardless of the
            // ambient TUI state. See `task/pty-decision.ts` for the
            // shared resolution logic.
            const usePty = decidePty({
                interactive: Boolean(lifecycleHooks),
                taskPty: task.pty,
                workspacePty: visOptions?.pty,
            });

            return {
                command,
                cwd,
                env: {
                    INIT_CWD: initCwd,
                    ...envFileVars,
                    ...serviceEnv,
                    ...affectedEnv,
                    ...(task.overrides[TASK_ARG_ENV_KEY] as Record<string, string> | undefined),
                },
                name: task.id,
                ...(usePty
                    ? {
                        ptySize: { cols: process.stdout.columns ?? 80, rows: process.stdout.rows ?? 24 },
                        stdin: "pty" as const,
                    }
                    : {}),
            };
        })
        .filter((c): c is NonNullable<typeof c> => c !== undefined);

    if (commands.length === 0) {
        return;
    }

    if (!lifecycleHooks) {
        await runConcurrently(commands as ConcurrentCommandInput[], {
            killOthers: ["failure"],
            onEvent: () => {
                // No-op — presence forces the JS fallback path, which is
                // the one with the hardened signal cleanup.
            },
        });

        return;
    }

    const { abortSignal, lifeCycle, stdinRegistry, store } = lifecycleHooks;
    // Map runConcurrently's positional `index` back to the originating
    // Task — runConcurrently doesn't echo `name` on stdout/stderr/started
    // events, only on `close`. Keeping a parallel array preserves the
    // ordering invariant without trusting per-event metadata.
    const runnableTasks = commands.map((c) => tasks.find((t) => t.id === c.name)!).filter(Boolean);

    // PTY tasks emit raw ANSI (cursor moves, in-place spinner redraws) as a
    // single merged stdout stream. Feed each through its own TerminalBuffer
    // so `toString()` yields a normalized frame, then REPLACE the stored
    // output (`setOutput`) rather than appending — the buffer already holds
    // the full accumulated frame. Pipe-mode tasks keep the line-append path.
    const isPtyIndex = (index: number): boolean => (commands[index] as { stdin?: string } | undefined)?.stdin === "pty";
    const termBuffers = new Map<number, TerminalBuffer>();
    const getTermBuffer = (index: number): TerminalBuffer | undefined => {
        if (!isPtyIndex(index)) {
            return undefined;
        }

        let buf = termBuffers.get(index);

        if (!buf) {
            buf = new TerminalBuffer(MAX_OUTPUT_BYTES);
            termBuffers.set(index, buf);
        }

        return buf;
    };

    // The orchestrator already called endCommand() → markDone() on the
    // store; reverse it so the TUI keeps the task table visible while
    // the persistent tasks run. markDone() runs again in the finally
    // block so the post-exit summary surfaces normally.
    store.unmarkDone();
    lifeCycle.startTasks?.(runnableTasks);

    const startTimeById = new Map<string, number>();
    const killHandles = new Map<number, (signal?: string) => void>();
    let escalationTimer: ReturnType<typeof setTimeout> | undefined;

    const killAll = (): void => {
        for (const kill of killHandles.values()) {
            try {
                kill("SIGTERM");
            } catch {
                // Process already gone.
            }
        }

        // Some dev servers ignore SIGTERM (or have child workers that
        // outlive the parent). Escalate to SIGKILL after a grace period
        // so `q` actually exits without forcing the user to Ctrl+C.
        // Don't clear handles synchronously — we still need them for the
        // SIGKILL pass.
        if (!escalationTimer) {
            escalationTimer = setTimeout(() => {
                for (const kill of killHandles.values()) {
                    try {
                        kill("SIGKILL");
                    } catch {
                        // Process already gone.
                    }
                }

                killHandles.clear();
            }, 2000);
            escalationTimer.unref?.();
        }
    };

    // When the TUI unmounts (`q` or Ctrl+C inside the React app), the
    // promise resolves before runConcurrently's signal handlers fire —
    // explicitly kill so the persistent run doesn't outlive the UI.
    let abortListener: (() => void) | undefined;

    if (abortSignal) {
        abortListener = (): void => {
            killAll();
        };

        abortSignal
            .then(() => {
                abortListener?.();

                return undefined;
            })
            .catch(() => {
                abortListener?.();
            });
    }

    try {
        await runConcurrently(commands as ConcurrentCommandInput[], {
            killOthers: ["failure"],
            onEvent: (event: ProcessEvent) => {
                const task = runnableTasks[event.index];

                if (!task) {
                    return;
                }

                switch (event.kind) {
                    case "close": {
                        const startTime = startTimeById.get(task.id) ?? Date.now();
                        // A killed persistent task (Ctrl+C, `q`, killOthers
                        // cascade) is the expected exit path — render it
                        // as `success` so the row shows a tick instead of
                        // a misleading red cross.
                        const status = event.killed || event.exitCode === 0 ? "success" : "failure";

                        lifeCycle.endTasks?.([
                            {
                                code: event.exitCode ?? 0,
                                endTime: Date.now(),
                                startTime,
                                status,
                                task,
                                terminalOutput: store.getSnapshot().outputs.get(task.id) ?? "",
                            },
                        ]);
                        killHandles.delete(event.index);
                        stdinRegistry?.delete(task.id);
                        break;
                    }
                    case "error": {
                        if (event.message) {
                            const buf = getTermBuffer(event.index);

                            if (buf) {
                                buf.write(`${event.message}\n`);
                                store.setOutput(task.id, buf.toString());
                            } else {
                                store.addOutput(task.id, `${event.message}\n`);
                            }
                        }

                        break;
                    }
                    case "started": {
                        startTimeById.set(task.id, Date.now());

                        if (event.kill) {
                            killHandles.set(event.index, event.kill);
                        }

                        // PTY tasks expose write/resize so the user can
                        // type into the dev server (e.g. vite's `r` to
                        // restart) once the task panel is focused.
                        if (event.write && stdinRegistry) {
                            stdinRegistry.set(task.id, { kill: event.kill, resize: event.resize, write: event.write });
                        }

                        break;
                    }
                    case "stderr":
                    case "stdout": {
                        if (event.text) {
                            const buf = getTermBuffer(event.index);

                            if (buf) {
                                buf.write(event.text);
                                store.setOutput(task.id, buf.toString());
                            } else {
                                store.addOutput(task.id, `${event.text}\n`);
                            }
                        }

                        break;
                    }
                    default:
                    // ignore
                }
            },
        });
    } finally {
        if (escalationTimer) {
            clearTimeout(escalationTimer);
            escalationTimer = undefined;
        }

        store.markDone();
    }
};

/** Liveness check: true if the pid (or its group) is still in the process table. */
const isPidAlive = (pid: number): boolean => {
    try {
        process.kill(-pid, 0);

        return true;
    } catch {
        try {
            process.kill(pid, 0);

            return true;
        } catch {
            return false;
        }
    }
};

/** Synchronous sleep using Atomics.wait on a private SharedArrayBuffer. */
const sleepSyncMs = (ms: number): void => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

/**
 * Run-end cleanup for ephemeral services started via `injectServiceTasks`,
 * and (when `--stop-services` is set) registry-mode services this run
 * started. Each ephemeral pid file holds the pid of a process group
 * leader the bootstrap spawned and `unref`d. We SIGTERM the whole group
 * (so the shell wrapper AND the actual server die) and then drop the
 * scratch directory. Any file/process that's already gone is silently
 * ignored — the goal is to leave nothing behind, not to assert what we
 * found.
 *
 * Synchronous on purpose: a SIGINT handler can call this inline before
 * the process exits. The SIGKILL escalation polls liveness with
 * `Atomics.wait` so it actually fires on the exit path — an unref'd
 * timer would be cancelled when `process.exit` runs immediately after.
 *
 * Registry entries for `extraPids` are NOT removed here (sync FS work in
 * a signal handler is risky); `vis service list --prune` and `pruneDead`
 * tidy them up. The entries point at dead pids by then so subsequent
 * runs treat them as missing.
 */
const cleanupEphemeralServices = (params: { extraPids?: ReadonlyArray<number>; pidFiles: string[]; runDir: string | undefined }): void => {
    const { extraPids = [], pidFiles, runDir } = params;
    const pids: number[] = [];

    const sendSigterm = (pid: number): void => {
        try {
            // The bootstrap spawned with `detached: true`, so the child
            // is its own process-group leader. Negate the pid to signal
            // the whole group — kills both the shell wrapper and the
            // service binary it forked.
            process.kill(-pid, "SIGTERM");
        } catch {
            try {
                process.kill(pid, "SIGTERM");
            } catch {
                // Already gone.
            }
        }
    };

    for (const pidFile of pidFiles) {
        let pid: number | undefined;

        try {
            const text = readFileSync(pidFile);
            const parsed = Number.parseInt(text.trim(), 10);

            pid = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
        } catch {
            continue;
        }

        if (pid === undefined) {
            continue;
        }

        pids.push(pid);
        sendSigterm(pid);
    }

    for (const pid of extraPids) {
        if (!Number.isFinite(pid) || pid <= 0) {
            continue;
        }

        pids.push(pid);
        sendSigterm(pid);
    }

    // Some services (postgres, custom node servers) ignore SIGTERM until
    // they finish in-flight work. Poll liveness for up to ~1.5s — most
    // well-behaved services exit within a few hundred ms — and SIGKILL
    // anything still standing. Synchronous waits are required: this can
    // be invoked from a signal handler immediately followed by
    // `process.exit`, which would cancel any unref'd timer.
    if (pids.length > 0) {
        const grace = 1500;
        const step = 100;
        const deadline = Date.now() + grace;

        while (Date.now() < deadline) {
            let allDead = true;

            for (const pid of pids) {
                if (isPidAlive(pid)) {
                    allDead = false;
                    break;
                }
            }

            if (allDead) {
                break;
            }

            sleepSyncMs(step);
        }

        for (const pid of pids) {
            if (!isPidAlive(pid)) {
                continue;
            }

            try {
                process.kill(-pid, "SIGKILL");
            } catch {
                try {
                    process.kill(pid, "SIGKILL");
                } catch {
                    // Already gone.
                }
            }
        }
    }

    if (runDir) {
        removeSync(runDir);
    }
};

/**
 * Maximum output buffer size per task (256 KB).
 */
const MAX_OUTPUT_BYTES = 256 * 1024;

/**
 * Ring buffer that keeps the last `maxBytes` of appended text.
 * Avoids unbounded memory growth for long-running dev servers.
 */
class OutputRingBuffer {
    readonly #maxBytes: number;

    #buffer = "";

    #truncated = false;

    constructor(maxBytes: number) {
        this.#maxBytes = maxBytes;
    }

    append(text: string): void {
        this.#buffer += text;

        if (this.#buffer.length > this.#maxBytes) {
            this.#buffer = this.#buffer.slice(-this.#maxBytes);
            this.#truncated = true;
        }
    }

    toString(): string {
        if (this.#truncated) {
            return `[...output truncated, showing last ${Math.round(this.#maxBytes / 1024)}KB...]\n${this.#buffer}`;
        }

        return this.#buffer;
    }
}

/**
 * Extract vis target options from a Task. Target options travel through
 * task-runner as part of `task.overrides.visOptions`, opaquely to the
 * runner but recovered here for per-task behaviour tweaks.
 */
const getTaskOptions = (task: Task): VisTargetOptions | undefined => {
    const options = task.overrides["visOptions"];

    if (options && typeof options === "object") {
        return options;
    }

    return undefined;
};

/**
 * Wraps a string in single quotes for safe POSIX shell execution.
 * Used when we know the consumer is a POSIX shell — e.g. when forwarding
 * a value as the argument of `&lt;shell> -c &lt;value>` regardless of OS.
 */
const singleQuoteEscape = (value: string): string => `'${value.replaceAll("'", String.raw`'\''`)}'`;

/**
 * Wraps a string for safe shell execution by the platform's default
 * shell. POSIX uses single quotes (prevents `$VAR` / `\n` / backtick
 * expansion). Windows cmd.exe treats single quotes as literal characters
 * — they would survive into the child process's argv — so we use
 * double-quote escaping with inner `"` doubled per cmd.exe parsing rules.
 */
const shellQuote = (value: string): string => {
    if (process.platform === "win32") {
        if (value.length > 0 && !/[\s"&|<>^()%!]/.test(value)) {
            return value;
        }

        return `"${value.replaceAll("\"", "\"\"")}"`;
    }

    return singleQuoteEscape(value);
};

/** Builds the command args list for `affectedFiles` forwarding. */
const buildAffectedFilesArgs = (command: string, affectedFiles: string[] | undefined, mode: VisTargetOptions["affectedFiles"]): string => {
    if (!affectedFiles || affectedFiles.length === 0 || mode === false || mode === undefined) {
        return command;
    }

    if (mode === "args" || mode === "both") {
        const quoted = affectedFiles.map((file) => shellQuote(file)).join(" ");

        return `${command} ${quoted}`;
    }

    return command;
};

/** Override key carrying CLI args that should only reach the target task. */
const FORWARDED_ARGS_KEY = "visForwardedArgs";

/** Override key carrying validated `VIS_ARG_*` env vars for the target task. */
const TASK_ARG_ENV_KEY = "visTaskArgEnv";

/**
 * Appends forwarded positional args (`vis run test --reporter=verbose`)
 * to the task's command. Only the user-invoked target task carries this
 * override — `dependsOn` dependencies see an empty overrides object
 * because `resolveStringDependency` in task-runner strips them.
 */
const appendForwardedArgs = (command: string, task: Task): string => {
    const args = task.overrides[FORWARDED_ARGS_KEY];

    if (!Array.isArray(args) || args.length === 0) {
        return command;
    }

    const quoted = (args as string[]).map((argument) => shellQuote(argument)).join(" ");

    return `${command} ${quoted}`;
};

/**
 * Serializes tasks that share a mutex name. Keyed by mutex name, each
 * entry is the tail of a promise chain — a task acquires the mutex by
 * awaiting the current tail, then replaces it with its own completion
 * promise.
 */
type MutexPool = Map<string, Promise<void>>;

const withMutex = async <T>(pool: MutexPool, name: string | undefined, run: () => Promise<T>): Promise<T> => {
    if (!name) {
        return run();
    }

    const previous = pool.get(name) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
        release = resolve;
    });
    const chained = previous.then(() => next);

    pool.set(name, chained);

    await previous;

    try {
        return await run();
    } finally {
        release();

        // Only clear the pool entry if we are still the tail — another
        // task may have enqueued itself after us.
        if (pool.get(name) === chained) {
            pool.delete(name);
        }
    }
};

/**
 * Shared counter for the global `--retry-budget` flag. Tasks consult
 * `claim(requested)` at launch to grab up to `requested` retries; the
 * budget is decremented conservatively by the claim (not by actual
 * retries consumed) to keep the bound simple to reason about. Once
 * the budget is exhausted, subsequent tasks run with no retries —
 * surfacing flakiness instead of silently burning CI time.
 */
export interface RetryBudget {
    claim: (requested: number) => number;
    readonly remaining: number;
}

export const createRetryBudget = (limit: number): RetryBudget => {
    let remaining = Math.max(0, Math.floor(limit));

    return {
        claim(requested) {
            const granted = Math.max(0, Math.min(requested, remaining));

            remaining -= granted;

            return granted;
        },
        get remaining() {
            return remaining;
        },
    };
};

interface ExecutorDependencies {
    affectedFiles?: string[];

    /**
     * Host OS resolved once at run-start so the per-task executor
     * doesn't call `os.platform()` on every invocation.
     */
    currentOs: ReturnType<typeof detectCurrentOs>;

    /**
     * Plugin hook bus. Used by the executor to fire `task:retry` before
     * each restart attempt — bridged from task-runner's per-attempt
     * `onRetry` callback. Optional so tests that exercise the executor
     * directly don't need to construct a hookable.
     */
    hooks?: Hookable<VisHooks>;

    /**
     * The directory the user launched `vis` from, captured before any
     * workspace/package discovery changes cwd. Surfaced to child tasks
     * as `INIT_CWD`, matching pnpm/npm/yarn convention so scripts can
     * reference the original invocation directory.
     */
    initCwd: string;

    /**
     * Optional task-runner lifecycle to receive streaming stdout/stderr
     * chunks. Plumbed so plugin authors get live output without having
     * to wait for the buffered dump at task-end.
     */
    lifeCycle?: LifeCycleInterface;
    mutexPool?: MutexPool;
    onOutput?: (taskId: string, text: string) => void;
    onOutputReplace?: (taskId: string, fullContent: string) => void;
    /** Optional global retry budget applied across all tasks in the run. */
    retryBudget?: RetryBudget;

    /**
     * Per-dependent task env contributed by externally-registered
     * services. Pre-computed by `applyServiceRegistry` before the
     * service edges are pruned, so the executor doesn't need to walk
     * the post-prune graph to find what env to merge.
     */
    serviceEnvByTaskId?: Map<string, Record<string, string>>;

    /**
     * Set when auto-start is active. The executor calls
     * `onRegistryTaskStarted` / `onRegistryTaskClosed` on the bridge for
     * any task that was injected as a service so the dock can transition
     * from `starting → ready` (or `failed`) using the wrapper's lifecycle
     * events. Ephemeral entries are no-ops in those calls — they get
     * boot-phase events through the stdout marker channel instead.
     */
    serviceEventBridge?: ServiceEventBridge;
    stdinRegistry?: Map<string, StdinEntry>;

    /**
     * When `true`, every task command is scanned for `${VAR}` / `$VAR`
     * references before spawn — unset references fail the task instead
     * of silently expanding to "". Falls back to per-target
     * `options.strictEnv`, then `vis.config.ts strictEnv`, then `false`.
     */
    strictEnv?: boolean;
    workspaceRoot: string;
}

/**
 * Creates an async task executor using the concurrent process runner.
 *
 * Uses the native Rust addon (setsid/killpg process groups, tokio I/O)
 * when available, falling back to a JS implementation.
 * Commands originate from package.json scripts (trusted input).
 *
 * Output is collected in a ring buffer capped at MAX_OUTPUT_BYTES to
 * prevent unbounded memory growth with long-running tasks like dev servers.
 *
 * The executor also honors vis-specific target options carried on the task:
 * `envFile`, `runFromWorkspaceRoot`, `retryCount`/`retryDelay`, `mutex`,
 * `affectedFiles`, and per-target `shell`/`unixShell`/`windowsShell`.
 */

/**
 * Per-run env-file cache: (cwd, envFileSpec) → parsed env vars.
 * With `envFile: true` or a shared config pointing at one dotenv
 * path, every task would otherwise re-read + re-parse the same file.
 */
type EnvFileCache = Map<string, Record<string, string>>;

const loadEnvFileCached = (cache: EnvFileCache, cwd: string, envFileSpec: NonNullable<VisTargetOptions["envFile"]>): Record<string, string> => {
    const key = `${cwd}\0${typeof envFileSpec === "string" ? envFileSpec : String(envFileSpec)}`;
    const hit = cache.get(key);

    if (hit) {
        return hit;
    }

    const parsed = loadEnvFile(cwd, envFileSpec);

    cache.set(key, parsed);

    return parsed;
};

const createConcurrentExecutor = (deps: ExecutorDependencies) => {
    const envFileCache: EnvFileCache = new Map();

    return async (task: Task, execOptions: { cwd?: string; env?: Record<string, string> }) => {
        const {
            affectedFiles,
            currentOs,
            hooks,
            initCwd,
            lifeCycle,
            mutexPool,
            onOutput,
            onOutputReplace,
            retryBudget,
            serviceEnvByTaskId,
            serviceEventBridge: bridge,
            stdinRegistry,
            strictEnv: workspaceStrictEnv,
            workspaceRoot,
        } = deps;

        const visOptions = getTaskOptions(task);

        const resolvedCwd = resolveTaskCwd(workspaceRoot, execOptions.cwd ?? task.projectRoot, visOptions?.runFromWorkspaceRoot === true);

        // `overrides.command` is already token-expanded at the build
        // site so the cache hasher sees the resolved form. Forwarded
        // args and the `affectedFiles: "args"` trailing-append both
        // keep their existing append-at-end semantics.
        const expandedCommand = task.overrides["command"] as string | undefined;

        if (!expandedCommand) {
            return { code: 0, terminalOutput: `No command configured for ${task.target.project}:${task.target.target}` };
        }

        const commandWithArgs = appendForwardedArgs(expandedCommand, task);
        const commandWithAffected = buildAffectedFilesArgs(commandWithArgs, affectedFiles, visOptions?.affectedFiles);

        const customShell = resolveTargetShell(visOptions, currentOs);
        // `shellArgs` lets a target pick a non-`-c` interpreter (e.g.
        // `shell: "node", shellArgs: ["-e"]` runs the command as inline JS).
        // An empty array would drop the flag entirely (turning `node 'cmd'`
        // into a file lookup), so fall back to `-c`.
        const shellArgs = visOptions?.shellArgs;
        const shellInvokeArgs = shellArgs && shellArgs.length > 0 ? shellArgs.join(" ") : "-c";
        // `shellQuote` is platform-aware (POSIX single-quote / cmd.exe
        // double-quote) — `singleQuoteEscape` would leave literal `'…'` around
        // the command under cmd.exe, breaking e.g. `node -e` on Windows.
        const command = customShell ? `${customShell} ${shellInvokeArgs} ${shellQuote(commandWithAffected)}` : commandWithAffected;

        const envFileVars = visOptions?.envFile ? loadEnvFileCached(envFileCache, resolvedCwd, visOptions.envFile) : undefined;

        const affectedFilesEnv: Record<string, string> = {};

        if (affectedFiles && affectedFiles.length > 0 && (visOptions?.affectedFiles === "env" || visOptions?.affectedFiles === "both")) {
            affectedFilesEnv[AFFECTED_FILES_ENV] = affectedFiles.join("\n");
        }

        const serviceEnv = serviceEnvByTaskId?.get(task.id);

        const mergedEnv: Record<string, string> = {
            INIT_CWD: initCwd,
            ...envFileVars,
            // Externally-registered service env merges below the
            // task's explicit env so users can override service-
            // provided defaults (e.g. point a test at a staging URL
            // without restarting the registered service).
            ...serviceEnv,
            ...execOptions.env,
            ...affectedFilesEnv,
            ...(task.overrides[TASK_ARG_ENV_KEY] as Record<string, string> | undefined),
        };

        // Per-target opt-in/out wins over the workspace flag — let a
        // single target tolerate `$VAR` references when the rest of the
        // workspace runs strict, and vice versa.
        const strictEnvActive = visOptions?.strictEnv ?? workspaceStrictEnv ?? false;

        if (strictEnvActive) {
            const violation = checkStrictEnv({
                command: commandWithAffected,
                processEnv: process.env,
                taskEnv: mergedEnv,
                taskId: task.id,
            });

            if (violation) {
                const message = formatStrictEnvError(violation);

                lifeCycle?.onTaskStderr?.(task, message);

                return { code: 1, terminalOutput: message };
            }
        }

        // PTY stdio is enabled when either an interactive stdin registry is
        // present (live TUI dev tasks) or the target config opts in via
        // `options.pty`. In both cases output flows through TerminalBuffer,
        // which normalizes ANSI escapes into a deterministic final frame.
        //
        // Per-target `task.pty` (from TargetConfiguration.pty) overrides
        // both workspace-level signals so individual targets can opt in
        // or out independent of the ambient setup. Subtly different from
        // the pre-spawn builder: here a TUI stdin registry forces PTY
        // even when `visOptions.pty === false` (the user needs to pass
        // input through), so we don't gate `ptyInteractive` on the
        // workspace toggle.
        const ptyOptIn = visOptions?.pty === true;
        const ptyInteractive = Boolean(stdinRegistry);
        const isPty = task.pty === true ? true : task.pty === false ? false : ptyInteractive || ptyOptIn;

        if (isPty) {
            task.cache = false;
        }

        const output = isPty ? undefined : new OutputRingBuffer(MAX_OUTPUT_BYTES);
        const termBuf = isPty ? new TerminalBuffer(MAX_OUTPUT_BYTES) : undefined;

        // Held across the runOnce lifetime so the timeout watchdog can
        // SIGTERM the child process when the wall-clock budget is exceeded.
        let killCurrentProcess: ((signal?: string) => void) | undefined;

        const onEvent = (event: ProcessEvent): void => {
            if (event.kind === "started") {
                killCurrentProcess = event.kill;

                if (event.write && stdinRegistry) {
                    stdinRegistry.set(task.id, { kill: event.kill, resize: event.resize, write: event.write });
                }

                // Registry-mode service tasks: the wrapper (`vis service
                // start <id>`) just spawned. The bridge transitions the
                // dock row to `starting`. Ephemeral entries no-op here —
                // they receive boot events from the stdout marker channel.
                bridge?.onRegistryTaskStarted(task.id);
            }

            if ((event.kind === "stdout" || event.kind === "stderr") && event.text !== undefined) {
                // Stream the raw chunk to the lifecycle first so plugins
                // (notifiers, metrics, log shippers) see output as it
                // arrives — before we store it in a buffer for the
                // buffered `printTaskTerminalOutput` at task-end.
                if (event.kind === "stdout") {
                    lifeCycle?.onTaskStdout?.(task, event.text);
                } else {
                    lifeCycle?.onTaskStderr?.(task, event.text);
                }

                if (termBuf) {
                    termBuf.write(event.text);

                    // Stream to the live TUI only when a stdin registry is
                    // wired up; non-interactive PTY tasks are captured and
                    // flushed at task completion via terminalOutput.
                    if (ptyInteractive) {
                        onOutputReplace?.(task.id, termBuf.toString());
                    }

                    // Service-task wrappers run in PTY mode like everything
                    // else, but their `[[VIS_BOOT]]…` markers must also reach
                    // the bridge's parser — without this, the dock stays on
                    // "booting…" while the wrapper completes happily and the
                    // regular task list shows the row as ✓.
                    if (bridge) {
                        bridge.onTaskOutput(task.id, event.text);
                    }
                } else {
                    const line = `${event.text}\n`;

                    output!.append(line);
                    onOutput?.(task.id, line);
                }
            }

            if (event.kind === "close") {
                if (stdinRegistry) {
                    stdinRegistry.delete(task.id);
                }

                // Registry-mode: the wrapper exited. On success, the
                // bridge reads the registry entry to surface pid/logFile,
                // then transitions the dock to `ready` and starts the
                // running-phase log tail. On non-zero exit, transitions
                // to `failed`. Awaiting isn't needed here — the call is
                // fire-and-forget; the dock updates asynchronously via
                // its store.
                if (bridge) {
                    bridge.onRegistryTaskClosed(task.id, event.exitCode ?? 0, Boolean(event.killed)).catch(() => {});
                }
            }
        };

        const runOnce = async (): Promise<{ code: number; retryAttempts: number; terminalOutput: string }> => {
            const requestedRetries = visOptions?.retryCount ?? 0;
            const retryDelay = visOptions?.retryDelay;
            // Global retry budget caps per-task retries from above. The budget
            // grants up to the requested amount; when it's exhausted, tasks
            // run with retries disabled so a single flaky task can't eat the
            // entire CI wall clock.
            const retryCount = retryBudget ? retryBudget.claim(requestedRetries) : requestedRetries;

            const timeoutMs = typeof visOptions?.timeout === "number" && visOptions.timeout > 0 ? visOptions.timeout : 0;
            const killGracePeriodMs
                = typeof visOptions?.killGracePeriodMs === "number" && visOptions.killGracePeriodMs >= 0 ? visOptions.killGracePeriodMs : 5000;
            let timedOut = false;
            let retryAttempts = 0;

            const timeoutKill = scheduleTimeoutKill({
                killGracePeriodMs,
                onTimeout: () => {
                    timedOut = true;
                },
                sendSignal: (signal) => {
                    killCurrentProcess?.(signal);
                },
                timeoutMs,
            });

            let result: Awaited<ReturnType<typeof runConcurrently>>;

            try {
                result = await runConcurrently(
                    [
                        {
                            command,
                            cwd: resolvedCwd,
                            env: mergedEnv,
                            name: task.id,
                            ...(isPty
                                ? {
                                    ptySize: { cols: process.stdout.columns ?? 80, rows: process.stdout.rows ?? 24 },
                                    stdin: "pty" as const,
                                }
                                : {}),
                        },
                    ],
                    {
                        killOthers: ["failure"],
                        onEvent,
                        ...(retryCount > 0
                            ? {
                                restart: {
                                    delay: retryDelay ?? "exponential",
                                    // Bridge task-runner's per-attempt callback into the
                                    // typed task:retry hook. Throwing from a plugin
                                    // handler aborts the retry — task-runner unwraps
                                    // the rejection and surfaces it as a failure.
                                    onRetry: async (attempt, _commandIndex, prevExitCode) => {
                                        retryAttempts = attempt;

                                        if (hooks) {
                                            await hooks.callHook("task:retry", task, attempt, prevExitCode);
                                        }
                                    },
                                    tries: retryCount,
                                },
                            }
                            : {}),
                    },
                );
            } finally {
                timeoutKill.cancel();
            }

            const closeEvent = result.closeEvents[0];
            const buffered = termBuf ? termBuf.toString() : output!.toString();

            if (timedOut) {
                // Mark the result with a distinctive prefix so reporters and
                // CI log grep can surface timeouts separately from ordinary
                // failures. Exit code 124 mirrors GNU `timeout(1)` convention.
                return {
                    code: 124,
                    retryAttempts,
                    terminalOutput: `${buffered}\n[timeout] Task "${task.id}" exceeded ${timeoutMs}ms budget.\n`,
                };
            }

            return {
                code: closeEvent?.exitCode ?? 1,
                retryAttempts,
                terminalOutput: buffered,
            };
        };

        return mutexPool ? withMutex(mutexPool, visOptions?.mutex, runOnce) : runOnce();
    };
};

/**
 * Parses the `VIS_RUN_CONCURRENCY_LIMIT` env var into a positive
 * integer. Returns `{ value: N }` on success, `undefined` when the
 * env is unset or empty (silent fallthrough), or `{ invalid: raw }`
 * when the value is set but unparseable — callers surface the
 * invalid case via a warn so misconfigurations aren't silent.
 * Floors fractional values so `VIS_RUN_CONCURRENCY_LIMIT=2.5` is
 * treated as 2 rather than rejected.
 */
const parseEnvConcurrency = (raw: string | undefined): { invalid: string } | { value: number } | undefined => {
    if (!raw || raw.trim().length === 0) {
        return undefined;
    }

    const value = Number.parseFloat(raw);

    if (!Number.isFinite(value) || value <= 0) {
        return { invalid: raw };
    }

    return { value: Math.floor(value) };
};

/**
 * Renders `.vis/last-summary.json` as a compact stats block.
 *
 * Keeps the format simple on purpose — users who want the full JSON
 * can `cat .vis/last-summary.json` directly. This view is the
 * "glance at what happened" companion to `vis run --last-details`.
 */
const renderLastRunSummary = async (
    workspaceRoot: string,
    logger: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void },
): Promise<void> => {
    const summary = await readLastRunSummary(workspaceRoot, { dataDirectory: getVisWorkspaceDataDir(workspaceRoot) });

    if (!summary) {
        logger.warn(
            `No previous run recorded yet. Run a task at least once to populate ${getLastRunSummaryPath(workspaceRoot, { dataDirectory: getVisWorkspaceDataDir(workspaceRoot) })}.`,
        );

        return;
    }

    const seconds = (summary.duration / 1000).toFixed(2);

    logger.info("");
    logger.info(`Last run — ${summary.startTime} (${seconds}s)`);
    logger.info("");
    logger.info(`  Total:     ${String(summary.stats.total)}`);
    logger.info(`  Succeeded: ${String(summary.stats.succeeded)}`);
    logger.info(`  Cached:    ${String(summary.stats.cached)}`);
    logger.info(`  Failed:    ${String(summary.stats.failed)}`);
    logger.info(`  Skipped:   ${String(summary.stats.skipped)}`);
    logger.info("");

    if (summary.stats.failed > 0) {
        const failedTasks = summary.tasks.filter((t) => t.exitCode !== undefined && t.exitCode !== 0);

        logger.info("Failed tasks:");

        for (const task of failedTasks) {
            const durationMs = task.duration ?? 0;

            logger.info(`  × ${task.taskId}  (exit ${String(task.exitCode ?? -1)}, ${durationMs}ms)`);
        }

        logger.info("");
    }

    // Slowest 5 — useful for spotting where wall-clock time actually went.
    const slowest = [...summary.tasks]
        .filter((t) => typeof t.duration === "number")
        .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))
        .slice(0, 5);

    if (slowest.length > 0) {
        logger.info("Slowest tasks:");

        for (const task of slowest) {
            logger.info(`  ${task.taskId.padEnd(40)}  ${String(task.duration ?? 0).padStart(6)}ms  [${task.cacheStatus}]`);
        }

        logger.info("");
    }
};

const parseCacheMode = (value: string | undefined): "read" | "readwrite" | "write" | undefined => {
    if (value === undefined || value === "") {
        return undefined;
    }

    if (value !== "read" && value !== "write" && value !== "readwrite") {
        throw new Error(`--cache-mode must be one of: read, write, readwrite (received "${value}")`);
    }

    return value;
};

const parseCacheBackend = (value: string | undefined): "http" | "reapi" | undefined => {
    if (value === undefined || value === "") {
        return undefined;
    }

    if (value !== "http" && value !== "reapi") {
        throw new Error(`--cache-backend must be one of: http, reapi (received "${value}")`);
    }

    return value;
};

const execute = async ({ argument, logger, options, runtime, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, RunOptions>): Promise<void> => {
    if (!wsRoot) {
        throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
    }

    const workspaceRoot = wsRoot;

    // Vis used to write its run state under `.task-runner/` and the cache
    // under `.task-runner-cache/`. After the cutover to `.vis/` those paths
    // are no longer read, so silently sweep them away on the next run.
    cleanupLegacyTaskRunnerLayout(workspaceRoot);

    // `--last-details` short-circuits execution: render the
    // persisted last-run summary and exit. Handles the common
    // "I ran tests 30s ago, show me what happened" case without
    // re-running and (more importantly) without needing the
    // workspace to be in a runnable state.
    if (options.lastDetails === true) {
        await renderLastRunSummary(workspaceRoot, logger);

        return;
    }

    // The directory the user invoked `vis` from, captured before any
    // workspace resolution. Propagated as INIT_CWD to every task —
    // matches pnpm/npm/yarn semantics so scripts can resolve paths
    // relative to where the user actually ran the command.
    const invocationCwd = process.cwd();
    const taskConfigs = await loadVisTaskConfigsForWorkspace(workspaceRoot);
    const { config, packageJsons, projectOptions, workspace } = discoverWorkspace(workspaceRoot, visConfig, taskConfigs);
    const projectGraph = buildProjectGraph(workspaceRoot, workspace, packageJsons);

    let rawSelector = argument[0];

    if (!rawSelector) {
        const available = collectAvailableTargets(workspace);

        if (process.stdout.isTTY && process.stdin.isTTY) {
            const picked = await promptTargetInteractively(available);

            if (!picked) {
                logger.info("No target selected.");

                return;
            }

            rawSelector = picked;

            // The user ran `vis run` (no target) — without this, the
            // resolved pick never appears in shell history, so
            // up-arrow replays the picker, not the task. Best-effort,
            // skipped on Windows / unrecognized shell.
            await appendToShellHistory(`vis run ${picked}`);
        } else {
            logger.info("Available targets:");
            logger.info("");
            logger.info(formatTargetList(available));
            logger.info("");
            logger.info("Usage: vis run <target>");

            return;
        }
    }

    if (config.constraints && !options.skipConstraints) {
        const violations = enforceProjectConstraints(projectGraph, config.constraints);

        if (violations.length > 0) {
            for (const v of violations) {
                logger.error(`[${v.rule}] ${v.message}`);
            }

            throw new Error(`${violations.length} project constraint violation(s) found. Use --skip-constraints to bypass.`);
        }
    }

    // --affected shorthand: delegate to the affected command
    if (options.affected) {
        const argv: string[] = [rawSelector];

        if (options.parallel !== undefined) {
            argv.push(`--parallel=${String(options.parallel)}`);
        }

        if (!options.cache) {
            argv.push("--no-cache");
        }

        if (options.query) {
            argv.push(`--query=${String(options.query)}`);
        }

        if (options.reverse) {
            argv.push("--reverse");
        }

        if (typeof options.runnerTags === "string" && options.runnerTags !== "") {
            argv.push(`--runner-tags=${options.runnerTags}`);
        }

        await runtime.runCommand("affected", { argv });

        return;
    }

    const selectorResult = await resolveSelector(rawSelector, workspace, process.cwd(), workspaceRoot);
    // Resolve target aliases declared on any VisTargetConfiguration
    // before any further filtering so `vis run t` picks up `test`.
    const aliasMap = buildAliasMap(projectOptions);
    const target = resolveTargetAlias(selectorResult.target, aliasMap);

    if (target !== selectorResult.target) {
        logger.debug?.(`Resolved alias "${selectorResult.target}" → "${target}"`);
    }

    let projectNames = selectorResult.projects;

    // Any positional args past the target name are forwarded only to the
    // invoked task — not to `dependsOn` deps. The task-runner string-form
    // resolver strips overrides so deps start with a clean slate.
    const forwardedArgs: string[] = argument.slice(1).map(String);

    if (options.projects) {
        const requested = new Set(options.projects.split(",").map((p: string) => p.trim()));

        projectNames = projectNames.filter((name) => requested.has(name));

        if (projectNames.length === 0) {
            throw new Error(`No matching projects found for: ${String(options.projects)}`);
        }
    }

    // Apply --query filter (language=X && tag=Y style).
    if (options.query) {
        projectNames = filterProjectsByQuery(projectNames, workspace, options.query);

        if (projectNames.length === 0) {
            logger.info(`Query "${String(options.query)}" matched no projects.`);

            return;
        }
    }

    const currentOs = detectCurrentOs();

    const affectedFilesRaw = process.env[AFFECTED_FILES_ENV];
    const affectedFiles = affectedFilesRaw ? affectedFilesRaw.split("\n").filter(Boolean) : undefined;

    // Runner-tag filter: CLI flag wins over env so a script can override
    // a CI-injected default. Empty string after splitting is dropped so
    // `--runner-tags=` (no value) doesn't accidentally enable a filter
    // with one empty tag. `undefined` keeps the filter inactive.
    const runnerTagsRaw = (typeof options.runnerTags === "string" ? options.runnerTags : process.env["VIS_RUNNER_TAGS"]) ?? undefined;
    const runnerTags = runnerTagsRaw
        ? new Set(
            runnerTagsRaw
                .split(",")
                .map((tag: string) => tag.trim())
                .filter(Boolean),
        )
        : undefined;

    const projectsWithTarget: string[] = [];
    const projectTargetIndex = new Map<string, VisTargetConfiguration>();

    for (const name of projectNames) {
        const visTargets = projectOptions.get(name);
        const visTarget = visTargets?.[target];

        if (!visTarget) {
            continue;
        }

        const visOptions = visTarget.options;

        if (visOptions?.internal) {
            continue;
        }

        if (!shouldRunInCI(visOptions, Boolean(isInCi))) {
            logger.debug?.(`Skipping ${name}:${target} — runInCI filter`);
            continue;
        }

        if (!matchesRunnerTags(visOptions, runnerTags)) {
            logger.debug?.(`Skipping ${name}:${target} — runner-tags filter`);
            continue;
        }

        // when:/os gates are evaluated by the task-runner orchestrator
        // just before launch — see TargetConfiguration.when. Letting them
        // through to the graph means skipped tasks show up with a reason
        // in the run summary instead of being silently filtered here.

        projectsWithTarget.push(name);
        projectTargetIndex.set(name, visTarget);
    }

    if (projectsWithTarget.length === 0) {
        const available = collectAvailableTargets(workspace);
        const exactMatchProjects = Object.entries(workspace.projects)
            .filter(([, proj]) => proj.targets?.[target] !== undefined)
            .map(([name]) => name);

        logger.error(`No projects have the "${target}" target.`);

        if (exactMatchProjects.length > 0) {
            // The target exists somewhere in the workspace — it was
            // just filtered out by selector/query/os/runInCI/runner-tags.
            // Tell the user which projects do implement it.
            logger.info("");
            logger.info(`Target "${target}" exists in these projects but was filtered out:`);

            for (const name of exactMatchProjects.slice(0, 5)) {
                logger.info(`  - ${name}`);
            }

            if (exactMatchProjects.length > 5) {
                logger.info(`  …and ${exactMatchProjects.length - 5} more`);
            }
        } else {
            const suggestions = suggestTargets(target, available, 3);

            if (suggestions.length > 0) {
                logger.info("");
                logger.info(
                    suggestions.length === 1 ? `Did you mean "${suggestions[0]}"?` : `Did you mean one of: ${suggestions.map((s) => `"${s}"`).join(", ")}?`,
                );
            }

            logger.info("");
            logger.info("Run `vis run` without arguments to see all available targets.");
        }

        return;
    }

    const ptyFlag = options.pty === true;

    // First-class task arguments: validate the forwarded args against the
    // invoked target's declared schema, surface per-task `--help`, and expose
    // validated values to the command as VIS_ARG_* env vars. See
    // `./task-arguments`. Because the same args + VIS_ARG_* reach every
    // selected project, all of them must agree on the contract — fail fast if
    // two projects expose this target with different `arguments` schemas
    // rather than validate one project's invocation against another's.
    const schemasByProject = projectsWithTarget
        .map((projectName) => { return { project: projectName, schema: projectTargetIndex.get(projectName)?.arguments }; })
        .filter((entry): entry is { project: string; schema: NonNullable<VisTargetConfiguration["arguments"]> } => Array.isArray(entry.schema) && entry.schema.length > 0);

    const distinctSchemas = new Map<string, string[]>();

    for (const { project, schema } of schemasByProject) {
        const key = JSON.stringify(schema);
        const projects = distinctSchemas.get(key) ?? [];

        projects.push(project);
        distinctSchemas.set(key, projects);
    }

    if (distinctSchemas.size > 1) {
        const groups = [...distinctSchemas.values()].map((projects) => projects.join(", ")).join(" | ");

        throw new Error(
            `Target "${target}" declares conflicting \`arguments\` schemas across projects (${groups}). `
            + `Run a single project (e.g. \`vis run ${schemasByProject[0]?.project}:${target}\` or --projects=<name>) so the argument contract is unambiguous.`,
        );
    }

    const argumentSchema = schemasByProject[0]?.schema;
    const argumentDescription = projectTargetIndex.get(schemasByProject[0]?.project ?? (projectsWithTarget[0] as string))?.description;
    const argumentResolution = resolveTaskArguments(target, argumentDescription, argumentSchema, forwardedArgs);

    if (argumentResolution.kind === "help") {
        logger.info(argumentResolution.text);

        return;
    }

    if (argumentResolution.kind === "invalid") {
        logger.info(`Invalid arguments for "${target}":`);

        for (const message of argumentResolution.errors) {
            logger.info(`  ✖ ${message}`);
        }

        logger.info("");
        logger.info(argumentResolution.help);

        throw new Error(`Invalid arguments for target "${target}"`);
    }

    const taskArgumentEnvVars = argumentResolution.env;

    let initialTasks: Task[] = projectsWithTarget.map((projectName) => {
        const project = workspace.projects[projectName];
        const visTarget = projectTargetIndex.get(projectName)!;
        const taskTarget: TaskTarget = { project: projectName, target };
        const taskId = `${projectName}:${target}`;
        // The --pty flag flips all tasks into PTY mode; per-target config
        // still wins when the target explicitly opts out.
        const mergedOptions: VisTargetOptions | undefined = ptyFlag ? { ...visTarget.options, pty: visTarget.options?.pty ?? true } : visTarget.options;

        // Expand `${affected.files}` / `${changed_files | flag '...'}`
        // tokens here so the resolved paths land in `overrides.command`
        // before task-runner's hasher reads it. Hashing the raw form
        // would let two runs with different affected-file sets but the
        // same workspace file hashes collide on the cache key — the
        // executor would replay a stale result that "linted" a different
        // subset. Persistent tasks and the watch-retry path also read
        // `overrides.command` directly, so doing this once at build time
        // keeps every consumer in sync.
        const expandedCommand = visTarget.command ? expandTokensInString(visTarget.command, { affectedFiles, projectRoot: project?.root }) : visTarget.command;

        // Expand `{projectRoot}`/`{projectName}` tokens in outputs (string
        // entries only; `{ auto: true }` passes through). Unexpanded, the
        // task-runner treats `{projectRoot}/dist` as a literal glob whose braces
        // match nothing, so output caching captures nothing. An empty project
        // root maps to `.` so the path stays a workspace-relative `./dist`
        // instead of an escaping `/dist`. Idempotent if already expanded.
        const outputsProjectRoot = project?.root && project.root.length > 0 ? project.root : ".";
        const expandedOutputs = (visTarget.outputs ?? []).map((output) => {
            if (typeof output !== "string") {
                return output;
            }

            return output.replaceAll("{projectRoot}", outputsProjectRoot).replaceAll("{projectName}", projectName);
        });

        return {
            cache: visTarget.cache,
            id: taskId,
            outputs: expandedOutputs,
            overrides: {
                command: expandedCommand,
                ...(forwardedArgs.length > 0 ? { [FORWARDED_ARGS_KEY]: forwardedArgs } : {}),
                ...(Object.keys(taskArgumentEnvVars).length > 0 ? { [TASK_ARG_ENV_KEY]: taskArgumentEnvVars } : {}),
                ...(mergedOptions ? { visOptions: mergedOptions } : {}),
            },
            parallelism: visTarget.parallelism,
            projectRoot: project?.root,
            target: taskTarget,
        };
    });

    const persistentTasks: Task[] = [];
    const regularTasks: Task[] = [];

    for (const task of initialTasks) {
        const opts = getTaskOptions(task);

        if (opts?.persistent) {
            task.cache = false;
            persistentTasks.push(task);
        } else {
            regularTasks.push(task);
        }
    }

    initialTasks = regularTasks;

    const partition = parsePartition(options.partition);

    if (partition) {
        initialTasks = TaskScheduler.partitionTasks(initialTasks, partition);

        logger.info(`Partition ${partition.index}/${partition.total}: running ${initialTasks.length} task(s)`);

        if (initialTasks.length === 0) {
            logger.info("No tasks assigned to this partition.");

            return;
        }
    }

    // Include persistent tasks in the graph so their `dependsOn` chain
    // (especially service deps like `web:serve → api:db`) is walked by
    // `applyServiceRegistry`. Without this, persistent tasks are split
    // out before graph construction and their service deps go undiscovered,
    // so preflight never auto-starts them. The persistent task ids are
    // stripped from the graph again after preflight injection so the
    // regular runner doesn't execute them — they run via `runPersistentTasks`.
    let taskGraph = createTaskGraph([...initialTasks, ...persistentTasks], {
        onCycleBroken: (cycle) => {
            // A dependency cycle that runs only through devDependency edges
            // is tolerated (pnpm does the same) — we break it and warn rather
            // than deadlocking. Cycles with a real (static) edge stay fatal.
            logger.warn(`Ignoring dev-only dependency cycle (build order is ambiguous): ${cycle.join(" → ")}`);
        },
        projectGraph,
        targetDefaults: config.tasks as unknown as Record<string, Partial<TargetConfiguration>>,
        workspace,
    });

    // task-runner's createTaskGraph copies overrides only from the
    // user-invoked `initialTasks`, so dep tasks added via `dependsOn`
    // arrive without `visOptions` and without `command`. That hides
    // every vis-specific option on dep tasks — most importantly
    // `options.service`, which applyServiceRegistry needs to detect a
    // service dependency it should auto-attach to — and leaves the
    // service-preflight injector with no command to wrap. Re-hydrate
    // both fields for every task in the graph from `projectOptions`
    // so dep tasks carry the same target metadata that user-invoked
    // tasks already carry.
    for (const [taskId, task] of Object.entries(taskGraph.tasks)) {
        const projectName = task.target.project;
        const targetName = task.target.target;
        const visTarget = projectOptions.get(projectName)?.[targetName];

        if (!visTarget) {
            continue;
        }

        const project = workspace.projects[projectName];
        let mutated = false;
        const nextOverrides = { ...task.overrides };

        if (nextOverrides["visOptions"] === undefined && visTarget.options) {
            nextOverrides["visOptions"] = visTarget.options;
            mutated = true;
        }

        if (nextOverrides["command"] === undefined && visTarget.command) {
            nextOverrides["command"] = expandTokensInString(visTarget.command, { affectedFiles, projectRoot: project?.root });
            mutated = true;
        }

        if (mutated) {
            task.overrides = nextOverrides;
            taskGraph.tasks[taskId] = task;
        }
    }

    // Per-task cache bypass via --skip-cache=<patterns>. Unlike the
    // global --no-cache (which drops the runner's `skipNxCache` switch
    // and bypasses cache for every task), this only flips
    // `task.cache = false` on tasks whose ID matches a user-supplied
    // pattern. The dry-run plan printer already surfaces this as
    // `(no-cache)` next to the matched task IDs. We skip the work
    // entirely when --no-cache is set since the runner-level switch
    // already disables caching for the whole run.
    if (typeof options.skipCache === "string" && options.skipCache.trim() !== "") {
        if (options.cache) {
            const skipResolution = resolveSkipCachePatterns(options.skipCache, workspace, Object.keys(taskGraph.tasks));

            for (const id of skipResolution.skipTaskIds) {
                const task = taskGraph.tasks[id];

                if (task !== undefined) {
                    task.cache = false;
                }
            }

            if (skipResolution.unmatchedPatterns.length > 0) {
                logger.warn(`--skip-cache: no tasks matched ${skipResolution.unmatchedPatterns.map((p) => `"${p}"`).join(", ")}`);
            }

            if (skipResolution.skipTaskIds.size > 0) {
                logger.debug?.(`--skip-cache: bypassing cache for ${String(skipResolution.skipTaskIds.size)} task(s)`);
            }
        } else {
            logger.debug?.("--skip-cache ignored: --no-cache already disables caching for the whole run");
        }
    }

    // Pre-flight: if a workspace tool pin doesn't match the running
    // version and `toolchain.autoInstall` is on (default when a
    // manager is detected), install via the right manager and let
    // subsequent task subprocesses pick up the new version. We
    // never block on failure — surface a warning, keep going,
    // and let the existing runtime-check warnings do their job.
    //
    // Runs before service auto-attach so the right Node/PM is in
    // place when the probe runs, and before the dry-run short-circuit
    // so `--dry-run` still surfaces toolchain drift.
    await runToolchainPreflight(
        workspaceRoot,
        config.toolchain,
        {
            error: (message) => {
                logger.error(message);
            },
            info: (message) => {
                logger.info(message);
            },
            warn: (message) => {
                logger.warn(message);
            },
        },
        Boolean(options.skipToolchain),
    );

    // Lockfile/install drift check. Fires after toolchain (so the
    // suggested install command runs against the right Node) and
    // before service auto-attach + task execution. CLI flag wins over
    // config; both default to on. The helper logs the warn line itself
    // in TTY; in CI it stays silent and we throw with `formattedMessage`
    // so the user sees the detail exactly once.
    const preflightEnabled = options.preflight !== false && config.preflight?.lockfile !== false;
    const lockfilePreflight = runLockfilePreflight(
        workspaceRoot,
        isInCi,
        {
            warn: (message) => {
                logger.warn(message);
            },
        },
        { skip: !preflightEnabled },
    );

    if (!lockfilePreflight.shouldContinue) {
        throw new Error(`${lockfilePreflight.formattedMessage ?? "preflight: lockfile drift detected"} (pass --no-preflight to bypass)`);
    }

    // One-time offer to alias @voidzero-dev/vite-task-client to our
    // drop-in client so its cache hints reach the runner. TTY-only and
    // remembers a decline, so CI and repeat runs are never blocked.
    if (preflightEnabled && !isInCi && process.stdin.isTTY && process.stdout.isTTY) {
        await maybePromptViteClientOverride(workspaceRoot, {
            interactive: true,
            logger: {
                info: (message) => {
                    logger.info(message);
                },
                warn: (message) => {
                    logger.warn(message);
                },
            },
            // Scan every discovered project manifest, not just the root —
            // a tool depending on the vite client may live in a sub-package.
            projectManifests: [...packageJsons.values()],
        });
    }

    // Auto-attach: if a service this run depends on is already
    // running in the background registry, drop it from the graph and
    // capture its env for the surviving dependents. Diagnostics here
    // mean the user invoked something whose dep is a service that
    // isn't running — refuse to half-execute.
    //
    // The probe re-runs the service's readiness check with a short
    // timeout before accepting the entry. PID-alive isn't enough: a
    // shell-wrapped service whose underlying server has crashed leaves
    // the wrapper PID alive, and we don't want to attach a dependent
    // task to a dead port. The probe is skipped in `--dry-run` because
    // a plan print never executes the dependent task, so probing risks
    // a misleading "service down" diagnostic for what is really a
    // planning-only invocation.
    const visVersion = process.env["VIS_VERSION"] ?? "0.0.0";
    const probe = options.dryRun
        ? undefined
        : async (entry: ServiceEntry): Promise<boolean> => {
            try {
                await runReadiness(entry.config, { timeoutMs: SERVICE_PROBE_TIMEOUT_MS });

                return true;
            } catch {
                return false;
            }
        };

    const registeredEntries = await readAllEntries(workspaceRoot);
    // User-invoked tasks for `applyServiceRegistry`'s "is this user-asked-for?"
    // check — includes persistent ones so a user running `vis run dev` (where
    // `dev` is persistent) doesn't get a confusing "service deps missing"
    // diagnostic for the persistent task itself.
    const serviceResult = await applyServiceRegistry({
        initialTasks: [...initialTasks, ...persistentTasks],
        probe,
        registeredEntries,
        taskGraph,
        visVersion,
    });

    /**
     * Ephemeral pid files written by the bootstrap wrapper at service
     * boot. Read at run end + SIGTERM the recorded pids so a failed run
     * never leaves orphan children. Registry-mode services are NOT
     * tracked here — they persist by design.
     */
    const ephemeralPidFiles: string[] = [];
    /** Per-run scratch directory holding the bootstrap script + pid/config files. Removed at run end. */
    let serviceRunDir: string | undefined;
    /** Registry-mode services started this run; surfaced in a one-line cleanup hint after the run completes. */
    let registryStartedCount = 0;
    /** Ids of registry-mode services this run started — used by `--stop-services` to clean only its own. */
    const registryStartedIds: string[] = [];
    /** id → pid for registry-mode services this run started, captured in the bridge `started` sink. Used by the sync signal-path cleanup. */
    const registryStartedPids = new Map<string, number>();

    /**
     * Service ids injected as regular dep nodes for this run. The dynamic
     * TUI's `TaskStore` only renders rows for tasks it knows about at
     * construction time — top-level `initialTasks` alone would hide the
     * service rows. We prepend these task objects to `initialTasks` after
     * the 2nd-pass `applyServiceRegistry` so the renderer makes rows for
     * them and live boot logs land somewhere visible.
     */
    let injectedServiceIds: string[] = [];
    /** Set form of `injectedServiceIds` used by the executor's onOutput hook to route per-task chunks. */
    const injectedServiceIdSet = new Set<string>();
    /** Service dock store + event bridge (ephemeral mode only in v1). Constructed alongside successful injection. */
    let serviceDockStore: ServiceDockStore | null = null;
    let serviceEventBridge: ServiceEventBridge | null = null;

    if (serviceResult.diagnostics.length > 0) {
        const isTty = Boolean(process.stdout.isTTY && process.stdin.isTTY);
        const decision = options.dryRun
            ? "off"
            : resolveServicesPolicy({
                cli: options.services,
                config: config.run?.services,
                isCi: Boolean(isInCi),
                isPersistentTarget: persistentTasks.length > 0,
                isTty,
                target,
            });

        if (decision === "off") {
            for (const diagnostic of serviceResult.diagnostics) {
                logger.error(diagnostic.message);
            }

            throw new Error(`${serviceResult.diagnostics.length} service dependency error(s) — start the missing services or invoke them directly.`);
        }

        const missingIds = serviceResult.diagnostics.map((d) => d.targetId);
        const mode = decision;

        // Capture the original (pre-injection) per-service config so the
        // bridge's registry entries hold the actual service command —
        // `injectServiceTasks` rewrites `task.overrides.command` to the
        // `vis service start <id>` wrapper, which is the wrong thing to
        // re-spawn from `#retryRegistry`.
        const preInjectionExtracted = mode === "registry" ? extractPreflightTasks(workspaceRoot, missingIds, taskGraph) : undefined;

        // Inject the missing services as regular task graph nodes —
        // they'll render as rows in the run TUI with live boot logs,
        // execute strictly sequentially (artificial deps chain them),
        // and exit 0 the moment readiness passes. The synthesized env
        // map below mirrors apply-service-registry's prune-time logic
        // without actually pruning the graph.
        const visBin = process.argv[1] ?? "vis";
        const injection = injectServiceTasks({
            missingServiceIds: missingIds,
            mode,
            taskGraph,
            visBin,
            workspaceRoot,
        });

        if (injection.skipped.length > 0) {
            for (const { id, reason } of injection.skipped) {
                logger.error(`Cannot auto-start ${id}: ${reason}`);
            }

            throw new Error(`${injection.skipped.length} service(s) cannot be auto-started — invoke them directly or add a service config.`);
        }

        ephemeralPidFiles.push(...injection.ephemeralPidFiles);
        serviceRunDir = injection.runDir;
        injectedServiceIds = injection.chain;

        for (const id of injection.chain) {
            injectedServiceIdSet.add(id);
        }

        if (mode === "registry") {
            registryStartedCount = injection.chain.length;
            registryStartedIds.push(...injection.chain);
        }

        // Stand up the dock + bridge for both modes. Ephemeral surfaces
        // boot events through the bootstrap's stdout marker channel and
        // running-phase log via fs.watch. Registry surfaces them through
        // the wrapper task's `started`/`close` lifecycle events emitted
        // by the executor — see the bridge wiring in `onEvent`.
        if (injection.chain.length > 0) {
            const dock = new ServiceDockStore(injection.chain);
            const bridgeEntries = new Map<string, ServiceBridgeEntry>();

            if (mode === "ephemeral" && injection.runDir) {
                for (const id of injection.chain) {
                    const paths = buildBootstrapPaths(injection.runDir, `${injection.runDir}/bootstrap.mjs`, id);

                    bridgeEntries.set(id, {
                        ephemeral: {
                            configFile: paths.configFile,
                            cwd: workspaceRoot,
                            logFile: paths.logFile,
                            pidFile: paths.pidFile,
                            scriptPath: paths.scriptPath,
                        },
                        mode: "ephemeral",
                    });
                }
            } else if (mode === "registry" && preInjectionExtracted) {
                for (const svc of preInjectionExtracted.services) {
                    bridgeEntries.set(svc.id, {
                        mode: "registry",
                        registry: {
                            command: svc.command,
                            config: svc.config,
                            cwd: svc.cwd,
                            env: svc.env,
                        },
                    });
                }
            }

            if (bridgeEntries.size > 0) {
                const bridge = new ServiceEventBridge({
                    indexToId: new Map(),
                    services: bridgeEntries,
                    sink: {
                        crashed: (id, tail) => {
                            dock.markCrashed(id, tail);
                        },
                        failed: (id, reason, detail) => {
                            dock.markFailed(id, reason, detail);
                        },
                        log: (id, chunk) => {
                            dock.appendLog(id, chunk);
                        },
                        ready: (id, info) => {
                            dock.markReady(id, info);
                        },
                        started: (id, pid) => {
                            dock.markStarted(id, pid);

                            // Capture registry-mode pids for the optional
                            // --stop-services cleanup. Ephemeral pids are
                            // already tracked via `ephemeralPidFiles`, so
                            // skip those to keep the two cleanup paths
                            // from doubly-killing the same pid.
                            if (mode === "registry" && pid !== null) {
                                registryStartedPids.set(id, pid);
                            }
                        },
                        starting: (id) => {
                            dock.markStarting(id);
                        },
                    },
                    workspaceRoot,
                });

                serviceDockStore = dock;
                serviceEventBridge = bridge;
            }
        }

        // Merge synthesized env on top of the 1st pass's env map.
        // 1st-pass entries cover already-running registered services;
        // injection covers services we're about to boot.
        for (const [taskId, env] of injection.serviceEnvByTaskId) {
            const existing = serviceResult.serviceEnvByTaskId.get(taskId) ?? {};

            serviceResult.serviceEnvByTaskId.set(taskId, { ...existing, ...env });
        }
    }

    // applyServiceRegistry was called with `[...initialTasks, ...persistentTasks]`
    // so its "is this user-asked-for?" check covers persistent targets like
    // `vis run dev`. Its returned `initialTasks` therefore *also* contains
    // the persistent ones (minus any satisfied services). Strip them back
    // out — `runPersistentTasks` runs them; the regular runner must not.
    // Without this filter, `web:serve` is fed to *both* pipelines and the
    // TUI renders the row twice.
    const persistentIdSet = new Set(persistentTasks.map((task) => task.id));

    initialTasks = serviceResult.initialTasks.filter((task) => !persistentIdSet.has(task.id));
    taskGraph = serviceResult.taskGraph;

    if (injectedServiceIds.length > 0) {
        const serviceTasks = injectedServiceIds.map((id) => taskGraph.tasks[id]).filter((t): t is Task => t !== undefined);

        initialTasks = [...serviceTasks, ...initialTasks];
    }

    // Persistent tasks were folded into the graph above so their service
    // deps could be walked. Strip them now so the regular task runner
    // doesn't try to execute them — they have their own runner pipeline
    // via `runPersistentTasks`. Their dep edges are removed too; the
    // service tasks they pointed at become roots and run on their own.
    if (persistentTasks.length > 0) {
        const persistentIds = new Set(persistentTasks.map((task) => task.id));

        const filteredTasks: Record<string, Task> = {};

        for (const [id, task] of Object.entries(taskGraph.tasks)) {
            if (!persistentIds.has(id)) {
                filteredTasks[id] = task;
            }
        }

        const filteredDependencies: Record<string, string[]> = {};

        for (const [id, deps] of Object.entries(taskGraph.dependencies)) {
            if (persistentIds.has(id)) {
                continue;
            }

            filteredDependencies[id] = deps.filter((depId) => !persistentIds.has(depId));
        }

        // Recompute roots from the trimmed graph: anything no remaining
        // task depends on. Service tasks orphaned by removing their
        // dependent persistent task become roots here.
        const dependedOn = new Set<string>();

        for (const deps of Object.values(filteredDependencies)) {
            for (const depId of deps) {
                dependedOn.add(depId);
            }
        }

        const filteredRoots = Object.keys(filteredTasks).filter((id) => !dependedOn.has(id));

        taskGraph = {
            dependencies: filteredDependencies,
            roots: filteredRoots,
            tasks: filteredTasks,
        };
    }

    // Service env precedence: the executor merges these on top of
    // process.env when running each dependent task. See
    // apply-service-registry.ts → ApplyServiceRegistryResult.serviceEnvByTaskId
    // for the keying contract (per *dependent*, not per service).
    const { serviceEnvByTaskId } = serviceResult;

    if (serviceResult.satisfiedServices.length > 0) {
        const names = serviceResult.satisfiedServices.map((s) => s.id).join(", ");

        logger.debug?.(`Auto-attached to running services: ${names}`);

        // Surface attached services in the dock so a second `vis run dev`
        // (where the registry already holds api:db, api:redis, …) still
        // shows the green pill. Without this, the dock is empty on rerun
        // and the user can't tell whether their deps are wired.
        if (serviceDockStore) {
            for (const entry of serviceResult.satisfiedServices) {
                serviceDockStore.registerService(entry.id);
            }
        } else {
            serviceDockStore = new ServiceDockStore(serviceResult.satisfiedServices.map((s) => s.id));
        }

        for (const entry of serviceResult.satisfiedServices) {
            const readinessPort = entry.config.readiness?.tcp?.port ?? entry.config.port ?? 0;
            const readinessHost = entry.config.readiness?.tcp?.host ?? "127.0.0.1";

            serviceDockStore.markReady(entry.id, { host: readinessHost, port: readinessPort });
        }
    }

    // Flip the task graph for teardown targets (CDK/Pulumi `destroy`,
    // `undeploy`, etc.) where dependents must run before the things
    // they depend on. Runs after service auto-attach so service
    // detection still uses the natural graph; runs before the
    // dry-run walk and scheduler so both reflect the reversed order.
    // `reverseTaskGraph` recomputes `roots` from the flipped edges,
    // so the dry-run printer and `TaskScheduler` need no further
    // changes — they already walk topologically over `dependencies`.
    if (options.reverse) {
        taskGraph = reverseTaskGraph(taskGraph);
        logger.debug?.(`Reversed task graph: ${String(taskGraph.roots.length)} new root(s) (originally leaves)`);
    }

    if (options.dryRun) {
        const taskCount = Object.keys(taskGraph.tasks).length;
        const rootCount = taskGraph.roots.length;

        logger.info(`Execution plan (${String(taskCount)} task(s), ${String(rootCount)} root(s)):`);
        logger.info("");

        const visited = new Set<string>();
        const walkPlan = (id: string, depth: number): void => {
            if (visited.has(id)) {
                return;
            }

            visited.add(id);

            for (const dep of taskGraph.dependencies[id] ?? []) {
                walkPlan(dep, depth + 1);
            }

            const task = taskGraph.tasks[id];
            const indent = "  ".repeat(depth + 1);

            logger.info(`${indent}${id}${task?.cache === false ? " (no-cache)" : ""}`);
        };

        for (const root of taskGraph.roots) {
            walkPlan(root, 0);
        }

        // Visit any tasks not reachable from `roots`. Two cases hit
        // this: disconnected graph components, and reversed graphs
        // where reverse-roots don't reach the original-leaves through
        // outbound `dependencies` (the printer recurses into deps,
        // and original-leaves are reverse-dependents — so we'd
        // otherwise drop them silently from the plan).
        for (const taskId of Object.keys(taskGraph.tasks)) {
            walkPlan(taskId, 0);
        }

        if (persistentTasks.length > 0) {
            logger.info("");
            logger.info(`  + ${String(persistentTasks.length)} persistent task(s) (run after graph completes)`);
        }

        logger.info("");

        return;
    }

    const startTime = Date.now();

    // One typed hook registry per run. Plugins register handlers
    // via `config.plugins`; the HookableLifeCycle forwards lifecycle
    // events from task-runner into the registry so plugin authors
    // see `task:before`/`task:after`/`task:cacheHit` etc. without
    // needing to understand the lower-level LifeCycleInterface.
    const hooks = createVisHooks();

    // Per-run handler, passed into HookableLifeCycle below. No
    // module-level state: concurrent `vis` invocations in the same
    // process (programmatic API, Vitest parallel suites) each get
    // their own channel.
    const onHookError = (hookName: string, error: unknown): void => {
        const message = error instanceof Error ? error.message : String(error);

        logger.warn(`Plugin error in ${hookName}: ${message}`);
    };

    await registerPlugins(hooks, config.plugins);

    const profilePath = typeof options.profile === "string" ? options.profile : undefined;
    const maybeWriteProfile = async (results: TaskResults): Promise<void> => {
        if (!profilePath) {
            return;
        }

        const summary = generateRunSummary(results, taskGraph, startTime);

        const resolvedProfilePath = profilePath.startsWith("/") ? profilePath : `${workspaceRoot}/${profilePath}`;

        await writeChromeTrace(summary, resolvedProfilePath);

        logger.info(`Profile written to ${profilePath}`);
    };

    // Resolve the cache directory through the shared helper so precedence
    // (CLI > vis.config.ts > default) stays consistent with `vis cache`
    // and relative --cache-dir values are normalized against the
    // workspace root. Other fields keep their existing spread semantics
    // to avoid changing override precedence for parallel/dryRun/etc.
    const configTaskRunner = (config.taskRunner ?? {}) as TaskRunnerOptions & { cacheDirectory?: string };
    // Anchor the default cache path to the *main* worktree root when this
    // workspace is a linked git worktree, so sibling agents share one cache
    // instead of rebuilding the same hash N times. Explicit paths
    // (--cache-dir, vis.config.ts, VIS_CACHE_DIRECTORY) win unchanged.
    const baseCacheDirectory = resolveSharedCacheDirectory(workspaceRoot, options.cacheDir, configTaskRunner.cacheDirectory, config.sharedWorktreeCache);
    // Branch-scope the cache dir when configured so main/feature
    // branches stop overwriting each other's entries.
    const resolvedCacheDirectory = applyBranchScope(baseCacheDirectory, workspaceRoot, config.branchScopedCache);

    // Concurrency resolution order: --parallel CLI flag > VIS_RUN_CONCURRENCY_LIMIT
    // env > built-in default of 3. Matches vite-task's
    // VP_RUN_CONCURRENCY_LIMIT semantics — lets CI runners set a
    // global limit via env without passing the flag on every call.
    // An invalid env value surfaces as a warn so misconfigurations
    // aren't silently ignored.
    const parallelEnvParsed = parseEnvConcurrency(process.env["VIS_RUN_CONCURRENCY_LIMIT"]);

    if (parallelEnvParsed && "invalid" in parallelEnvParsed) {
        logger.warn(`VIS_RUN_CONCURRENCY_LIMIT=${parallelEnvParsed.invalid} is not a positive number; falling back to default concurrency.`);
    }

    const parallelFromEnv = parallelEnvParsed && "value" in parallelEnvParsed ? parallelEnvParsed.value : undefined;
    const resolvedParallel = options.parallel ?? parallelFromEnv ?? 3;

    // CLI flag wins over the workspace config; per-target opt-in/out
    // is applied later in the executor against this resolved baseline.
    const resolvedStrictEnv = options.strictEnv ?? config.strictEnv ?? false;

    const runnerOptions: TaskRunnerOptions = {
        dryRun: options.dryRun ?? false,
        parallel: resolvedParallel,
        skipNxCache: !options.cache,
        summarize: options.summarize ?? false,
        ...configTaskRunner,
        // Applied after the config spread so the user's `--cache-dir` flag
        // wins over a config value and relative paths are normalized
        // against `workspaceRoot` via `resolveCacheDirectory()`.
        cacheDirectory: resolvedCacheDirectory,
        // `namedInputs` lives at the TOP LEVEL of the vis config, not under
        // `taskRunner`, so the `...configTaskRunner` spread above does not carry
        // it. Forward it explicitly: without it the task-runner's hasher gets an
        // empty named-inputs map, so a task whose `inputs` reference a named
        // input (`production`, `default`, …) resolves those names as LITERAL,
        // non-existent directories — contributing zero files to the cache key.
        // The task then false-cache-hits forever and never re-runs on a source
        // change. (Tasks with no `inputs` fall back to `{projectRoot}/**/*`,
        // which is why `lint:types` worked while `build` did not.)
        namedInputs: config.namedInputs,
        // Forward the vis-owned data directory so run summaries land in
        // `<workspaceRoot>/.vis/` rather than the task-runner default
        // `<workspaceRoot>/.task-runner/`. The config-supplied value
        // (if any) is honoured because the spread above can carry it
        // through; the explicit assignment here guarantees vis-driven
        // runs always co-locate their state under `.vis/`.
        dataDirectory: configTaskRunner.dataDirectory ?? getVisWorkspaceDataDir(workspaceRoot),
        // Bridge the typed `task:fingerprint` hook into task-runner's
        // `onFingerprint` callback. Placed after the config spread so
        // the plugin pipeline always runs — a config-supplied
        // `onFingerprint` would silently disable every plugin's
        // fingerprint contributions.
        //
        // Errors propagate intentionally: a buggy plugin must fail the
        // task before any cache lookup runs (per the hook's documented
        // contract — see `VisHooks["task:fingerprint"]`).
        onFingerprint: async (task, contributor) => {
            await hooks.callHook("task:fingerprint", task, contributor);
        },
    };

    // Resolve the remote-cache config in three layers (CLI > vis.config.ts
    // > Turbo env-var compat). Fill missing HTTP fields from TURBO_API /
    // TURBO_TOKEN / TURBO_TEAM so a workspace migrating from Turbo keeps
    // working without rewriting CI secrets. Rejects malformed CLI values
    // up front so a typo in `--cache-mode=eread` doesn't silently fall
    // through to the runner and surface as "no cache hits".
    const envCompatRemoteCache = resolveTurboEnvCompat(configTaskRunner.remoteCache);

    if (envCompatRemoteCache) {
        const cliMode = parseCacheMode(options.cacheMode);
        const cliBackend = parseCacheBackend(options.cacheBackend);

        runnerOptions.remoteCache = {
            ...envCompatRemoteCache,
            ...(cliMode ? { mode: cliMode } : {}),
            ...(cliBackend ? { backend: cliBackend } : {}),
        };

        // Config can only carry serializable attestation knobs
        // (`requireOnDownload`, `expectedIdentity`); the actual keyless
        // sign/verify callbacks can't live in vis.config.ts. When the
        // user opted in, swap the declarative stub for Sigstore-backed
        // hooks here.
        if (runnerOptions.remoteCache.attestation) {
            const { expectedIdentity, requireOnDownload } = runnerOptions.remoteCache.attestation;

            // Verifying a keyless bundle without pinning the signer
            // proves integrity, not authenticity — that is what the HMAC
            // `signing` block already does. Accept any of the three
            // public identity forms; refuse a half-configured setup
            // loudly rather than ship a false sense of provenance.
            const identityConfigured
                = expectedIdentity !== undefined
                    && (("github" in expectedIdentity
                        && typeof expectedIdentity.github?.ref === "string"
                        && typeof expectedIdentity.github.repo === "string"
                        && typeof expectedIdentity.github.workflow === "string")
                    || ("oidcIssuer" in expectedIdentity
                        && typeof expectedIdentity.oidcIssuer === "string"
                        && (typeof (expectedIdentity as { san?: unknown }).san === "string"
                            || typeof (expectedIdentity as { sanRegex?: unknown }).sanRegex === "string")));

            if (!identityConfigured) {
                throw new Error(
                    "[vis run] remoteCache.attestation requires a pinned keyless signer via `expectedIdentity`. Use one of:\n  • { github: { repo, workflow, ref } }   (GitHub Actions — recommended)\n  • { oidcIssuer, san }                   (literal identity; vis regex-escapes + anchors it)\n  • { oidcIssuer, sanRegex }              (advanced: raw regex, you own anchoring)\nWithout it, verification is integrity-only — use `remoteCache.signing` (HMAC) for that instead.",
                );
            }

            // Only the raw-regex form carries the unanchored-match
            // hazard: sigstore matches the SAN with `String.match`, so a
            // substring-matched pattern lets a longer attacker SAN that
            // merely *contains* the expected value pass. The `github`
            // and literal `san` forms are escaped and `^…$`-anchored by
            // `normalizeExpectedIdentity`, so they're safe by default.
            if ("sanRegex" in expectedIdentity && (!expectedIdentity.sanRegex.startsWith("^") || !expectedIdentity.sanRegex.endsWith("$"))) {
                logger.warn(
                    "[vis run] remoteCache.attestation.expectedIdentity.sanRegex is not anchored (^…$). sigstore matches it as a regex; an unanchored value is substring-matched and weakens the identity pin. Prefer the literal `san` form unless you need a pattern.",
                );
            }

            const { installCommandFor, isSigstoreInstalled } = await import("../../security/sigstore/loader");

            // Surface a missing optional peer dep at startup rather than
            // mid-run: warn (don't fail) so a misconfigured consumer
            // still runs, just without provenance, with a copy-paste fix.
            if (!isSigstoreInstalled()) {
                logger.warn(
                    `[vis run] remoteCache.attestation is configured but the optional \`sigstore\` package is not installed. Cache uploads will be unsigned and signed entries can't be verified until you install it:\n  ${installCommandFor(workspaceRoot)}`,
                );
            }

            const { buildCacheAttestationHooks } = await import("../../security/sigstore/cache-attestation");

            runnerOptions.remoteCache.attestation = buildCacheAttestationHooks({
                expectedIdentity,
                onReject: (hash, reason) => {
                    logger.warn(`[vis run] remote cache entry ${hash.slice(0, 12)} rejected: attestation ${reason}. Treating as a cache miss.`);
                },
                onVerifyFailure: (message) => {
                    logger.warn(`[vis run] attestation verification failed: ${message}`);
                },
                requireOnDownload,
                workspaceRoot,
            });
        }
    } else if (options.cacheMode || options.cacheBackend) {
        logger.warn("[vis run] --cache-mode and --cache-backend require a `remoteCache` block in vis.config.ts (or TURBO_API env); ignoring.");
    }

    const isTTY = process.stdout.isTTY && !isInCi;
    const autoExitConfig = config.tui?.autoExit ?? false;
    // Include persistent tasks in the lifecycle's view so the header
    // ("Running targets serve for 1 project") and summary count them
    // even when the regular task graph is empty (e.g. `vis run serve`
    // for a project whose `serve` target has `preset: "server"`).
    const lifecycleOptions = {
        args: { parallel: runnerOptions.parallel, targets: [target] },
        autoExit: autoExitConfig,
        projectNames: projectsWithTarget,
        tasks: [...initialTasks, ...persistentTasks],
    };

    const retryBudgetLimit = typeof options.retryBudget === "number" ? options.retryBudget : undefined;
    const sharedRetryBudget = retryBudgetLimit === undefined ? undefined : createRetryBudget(retryBudgetLimit);

    const hookLifeCycle = new HookableLifeCycle(hooks, onHookError);
    const failureLogLifeCycle = new FailureLogLifeCycle(workspaceRoot);

    const outputStyle = parseOutputStyle(typeof options.outputStyle === "string" ? options.outputStyle.toLowerCase() : undefined);

    // Fire service:attach for each registered service we attached to.
    // Computed earlier in `applyServiceRegistry`; the hook fires here
    // because `hooks` only exists post-`registerPlugins`. `taskIds` is
    // the set of in-graph dependents that consume the service's env —
    // empty when the service was attached but no dependent kept it.
    //
    // service:attach is an observation hook (see VisHooks docstring),
    // so a buggy plugin warns through `onHookError` rather than aborting
    // the run. Matches how the standalone `vis service` commands fire
    // service:start/service:stop in `commands/service/handler.ts`.
    if (serviceResult.satisfiedServices.length > 0) {
        for (const entry of serviceResult.satisfiedServices) {
            const taskIds = serviceResult.serviceDependentsByServiceId.get(entry.id) ?? [];

            try {
                await hooks.callHook("service:attach", entry, taskIds);
            } catch (error) {
                onHookError("service:attach", error);
            }
        }
    }

    await hooks.callHook("run:before", { tasks: initialTasks, workspaceRoot });

    /**
     * SIGTERM the ephemeral service group + drop the scratch dir exactly
     * once. Run from the run-block's `finally`, AND from a Ctrl+C/SIGTERM
     * listener so children don't outlive the run when the dynamic TUI's
     * own `process.exit(1)` short-circuits the normal exit path.
     */
    const stopServicesOnExit = options.stopServices === true;
    let cleanupRan = false;
    const runCleanupOnce = (): void => {
        if (cleanupRan) {
            return;
        }

        cleanupRan = true;

        if (serviceEventBridge) {
            serviceEventBridge.dispose().catch(() => {});
        }

        // When --stop-services is set, also kill the registry-mode services
        // this run started. Their pids are captured by the bridge `started`
        // sink. Registry entries point at dead pids after this; `vis
        // service list` / `pruneDead` cleans them up later.
        const extraPids = stopServicesOnExit ? [...registryStartedPids.values()] : undefined;

        cleanupEphemeralServices({ extraPids, pidFiles: ephemeralPidFiles, runDir: serviceRunDir });
    };
    const onCleanupSignal = (): void => {
        runCleanupOnce();
    };
    const hasCleanupWork = ephemeralPidFiles.length > 0 || serviceRunDir !== undefined || (stopServicesOnExit && registryStartedIds.length > 0);

    if (hasCleanupWork) {
        process.on("SIGINT", onCleanupSignal);
        process.on("SIGTERM", onCleanupSignal);
    }

    try {
        if (isTTY) {
            const stdinRegistry = new Map<string, StdinEntry>();
            const dynamic = createDynamicOutputRenderer({
                ...lifecycleOptions,
                onRetryService: serviceEventBridge ? (id) => serviceEventBridge.retry(id) : undefined,
                outputStyle,
                serviceDockStore,
                stdinRegistry,
            });
            const { lifeCycle: uiLifeCycle, store } = dynamic;
            // Fan lifecycle events out to both the UI renderer and the
            // plugin hook layer so subscribers see the same events
            // without adding another renderer.
            const lifeCycle = new CompositeLifeCycle([uiLifeCycle, hookLifeCycle, failureLogLifeCycle]);
            const mutexPool: MutexPool = new Map();
            const taskExecutor = createConcurrentExecutor({
                affectedFiles,
                currentOs,
                hooks,
                initCwd: invocationCwd,
                lifeCycle,
                mutexPool,
                onOutput: (taskId, text) => {
                    if (serviceEventBridge && injectedServiceIdSet.has(taskId)) {
                        serviceEventBridge.onTaskOutput(taskId, text);
                    } else {
                        store.addOutput(taskId, text);
                    }
                },
                onOutputReplace: (taskId, fullContent) => {
                    store.setOutput(taskId, fullContent);
                },
                retryBudget: sharedRetryBudget,
                serviceEnvByTaskId,
                serviceEventBridge: serviceEventBridge ?? undefined,
                stdinRegistry,
                strictEnv: resolvedStrictEnv,
                workspaceRoot,
            });

            let loopAction: "quit" | "rerun" | "retry" = "rerun";
            let retryTaskId: string | null = null;

            let lastResults: TaskResults = new Map();

            while (loopAction !== "quit") {
                if (loopAction === "rerun") {
                    lastResults = await defaultTaskRunner(initialTasks, runnerOptions, {
                        lifeCycle,
                        projectGraph,
                        taskExecutor,
                        taskGraph,
                        workspaceRoot,
                    });

                    // Persistent tasks (servers, watchers) start AFTER the
                    // regular graph completes but BEFORE the loop awaits
                    // user input — that's the only way the dynamic TUI
                    // can show their spinners and stream their output.
                    // The abortSignal kills them when the user signals
                    // rerun/retry/quit so the outer loop can react.
                    if (persistentTasks.length > 0 && !options.failFast) {
                        const abortSignal = new Promise<void>((resolve) => {
                            const unsubscribe = store.subscribe(() => {
                                const s = store.getSnapshot();

                                if (s.rerunRequested || s.retryTaskId) {
                                    unsubscribe();
                                    resolve();
                                }
                            });

                            dynamic.renderIsDone
                                .then(() => {
                                    unsubscribe();
                                    resolve();

                                    return undefined;
                                })
                                .catch(() => {
                                    unsubscribe();
                                    resolve();
                                });
                        });

                        await runPersistentTasks(
                            persistentTasks,
                            workspaceRoot,
                            affectedFiles,
                            invocationCwd,
                            {
                                abortSignal,
                                lifeCycle,
                                stdinRegistry,
                                store,
                            },
                            serviceEnvByTaskId,
                        );
                    }
                } else if (loopAction === "retry" && retryTaskId) {
                    const task = initialTasks.find((t) => t.id === retryTaskId);
                    const command = task?.overrides["command"] as string | undefined;

                    if (task && command) {
                        const resolvedCwd = resolveTaskCwd(workspaceRoot, task.projectRoot, false);

                        lifeCycle.startTasks?.([task]);

                        const retryTermBuf = new TerminalBuffer(MAX_OUTPUT_BYTES);

                        const retryResult = await runConcurrently(
                            [
                                {
                                    command,
                                    cwd: resolvedCwd,
                                    name: task.id,
                                    ptySize: { cols: process.stdout.columns ?? 80, rows: process.stdout.rows ?? 24 },
                                    stdin: "pty",
                                },
                            ],
                            {
                                onEvent: (event: ProcessEvent) => {
                                    if (event.kind === "started" && event.write) {
                                        stdinRegistry.set(task.id, { kill: event.kill, resize: event.resize, write: event.write });
                                    }

                                    if ((event.kind === "stdout" || event.kind === "stderr") && event.text) {
                                        retryTermBuf.write(event.text);
                                        store.setOutput(task.id, retryTermBuf.toString());
                                    }

                                    if (event.kind === "close") {
                                        stdinRegistry.delete(task.id);
                                    }
                                },
                            },
                        );

                        const closeEvent = retryResult.closeEvents[0];

                        lifeCycle.endTasks?.([
                            {
                                code: closeEvent?.exitCode ?? 1,
                                status: closeEvent?.exitCode === 0 ? "success" : "failure",
                                task,
                                terminalOutput: store.getSnapshot().outputs.get(task.id),
                            },
                        ]);
                    } else if (task) {
                        lifeCycle.endTasks?.([
                            {
                                code: 1,
                                status: "failure",
                                task,
                                terminalOutput: `No command configured for ${task.id}`,
                            },
                        ]);
                    }

                    retryTaskId = null;

                    // Mark done after retry so user can rerun/retry again
                    store.markDone();
                }

                loopAction = await new Promise<"quit" | "rerun" | "retry">((resolve) => {
                    const unsubscribe = store.subscribe(() => {
                        const s = store.getSnapshot();

                        if (s.rerunRequested) {
                            store.acknowledgeRerun();
                            unsubscribe();
                            resolve("rerun");
                        }

                        if (s.retryTaskId) {
                            retryTaskId = store.acknowledgeRetry();
                            unsubscribe();
                            resolve("retry");
                        }
                    });

                    dynamic.renderIsDone
                        .then(() => {
                            unsubscribe();
                            resolve("quit");

                            return undefined;
                        })
                        .catch(() => {
                            unsubscribe();
                            resolve("quit");
                        });
                });
            }

            await dynamic.renderIsDone;
            await hooks.callHook("run:after", lastResults);
            await maybeWriteProfile(lastResults);

            if (registryStartedCount > 0) {
                logger.info("");

                if (stopServicesOnExit) {
                    logger.info(`${String(registryStartedCount)} service(s) stopped (--stop-services).`);
                } else {
                    logger.info(`${String(registryStartedCount)} service(s) started in the background. Run \`vis service stop --all\` to clean up.`);
                }
            }
        } else {
            const mutexPool: MutexPool = new Map();
            const logModeOption = typeof options.log === "string" ? options.log.toLowerCase() : "";
            const logMode: LogMode | undefined
                = logModeOption === "labeled" || logModeOption === "grouped" || logModeOption === "interleaved" ? logModeOption : undefined;
            const logReporter = logMode ? createLogReporter(logMode) : undefined;
            // Composite so plugin hooks see every task boundary event in
            // addition to the CI-style static renderer. Build the
            // lifecycle first so the executor can forward streaming
            // stdout/stderr chunks into it.
            const lifeCycle = new CompositeLifeCycle([
                new StaticOutputLifeCycle({ ...lifecycleOptions, ciGrouping: visConfig?.run?.ciGrouping ?? "auto", logReporter, outputStyle }),
                hookLifeCycle,
                failureLogLifeCycle,
            ]);

            const taskExecutor = createConcurrentExecutor({
                affectedFiles,
                currentOs,
                hooks,
                initCwd: invocationCwd,
                lifeCycle,
                mutexPool,
                retryBudget: sharedRetryBudget,
                serviceEnvByTaskId,
                serviceEventBridge: serviceEventBridge ?? undefined,
                strictEnv: resolvedStrictEnv,
                workspaceRoot,
            });

            const runOnce = async (): Promise<{ hasFailure: boolean; results: TaskResults; runHistory: Awaited<ReturnType<typeof loadRunSummaries>> }> => {
                const runStart = Date.now();

                const results = await defaultTaskRunner(initialTasks, runnerOptions, {
                    lifeCycle,
                    projectGraph,
                    taskExecutor,
                    taskGraph,
                    workspaceRoot,
                });

                const durationMs = Date.now() - runStart;

                if (options.summarize) {
                    const summary = generateRunSummary(results, taskGraph, startTime);

                    await writeRunSummary(summary, workspaceRoot, { dataDirectory: getVisWorkspaceDataDir(workspaceRoot) });
                }

                let hasFailure = false;

                for (const [, result] of results) {
                    if (result.status === "failure") {
                        hasFailure = true;
                    }
                }

                const timingLine = formatTimingSummary(results, durationMs);

                // Load historical summaries once here and share with
                // the flakiness analyzer below — both consumers need
                // the same files and duplicate reads dominate when
                // the runs/ dir has accumulated hundreds of entries.
                const runHistory = loadRunSummaries(workspaceRoot);
                const durationComparison = compareDuration(workspaceRoot, durationMs, runHistory);

                logger.info("");
                logger.info(`  ${timingLine}${durationComparison ? ` ${durationComparison}` : ""}`);

                return { hasFailure, results, runHistory };
            };

            const firstRun = await runOnce();

            await hooks.callHook("run:after", firstRun.results);
            await maybeWriteProfile(firstRun.results);

            const { hasFailure } = firstRun;

            if (options.watch) {
                const absoluteRoots = projectsWithTarget
                    .map((name) => {
                        const project = workspace.projects[name];
                        const root = project?.root;

                        if (!root) {
                            return undefined;
                        }

                        return root.startsWith("/") ? root : `${workspaceRoot}/${root}`;
                    })
                    .filter((p): p is string => p !== undefined);

                // Snapshot the post-partition task set so `a` (clear filter)
                // can return to it after `p` narrowed the run.
                const baseTasks = initialTasks;
                let projectFilter: string | undefined;

                const applyFilter = (filter: string | undefined): number => {
                    const result = applyProjectFilter(baseTasks, filter);

                    projectFilter = result.filter;
                    initialTasks = result.tasks;

                    return result.tasks.length;
                };

                let running = false;
                let lastResults = firstRun.results;

                // Builds a fresh watcher after each run so the watch set
                // reflects the files the latest run actually touched.
                // Falls back to project roots on the first invocation
                // (no prior results) or when no task carries hashDetails.
                const buildHandle = (): { handle: ReturnType<typeof startWatcher>; mode: "tracked" | "roots" } => {
                    const targets = collectTrackedWatchTargets(lastResults, workspaceRoot);

                    if (targets.directories.length > 0 && targets.files.size > 0) {
                        const filter = createTrackedFileFilter(targets.files, workspaceRoot, targets.directories);

                        return {
                            handle: startWatcher({
                                filter,
                                onChange: onChangeHandler,
                                paths: targets.directories,
                            }),
                            mode: "tracked",
                        };
                    }

                    return {
                        handle: startWatcher({ onChange: onChangeHandler, paths: absoluteRoots }),
                        mode: "roots",
                    };
                };

                let currentHandle: ReturnType<typeof startWatcher> | undefined;

                const onChangeHandler = async (paths: string[]): Promise<void> => {
                    if (running) {
                        return;
                    }

                    running = true;

                    try {
                        logger.info(`Change detected in ${paths.length} file(s), rerunning…`);

                        const nextRun = await runOnce();

                        lastResults = nextRun.results;

                        // Rebuild the watcher so the next event only
                        // fires for files the newest run still cares
                        // about. Cheap — under 100ms on typical graphs.
                        currentHandle?.close();

                        const rebuilt = buildHandle();

                        currentHandle = rebuilt.handle;
                    } finally {
                        running = false;
                    }
                };

                const initial = buildHandle();

                currentHandle = initial.handle;

                const scope
                    = initial.mode === "tracked"
                        ? `Watching ${String(collectTrackedWatchTargets(lastResults, workspaceRoot).files.size)} tracked file(s)`
                        : `Watching ${String(absoluteRoots.length)} project root(s)`;

                logger.info(`${scope} — edit a file to rerun, press h for keybinds, q to quit.`);

                const triggerRerun = async (): Promise<void> => {
                    if (running) {
                        return;
                    }

                    running = true;

                    try {
                        if (initialTasks.length === 0) {
                            logger.info("No tasks match the active filter — press a to clear it.");

                            return;
                        }

                        const nextRun = await runOnce();

                        lastResults = nextRun.results;
                        currentHandle?.close();

                        const rebuilt = buildHandle();

                        currentHandle = rebuilt.handle;
                    } finally {
                        running = false;
                    }
                };

                await new Promise<void>((resolve) => {
                    let exited = false;
                    // Forward declarations so `exit()` can reference both the
                    // SIGINT listener and the keybind handle without hitting
                    // a TDZ if a future refactor calls exit() synchronously.
                    let keybinds: KeybindHandle | undefined;
                    const onSigint = (): void => {
                        exit();
                    };

                    const exit = (): void => {
                        if (exited) {
                            return;
                        }

                        exited = true;
                        keybinds?.close();
                        process.off("SIGINT", onSigint);
                        currentHandle?.close();
                        resolve();
                    };

                    process.on("SIGINT", onSigint);

                    keybinds = installKeybinds({
                        handlers: {
                            onClearFilter: async () => {
                                const total = applyFilter(undefined);

                                logger.info(`Filter cleared — running ${String(total)} task(s).`);
                                await triggerRerun();
                            },
                            onFilter: async (pattern) => {
                                // Capture before mutating — applyFilter() overwrites
                                // projectFilter, so we'd lose the rollback target
                                // otherwise.
                                const previousFilter = projectFilter;
                                const matching = applyFilter(pattern);

                                if (matching === 0) {
                                    logger.info(`Filter "${pattern}" matched no projects — keeping previous filter.`);
                                    applyFilter(previousFilter);

                                    return;
                                }

                                logger.info(`Filter "${pattern}" matched ${String(matching)} task(s).`);
                                await triggerRerun();
                            },
                            onHelp: () => {
                                writeHelp(process.stdout);
                            },
                            onQuit: () => {
                                exit();
                            },
                            onRerun: triggerRerun,
                        },
                    });
                });

                return;
            }

            // Print historical flakiness regardless of this run's outcome —
            // a clean run that masked a flaky task via retries (or one that
            // hasn't tripped the flake yet today) shouldn't hide history
            // that would help the user investigate. Suppressed with
            // `--no-flaky`. Reuses the history already loaded for the
            // timing comparison above — the runs/ directory hasn't
            // changed since this turn of the loop started.
            if (options.flaky !== false) {
                const flakyStats = analyzeFlakiness(workspaceRoot, { minRuns: 2 }, firstRun.runHistory);

                if (flakyStats.length > 0) {
                    logger.info("");
                    logger.info("Flaky tasks (based on historical runs):");
                    logger.info("");

                    for (const line of formatFlakinessTable(flakyStats)) {
                        logger.info(`  ${line}`);
                    }

                    logger.info("");
                }
            }

            // `--fail-on-retry` upgrades any retried-but-passed task into a
            // run failure. Lets CI surface flakes that retries would
            // otherwise mask — useful as a periodic "nightly" check that
            // disables the safety net the day-to-day workflow keeps on.
            const retriedTaskIds: string[] = [];

            for (const [taskId, result] of firstRun.results) {
                if (result.retryAttempts && result.retryAttempts > 0) {
                    retriedTaskIds.push(taskId);
                }
            }

            const failOnRetry = options.failOnRetry === true && retriedTaskIds.length > 0;

            if (failOnRetry) {
                // Cap the rendered list so a wide flake (every task retried
                // once) doesn't produce a multi-screen warn line that buries
                // surrounding context in CI logs.
                const MAX_LISTED = 5;
                const listedIds = retriedTaskIds.slice(0, MAX_LISTED);
                const remaining = retriedTaskIds.length - listedIds.length;
                const idsRendered = remaining > 0 ? `${listedIds.join(", ")}, and ${String(remaining)} more` : listedIds.join(", ");

                logger.warn("");
                logger.warn(`--fail-on-retry: ${String(retriedTaskIds.length)} task(s) succeeded only after retry: ${idsRendered}`);
            }

            if (hasFailure || failOnRetry) {
                const headline = failOnRetry && !hasFailure ? "Some tasks succeeded only after retry (--fail-on-retry)." : "Some tasks failed.";

                // Tail the captured terminal output of every failed task into
                // the thrown error so callers (especially programmatic ones
                // like vitest runs that mute the logger) see *why* a task
                // failed, not just *that* one did. Cap each tail so a runaway
                // log doesn't drown the stack trace.
                const TAIL_BYTES = 2000;
                const failureDetails: string[] = [];

                for (const [taskId, result] of firstRun.results) {
                    if (result.status !== "failure") {
                        continue;
                    }

                    const output = result.terminalOutput ?? "";
                    const tail = output.length > TAIL_BYTES ? `…${output.slice(-TAIL_BYTES)}` : output;
                    const code = result.code ?? "?";

                    failureDetails.push(
                        `  ${taskId} (exit ${String(code)}):\n${tail
                            .split("\n")
                            .map((l) => `    ${l}`)
                            .join("\n")}`,
                    );
                }

                throw new Error(failureDetails.length > 0 ? `${headline}\n${failureDetails.join("\n")}` : headline);
            }

            if (persistentTasks.length > 0 && !options.failFast) {
                await runPersistentTasks(persistentTasks, workspaceRoot, affectedFiles, invocationCwd, undefined, serviceEnvByTaskId);
            }

            if (registryStartedCount > 0) {
                logger.info("");

                if (stopServicesOnExit) {
                    logger.info(`${String(registryStartedCount)} service(s) stopped (--stop-services).`);
                } else {
                    logger.info(`${String(registryStartedCount)} service(s) started in the background. Run \`vis service stop --all\` to clean up.`);
                }
            }
        }
    } finally {
        runCleanupOnce();

        if (hasCleanupWork) {
            process.off("SIGINT", onCleanupSignal);
            process.off("SIGTERM", onCleanupSignal);
        }

        // Clean exit path: also delete the registry entries for services
        // we just stopped so `vis service list` doesn't show stale rows.
        // The signal-handler path skips this — sync FS work in a SIGINT
        // handler is risky, and `pruneDead` reconciles dead entries on
        // demand anyway.
        if (stopServicesOnExit && registryStartedIds.length > 0) {
            await Promise.all(
                registryStartedIds.map(async (id) => {
                    try {
                        await deleteEntry(workspaceRoot, id);
                    } catch {
                        // Best-effort — entry may already be gone.
                    }
                }),
            );
        }
    }
};

export default execute as CommandExecute<Toolbox>;
