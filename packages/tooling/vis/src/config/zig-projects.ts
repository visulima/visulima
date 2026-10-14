/**
 * Zig packages for the task graph, opt-in through `zig.discover`. The packages are
 * the `build.zig.zon` at the workspace root's `.path` dependencies, followed the
 * same way as release discovery: each must stay inside the workspace and hold its
 * own manifest. The workspace root itself is not a task project, the same as the
 * Gradle build root, because the workspace patterns never name it. A single-package
 * Zig repo therefore gets no tasks from this option.
 */

import { relative } from "node:path";

import { isAccessibleSync, readFileSync } from "@visulima/fs";

import { walkZigManifests } from "../util/zig-manifest";

const readManifest = (path: string): string | undefined => (isAccessibleSync(path) ? readFileSync(path) : undefined);

/**
 * Workspace-relative Zig package directories among the path dependencies, skipping
 * anything under a directory already claimed by another ecosystem or a JS package.
 * A manifest that does not parse yields nothing here; the release step reports it.
 */
export const resolveZigProjectDirectories = (workspaceRoot: string, claimed: string[]): string[] => {
    let nodes: ReturnType<typeof walkZigManifests>;

    try {
        nodes = walkZigManifests(workspaceRoot, workspaceRoot, readManifest);
    } catch {
        return [];
    }

    return nodes
        .filter((node) => node.dir !== workspaceRoot)
        .map((node) => relative(workspaceRoot, node.dir).split("\\").join("/"))
        .filter((directory) => !claimed.some((claimedDirectory) => directory === claimedDirectory || directory.startsWith(`${claimedDirectory}/`)));
};
