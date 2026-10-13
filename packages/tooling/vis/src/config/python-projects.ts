/**
 * Python projects for the task graph. A directory with a `pyproject.toml` that
 * has `[project]` and no `package.json` is a project, named by `[project].name`.
 * A uv workspace root that only groups members is not.
 */

import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { parse as parseToml } from "smol-toml";

interface PyProjectShape {
    project?: { name?: unknown };
}

const readPyproject = (directory: string): PyProjectShape | undefined => {
    const manifestPath = join(directory, "pyproject.toml");

    if (!isAccessibleSync(manifestPath)) {
        return undefined;
    }

    try {
        return parseToml(readFileSync(manifestPath));
    } catch {
        return undefined;
    }
};

/** The `[project].name` of a Python project directory, or undefined when it is not one. */
export const readPythonProjectName = (directory: string): string | undefined => {
    const name = readPyproject(directory)?.project?.name;

    return typeof name === "string" && name !== "" ? name : undefined;
};

const isWithinDirectory = (directory: string, root: string): boolean => directory === root || directory.startsWith(`${root}/`);

/**
 * Workspace-relative Python project directories among `candidates`, skipping
 * anything already claimed (a JS package or a Cargo project).
 */
export const resolvePythonProjectDirectories = (workspaceRoot: string, candidates: string[], claimed: string[]): string[] => {
    const accepted: string[] = [];

    for (const directory of [...new Set(candidates)].toSorted()) {
        // A project nested inside a claimed one (a fixture under a JS package) is
        // part of that package, not a second project.
        if (claimed.some((root) => isWithinDirectory(directory, root)) || accepted.includes(directory)) {
            continue;
        }

        if (readPythonProjectName(join(workspaceRoot, directory)) !== undefined) {
            accepted.push(directory);
        }
    }

    return accepted;
};
