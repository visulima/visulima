import { cpSync, lstatSync, readdirSync, rmSync } from "node:fs";

import { ensureDirSync, isAccessibleSync, readJsonSync, writeFileSync } from "@visulima/fs";
import { dirname, join, relative } from "@visulima/path";
import type { ProjectGraph, WorkspaceConfiguration } from "@visulima/task-runner";

import type { VisProjectConfiguration } from "../config/workspace";

/**
 * BFS the project graph to collect every project reachable from
 * `start` through `dependencies`. Returns a new set that includes
 * every transitive dependency but NOT `start` itself.
 */
const collectTransitiveProjectDeps = (start: string, projectGraph: ProjectGraph): Set<string> => {
    const result = new Set<string>();
    const queue: string[] = [start];
    const visited = new Set<string>([start]);

    while (queue.length > 0) {
        const current = queue.shift()!;
        const edges = projectGraph.dependencies[current] ?? [];

        for (const edge of edges) {
            if (visited.has(edge.target)) {
                continue;
            }

            visited.add(edge.target);
            result.add(edge.target);
            queue.push(edge.target);
        }
    }

    return result;
};

/**
 * Minimal Docker scaffold: copies the set of files Docker's layer
 * cache benefits from keeping stable (manifests + lockfiles) so an
 * image build can `COPY` them first and install dependencies before
 * source code arrives.
 *
 * Computes the set of projects a focus project depends on and copies
 * only their `package.json` + `project.json` + root manifests, not
 * the whole source tree. Compare with moon's `moon docker scaffold`.
 */

/** Name of the manifest file written by scaffold and read by prune. */
export const DOCKER_MANIFEST_FILENAME = "vis-docker-manifest.json";

const MANIFEST_FILES = ["package.json", "project.json"] as const;

const ROOT_MANIFEST_FILES = [
    "package.json",
    "pnpm-workspace.yaml",
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
    ".npmrc",
    "vis.config.ts",
    "vis.config.mts",
    "vis.config.cts",
    "vis.config.js",
    "vis.config.mjs",
    "vis.config.cjs",
] as const;

export interface ScaffoldOptions {
    /** Project names to focus on — transitive deps are pulled in automatically. */
    focus: string[];

    /**
     * Include the full source tree for the focus project(s). Used for the
     * `sources` stage so the build can actually compile code after deps
     * are installed.
     */
    includeSources?: boolean;
    /** Output directory, typically `.vis/docker/workspace`. */
    outDir: string;
    /** Project graph used to compute the transitive dependency closure. */
    projectGraph: ProjectGraph;
    /** Workspace configuration with resolved project roots. */
    workspace: WorkspaceConfiguration;
    /** Workspace root on disk. */
    workspaceRoot: string;
}

/**
 * Computes the full set of projects that must exist in the Docker context
 * to build a given focus set: the focus projects themselves plus every
 * project reachable from them in the workspace dependency graph.
 * @param focus Project names to focus on.
 * @param projectGraph The workspace project graph.
 * @returns A set containing every project in the transitive closure.
 */
export const resolveFocusProjects = (focus: string[], projectGraph: ProjectGraph): Set<string> => {
    const result = new Set<string>(focus);

    for (const name of focus) {
        const transitive = collectTransitiveProjectDeps(name, projectGraph);

        for (const dep of transitive) {
            result.add(dep);
        }
    }

    return result;
};

const ensureDir = (path: string): void => {
    ensureDirSync(path);
};

const copyFileIfExists = (src: string, dest: string): boolean => {
    try {
        ensureDir(dirname(dest));
        cpSync(src, dest);

        return true;
    } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return false;
        }

        throw error;
    }
};

const copyTreeExcludingNodeModules = (src: string, dest: string): void => {
    let stats;

    try {
        stats = lstatSync(src);
    } catch {
        return;
    }

    // Never follow symlinks — they can point outside the workspace or cause loops.
    if (stats.isSymbolicLink()) {
        return;
    }

    if (stats.isFile()) {
        ensureDir(dirname(dest));
        cpSync(src, dest);

        return;
    }

    ensureDir(dest);

    for (const entry of readdirSync(src, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.isSymbolicLink()) {
            continue;
        }

        copyTreeExcludingNodeModules(join(src, entry.name), join(dest, entry.name));
    }
};

