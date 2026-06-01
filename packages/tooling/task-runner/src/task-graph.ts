import type { OutputSpec, ProjectGraph, TargetConfiguration, TargetDependencyConfig, Task, TaskGraph, TaskTarget, WorkspaceConfiguration } from "./types";

interface CreateTaskGraphOptions {
    /** The project graph */
    projectGraph: ProjectGraph;
    /** Target default configurations */
    targetDefaults?: Record<string, Partial<TargetConfiguration>>;
    /** The workspace configuration */
    workspace: WorkspaceConfiguration;
}

/**
 * Creates a unique task ID from a target.
 */
const getTaskId = (target: TaskTarget): string => {
    const parts = [target.project, target.target];

    if (target.configuration) {
        parts.push(target.configuration);
    }

    return parts.join(":");
};

/**
 * Parses a task ID into its component parts.
 */
const parseTaskId = (taskId: string): TaskTarget => {
    const parts = taskId.split(":");

    if (parts.length < 2) {
        throw new Error(`Invalid task ID: ${taskId}`);
    }

    return {
        configuration: parts[2],
        project: parts[0] as string,
        target: parts[1] as string,
    };
};

const normalizeWarningPattern = (value: string | string[] | undefined): string[] | undefined => {
    if (value === undefined) {
        return undefined;
    }

    const list = typeof value === "string" ? [value] : value;

    return list.length === 0 ? undefined : list;
};

/**
 * Extracts the output patterns for a task.
 */
const getTaskOutputs = (
    projectName: string,
    targetName: string,
    workspace: WorkspaceConfiguration,
    targetDefaults?: Record<string, Partial<TargetConfiguration>>,
): OutputSpec[] => {
    const project = workspace.projects[projectName];
    const targetConfig = project?.targets?.[targetName];
    const defaultConfig = targetDefaults?.[targetName];

    const outputs = targetConfig?.outputs ?? defaultConfig?.outputs ?? [];

    // Only string entries carry `{projectRoot}`/`{projectName}`
    // tokens; `{ auto: true }` is an opaque marker resolved later
    // against the file-access tracker, so it passes through verbatim.
    return outputs.map((output) =>
        typeof output === "string" ? output.replace("{projectRoot}", project?.root ?? "").replace("{projectName}", projectName) : output,
    );
};

/**
 * Gets a task for a target on the same project.
 */
const getSameProjectTask = (
    projectName: string,
    targetName: string,
    overrides: Record<string, unknown>,
    workspace: WorkspaceConfiguration,
    targetDefaults?: Record<string, Partial<TargetConfiguration>>,
): Task[] => {
    const project = workspace.projects[projectName];

    if (!project) {
        return [];
    }

    const hasTarget = project.targets?.[targetName] !== undefined || targetDefaults?.[targetName] !== undefined;

    if (!hasTarget) {
        return [];
    }

    const target: TaskTarget = {
        project: projectName,
        target: targetName,
    };

    return [
        {
            always: project.targets?.[targetName]?.always ?? targetDefaults?.[targetName]?.always,
            cache: project.targets?.[targetName]?.cache ?? targetDefaults?.[targetName]?.cache,
            cacheOnWarning: project.targets?.[targetName]?.cacheOnWarning ?? targetDefaults?.[targetName]?.cacheOnWarning,
            cacheRestore: project.targets?.[targetName]?.cacheRestore ?? targetDefaults?.[targetName]?.cacheRestore,
            concurrencyGroup: project.targets?.[targetName]?.concurrencyGroup ?? targetDefaults?.[targetName]?.concurrencyGroup,
            concurrencyWeight: project.targets?.[targetName]?.concurrencyWeight ?? targetDefaults?.[targetName]?.concurrencyWeight,
            hashMode: project.targets?.[targetName]?.hashMode ?? targetDefaults?.[targetName]?.hashMode,
            id: getTaskId(target),
            maxConcurrent: project.targets?.[targetName]?.maxConcurrent ?? targetDefaults?.[targetName]?.maxConcurrent,
            outputs: getTaskOutputs(projectName, targetName, workspace, targetDefaults),
            overrides,
            parallelism: project.targets?.[targetName]?.parallelism ?? targetDefaults?.[targetName]?.parallelism,
            projectRoot: project.root,
            pty: project.targets?.[targetName]?.pty ?? targetDefaults?.[targetName]?.pty,
            target,
            warningPattern: normalizeWarningPattern(project.targets?.[targetName]?.warningPattern ?? targetDefaults?.[targetName]?.warningPattern),
            when: project.targets?.[targetName]?.when ?? targetDefaults?.[targetName]?.when,
        },
    ];
};

