/**
 * Go modules for the task graph, opt-in through `go.discover`. The modules are the
 * `use` entries of `go.work` at the workspace root, each with its own `go.mod`.
 *
 * The root module is not a task project. The workspace patterns never name it, and a
 * root `go.mod` without a `go.work` gives no task projects. A single-module repository
 * therefore gets no Go tasks: that is a known gap, not a silent skip to rely on.
 */

import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { isAbsolute, join, normalize } from "@visulima/path";

import { parseGoWorkUses } from "../util/go-modules";

/**
 * Workspace-relative Go module directories among `claimed`'s complement. Skips anything
 * under a directory already claimed (a JS package, a Cargo crate, a Gradle module, ...).
 */
export const resolveGoProjectDirectories = (workspaceRoot: string, claimed: string[]): string[] => {
    const workFile = join(workspaceRoot, "go.work");

    if (!isAccessibleSync(workFile)) {
        return [];
    }

    let uses: string[];

    try {
        uses = parseGoWorkUses(readFileSync(workFile));
    } catch {
        return [];
    }

    const directories: string[] = [];

    for (const entry of uses) {
        const directory = normalize(entry).replace(/^\.\//u, "").replace(/\/$/u, "");

        if (isAbsolute(directory) || directory === "" || directory === "." || directory === ".." || directory.startsWith("../")) {
            continue;
        }

        if (!isAccessibleSync(join(workspaceRoot, directory, "go.mod"))) {
            continue;
        }

        if (claimed.some((claimedDirectory) => directory === claimedDirectory || directory.startsWith(`${claimedDirectory}/`))) {
            continue;
        }

        directories.push(directory);
    }

    return directories;
};
