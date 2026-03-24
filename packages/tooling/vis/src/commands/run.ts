import { execSync } from "node:child_process";
import { cwd, stderr, stdout } from "node:process";

import {
    ConsoleLifeCycle,
    createTaskGraph,
    defaultTaskRunner,
    generateRunSummary,
    writeRunSummary,
    type Task,
    type TaskRunnerOptions,
    type TaskTarget,
} from "@visulima/task-runner";

import { buildProjectGraph, discoverWorkspace, findWorkspaceRoot } from "../workspace";

/**
 * Creates a task executor that runs commands via shell.
 */
const createShellExecutor = (workspaceRoot: string) => {
    return async (task: Task, options: { cwd?: string; env?: Record<string, string> }) => {
        const taskCwd = options.cwd ?? task.projectRoot ?? workspaceRoot;
        const resolvedCwd = taskCwd.startsWith("/") ? taskCwd : `${workspaceRoot}/${taskCwd}`;

        // Get the command from task target
        const command = task.overrides["command"] as string | undefined;

        if (!command) {
            return { code: 0, terminalOutput: `No command configured for ${task.target.project}:${task.target.target}` };
        }

        try {
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
};

/**
 * Implements the `vis run <target>` command.
 */
const runCommand = async (positionals: string[], flags: Record<string, string | boolean>): Promise<void> => {
    const target = positionals[0];

    if (!target) {
        stderr.write("Error: Missing target. Usage: vis run <target>\n");
        process.exit(1);
    }

    const workspaceRoot = findWorkspaceRoot(cwd());
    const { config, workspace } = discoverWorkspace(workspaceRoot);
    const projectGraph = buildProjectGraph(workspaceRoot, workspace);

    // Determine which projects to run
    let projectNames = Object.keys(workspace.projects);

    if (typeof flags["projects"] === "string") {
        const requestedProjects = flags["projects"].split(",").map((p) => p.trim());

        projectNames = projectNames.filter((name) => requestedProjects.includes(name));

        if (projectNames.length === 0) {
            stderr.write(`Error: No matching projects found for: ${flags["projects"]}\n`);
            process.exit(1);
        }
    }

    // Filter to projects that have this target
    const projectsWithTarget = projectNames.filter((name) => {
        const project = workspace.projects[name];

        return project?.targets?.[target] !== undefined;
    });

    if (projectsWithTarget.length === 0) {
        stdout.write(`No projects have the "${target}" target.\n`);

        return;
    }

    // Create initial tasks
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

    // Build the task graph
    const taskGraph = createTaskGraph(initialTasks, {
        projectGraph,
        targetDefaults: config.targetDefaults,
        workspace,
    });

    const taskCount = Object.keys(taskGraph.tasks).length;
    const startTime = Date.now();

    stdout.write(`\n  vis run ${target}  (${taskCount} task${taskCount === 1 ? "" : "s"})\n\n`);

    // Build task runner options
    const runnerOptions: TaskRunnerOptions = {
        ...config.taskRunnerOptions,
        parallel: typeof flags["parallel"] === "string" ? Number.parseInt(flags["parallel"], 10) : 3,
        skipNxCache: flags["cache"] === false,
        dryRun: flags["dry-run"] === true,
        summarize: flags["summarize"] === true,
    };

    // Create lifecycle
    const lifeCycle = new ConsoleLifeCycle();

    // Run tasks
    const taskExecutor = createShellExecutor(workspaceRoot);

    const results = await defaultTaskRunner(initialTasks, runnerOptions, {
        lifeCycle,
        projectGraph,
        taskExecutor,
        taskGraph,
        workspaceRoot,
    });

    // Write summary if requested
    if (flags["summarize"] === true) {
        const summary = generateRunSummary(results, taskGraph, startTime);

        await writeRunSummary(summary, workspaceRoot);
    }

    // Check for failures
    let hasFailure = false;

    for (const [, result] of results) {
        if (result.status === "failure") {
            hasFailure = true;
        }
    }

    if (hasFailure) {
        stderr.write("\nSome tasks failed.\n");
        process.exit(1);
    }

    stdout.write("\nAll tasks completed successfully.\n");
};

export { runCommand };
