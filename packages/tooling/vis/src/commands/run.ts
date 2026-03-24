import { execSync } from "node:child_process";
import { cwd } from "node:process";

import type { Command } from "@visulima/cerebro";
import type { Task, TaskRunnerOptions, TaskTarget } from "@visulima/task-runner";
import { ConsoleLifeCycle, createTaskGraph, defaultTaskRunner, generateRunSummary, writeRunSummary } from "@visulima/task-runner";

import { buildProjectGraph, discoverWorkspace, findWorkspaceRoot } from "../workspace";

/**
 * Creates a task executor that runs commands via shell.
 */
const createShellExecutor = (workspaceRoot: string) => async (task: Task, options: { cwd?: string; env?: Record<string, string> }) => {
    const taskCwd = options.cwd ?? task.projectRoot ?? workspaceRoot;
    const resolvedCwd = taskCwd.startsWith("/") ? taskCwd : `${workspaceRoot}/${taskCwd}`;

    const command = task.overrides["command"] as string | undefined;

    if (!command) {
        return { code: 0, terminalOutput: `No command configured for ${task.target.project}:${task.target.target}` };
    }

    try {
        // eslint-disable-next-line sonarjs/os-command -- command sourced from package.json scripts, not user input
        const output = execSync(command, {
            cwd: resolvedCwd,
            encoding: "utf8",
            env: { ...process.env, ...options.env },
            stdio: "pipe",
        });

        return { code: 0, terminalOutput: output };
    } catch (error: unknown) {
        const execError = error as { status?: number; stderr?: string; stdout?: string };

        return {
            code: execError.status ?? 1,
            terminalOutput: (execError.stdout ?? "") + (execError.stderr ?? ""),
        };
    }
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
    execute: async ({ argument, logger, options }) => {
        const target = argument[0];

        if (!target) {
            throw new Error("Missing target. Usage: vis run <target>");
        }

        const workspaceRoot = findWorkspaceRoot(cwd());
        const { config, workspace } = discoverWorkspace(workspaceRoot);
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

        const taskCount = Object.keys(taskGraph.tasks).length;
        const startTime = Date.now();

        logger.info(`vis run ${target}  (${taskCount} task${taskCount === 1 ? "" : "s"})`);

        const runnerOptions: TaskRunnerOptions = {
            cacheDirectory: options.cacheDir as string | undefined,
            dryRun: options.dryRun as boolean,
            parallel: (options.parallel as number) ?? 3,
            skipNxCache: !options.cache,
            summarize: options.summarize as boolean,
            ...config.taskRunnerOptions,
        };

        const lifeCycle = new ConsoleLifeCycle();
        const taskExecutor = createShellExecutor(workspaceRoot);

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

        logger.info("All tasks completed successfully.");
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
