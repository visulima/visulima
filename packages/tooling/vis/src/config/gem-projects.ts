/**
 * Gem directories for the task graph, opt-in through `gem.discover`. Each directory
 * under the workspace root that holds a `*.gemspec` is a task project, found by
 * walking the tree (skipping `vendor`, `node_modules` and `.bundle`), not from the
 * workspace patterns.
 *
 * The root directory is not a task project, the same as the Gradle build root,
 * because the workspace patterns never name it. A directory already claimed by a JS
 * package or another ecosystem is skipped.
 */

import { dirname, relative } from "node:path";

import { findGemspecs } from "../util/gemspec";

/**
 * Workspace-relative gem directories, skipping anything under a directory already
 * claimed. Returns nothing when the workspace holds no gemspec.
 */
export const resolveGemProjectDirectories = (workspaceRoot: string, claimed: string[]): string[] => {
    const directories = new Set<string>();

    for (const gemspec of findGemspecs(workspaceRoot)) {
        const directory = relative(workspaceRoot, dirname(gemspec)).split("\\").join("/");

        if (directory !== "") {
            directories.add(directory);
        }
    }

    return [...directories]
        .sort()
        .filter((directory) => !claimed.some((claimedDirectory) => directory === claimedDirectory || directory.startsWith(`${claimedDirectory}/`)));
};
