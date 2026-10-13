/**
 * Composer packages for the task graph, opt-in through `composer.discover`. A package is
 * any `composer.json` in a subdirectory of the workspace, found by the same walk the
 * release uses (`util/composer.ts`), skipping `vendor` and dot-directories.
 *
 * The root `composer.json` is not a task project, the same as the Go and Gradle roots:
 * the workspace patterns never name it. A single-package repository therefore gets no
 * Composer tasks. That is a known gap, stated in the docs, not a silent skip.
 */

import { relative } from "@visulima/path";

import { findComposerManifestDirs } from "../util/composer";

/**
 * Workspace-relative directories of the nested `composer.json` files, minus anything under
 * a directory already claimed (a JS package, a Cargo crate, a Gradle module, ...).
 */
export const resolveComposerProjectDirectories = (workspaceRoot: string, claimed: string[]): string[] =>
    findComposerManifestDirs(workspaceRoot)
        .map((dir) => relative(workspaceRoot, dir))
        .filter(
            (directory) =>
                directory !== "" && !claimed.some((claimedDirectory) => directory === claimedDirectory || directory.startsWith(`${claimedDirectory}/`)),
        );
