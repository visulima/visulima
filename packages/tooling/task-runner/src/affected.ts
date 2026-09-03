import { execFile } from "node:child_process";
import { existsSync } from "node:fs";

// path utilities not needed - git returns workspace-relative paths
import type { AffectedScope, ProjectConfiguration, ProjectGraph } from "./types";

/**
 * Validates a git ref to prevent command injection and `git` option injection.
 * Only allows characters valid in git refs (`\w`, `.`, `-`, `/`, `~`, `^`,
 * `@`, `{`, `}`) and rejects leading dashes so values like `--help` cannot
 * be interpreted as options when passed positionally to `git`.
 *
 * NOTE: This is intentionally mirrored in
 * `packages/tooling/vis/src/commands/ignore-helpers.ts` (`GIT_REF_RE` +
 * `validateGitRef`). If you change the regex or error message here, update
 * the mirror too — vis can't import from task-runner without breaking the
 * test isolation that keeps `vitest run __tests__/ignore.test.ts` runnable
 * without a pre-built task-runner dist.
 */
const validateGitRef = (ref: string): void => {
    if (!/^[\w./~^@{}][\w.\-/~^@{}]*$/.test(ref)) {
        throw new Error(
            `Invalid git ref: "${ref}". Refs must start with an alphanumeric character or one of _ . / ~ ^ @ { } and may only contain letters, digits, dots, dashes, underscores, slashes, tildes, carets, @, and braces.`,
        );
    }
};

/**
 * Options for determining affected projects.
 */
interface AffectedOptions {
    /**
     * Extra changed-file paths to fold into the git diff before mapping
     * files to projects — workspace-relative, same shape as `git diff
     * --name-only` output.
     *
     * Callers use this to account for changes git's ref-to-ref diff cannot
     * see, most importantly the uncommitted working tree (`git status
     * --porcelain`). Merged and deduped with the diff result, so a path
     * appearing in both is counted once.
     */
    additionalChangedFiles?: string[];

    /** The base ref to compare against (default: "main") */
    base?: string;

    /**
     * Control how far downstream (dependents of changed projects) to include.
     * @default "deep"
     */
    downstream?: AffectedScope;
    /** The head ref to compare (default: "HEAD") */
    head?: string;
    /** Project graph for dependency resolution */
    projectGraph: ProjectGraph;
    /** All project configurations keyed by name */
    projects: Record<string, ProjectConfiguration>;

    /**
     * Control how far upstream (dependencies of changed projects) to include.
     * @default "none"
     */
    upstream?: AffectedScope;
    /** The workspace root directory */
    workspaceRoot: string;
}

/**
 * Result of affected detection.
 */
interface AffectedResult {
    /** All affected projects (union of changed, downstream, and upstream) */
    affectedProjects: string[];
    /** Files that changed between base and head */
    changedFiles: string[];
    /** Projects that were directly changed */
    changedProjects: string[];
    /** Projects affected because they depend on changed projects */
    downstreamProjects: string[];
    /** Projects that changed projects depend on */
    upstreamProjects: string[];
}

/**
 * Determines which project owns a given file path (relative to workspace root).
 * Returns undefined if the file is outside all projects (global file).
 */
const findProjectForFile = (filePath: string, projects: Record<string, ProjectConfiguration>): string | undefined => {
    let bestMatch: string | undefined;
    let bestLength = 0;
    // Workspace-root project (root: "." or root: "") matches any file
    // not claimed by a more specific project. Without this special-case,
    // `${root}/` becomes `./` and `filePath.startsWith("./")` is false for
    // git-relative paths like `package.json` — every changed file then
    // falls through to "outside all projects" and the caller marks the
    // whole workspace as affected, defeating affected detection.
    let rootProject: string | undefined;

    for (const [name, config] of Object.entries(projects)) {
        const { root } = config;

        if (root === "" || root === ".") {
            rootProject = name;
            continue;
        }

        // Check if file is within this project's root
        if (
            (filePath.startsWith(`${root}/`) || filePath === root) // Prefer the most specific (longest) match
            && root.length > bestLength
        ) {
            bestMatch = name;
            bestLength = root.length;
        }
    }

    return bestMatch ?? rootProject;
};

/**
 * Builds a map from each project to the set of projects that depend on it (reverse/downstream).
 */
const buildReverseDependencyMap = (projectGraph: ProjectGraph): Map<string, Set<string>> => {
    const map = new Map<string, Set<string>>();

    for (const [project, dependencies] of Object.entries(projectGraph.dependencies)) {
        for (const dependency of dependencies) {
            let set = map.get(dependency.target);

            if (!set) {
                set = new Set();
                map.set(dependency.target, set);
            }

            set.add(project);
        }
    }

    return map;
};

/**
 * Builds a map from each project to the set of projects it depends on (forward/upstream).
 */
const buildForwardDependencyMap = (projectGraph: ProjectGraph): Map<string, Set<string>> => {
    const map = new Map<string, Set<string>>();

    for (const [project, dependencies] of Object.entries(projectGraph.dependencies)) {
        const set = new Set<string>();

        for (const dependency of dependencies) {
            set.add(dependency.target);
        }

        if (set.size > 0) {
            map.set(project, set);
        }
    }

    return map;
};

