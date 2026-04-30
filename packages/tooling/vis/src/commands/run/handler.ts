import type { CommandExecute, Toolbox } from "@visulima/cerebro";
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
    generateRunSummary,
    parsePartition,
    readLastRunSummary,
    runConcurrently,
    TaskScheduler,
    TerminalBuffer,
    writeChromeTrace,
    writeRunSummary,
} from "@visulima/task-runner";
import isInCi from "is-in-ci";

import { applyBranchScope, resolveSharedCacheDirectory } from "../../cache/cache-directory";
import type { VisProjectConfiguration } from "../../config/workspace";
import { buildProjectGraph, discoverWorkspace, loadVisTaskConfigsForWorkspace } from "../../config/workspace";
import { FailureLogLifeCycle } from "../../report/failure-log";
import { analyzeFlakiness, formatFlakinessTable } from "../../report/flakiness";
import { compareDuration, formatTimingSummary, loadRunSummaries } from "../../report/run-report";
import { runToolchainPreflight } from "../../runtime/toolchain";
import { filterProjectsByQuery, resolveSelector } from "../../task/selectors";
import { buildAliasMap, collectAvailableTargets, formatTargetList, promptTargetInteractively, resolveTargetAlias, suggestTargets } from "../../task/target-discovery";
import type { VisTargetConfiguration, VisTargetOptions } from "../../task/target-options";
import { detectCurrentOs, loadEnvFile, resolveTargetShell, shouldRunInCI } from "../../task/target-options";
import { createDynamicOutputRenderer } from "../../tui/dynamic-life-cycle";
import { parseOutputStyle, StaticOutputLifeCycle } from "../../tui/static-life-cycle";
import type { StdinEntry } from "../../tui/types";
import { createVisHooks, HookableLifeCycle, registerPlugins } from "../../util/hooks";
import { appendToShellHistory } from "../../util/shell-history";
import { scheduleTimeoutKill } from "../../util/signal-escalation";
import { collectTrackedWatchTargets, createTrackedFileFilter, startWatcher } from "../../watch/watch";
import { applyProjectFilter } from "../../watch/watch-filter";
import type { KeybindHandle } from "../../watch/watch-keybinds";
import { installKeybinds, writeHelp } from "../../watch/watch-keybinds";
import type { RunOptions } from "./index";

const AFFECTED_FILES_ENV = "VIS_AFFECTED_FILES";

/**
 * Resolves a task's effective working directory. Returns the workspace
 * root when `runFromWorkspaceRoot` is set, otherwise resolves
 * `projectRoot` — keeping absolute paths as-is and prefixing relative
 * ones with the workspace root.
 */
const resolveCwd = (workspaceRoot: string, projectRoot: string | undefined, runFromWorkspaceRoot: boolean): string => {
    if (runFromWorkspaceRoot) {
        return workspaceRoot;
    }

    if (!projectRoot) {
        return workspaceRoot;
    }

    return projectRoot.startsWith("/") ? projectRoot : `${workspaceRoot}/${projectRoot}`;
};

/**
 * Runs persistent tasks (dev servers, watch mode) as a concurrent batch.
 * Persistent tasks never cache and never return a "result" — they run
 * until interrupted or until all of them exit.
 */
const runPersistentTasks = async (tasks: Task[], workspaceRoot: string, affectedFiles: string[] | undefined, initCwd: string): Promise<void> => {
    const commands = tasks
        .map((task) => {
            const command = task.overrides["command"] as string | undefined;

            if (!command) {
                return undefined;
            }

            const visOptions = task.overrides["visOptions"] as VisTargetOptions | undefined;
            const cwd = resolveCwd(workspaceRoot, task.projectRoot, Boolean(visOptions?.runFromWorkspaceRoot));

            const envFileVars = visOptions?.envFile ? loadEnvFile(cwd, visOptions.envFile) : {};
            const affectedEnv
                = affectedFiles && (visOptions?.affectedFiles === "env" || visOptions?.affectedFiles === "both")
                    ? { [AFFECTED_FILES_ENV]: affectedFiles.join("\n") }
                    : {};

            return {
                command,
                cwd,
                env: { INIT_CWD: initCwd, ...envFileVars, ...affectedEnv },
                name: task.id,
            };
        })
        .filter((c): c is NonNullable<typeof c> => c !== undefined);

    if (commands.length === 0) {
        return;
    }

    await runConcurrently(commands as ConcurrentCommandInput[], { killOthers: ["failure"] });
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
        return options as VisTargetOptions;
    }

    return undefined;
};