/**
 * Gets tasks for the dependency projects of a given project.
 */
const getDependencyProjectTasks = (
    projectName: string,
    targetName: string,
    overrides: Record<string, unknown>,
    workspace: WorkspaceConfiguration,
    projectGraph: ProjectGraph,
    targetDefaults?: Record<string, Partial<TargetConfiguration>>,
): Task[] => {
    const tasks: Task[] = [];
    const deps = projectGraph.dependencies[projectName] ?? [];

    for (const dep of deps) {
        // Skip self-edges. A package that lists itself as a workspace
        // dependency (a real and easy-to-make mistake in package.json)
        // would otherwise produce `pkg:build → pkg:build` and the
        // orchestrator's deadlock detector would surface it as a
        // circular dependency — pointing the operator at the task
        // graph when the real bug is in the project graph.
        if (dep.target === projectName) {
            continue;
        }

        // Skip peer-dependency edges for *build ordering*. Peers are
        // declarations that the depending package needs the peer at
        // runtime, but they don't imply that the peer must build first
        // (and they often form bidirectional cycles: an eslint plugin
        // peer-deps eslint while eslint workspace-deps the plugin via
        // tests). pnpm/turbo intentionally exclude peer-deps from
        // build order. Affected-detection still uses the full graph
        // through a separate code path, so a code change in the peer
        // still propagates. See voidzero-dev/vite-task#411.
        if (dep.type === "peerDependency") {
            continue;
        }

        const depProject = workspace.projects[dep.target];

        if (!depProject) {
            continue;
        }

        const hasTarget = depProject.targets?.[targetName] !== undefined || targetDefaults?.[targetName] !== undefined;

        if (hasTarget) {
            const target: TaskTarget = {
                project: dep.target,
                target: targetName,
            };

            tasks.push({
                always: depProject.targets?.[targetName]?.always ?? targetDefaults?.[targetName]?.always,
                cache: depProject.targets?.[targetName]?.cache ?? targetDefaults?.[targetName]?.cache,
                cacheOnWarning: depProject.targets?.[targetName]?.cacheOnWarning ?? targetDefaults?.[targetName]?.cacheOnWarning,
                cacheRestore: depProject.targets?.[targetName]?.cacheRestore ?? targetDefaults?.[targetName]?.cacheRestore,
                concurrencyGroup: depProject.targets?.[targetName]?.concurrencyGroup ?? targetDefaults?.[targetName]?.concurrencyGroup,
                concurrencyWeight: depProject.targets?.[targetName]?.concurrencyWeight ?? targetDefaults?.[targetName]?.concurrencyWeight,
                hashMode: depProject.targets?.[targetName]?.hashMode ?? targetDefaults?.[targetName]?.hashMode,
                id: getTaskId(target),
                maxConcurrent: depProject.targets?.[targetName]?.maxConcurrent ?? targetDefaults?.[targetName]?.maxConcurrent,
                outputs: getTaskOutputs(dep.target, targetName, workspace, targetDefaults),
                overrides,
                parallelism: depProject.targets?.[targetName]?.parallelism ?? targetDefaults?.[targetName]?.parallelism,
                projectRoot: depProject.root,
                pty: depProject.targets?.[targetName]?.pty ?? targetDefaults?.[targetName]?.pty,
                target,
                warningPattern: normalizeWarningPattern(depProject.targets?.[targetName]?.warningPattern ?? targetDefaults?.[targetName]?.warningPattern),
                when: depProject.targets?.[targetName]?.when ?? targetDefaults?.[targetName]?.when,
            });
        }
    }

    return tasks;
};

/**
 * Resolves a string-format dependency like "build" or "^build".
 *
 * String-form deps **do not inherit** the parent task's overrides —
 * matching the config-form default (`params: "forward"` must be set
 * explicitly to propagate). This is what lets consumers scope extra
 * CLI args to the user-invoked target only. (Same fix as vite-task PR #324.)
 */
const resolveStringDependency = (
    task: Task,
    dep: string,
    workspace: WorkspaceConfiguration,
    projectGraph: ProjectGraph,
    targetDefaults?: Record<string, Partial<TargetConfiguration>>,
): Task[] => {
    // "^targetName" means the target on dependency projects
    if (dep.startsWith("^")) {
        const targetName = dep.slice(1);

        return getDependencyProjectTasks(task.target.project, targetName, {}, workspace, projectGraph, targetDefaults);
    }

    // "targetName" means the target on the same project
    return getSameProjectTask(task.target.project, dep, {}, workspace, targetDefaults);
};

