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
    writeRunSummary,
} from "@visulima/task-runner";
import isInCi from "is-in-ci";

import { createDynamicOutputRenderer } from "../tui/dynamic-life-cycle";
import { StaticOutputLifeCycle } from "../tui/static-life-cycle";
import { buildProjectGraph, discoverWorkspace } from "../workspace";

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
            // Keep the tail, trim from the front
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
 * Creates an async task executor using the concurrent process runner.
 *
 * Uses the native Rust addon (setsid/killpg process groups, tokio I/O)
 * when available, falling back to a JS implementation.
 * Commands originate from package.json scripts (trusted input).
 *
 * Output is collected in a ring buffer capped at MAX_OUTPUT_BYTES to
 * prevent unbounded memory growth with long-running tasks like dev servers.
 */
const createConcurrentExecutor = (workspaceRoot: string) => async (task: Task, options: { cwd?: string; env?: Record<string, string> }) => {
    const taskCwd = options.cwd ?? task.projectRoot ?? workspaceRoot;
    const resolvedCwd = taskCwd.startsWith("/") ? taskCwd : `${workspaceRoot}/${taskCwd}`;

    const command = task.overrides["command"] as string | undefined;

    if (!command) {
        return { code: 0, terminalOutput: `No command configured for ${task.target.project}:${task.target.target}` };
    }

    const output = new OutputRingBuffer(MAX_OUTPUT_BYTES);

    const onEvent = (event: ProcessEvent): void => {
        if ((event.kind === "stdout" || event.kind === "stderr") && event.text !== undefined) {
            output.append(`${event.text}\n`);
        }
    };

    const result = await runConcurrently([{ command, cwd: resolvedCwd, env: options.env, name: task.id }], { killOthers: ["failure"], onEvent });

    const closeEvent = result.closeEvents[0];

    return {
        code: closeEvent?.exitCode ?? 1,
        terminalOutput: output.toString(),
    };
};

const run: Command = {
    argument: {
        description: "The target to run (e.g., build, test, lint)",
        name: "target",
        type: String,
    },
    description: "Run a target across workspace projects",
    examples: [
        ["vis run build", "Run build on all projects"],
        ["vis run test --projects=pkg-a,pkg-b", "Run test on specific projects"],
        ["vis run build --parallel=5", "Run build with 5 parallel tasks"],
        ["vis run build --no-cache", "Run build without caching"],
    ],
    execute: async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }) => {
        const target = argument[0];

        if (!target) {
            throw new Error("Missing target. Usage: vis run <target>");
        }

        if (!wsRoot) {
            throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
        }

        const workspaceRoot = wsRoot;
        const { config, workspace } = discoverWorkspace(workspaceRoot, visConfig);
        const projectGraph = buildProjectGraph(workspaceRoot, workspace);

        // Enforce project constraints if configured
        if (config.constraints && !options.skipConstraints) {
            const violations = enforceProjectConstraints(projectGraph, config.constraints);

            if (violations.length > 0) {
                for (const v of violations) {
                    logger.error(`[${v.rule}] ${v.message}`);
                }

                throw new Error(`${violations.length} project constraint violation(s) found. Use --skip-constraints to bypass.`);
            }
        }

        let projectNames = Object.keys(workspace.projects);

        if (options.projects) {
            const requested = new Set((options.projects as string).split(",").map((p: string) => p.trim()));

            projectNames = projectNames.filter((name) => requested.has(name));

            if (projectNames.length === 0) {
                throw new Error(`No matching projects found for: ${String(options.projects)}`);
            }
        }

        const projectsWithTarget = projectNames.filter((name) => {
            const project = workspace.projects[name];

            return project?.targets?.[target] !== undefined;
        });

        if (projectsWithTarget.length === 0) {
            logger.info(`No projects have the "${target}" target.`);

            return;
        }

        let initialTasks: Task[] = projectsWithTarget.map((projectName) => {
            const project = workspace.projects[projectName];
            const targetConfig = project?.targets?.[target];
            const taskTarget: TaskTarget = { project: projectName, target };
            const taskId = `${projectName}:${target}`;

            return {
                cache: targetConfig?.cache ?? config.targetDefaults?.[target]?.cache,
                id: taskId,
                outputs: targetConfig?.outputs ?? config.targetDefaults?.[target]?.outputs ?? [],
                overrides: { command: targetConfig?.command },
                parallelism: targetConfig?.parallelism ?? config.targetDefaults?.[target]?.parallelism,
                projectRoot: project?.root,
                target: taskTarget,
            };
        });

        // Apply CI job partitioning if --partition or VIS_PARTITION is set
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

        const taskExecutor = createConcurrentExecutor(workspaceRoot);

        if (isTTY) {
            const dynamic = createDynamicOutputRenderer(lifecycleOptions);
            const { lifeCycle, store } = dynamic;

            // Run tasks in a loop — supports rerun (r) and single-task retry (R)
            let loopAction: "quit" | "rerun" | "retry" = "rerun";
            let retryTaskId: string | null = null;

            while (loopAction !== "quit") {
                if (loopAction === "rerun") {
                    // Full rerun of all tasks

                    await defaultTaskRunner(initialTasks, runnerOptions, {
                        lifeCycle,
                        projectGraph,
                        taskExecutor,
                        taskGraph,
                        workspaceRoot,
                    });
                } else if (loopAction === "retry" && retryTaskId) {
                    // Retry a single failed task
                    const task = initialTasks.find((t) => t.id === retryTaskId);
                    const command = task?.overrides["command"] as string | undefined;

                    if (task && command) {
                        const taskCwd = task.projectRoot ?? workspaceRoot;
                        const resolvedCwd = taskCwd.startsWith("/") ? taskCwd : `${workspaceRoot}/${taskCwd}`;

                        lifeCycle.startTasks?.([task]);

                        const retryResult = await runConcurrently([{ command, cwd: resolvedCwd, name: task.id }], {
                            onEvent: (event: ProcessEvent) => {
                                if ((event.kind === "stdout" || event.kind === "stderr") && event.text) {
                                    store.addOutput(task.id, `${event.text}\n`);
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

                // Wait for user action: quit, rerun, or retry

                loopAction = await new Promise<"quit" | "rerun" | "retry">((resolve) => {
                    // Watch for rerun or retry requests
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

                    // Check if user quit -- clean up subscription to avoid leak
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
        } else {
            const lifeCycle = new StaticOutputLifeCycle(lifecycleOptions);

            const results = await defaultTaskRunner(initialTasks, runnerOptions, {
                lifeCycle,
                projectGraph,
                taskExecutor,
                taskGraph,
                workspaceRoot,
            });

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

            if (hasFailure) {
                throw new Error("Some tasks failed.");
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
    ],
};

export default run;