/**
 * Wraps a string in single quotes for safe shell execution, escaping
 * any internal single quotes using the standard `'\''` pattern. Unlike
 * double quotes, single quotes prevent shell expansion of `$VAR`, `\n`,
 * and backticks.
 */
const singleQuoteEscape = (value: string): string => `'${value.replaceAll("'", String.raw`'\''`)}'`;

/** Builds the command args list for `affectedFiles` forwarding. */
const buildAffectedFilesArgs = (command: string, affectedFiles: string[] | undefined, mode: VisTargetOptions["affectedFiles"]): string => {
    if (!affectedFiles || affectedFiles.length === 0 || mode === false || mode === undefined) {
        return command;
    }

    if (mode === "args" || mode === "both") {
        const quoted = affectedFiles.map(singleQuoteEscape).join(" ");

        return `${command} ${quoted}`;
    }

    return command;
};

/** Override key carrying CLI args that should only reach the target task. */
const FORWARDED_ARGS_KEY = "visForwardedArgs";

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

    const quoted = (args as string[]).map(singleQuoteEscape).join(" ");

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
    stdinRegistry?: Map<string, StdinEntry>;
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
        const { affectedFiles, currentOs, initCwd, lifeCycle, mutexPool, onOutput, onOutputReplace, retryBudget, stdinRegistry, workspaceRoot } = deps;

        const visOptions = getTaskOptions(task);

        const resolvedCwd = resolveCwd(workspaceRoot, execOptions.cwd ?? task.projectRoot, visOptions?.runFromWorkspaceRoot === true);

        const rawCommand = task.overrides["command"] as string | undefined;

        if (!rawCommand) {
            return { code: 0, terminalOutput: `No command configured for ${task.target.project}:${task.target.target}` };
        }

        const commandWithArgs = appendForwardedArgs(rawCommand, task);
        const commandWithAffected = buildAffectedFilesArgs(commandWithArgs, affectedFiles, visOptions?.affectedFiles);

        const customShell = resolveTargetShell(visOptions, currentOs);
        const command = customShell ? `${customShell} -c ${singleQuoteEscape(commandWithAffected)}` : commandWithAffected;

        const envFileVars = visOptions?.envFile ? loadEnvFileCached(envFileCache, resolvedCwd, visOptions.envFile) : undefined;

        const affectedFilesEnv: Record<string, string> = {};

        if (affectedFiles && affectedFiles.length > 0 && (visOptions?.affectedFiles === "env" || visOptions?.affectedFiles === "both")) {
            affectedFilesEnv[AFFECTED_FILES_ENV] = affectedFiles.join("\n");
        }

        const mergedEnv: Record<string, string> = {
            INIT_CWD: initCwd,
            ...envFileVars,
            ...execOptions.env,
            ...affectedFilesEnv,
        };

        // PTY stdio is enabled when either an interactive stdin registry is
        // present (live TUI dev tasks) or the target config opts in via
        // `options.pty`. In both cases output flows through TerminalBuffer,
        // which normalizes ANSI escapes into a deterministic final frame.
        const ptyOptIn = visOptions?.pty === true;
        const ptyInteractive = Boolean(stdinRegistry);
        const isPty = ptyInteractive || ptyOptIn;

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
                } else {
                    const line = `${event.text}\n`;

                    output!.append(line);
                    onOutput?.(task.id, line);
                }
            }

            if (event.kind === "close" && stdinRegistry) {
                stdinRegistry.delete(task.id);
            }
        };

        const runOnce = async (): Promise<{ code: number; terminalOutput: string }> => {
            const requestedRetries = visOptions?.retryCount ?? 0;
            const retryDelay = visOptions?.retryDelay;
            // Global retry budget caps per-task retries from above. The budget
            // grants up to the requested amount; when it's exhausted, tasks
            // run with retries disabled so a single flaky task can't eat the
            // entire CI wall clock.
            const retryCount = retryBudget ? retryBudget.claim(requestedRetries) : requestedRetries;

            const timeoutMs = typeof visOptions?.timeout === "number" && visOptions.timeout > 0 ? visOptions.timeout : 0;
            const killGracePeriodMs = typeof visOptions?.killGracePeriodMs === "number" && visOptions.killGracePeriodMs >= 0
                ? visOptions.killGracePeriodMs
                : 5000;
            let timedOut = false;

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
                        ...(retryCount > 0 ? { restart: { delay: retryDelay ?? "exponential", tries: retryCount } } : {}),
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
                    terminalOutput: `${buffered}\n[timeout] Task "${task.id}" exceeded ${timeoutMs}ms budget.\n`,
                };
            }

            return {
                code: closeEvent?.exitCode ?? 1,
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
 * Renders `.task-runner/last-summary.json` as a compact stats block.
 *
 * Keeps the format simple on purpose — users who want the full JSON
 * can `cat .task-runner/last-summary.json` directly. This view is the
 * "glance at what happened" companion to `vis run --last-details`.
 */
const renderLastRunSummary = async (
    workspaceRoot: string,
    logger: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void },
): Promise<void> => {
    const summary = await readLastRunSummary(workspaceRoot);

    if (!summary) {
        logger.warn("No previous run recorded yet. Run a task at least once to populate .task-runner/last-summary.json.");

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

const execute = async ({ argument, logger, options, runtime, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, RunOptions>): Promise<void> => {
    if (!wsRoot) {
        throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
    }

    const workspaceRoot = wsRoot;

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
        const requested = new Set((options.projects).split(",").map((p: string) => p.trim()));

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
            // just filtered out by selector/query/os/runInCI. Tell
            // the user which projects do implement it.
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

    let initialTasks: Task[] = projectsWithTarget.map((projectName) => {
        const project = workspace.projects[projectName];
        const visTarget = projectTargetIndex.get(projectName)!;
        const taskTarget: TaskTarget = { project: projectName, target };
        const taskId = `${projectName}:${target}`;
        // The --pty flag flips all tasks into PTY mode; per-target config
        // still wins when the target explicitly opts out.
        const mergedOptions: VisTargetOptions | undefined = ptyFlag ? { ...visTarget.options, pty: visTarget.options?.pty ?? true } : visTarget.options;

        return {
            cache: visTarget.cache,
            id: taskId,
            outputs: visTarget.outputs ?? [],
            overrides: {
                command: visTarget.command,
                ...(forwardedArgs.length > 0 ? { [FORWARDED_ARGS_KEY]: forwardedArgs } : {}),
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

    const taskGraph = createTaskGraph(initialTasks, {
        projectGraph,
        targetDefaults: config.targetDefaults as unknown as Record<string, Partial<TargetConfiguration>>,
        workspace,
    });

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

        if (persistentTasks.length > 0) {
            logger.info("");
            logger.info(`  + ${String(persistentTasks.length)} persistent task(s) (run after graph completes)`);
        }

        logger.info("");

        return;
    }

    // Pre-flight: if a workspace tool pin doesn't match the running
    // version and `toolchain.autoInstall` is on (default when a
    // manager is detected), install via the right manager and let
    // subsequent task subprocesses pick up the new version. We
    // never block on failure — surface a warning, keep going,
    // and let the existing runtime-check warnings do their job.
    //
    // Runs only when we're committing to actually execute tasks:
    // after target selection, after the `--last-details` and
    // `--dry-run` short-circuits, and after the no-target listing
    // path returns. Avoids surprising auto-installs from `vis run`
    // with no args or `vis run --dry-run`.
    await runToolchainPreflight(
        workspaceRoot,
        config.toolchain,
        {
            error: (message) => { logger.error(message); },
            info: (message) => { logger.info(message); },
            warn: (message) => { logger.warn(message); },
        },
        Boolean(options.skipToolchain),
    );

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
    const configTaskRunnerOptions = (config.taskRunnerOptions ?? {}) as TaskRunnerOptions & { cacheDirectory?: string };
    // Anchor the default cache path to the *main* worktree root when this
    // workspace is a linked git worktree, so sibling agents share one cache
    // instead of rebuilding the same hash N times. Explicit paths
    // (--cache-dir, vis.config.ts, VIS_CACHE_DIRECTORY) win unchanged.
    const baseCacheDirectory = resolveSharedCacheDirectory(
        workspaceRoot,
        options.cacheDir,
        configTaskRunnerOptions.cacheDirectory,
        config.sharedWorktreeCache,
    );
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

    const runnerOptions: TaskRunnerOptions = {
        dryRun: options.dryRun ?? false,
        parallel: resolvedParallel,
        skipNxCache: !options.cache,
        summarize: options.summarize ?? false,
        ...configTaskRunnerOptions,
        // Applied after the config spread so the user's `--cache-dir` flag
        // wins over a config value and relative paths are normalized
        // against `workspaceRoot` via `resolveCacheDirectory()`.
        cacheDirectory: resolvedCacheDirectory,
    };

    const isTTY = process.stdout.isTTY && !isInCi;
    const autoExitConfig = config.tui?.autoExit ?? false;
    const lifecycleOptions = {
        args: { parallel: runnerOptions.parallel, targets: [target] },
        autoExit: autoExitConfig,
        projectNames: projectsWithTarget,
        tasks: initialTasks,
    };

    const retryBudgetLimit = typeof options.retryBudget === "number" ? options.retryBudget : undefined;
    const sharedRetryBudget = retryBudgetLimit === undefined ? undefined : createRetryBudget(retryBudgetLimit);

    const hookLifeCycle = new HookableLifeCycle(hooks, onHookError);
    const failureLogLifeCycle = new FailureLogLifeCycle(workspaceRoot);

    const outputStyle = parseOutputStyle(typeof options.outputStyle === "string" ? options.outputStyle.toLowerCase() : undefined);

    await hooks.callHook("run:before", { tasks: initialTasks, workspaceRoot });

    if (isTTY) {
        const stdinRegistry = new Map<string, StdinEntry>();
        const dynamic = createDynamicOutputRenderer({ ...lifecycleOptions, outputStyle, stdinRegistry });
        const { lifeCycle: uiLifeCycle, store } = dynamic;
        // Fan lifecycle events out to both the UI renderer and the
        // plugin hook layer so subscribers see the same events
        // without adding another renderer.
        const lifeCycle = new CompositeLifeCycle([uiLifeCycle, hookLifeCycle, failureLogLifeCycle]);
        const mutexPool: MutexPool = new Map();
        const taskExecutor = createConcurrentExecutor({
            affectedFiles,
            currentOs,
            initCwd: invocationCwd,
            lifeCycle,
            mutexPool,
            onOutput: (taskId, text) => {
                store.addOutput(taskId, text);
            },
            onOutputReplace: (taskId, fullContent) => {
                store.setOutput(taskId, fullContent);
            },
            retryBudget: sharedRetryBudget,
            stdinRegistry,
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
            } else if (loopAction === "retry" && retryTaskId) {
                const task = initialTasks.find((t) => t.id === retryTaskId);
                const command = task?.overrides["command"] as string | undefined;

                if (task && command) {
                    const taskCwd = task.projectRoot ?? workspaceRoot;
                    const resolvedCwd = taskCwd.startsWith("/") ? taskCwd : `${workspaceRoot}/${taskCwd}`;

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

                dynamic.renderIsDone.then(
                    () => {
                        unsubscribe();
                        resolve("quit");
                    },
                    () => {
                        unsubscribe();
                        resolve("quit");
                    },
                );
            });
        }

        await dynamic.renderIsDone;
        await hooks.callHook("run:after", lastResults);
        await maybeWriteProfile(lastResults);

        if (persistentTasks.length > 0 && !options.failFast) {
            await runPersistentTasks(persistentTasks, workspaceRoot, affectedFiles, invocationCwd);
        }
    } else {
        const mutexPool: MutexPool = new Map();
        const logModeOption = typeof options.log === "string" ? options.log.toLowerCase() : "";
        const logMode: LogMode | undefined
            = logModeOption === "labeled" || logModeOption === "grouped" || logModeOption === "interleaved" ? (logModeOption as LogMode) : undefined;
        const logReporter = logMode ? createLogReporter(logMode) : undefined;
        // Composite so plugin hooks see every task boundary event in
        // addition to the CI-style static renderer. Build the
        // lifecycle first so the executor can forward streaming
        // stdout/stderr chunks into it.
        const lifeCycle = new CompositeLifeCycle([new StaticOutputLifeCycle({ ...lifecycleOptions, logReporter, outputStyle }), hookLifeCycle, failureLogLifeCycle]);

        const taskExecutor = createConcurrentExecutor({
            affectedFiles,
            currentOs,
            initCwd: invocationCwd,
            lifeCycle,
            mutexPool,
            retryBudget: sharedRetryBudget,
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

                await writeRunSummary(summary, workspaceRoot);
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
                    const project = workspace.projects[name] as VisProjectConfiguration | undefined;
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

            await new Promise<void>((resolveExit) => {
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
                    resolveExit();
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

        if (hasFailure) {
            if (options.flaky !== false) {
                // Reuse the history already loaded for the timing
                // comparison above — the runs/ directory hasn't
                // changed since this turn of the loop started.
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

            throw new Error("Some tasks failed.");
        }

        if (persistentTasks.length > 0 && !options.failFast) {
            await runPersistentTasks(persistentTasks, workspaceRoot, affectedFiles, invocationCwd);
        }
    }
};

export default execute as CommandExecute<Toolbox>;
