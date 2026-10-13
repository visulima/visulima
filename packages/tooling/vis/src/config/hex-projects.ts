/**
 * Hex apps for the task graph, opt-in through `hex.discover`. The apps are the
 * `&lt;apps_path>/*` members of the root's umbrella `mix.exs`, each with its own
 * `mix.exs`. They are found from the umbrella, not the workspace patterns, because
 * mix decides the app tree there.
 *
 * The root project is not a task project, the same as the Gradle build root, because
 * the workspace patterns never name it. A root that is not an umbrella yields nothing.
 */

import { listUmbrellaMembers, MixProjectError, readMixProject } from "../util/mix-project";

/**
 * Workspace-relative Hex app directories, skipping anything under a directory already
 * claimed. Returns nothing without a root `mix.exs`, for a non-umbrella root, or when
 * the root `mix.exs` cannot be read.
 */
export const resolveHexProjectDirectories = (workspaceRoot: string, claimed: string[]): string[] => {
    let root: ReturnType<typeof readMixProject>;

    try {
        root = readMixProject(workspaceRoot);
    } catch (error) {
        if (error instanceof MixProjectError) {
            return [];
        }

        throw error;
    }

    if (root?.project.appsPath === undefined) {
        return [];
    }

    return listUmbrellaMembers(workspaceRoot, root.project.appsPath)
        .map((directory) => directory.slice(workspaceRoot.length + 1).split("\\").join("/"))
        .filter((directory) => !claimed.some((claimedDirectory) => directory === claimedDirectory || directory.startsWith(`${claimedDirectory}/`)));
};
