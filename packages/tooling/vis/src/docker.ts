import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";

import { dirname, join, relative } from "@visulima/path";
import type { ProjectGraph, WorkspaceConfiguration } from "@visulima/task-runner";

import type { VisProjectConfiguration } from "./workspace";

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
    /** Output directory, typically `.vis/docker/workspace`. */
    outDir: string;
    /** Workspace root on disk. */
    workspaceRoot: string;
    /** Workspace configuration with resolved project roots. */
    workspace: WorkspaceConfiguration;
    /** Project graph used to compute the transitive dependency closure. */
    projectGraph: ProjectGraph;
    /**
     * Include the full source tree for the focus project(s). Used for the
     * `sources` stage so the build can actually compile code after deps
     * are installed.
     */
    includeSources?: boolean;
}

/**
 * Computes the full set of projects that must exist in the Docker context
 * to build a given focus set: the focus projects themselves plus every
 * project reachable from them in the workspace dependency graph.
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
    mkdirSync(path, { recursive: true });
};

const copyFileIfExists = (src: string, dest: string): boolean => {
    try {
        ensureDir(dirname(dest));
        cpSync(src, dest);

        return true;
    } catch {
        return false;
    }
};

const copyTreeExcludingNodeModules = (src: string, dest: string): void => {
    let stats;

    try {
        stats = statSync(src);
    } catch {
        return;
    }

    if (stats.isFile()) {
        ensureDir(dirname(dest));
        cpSync(src, dest);

        return;
    }

    ensureDir(dest);

    for (const entry of readdirSync(src, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".git") {
            continue;
        }

        copyTreeExcludingNodeModules(join(src, entry.name), join(dest, entry.name));
    }
};

/**
 * Build a minimal Docker context at {@link ScaffoldOptions.outDir}:
 *
 * - `<outDir>/workspace/`: root manifests + per-project manifests for
 *   the focus closure. Copy this BEFORE running `pnpm install`/etc.
 * - `<outDir>/sources/`: full source trees for the focus projects
 *   (only when `includeSources` is true). Copy this AFTER install so
 *   your image's install layer remains cache-friendly.
 */
export const scaffoldDockerContext = (options: ScaffoldOptions): { projects: string[] } => {
    const { focus, includeSources = false, outDir, projectGraph, workspace, workspaceRoot } = options;

    const projects = resolveFocusProjects(focus, projectGraph);
    const workspaceDir = join(outDir, "workspace");
    const sourcesDir = join(outDir, "sources");

    ensureDir(workspaceDir);

    // Copy top-level manifests (lockfiles, root package.json, vis config, …)
    for (const manifest of ROOT_MANIFEST_FILES) {
        copyFileIfExists(join(workspaceRoot, manifest), join(workspaceDir, manifest));
    }

    // Copy per-project manifests (no source)
    for (const name of projects) {
        const project = workspace.projects[name] as VisProjectConfiguration | undefined;

        if (!project?.root) {
            continue;
        }

        for (const manifest of MANIFEST_FILES) {
            copyFileIfExists(
                join(workspaceRoot, project.root, manifest),
                join(workspaceDir, project.root, manifest),
            );
        }
    }

    // Focus sources (not dependency sources — those are pulled in by the
    // package manager as workspace symlinks during install).
    if (includeSources) {
        ensureDir(sourcesDir);

        for (const name of focus) {
            const project = workspace.projects[name] as VisProjectConfiguration | undefined;

            if (!project?.root) {
                continue;
            }

            copyTreeExcludingNodeModules(
                join(workspaceRoot, project.root),
                join(sourcesDir, project.root),
            );
        }
    }

    // Write a tiny manifest listing the projects in the scaffold so
    // downstream tools (and `vis docker prune`) can read it.
    writeFileSync(
        join(outDir, "vis-docker-manifest.json"),
        `${JSON.stringify({ focus, projects: [...projects].sort() }, null, 2)}\n`,
    );

    return { projects: [...projects] };
};

/**
 * Prune a scaffolded Docker context by deleting every workspace project
 * that is not part of the focus closure. Intended to run inside a build
 * stage: after `pnpm install --frozen-lockfile`, call `vis docker prune`
 * to strip unfocused dependency sources from `node_modules/<pkg>`
 * workspace symlinks.
 *
 * This is intentionally conservative — it only removes files the
 * scaffold step would have omitted.
 */
export interface PruneOptions {
    /** Root of the scaffolded context (containing `vis-docker-manifest.json`). */
    contextRoot: string;
    workspaceRoot: string;
    workspace: WorkspaceConfiguration;
}

export const pruneDockerContext = (options: PruneOptions): { removed: string[] } => {
    const { contextRoot, workspace, workspaceRoot } = options;
    const manifestPath = join(contextRoot, "vis-docker-manifest.json");

    if (!existsSync(manifestPath)) {
        throw new Error(`No vis-docker-manifest.json at ${contextRoot}. Run \`vis docker scaffold\` first.`);
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { focus: string[]; projects: string[] };

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

        rmSync(absolute, { force: true, recursive: true });
        removed.push(rel);
    }

    return { removed };
};
