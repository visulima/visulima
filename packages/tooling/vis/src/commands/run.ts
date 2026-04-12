import type { Command } from "@visulima/cerebro";
import type { ProcessEvent, Task, TaskRunnerOptions, TaskTarget } from "@visulima/task-runner";
import {
    createTaskGraph,
    defaultTaskRunner,
    enforceProjectConstraints,
    generateRunSummary,
    parsePartition,
    runConcurrently,
    TaskScheduler,
    TerminalBuffer,
    writeRunSummary,
} from "@visulima/task-runner";
import isInCi from "is-in-ci";

import { analyzeFlakiness, formatFlakinessTable } from "../flakiness";
import { compareDuration, formatTimingSummary } from "../run-report";
import { filterProjectsByQuery, resolveSelector } from "../selectors";
import {
    detectCurrentOs,
    loadEnvFile,
    matchesOs,
    resolveTargetShell,
    shouldRunInCI,
    type VisTargetConfiguration,
    type VisTargetOptions,
} from "../target-options";
import { collectAvailableTargets, formatTargetList, suggestTarget } from "../target-discovery";
import { createDynamicOutputRenderer } from "../tui/dynamic-life-cycle";
import { StaticOutputLifeCycle } from "../tui/static-life-cycle";
import type { StdinEntry } from "../tui/types";
import { startWatcher } from "../watch";
import { buildProjectGraph, discoverWorkspace, type VisProjectConfiguration } from "../workspace";

const AFFECTED_FILES_ENV = "VIS_AFFECTED_FILES";

/**
 * Runs persistent tasks (dev servers, watch mode) as a concurrent batch.
 * Persistent tasks never cache and never return a "result" — they run
 * until interrupted or until all of them exit.
 */
const runPersistentTasks = async (
    tasks: Task[],
    workspaceRoot: string,
    affectedFiles: string[] | undefined,
): Promise<void> => {
    const commands = tasks
        .map((task) => {
            const command = task.overrides["command"] as string | undefined;

            if (!command) {
                return undefined;
            }

            const visOptions = task.overrides["visOptions"] as VisTargetOptions | undefined;
            const cwd = visOptions?.runFromWorkspaceRoot
                ? workspaceRoot
                : task.projectRoot
                    ? task.projectRoot.startsWith("/")
                        ? task.projectRoot
                        : `${workspaceRoot}/${task.projectRoot}`
                    : workspaceRoot;

            const envFileVars = visOptions?.envFile ? loadEnvFile(cwd, visOptions.envFile) : {};
            const affectedEnv = affectedFiles && (visOptions?.affectedFiles === "env" || visOptions?.affectedFiles === "both")
                ? { [AFFECTED_FILES_ENV]: affectedFiles.join(" ") }
                : {};

            return {
                command,
                cwd,
                env: { ...envFileVars, ...affectedEnv },
                name: task.id,
            };
        })
        .filter((c): c is NonNullable<typeof c> => c !== undefined);

    if (commands.length === 0) {
        return;
    }

    await runConcurrently(commands, { killOthers: ["failure"] });
};

