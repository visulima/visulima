import { spawn } from "node:child_process";

import type { Command } from "@visulima/cerebro";
import type { Task, TaskRunnerOptions, TaskTarget } from "@visulima/task-runner";
import { createTaskGraph, defaultTaskRunner, generateRunSummary, writeRunSummary } from "@visulima/task-runner";

import isInCi from "is-in-ci";

import { createDynamicOutputRenderer } from "../tui/dynamic-life-cycle";
import { StaticOutputLifeCycle } from "../tui/static-life-cycle";
import { buildProjectGraph, discoverWorkspace } from "../workspace";

/**
 * Creates an async task executor that runs commands via shell.
 * Uses spawn instead of execSync so the event loop stays unblocked,
 * allowing the TUI render interval to update spinners and durations.
 */
const createShellExecutor = (workspaceRoot: string) => async (task: Task, options: { cwd?: string; env?: Record<string, string> }) => {
    const taskCwd = options.cwd ?? task.projectRoot ?? workspaceRoot;
    const resolvedCwd = taskCwd.startsWith("/") ? taskCwd : `${workspaceRoot}/${taskCwd}`;

    const command = task.overrides["command"] as string | undefined;

    if (!command) {
        return { code: 0, terminalOutput: `No command configured for ${task.target.project}:${task.target.target}` };
    }

    return new Promise<{ code: number; terminalOutput: string }>((resolvePromise) => {
        const chunks: string[] = [];

        // command sourced from package.json scripts, not user input
        const child = spawn(command, {
            cwd: resolvedCwd,
            env: { ...process.env, ...options.env },
            shell: true,
            stdio: "pipe",
        });

        child.stdout?.on("data", (data: Buffer) => {
            chunks.push(data.toString());
        });

        child.stderr?.on("data", (data: Buffer) => {
            chunks.push(data.toString());
        });

        child.on("close", (code) => {
            resolvePromise({
                code: code ?? 0,
                terminalOutput: chunks.join(""),
            });
        });

        child.on("error", (error) => {
            resolvePromise({
                code: 1,
                terminalOutput: chunks.join("") + (error.message ?? ""),
            });
        });
    });
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

        const initialTasks: Task[] = projectsWithTarget.map((projectName) => {
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

        const taskExecutor = createShellExecutor(workspaceRoot);

        if (isTTY) {
            const dynamic = createDynamicOutputRenderer(lifecycleOptions);
            const { lifeCycle, store } = dynamic;

            // Run tasks in a loop — supports rerun via `r` key
            let shouldRerun = true;

            while (shouldRerun) {
                shouldRerun = false;

                // eslint-disable-next-line no-await-in-loop -- sequential rerun loop
                await defaultTaskRunner(initialTasks, runnerOptions, {
                    lifeCycle,
                    projectGraph,
                    taskExecutor,
                    taskGraph,
                    workspaceRoot,
                });

                // Wait for either quit (renderIsDone resolves) or rerun request
                // eslint-disable-next-line no-await-in-loop -- sequential rerun loop
                shouldRerun = await new Promise<boolean>((resolve) => {
                    // Check if already resolved (user quit before we got here)
                    dynamic.renderIsDone.then(
                        () => { resolve(false); },
                        () => { resolve(false); },
                    );

                    // Watch for rerun requests
                    const unsubscribe = store.subscribe(() => {
                        const state = store.getSnapshot();

                        if (state.rerunRequested) {
                            store.acknowledgeRerun();
                            unsubscribe();
                            resolve(true);
                        }
                    });
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
    ],
};

export default run;
