/**
 * Dart pub workspace members for the task graph, opt-in through `dart.discover`.
 *
 * The members are the entries of the root `pubspec.yaml`'s `workspace:` list that
 * hold a `pubspec.yaml`. A root without a workspace list is not a task project, the
 * same as the Gradle build root: a single-package repository gets no Dart tasks
 * from this resolver. A workspace list that uses a pattern vis does not expand
 * yields no task projects rather than a guessed set.
 */

import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { DartPubspecError, expandDartWorkspaceEntry, scanDartPubspec } from "../util/dart-pubspec";

/**
 * Workspace-relative Dart member directories among `candidates`, skipping anything
 * under a directory already claimed by another ecosystem or a JS package.
 */
export const resolveDartProjectDirectories = (workspaceRoot: string, claimed: string[]): string[] => {
    const rootPubspec = join(workspaceRoot, "pubspec.yaml");

    if (!isAccessibleSync(rootPubspec)) {
        return [];
    }

    let workspace: string[] | undefined;

    try {
        workspace = scanDartPubspec(readFileSync(rootPubspec)).workspace;
    } catch (error) {
        if (error instanceof DartPubspecError) {
            return [];
        }

        throw error;
    }

    if (workspace === undefined) {
        return [];
    }

    const directories: string[] = [];

    try {
        for (const entry of workspace) {
            for (const dir of expandDartWorkspaceEntry(workspaceRoot, entry)) {
                directories.push(dir.slice(workspaceRoot.length + 1).split("\\").join("/"));
            }
        }
    } catch (error) {
        if (error instanceof DartPubspecError) {
            return [];
        }

        throw error;
    }

    return [...new Set(directories)].filter(
        (directory) => !claimed.some((claimedDirectory) => directory === claimedDirectory || directory.startsWith(`${claimedDirectory}/`)),
    );
};
