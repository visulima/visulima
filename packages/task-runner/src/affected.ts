import { exec } from "node:child_process";
// path utilities not needed - git returns workspace-relative paths

import type { ProjectGraph, ProjectConfiguration } from "./types";

/**
 * Options for determining affected projects.
 */
export interface AffectedOptions {
    /** The workspace root directory */
    workspaceRoot: string;
    /** The base ref to compare against (default: "main") */
    base?: string;
    /** The head ref to compare (default: "HEAD") */
    head?: string;
    /** Project graph for dependency resolution */
    projectGraph: ProjectGraph;
    /** All project configurations keyed by name */
    projects: Record<string, ProjectConfiguration>;
}

/**
 * Result of affected detection.
 */
export interface AffectedResult {
    /** Projects that were directly changed */
    changedProjects: string[];
    /** Projects affected by changes (including transitive dependents) */
    affectedProjects: string[];
    /** Files that changed between base and head */
    changedFiles: string[];
}

/**
 * Determines which projects are affected by changes between two git refs.
 *
 * Uses `git diff` to find changed files, maps them to projects based on
 * project roots, then walks the project dependency graph to find all
 * transitively affected projects.
 *
 * This is the same strategy used by `nx affected` and `turbo run --filter=[base...]`.
 */
export const getAffectedProjects = async (
    options: AffectedOptions,
): Promise<AffectedResult> => {
    const {
        workspaceRoot,
        base = "main",
        head = "HEAD",
        projectGraph,
        projects,
    } = options;

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
                changedFiles,
                changedProjects: Object.keys(projects),
                affectedProjects: Object.keys(projects),
            };
        }
    }

    // Walk the dependency graph to find all affected projects
    const affectedProjects = new Set(changedProjects);

    expandAffected(affectedProjects, projectGraph);

    return {
        changedFiles,
        changedProjects: [...changedProjects],
        affectedProjects: [...affectedProjects],
    };
};

/**
 * Gets the list of files changed between two git refs.
 */
export const getChangedFiles = (
    workspaceRoot: string,
    base: string,
    head: string,
): Promise<string[]> => {
    return new Promise((promiseResolve, reject) => {
        // Use merge-base to handle diverged branches correctly
        exec(
            `git diff --name-only $(git merge-base ${base} ${head}) ${head}`,
            { cwd: workspaceRoot },
            (error, stdout) => {
                if (error) {
                    // Fallback: direct diff (for shallow clones)
                    exec(
                        `git diff --name-only ${base}...${head}`,
                        { cwd: workspaceRoot },
                        (error2, stdout2) => {
                            if (error2) {
                                reject(error2);
                            } else {
                                promiseResolve(
                                    stdout2.trim().split("\n").filter(Boolean),
                                );
                            }
                        },
                    );
                } else {
                    promiseResolve(
                        stdout.trim().split("\n").filter(Boolean),
                    );
                }
            },
        );
    });
};

/**
 * Determines which project owns a given file path (relative to workspace root).
 * Returns null if the file is outside all projects (global file).
 */
const findProjectForFile = (
    filePath: string,
    projects: Record<string, ProjectConfiguration>,
): string | null => {
    let bestMatch: string | null = null;
    let bestLength = 0;

    for (const [name, config] of Object.entries(projects)) {
        const root = config.root;

        // Check if file is within this project's root
        if (filePath.startsWith(root + "/") || filePath === root) {
            // Prefer the most specific (longest) match
            if (root.length > bestLength) {
                bestMatch = name;
                bestLength = root.length;
            }
        }
    }

    return bestMatch;
};

/**
 * Expands a set of changed projects to include all transitively dependent projects.
 * Mutates the input set.
 */
const expandAffected = (
    affectedProjects: Set<string>,
    projectGraph: ProjectGraph,
): void => {
    // Build reverse dependency map (project → projects that depend on it)
    const reverseDeps = new Map<string, Set<string>>();

    for (const [project, deps] of Object.entries(projectGraph.dependencies)) {
        for (const dep of deps) {
            let set = reverseDeps.get(dep.target);

            if (!set) {
                set = new Set();
                reverseDeps.set(dep.target, set);
            }

            set.add(project);
        }
    }

    // BFS from changed projects through reverse dependencies
    const queue = [...affectedProjects];

    while (queue.length > 0) {
        const project = queue.shift()!;
        const dependents = reverseDeps.get(project);

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
 * Filters tasks to only include those that are affected by changes.
 */
export const filterAffectedTasks = (
    taskIds: string[],
    affectedProjects: Set<string>,
): string[] => {
    return taskIds.filter((taskId) => {
        const project = taskId.split(":")[0]!;

        return affectedProjects.has(project);
    });
};
