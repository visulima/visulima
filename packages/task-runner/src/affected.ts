import { exec } from "node:child_process";

// path utilities not needed - git returns workspace-relative paths
import type { ProjectConfiguration, ProjectGraph } from "./types";

/**
 * Options for determining affected projects.
 */
interface AffectedOptions {
    /** The base ref to compare against (default: "main") */
    base?: string;
    /** The head ref to compare (default: "HEAD") */
    head?: string;
    /** Project graph for dependency resolution */
    projectGraph: ProjectGraph;
    /** All project configurations keyed by name */
    projects: Record<string, ProjectConfiguration>;
    /** The workspace root directory */
    workspaceRoot: string;
}

/**
 * Result of affected detection.
 */
interface AffectedResult {
    /** Projects affected by changes (including transitive dependents) */
    affectedProjects: string[];
    /** Files that changed between base and head */
    changedFiles: string[];
    /** Projects that were directly changed */
    changedProjects: string[];
}

/**
 * Determines which project owns a given file path (relative to workspace root).
 * Returns undefined if the file is outside all projects (global file).
 */
const findProjectForFile = (filePath: string, projects: Record<string, ProjectConfiguration>): string | undefined => {
    let bestMatch: string | undefined;
    let bestLength = 0;

    for (const [name, config] of Object.entries(projects)) {
        const { root } = config;

        // Check if file is within this project's root
        if (
            (filePath.startsWith(`${root}/`) || filePath === root) // Prefer the most specific (longest) match
            && root.length > bestLength
        ) {
            bestMatch = name;
            bestLength = root.length;
        }
    }

    return bestMatch;
};

/**
 * Expands a set of changed projects to include all transitively dependent projects.
 * Mutates the input set.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const expandAffected = (affectedProjects: Set<string>, projectGraph: ProjectGraph): void => {
    // Build reverse dependency map (project -> projects that depend on it)
    const reverseDependencies = new Map<string, Set<string>>();

    for (const [project, dependencies] of Object.entries(projectGraph.dependencies)) {
        for (const dependency of dependencies) {
            let set = reverseDependencies.get(dependency.target);

            if (!set) {
                set = new Set();
                reverseDependencies.set(dependency.target, set);
            }

            set.add(project);
        }
    }

    // BFS from changed projects through reverse dependencies
    const queue = [...affectedProjects];

    while (queue.length > 0) {
        const project = queue.shift();

        if (project === undefined) {
            continue;
        }

        const dependents = reverseDependencies.get(project);

        if (dependents) {
            for (const dependent of dependents) {
                if (!affectedProjects.has(dependent)) {
                    affectedProjects.add(dependent);
                    queue.push(dependent);
                }
            }
        }
    }
};

/**
 * Gets the list of files changed between two git refs.
 */
const getChangedFiles = (workspaceRoot: string, base: string, head: string): Promise<string[]> =>
    new Promise((resolve, reject) => {
        // Use merge-base to handle diverged branches correctly
        // eslint-disable-next-line sonarjs/os-command
        exec(`git diff --name-only $(git merge-base ${base} ${head}) ${head}`, { cwd: workspaceRoot }, (error, stdout) => {
            if (error) {
                // Fallback: direct diff (for shallow clones)
                // eslint-disable-next-line sonarjs/os-command
                exec(`git diff --name-only ${base}...${head}`, { cwd: workspaceRoot }, (error2, stdout2) => {
                    if (error2) {
                        reject(error2);
                    } else {
                        resolve(stdout2.trim().split("\n").filter(Boolean));
                    }
                });
            } else {
                resolve(stdout.trim().split("\n").filter(Boolean));
            }
        });
    });

/**
 * Determines which projects are affected by changes between two git refs.
 *
 * Uses `git diff` to find changed files, maps them to projects based on
 * project roots, then walks the project dependency graph to find all
 * transitively affected projects.
 *
 * This is the same strategy used by `nx affected` and `turbo run --filter=[base...]`.
 */
const getAffectedProjects = async (options: AffectedOptions): Promise<AffectedResult> => {
    const { base = "main", head = "HEAD", projectGraph, projects, workspaceRoot } = options;

    // Get changed files from git
    const changedFiles = await getChangedFiles(workspaceRoot, base, head);

    // Map changed files to projects
    const changedProjects = new Set<string>();

    for (const file of changedFiles) {
        const project = findProjectForFile(file, projects);

        if (project) {
            changedProjects.add(project);
        } else {
            // File is outside all projects (e.g., root tsconfig.json, package.json)
            // This is a global change — mark all projects as affected
            return {
                affectedProjects: Object.keys(projects),
                changedFiles,
                changedProjects: Object.keys(projects),
            };
        }
    }

    // Walk the dependency graph to find all affected projects
    const affectedProjects = new Set(changedProjects);

    expandAffected(affectedProjects, projectGraph);

    return {
        affectedProjects: [...affectedProjects],
        changedFiles,
        changedProjects: [...changedProjects],
    };
};

/**
 * Filters tasks to only include those that are affected by changes.
 */
const filterAffectedTasks = (taskIds: string[], affectedProjects: Set<string>): string[] =>
    taskIds.filter((taskId) => {
        const parts = taskId.split(":");
        const project = parts[0] as string;

        return affectedProjects.has(project);
    });

export type { AffectedOptions, AffectedResult };
export { filterAffectedTasks, getAffectedProjects, getChangedFiles };