/**
 * Resolves a config-format dependency.
 */
const resolveConfigDependency = (
    task: Task,
    dep: TargetDependencyConfig,
    workspace: WorkspaceConfiguration,
    projectGraph: ProjectGraph,
    targetDefaults?: Record<string, Partial<TargetConfiguration>>,
): Task[] => {
    const tasks: Task[] = [];

    if (dep.dependencies) {
        tasks.push(
            ...getDependencyProjectTasks(
                task.target.project,
                dep.target,
                dep.params === "forward" ? task.overrides : {},
                workspace,
                projectGraph,
                targetDefaults,
            ),
        );
    } else if (dep.projects) {
        const projects = Array.isArray(dep.projects) ? dep.projects : [dep.projects];

        for (const projectName of projects) {
            tasks.push(...getSameProjectTask(projectName, dep.target, dep.params === "forward" ? task.overrides : {}, workspace, targetDefaults));
        }
    } else {
        tasks.push(...getSameProjectTask(task.target.project, dep.target, dep.params === "forward" ? task.overrides : {}, workspace, targetDefaults));
    }

    return tasks;
};

/**
 * Resolves a single dependency declaration into concrete tasks.
 */
const resolveDependency = (
    task: Task,
    dep: string | TargetDependencyConfig,
    workspace: WorkspaceConfiguration,
    projectGraph: ProjectGraph,
    targetDefaults?: Record<string, Partial<TargetConfiguration>>,
): Task[] => {
    if (typeof dep === "string") {
        return resolveStringDependency(task, dep, workspace, projectGraph, targetDefaults);
    }

    return resolveConfigDependency(task, dep, workspace, projectGraph, targetDefaults);
};

/**
 * Resolves the dependencies of a task based on target configuration.
 */
const resolveTaskDependencies = (task: Task, options: CreateTaskGraphOptions): Task[] => {
    const { projectGraph, targetDefaults, workspace } = options;
    const project = workspace.projects[task.target.project];

    if (!project) {
        return [];
    }

    const targetConfig = project.targets?.[task.target.target];
    const defaultConfig = targetDefaults?.[task.target.target];
    const dependsOn = targetConfig?.dependsOn ?? defaultConfig?.dependsOn ?? [];

    const depTasks: Task[] = [];

    for (const dep of dependsOn) {
        const resolved = resolveDependency(task, dep, workspace, projectGraph, targetDefaults);

        depTasks.push(...resolved);
    }

    return depTasks;
};

/**
 * Creates a task graph from a list of tasks, resolving all dependencies.
 */
const createTaskGraph = (initialTasks: Task[], options: CreateTaskGraphOptions): TaskGraph => {
    const tasks: Record<string, Task> = {};
    const dependencies: Record<string, string[]> = {};
    const visited = new Set<string>();
    const queued = new Set<string>(initialTasks.map((task) => task.id));
    const queue: Task[] = [...initialTasks];

    while (queue.length > 0) {
        const task = queue.shift();

        if (!task) {
            break;
        }

        if (visited.has(task.id)) {
            continue;
        }

        visited.add(task.id);
        tasks[task.id] = task;
        dependencies[task.id] = [];

        const deps = resolveTaskDependencies(task, options);

        for (const depTask of deps) {
            dependencies[task.id]?.push(depTask.id);

            // Dedup at queue-time, not just at dequeue-time. Diamond
            // graphs (multiple parents sharing a dep) used to push the
            // same dep onto the queue once per parent; the visited
            // check inside the while loop made each extra entry a
            // no-op but still allocated. Track `queued` separately so
            // we don't accidentally mark the dep as fully processed
            // before its own deps are resolved.
            if (!visited.has(depTask.id) && !queued.has(depTask.id)) {
                queue.push(depTask);
                queued.add(depTask.id);
            }
        }
    }

    const allDeps = new Set<string>();

    for (const deps of Object.values(dependencies)) {
        for (const dep of deps) {
            allDeps.add(dep);
        }
    }

    const roots = Object.keys(tasks).filter((taskId) => !allDeps.has(taskId));

    return { dependencies, roots, tasks };
};

export { createTaskGraph, getTaskId, parseTaskId };