/**
 * Maximum output buffer size per task (512 KB).
 * For long-running tasks (vite dev, tsc --watch), only the tail is kept.
 * Short-lived tasks (build, lint) rarely exceed this.
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

/** Builds the command args list for `affectedFiles` forwarding. */
const buildAffectedFilesArgs = (command: string, affectedFiles: string[] | undefined, mode: VisTargetOptions["affectedFiles"]): string => {
    if (!affectedFiles || affectedFiles.length === 0 || mode === false || mode === undefined) {
        return command;
    }

    if (mode === "args" || mode === "both") {
        const quoted = affectedFiles.map((f) => `"${f.replaceAll("\"", "\\\"")}"`).join(" ");

        return `${command} ${quoted}`;
    }

    return command;
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

interface ExecutorDependencies {
    affectedFiles?: string[];
    mutexPool?: MutexPool;
    onOutput?: (taskId: string, text: string) => void;
    onOutputReplace?: (taskId: string, fullContent: string) => void;
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
const createConcurrentExecutor = (
    deps: ExecutorDependencies,
) => async (task: Task, execOptions: { cwd?: string; env?: Record<string, string> }) => {
    const { affectedFiles, mutexPool, onOutput, onOutputReplace, stdinRegistry, workspaceRoot } = deps;

    const visOptions = getTaskOptions(task);
    const currentOs = detectCurrentOs();

    const useWorkspaceCwd = visOptions?.runFromWorkspaceRoot === true;
    const baseCwd = useWorkspaceCwd ? workspaceRoot : (execOptions.cwd ?? task.projectRoot ?? workspaceRoot);
    const resolvedCwd = baseCwd.startsWith("/") ? baseCwd : `${workspaceRoot}/${baseCwd}`;

    const rawCommand = task.overrides["command"] as string | undefined;

    if (!rawCommand) {
        return { code: 0, terminalOutput: `No command configured for ${task.target.project}:${task.target.target}` };
    }

    const commandWithAffected = buildAffectedFilesArgs(rawCommand, affectedFiles, visOptions?.affectedFiles);

    const customShell = resolveTargetShell(visOptions, currentOs);
    const command = customShell ? `${customShell} -c ${JSON.stringify(commandWithAffected)}` : commandWithAffected;

    const envFileVars = visOptions?.envFile
        ? loadEnvFile(resolvedCwd, visOptions.envFile)
        : undefined;

    const affectedFilesEnv: Record<string, string> = {};

    if (affectedFiles && affectedFiles.length > 0 && (visOptions?.affectedFiles === "env" || visOptions?.affectedFiles === "both")) {
        affectedFilesEnv[AFFECTED_FILES_ENV] = affectedFiles.join(" ");
    }

    const mergedEnv: Record<string, string> = {
        ...envFileVars,
        ...execOptions.env,
        ...affectedFilesEnv,
    };

    const isPty = Boolean(stdinRegistry);

    if (isPty) {
        task.cache = false;
    }

    const output = isPty ? undefined : new OutputRingBuffer(MAX_OUTPUT_BYTES);
    const termBuf = isPty ? new TerminalBuffer(MAX_OUTPUT_BYTES) : undefined;

    const onEvent = (event: ProcessEvent): void => {
        if (event.kind === "started" && event.write && stdinRegistry) {
            stdinRegistry.set(task.id, { kill: event.kill, resize: event.resize, write: event.write });
        }

        if ((event.kind === "stdout" || event.kind === "stderr") && event.text !== undefined) {
            if (termBuf) {
                termBuf.write(event.text);
                onOutputReplace?.(task.id, termBuf.toString());
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
        const retryCount = visOptions?.retryCount ?? 0;
        const retryDelay = visOptions?.retryDelay;

        const result = await runConcurrently(
            [{
                command,
                cwd: resolvedCwd,
                env: mergedEnv,
                name: task.id,
                ...(stdinRegistry ? { ptySize: { cols: process.stdout.columns ?? 80, rows: process.stdout.rows ?? 24 }, stdin: "pty" as const } : {}),
            }],
            {
                killOthers: ["failure"],
                onEvent,
                ...(retryCount > 0
                    ? { restart: { delay: retryDelay ?? "exponential", tries: retryCount } }
                    : {}),
            },
        );

        const closeEvent = result.closeEvents[0];

        return {
            code: closeEvent?.exitCode ?? 1,
            terminalOutput: termBuf ? termBuf.toString() : output!.toString(),
        };
    };

    return mutexPool ? withMutex(mutexPool, visOptions?.mutex, runOnce) : runOnce();
};

const run: Command = {
    group: "Run & Execute",
    argument: {
        description: "The target to run (e.g., build, test, lint)",
        name: "target",
        type: String,
    },
    description: "Run a target across workspace projects",
    examples: [
        ["vis run", "List all available targets"],
        ["vis run build", "Run build on all projects"],
        ["vis run :build", "Run build on all projects (moon-style)"],
        ["vis run ~:test", "Run test on the project closest to the current directory"],
        ["vis run \"#frontend:build\"", "Run build on projects tagged 'frontend'"],
        ["vis run :build --query \"language=typescript\"", "Filter by project metadata"],
        ["vis run test --affected", "Run test only on git-changed projects"],
        ["vis run build --fail-fast", "Stop on first failure"],
        ["vis run build --dry-run", "Show execution plan without running"],
    ],
    execute: async ({ argument, logger, options, runtime, visConfig, workspaceRoot: wsRoot }) => {
        if (!wsRoot) {
            throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
        }

        const workspaceRoot = wsRoot;
        const { config, projectOptions, workspace } = discoverWorkspace(workspaceRoot, visConfig);
        const projectGraph = buildProjectGraph(workspaceRoot, workspace);

        const rawSelector = argument[0];

        if (!rawSelector) {
            const available = collectAvailableTargets(workspace);

            logger.info("Available targets:");
            logger.info("");
            logger.info(formatTargetList(available));
            logger.info("");
            logger.info("Usage: vis run <target>");

            return;
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
        const target = selectorResult.target;
        let projectNames = selectorResult.projects;

        if (options.projects) {
            const requested = new Set((options.projects as string).split(",").map((p: string) => p.trim()));

            projectNames = projectNames.filter((name) => requested.has(name));

            if (projectNames.length === 0) {
                throw new Error(`No matching projects found for: ${String(options.projects)}`);
            }
        }

        // Apply --query filter (language=X && tag=Y style).
        if (options.query) {
            projectNames = filterProjectsByQuery(projectNames, workspace, options.query as string);

            if (projectNames.length === 0) {
                logger.info(`Query "${String(options.query)}" matched no projects.`);

                return;
            }
        }

        const currentOs = detectCurrentOs();

        const affectedFilesRaw = process.env[AFFECTED_FILES_ENV];
        const affectedFiles = affectedFilesRaw ? affectedFilesRaw.split(" ").filter(Boolean) : undefined;

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

            if (!matchesOs(visOptions, currentOs)) {
                logger.debug?.(`Skipping ${name}:${target} — osType does not match ${currentOs}`);
                continue;
            }

            if (!shouldRunInCI(visOptions, Boolean(isInCi))) {
                logger.debug?.(`Skipping ${name}:${target} — runInCI filter`);
                continue;
            }

            projectsWithTarget.push(name);
            projectTargetIndex.set(name, visTarget);
        }

        if (projectsWithTarget.length === 0) {
            const available = collectAvailableTargets(workspace);
            const suggestion = suggestTarget(target, available);
            const hint = suggestion ? ` Did you mean "${suggestion}"?` : "";

            logger.info(`No projects have the "${target}" target.${hint}`);

            return;
        }

        let initialTasks: Task[] = projectsWithTarget.map((projectName) => {
            const project = workspace.projects[projectName];
            const visTarget = projectTargetIndex.get(projectName)!;
            const taskTarget: TaskTarget = { project: projectName, target };
            const taskId = `${projectName}:${target}`;

            return {
                cache: visTarget.cache,
                id: taskId,
                outputs: visTarget.outputs ?? [],
                overrides: {
                    command: visTarget.command,
                    ...(visTarget.options ? { visOptions: visTarget.options } : {}),
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

        const partition = parsePartition(options.partition as string | undefined);

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
            targetDefaults: config.targetDefaults,
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

        const startTime = Date.now();

        const runnerOptions: TaskRunnerOptions = {
            cacheDirectory: options.cacheDir as string | undefined,
            dryRun: options.dryRun as boolean,
            parallel: (options.parallel as number) ?? 3,
            skipNxCache: !options.cache,
            summarize: options.summarize as boolean,
            ...config.taskRunnerOptions,
        };

        const isTTY = process.stdout.isTTY && !isInCi;
        const autoExitConfig = config.tui?.autoExit ?? false;
        const lifecycleOptions = {
            args: { parallel: runnerOptions.parallel, targets: [target] },
            autoExit: autoExitConfig,
            projectNames: projectsWithTarget,
            tasks: initialTasks,
        };

        if (isTTY) {
            const stdinRegistry = new Map<string, StdinEntry>();
            const dynamic = createDynamicOutputRenderer({ ...lifecycleOptions, stdinRegistry });
            const { lifeCycle, store } = dynamic;
            const mutexPool: MutexPool = new Map();
            const taskExecutor = createConcurrentExecutor({
                affectedFiles,
                mutexPool,
                onOutput: (taskId, text) => store.addOutput(taskId, text),
                onOutputReplace: (taskId, fullContent) => store.setOutput(taskId, fullContent),
                stdinRegistry,
                workspaceRoot,
            });

            let loopAction: "quit" | "rerun" | "retry" = "rerun";
            let retryTaskId: string | null = null;

            while (loopAction !== "quit") {
                if (loopAction === "rerun") {
                    await defaultTaskRunner(initialTasks, runnerOptions, {
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

                        const retryResult = await runConcurrently([{
                            command,
                            cwd: resolvedCwd,
                            name: task.id,
                            ptySize: { cols: process.stdout.columns ?? 80, rows: process.stdout.rows ?? 24 },
                            stdin: "pty",
                        }], {
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
                        });

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

            if (persistentTasks.length > 0) {
                await runPersistentTasks(persistentTasks, workspaceRoot, affectedFiles);
            }
        } else {
            const mutexPool: MutexPool = new Map();
            const taskExecutor = createConcurrentExecutor({
                affectedFiles,
                mutexPool,
                workspaceRoot,
            });
            const lifeCycle = new StaticOutputLifeCycle(lifecycleOptions);

            const runOnce = async (): Promise<{ hasFailure: boolean; results: import("@visulima/task-runner").TaskResults }> => {
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
                const durationComparison = compareDuration(workspaceRoot, durationMs);

                logger.info("");
                logger.info(`  ${timingLine}${durationComparison ? ` ${durationComparison}` : ""}`);

                return { hasFailure, results };
            };

            const { hasFailure } = await runOnce();

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

                logger.info(`Watching ${absoluteRoots.length} project(s) — edit a file to rerun, Ctrl+C to exit.`);

                let running = false;

                const handle = startWatcher({
                    onChange: async (paths) => {
                        if (running) {
                            return;
                        }

                        running = true;

                        try {
                            logger.info(`Change detected in ${paths.length} file(s), rerunning…`);
                            await runOnce();
                        } finally {
                            running = false;
                        }
                    },
                    paths: absoluteRoots,
                });

                await new Promise<void>((resolve) => {
                    const onSigint = (): void => {
                        process.off("SIGINT", onSigint);
                        handle.close();
                        resolve();
                    };

                    process.on("SIGINT", onSigint);
                });

                return;
            }

            if (hasFailure) {
                if (options.flaky !== false) {
                    const flakyStats = analyzeFlakiness(workspaceRoot, { minRuns: 2 });

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
                await runPersistentTasks(persistentTasks, workspaceRoot, affectedFiles);
            }
        }
    },
    name: "run",
    options: [
        {
            alias: "p",
            description: "Comma-separated list of projects to run",
            name: "projects",
            type: String,
        },
        {
            defaultValue: 3,
            description: "Maximum number of parallel tasks",
            name: "parallel",
            type: Number,
        },
        {
            defaultValue: true,
            description: "Enable caching (use --no-cache to disable)",
            name: "cache",
            type: Boolean,
        },
        {
            description: "Custom cache directory",
            name: "cache-dir",
            type: String,
        },
        {
            defaultValue: false,
            description: "Show what would run without executing",
            name: "dry-run",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Generate a run summary after execution",
            name: "summarize",
            type: Boolean,
        },
        {
            description: "Partition tasks for distributed CI (e.g., \"1/4\" for first of four runners). Falls back to VIS_PARTITION env var.",
            name: "partition",
            type: String,
        },
        {
            defaultValue: false,
            description: "Skip project constraint validation",
            name: "skip-constraints",
            type: Boolean,
        },
        {
            description: "Filter matched projects by a query (e.g. 'language=typescript && tag=lib')",
            name: "query",
            type: String,
        },
        {
            defaultValue: false,
            description: "Only run on projects affected by git changes (shorthand for vis affected)",
            name: "affected",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Rerun affected tasks on file change. Ctrl+C to exit.",
            name: "watch",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Stop all tasks on first failure",
            name: "fail-fast",
            type: Boolean,
        },
        {
            defaultValue: true,
            description: "Show flaky task report on failure (use --no-flaky to suppress)",
            name: "flaky",
            type: Boolean,
        },
    ],
};

export default run;