/**
 * Expands the affected set in a given direction using BFS with depth control.
 * Only seed projects (the initially changed ones) are expanded at depth 0.
 * For "direct" scope, only immediate neighbors are included.
 * For "deep" scope, all transitive neighbors are included.
 */
const expandInDirection = (affected: Set<string>, seeds: Set<string>, adjacency: Map<string, Set<string>>, scope: "deep" | "direct"): Set<string> => {
    const added = new Set<string>();
    const visited = new Set(seeds);
    const queue = [...seeds];

    while (queue.length > 0) {
        const project = queue.shift() as string;
        const neighbors = adjacency.get(project);

        if (!neighbors) {
            continue;
        }

        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                affected.add(neighbor);
                added.add(neighbor);

                if (scope === "deep") {
                    queue.push(neighbor);
                }
                // "direct" → only seeds expand, so neighbors are not enqueued
            }
        }
    }

    return added;
};

/**
 * Expands a set of changed projects based on upstream/downstream scope settings.
 * Returns a new set containing all affected projects.
 */
const expandAffected = (
    changedProjects: Set<string>,
    projectGraph: ProjectGraph,
    options: { downstream: AffectedScope; upstream: AffectedScope },
): { affected: Set<string>; downstream: Set<string>; upstream: Set<string> } => {
    const affected = new Set(changedProjects);
    let downstream = new Set<string>();
    let upstream = new Set<string>();

    // Downstream: projects that depend on changed projects (dependents)
    if (options.downstream !== "none") {
        const reverseDeps = buildReverseDependencyMap(projectGraph);

        downstream = expandInDirection(affected, changedProjects, reverseDeps, options.downstream);
    }

    // Upstream: projects that changed projects depend on (dependencies)
    if (options.upstream !== "none") {
        const forwardDeps = buildForwardDependencyMap(projectGraph);

        upstream = expandInDirection(affected, changedProjects, forwardDeps, options.upstream);
    }

    return { affected, downstream, upstream };
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
 * Re-labels a spawn failure with the reason it actually happened, and passes
 * anything else through untouched.
 *
 * The bare `spawn git ENOENT` this replaces named neither git nor affected
 * detection nor what to install — and the usual CI base images (alpine node)
 * ship without git, so it is a common first encounter.
 *
 * `code`/`path`/`syscall` cannot tell the two ENOENT causes apart: spawning
 * into a directory that does not exist reports `path: "git"` and
 * `syscall: "spawn git"` exactly as a missing binary does. The workspace
 * root is therefore checked directly, so a bad `--cwd` is never answered
 * with "install git" when git is sitting right there.
 */
const withSpawnFailureHint = (error: unknown, workspaceRoot: string): unknown => {
    const failure = error as NodeJS.ErrnoException & { path?: string };

    if (failure?.code !== "ENOENT" || (failure.path !== "git" && failure.syscall !== "spawn git")) {
        return error;
    }

    if (!existsSync(workspaceRoot)) {
        return new Error(`Affected detection could not enter the workspace root: ${workspaceRoot} does not exist.`, { cause: error });
    }

    return new Error(
        "Affected detection needs the `git` binary, which was not found on PATH. "
        + "Install it (`apk add git` on alpine, `apt-get install -y git` on debian) "
        + "or run the target without `--affected`.",
        { cause: error },
    );
};

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
    } catch (error) {
        // A missing binary is not a diverged-branch problem, and the
        // fallback below cannot succeed either — both paths shell out to
        // the same missing executable. Fail here with the real reason.
        const relabelled = withSpawnFailureHint(error, workspaceRoot);

        if (relabelled !== error) {
            throw relabelled;
        }

        // Fallback: direct diff with ... syntax (for shallow clones)
        return new Promise((resolve, reject) => {
            execFile("git", ["diff", "--name-only", `${base}...${head}`], { cwd: workspaceRoot }, (diffError, stdout) => {
                if (diffError) {
                    reject(withSpawnFailureHint(diffError, workspaceRoot));
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
    const {
        additionalChangedFiles,
        base = "main",
        downstream = "deep",
        head = "HEAD",
        projectGraph,
        projects,
        upstream = "none",
        workspaceRoot,
    } = options;

    // Get changed files from git, then fold in any caller-supplied paths
    // (e.g. the uncommitted working tree) that the ref-to-ref diff cannot
    // see. Deduped so a path present in both is only mapped once.
    const diffedFiles = await getChangedFiles(workspaceRoot, base, head);
    const changedFiles
        = additionalChangedFiles && additionalChangedFiles.length > 0 ? [...new Set([...diffedFiles, ...additionalChangedFiles])] : diffedFiles;

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
                changedProjects: [...changedProjects],
                downstreamProjects: [],
                upstreamProjects: [],
            };
        }
    }

    // Walk the dependency graph with scope control
    const result = expandAffected(changedProjects, projectGraph, { downstream, upstream });

    return {
        affectedProjects: [...result.affected],
        changedFiles,
        changedProjects: [...changedProjects],
        downstreamProjects: [...result.downstream],
        upstreamProjects: [...result.upstream],
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
export { buildForwardDependencyMap, buildReverseDependencyMap, expandAffected, filterAffectedTasks, getAffectedProjects, getChangedFiles };
