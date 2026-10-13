/**
 * NuGet project directories for the task graph, opt-in through `nuget.discover`.
 * Each directory under the workspace root that holds a `*.csproj` or `*.fsproj` is a
 * task project, found by walking the tree (skipping `bin`, `obj`, `node_modules` and
 * dot-directories), not from the workspace patterns.
 *
 * The root directory is not a task project, the same as the Gem and Gradle roots. A
 * directory with more than one project file is skipped, because a bare `dotnet build`
 * there fails with MSB1011 and vis cannot pick a file. A directory already claimed by a
 * JS package or another ecosystem is skipped too.
 */

import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

const PROJECT_EXTENSIONS = [".csproj", ".fsproj"];
const SKIPPED_DIRECTORIES = new Set(["bin", "node_modules", "obj"]);

/** Workspace-relative directories holding exactly one NuGet project file, skipping anything under a claimed directory. */
export const resolveNuGetProjectDirectories = (workspaceRoot: string, claimed: string[]): string[] => {
    const found: string[] = [];

    const walk = (dir: string): void => {
        let entries;

        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }

        const projects = entries.filter((entry) => entry.isFile() && PROJECT_EXTENSIONS.some((ext) => entry.name.endsWith(ext)));

        if (projects.length === 1 && dir !== workspaceRoot) {
            found.push(relative(workspaceRoot, dir).split("\\").join("/"));
        }

        for (const entry of entries) {
            if (entry.isDirectory() && !SKIPPED_DIRECTORIES.has(entry.name) && !entry.name.startsWith(".")) {
                walk(join(dir, entry.name));
            }
        }
    };

    walk(workspaceRoot);

    const sorted = [...found].sort();

    return sorted
        .filter((directory) => !claimed.some((claimedDirectory) => directory === claimedDirectory || directory.startsWith(`${claimedDirectory}/`)));
};
