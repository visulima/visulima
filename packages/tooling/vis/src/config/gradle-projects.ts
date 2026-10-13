/**
 * Gradle modules for the task graph, opt-in through `gradle.discover`. The module
 * list is the `include` entries of `settings.gradle(.kts)` at the workspace root,
 * each with its own build script. The build root itself is not a task project,
 * the same as the Maven aggregator, because the workspace patterns never name it.
 *
 * Gradle modules are read from the settings file, not from the workspace patterns,
 * because Gradle decides the module tree there. A settings file that moves a
 * project to another directory or renames it yields no task projects, since the
 * directory it names cannot be trusted.
 */

import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { scanGradleSettings } from "../util/gradle-build";

const BUILD_FILES = ["build.gradle.kts", "build.gradle"];
const SETTINGS_FILES = ["settings.gradle.kts", "settings.gradle"];

const findFile = (directory: string, names: string[]): string | undefined => names.map((name) => join(directory, name)).find((path) => isAccessibleSync(path));

/**
 * Workspace-relative Gradle module directories among `candidates`, skipping anything
 * under a directory already claimed (a JS package, a Cargo crate, a Python project,
 * a Maven module). Returns nothing without a settings file, or when it moves a project.
 */
export const resolveGradleProjectDirectories = (workspaceRoot: string, claimed: string[]): string[] => {
    const settings = findFile(workspaceRoot, SETTINGS_FILES);

    if (settings === undefined) {
        return [];
    }

    let scan: ReturnType<typeof scanGradleSettings>;

    try {
        scan = scanGradleSettings(readFileSync(settings));
    } catch {
        return [];
    }

    if (scan.unsupported.length > 0) {
        return [];
    }

    return scan.includes.filter(
        (directory) =>
            findFile(join(workspaceRoot, directory), BUILD_FILES) !== undefined
            && !claimed.some((claimedDirectory) => directory === claimedDirectory || directory.startsWith(`${claimedDirectory}/`)),
    );
};