/**
 * Build a minimal Docker context at {@link ScaffoldOptions.outDir}.
 *
 * Creates two directories:
 * - `&lt;outDir>/workspace/` — root manifests + per-project manifests for the
 *   focus closure. `COPY` this BEFORE `pnpm install` for layer caching.
 * - `&lt;outDir>/sources/` — full source trees for the focus projects (only
 *   when {@link ScaffoldOptions.includeSources} is true).
 * @param options Scaffold configuration.
 * @returns The list of project names included in the scaffold.
 */
export const scaffoldDockerContext = (options: ScaffoldOptions): { projects: string[] } => {
    const { focus, includeSources = false, outDir, projectGraph, workspace, workspaceRoot } = options;

    const unknown = focus.filter((name) => workspace.projects[name] === undefined);

    if (unknown.length > 0) {
        throw new Error(`Unknown focus project(s): ${unknown.join(", ")}. Check project names in your workspace.`);
    }

    const projects = resolveFocusProjects(focus, projectGraph);
    const workspaceDir = join(outDir, "workspace");
    const sourcesDir = join(outDir, "sources");

    // Clear any previous scaffold so stale manifests / sources don't leak across runs.
    rmSync(workspaceDir, { force: true, recursive: true });
    rmSync(sourcesDir, { force: true, recursive: true });

    ensureDir(workspaceDir);

    for (const manifest of ROOT_MANIFEST_FILES) {
        copyFileIfExists(join(workspaceRoot, manifest), join(workspaceDir, manifest));
    }

    for (const name of projects) {
        const project = workspace.projects[name] as VisProjectConfiguration | undefined;

        if (!project?.root) {
            continue;
        }

        for (const manifest of MANIFEST_FILES) {
            copyFileIfExists(join(workspaceRoot, project.root, manifest), join(workspaceDir, project.root, manifest));
        }
    }

    if (includeSources) {
        ensureDir(sourcesDir);

        for (const name of focus) {
            const project = workspace.projects[name] as VisProjectConfiguration | undefined;

            if (!project?.root) {
                continue;
            }

            copyTreeExcludingNodeModules(join(workspaceRoot, project.root), join(sourcesDir, project.root));
        }
    }

    writeFileSync(join(outDir, DOCKER_MANIFEST_FILENAME), `${JSON.stringify({ focus, projects: [...projects].sort() }, null, 2)}\n`);

    return { projects: [...projects] };
};

export interface PruneOptions {
    /** Root of the scaffolded context (containing `vis-docker-manifest.json`). */
    contextRoot: string;
    workspace: WorkspaceConfiguration;
    workspaceRoot: string;
}

/**
 * Removes every workspace project that is not in the focus closure.
 *
 * Intended to run inside a Docker build stage after installing
 * dependencies, so unfocused workspace symlinks are stripped from
 * the final image.
 * @param options Prune configuration.
 * @returns The list of project root paths that were removed.
 * @throws If no `vis-docker-manifest.json` exists at the context root.
 */
export const pruneDockerContext = (options: PruneOptions): { removed: string[] } => {
    const { contextRoot, workspace, workspaceRoot } = options;
    const manifestPath = join(contextRoot, DOCKER_MANIFEST_FILENAME);

    if (!isAccessibleSync(manifestPath)) {
        throw new Error(`No ${DOCKER_MANIFEST_FILENAME} at ${contextRoot}. Run \`vis docker scaffold\` first.`);
    }

    const manifest = readJsonSync(manifestPath) as { focus: string[]; projects: string[] };

    if (!Array.isArray(manifest.projects)) {
        throw new TypeError(`Invalid ${DOCKER_MANIFEST_FILENAME}: "projects" must be an array.`);
    }

    const keep = new Set(manifest.projects);
    const removed: string[] = [];

    for (const [name, project] of Object.entries(workspace.projects) as [string, VisProjectConfiguration][]) {
        if (keep.has(name)) {
            continue;
        }

        if (!project.root) {
            continue;
        }

        const absolute = join(workspaceRoot, project.root);
        const rel = relative(workspaceRoot, absolute);

        // Guard against escaping the workspace or deleting the workspace root.
        if (rel === "" || rel === "." || rel.startsWith("..")) {
            continue;
        }

        rmSync(absolute, { force: true, recursive: true });
        removed.push(rel);
    }

    return { removed };
};
