import { execFile } from "node:child_process";

// path utilities not needed - git returns workspace-relative paths
import type { ProjectConfiguration, ProjectGraph } from "./types";

/**
 * Validates a git ref to prevent command injection.
 * Only allows characters valid in git refs: alphanumeric, ., -, _, /, ~, ^
 */
const validateGitRef = (ref: string): void => {
    if (!/^[a-zA-Z0-9._\-/~^@{}]+$/.test(ref)) {
        throw new Error(`Invalid git ref: "${ref}". Only alphanumeric characters, dots, dashes, underscores, slashes, tildes, carets, and @ are allowed.`);
    }
};

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
 * Gets the merge-base between two refs.
 */
const getMergeBase = (workspaceRoot: string, base: string, head: string): Promise<string> =>
    new Promise((resolve, reject) => {
        execFile("git", ["merge-base", base, head], { cwd: workspaceRoot }, (error, stdout) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout.trim());
            }
        });
    });

/**
 * Gets the list of files changed between two git refs.
 * Uses execFile with argument arrays to prevent command injection.
 */
const getChangedFiles = async (workspaceRoot: string, base: string, head: string): Promise<string[]> => {
    validateGitRef(base);
    validateGitRef(head);

    try {
        // Use merge-base to handle diverged branches correctly
        const mergeBase = await getMergeBase(workspaceRoot, base, head);

        return await new Promise((resolve, reject) => {
            execFile("git", ["diff", "--name-only", mergeBase, head], { cwd: workspaceRoot }, (error, stdout) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout.trim().split("\n").filter(Boolean));
                }
            });
        });
    } catch {
        // Fallback: direct diff with ... syntax (for shallow clones)
        return new Promise((resolve, reject) => {
            execFile("git", ["diff", "--name-only", `${base}...${head}`], { cwd: workspaceRoot }, (error, stdout) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout.trim().split("\n").filter(Boolean));
                }
            });
        });
    }
};

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
