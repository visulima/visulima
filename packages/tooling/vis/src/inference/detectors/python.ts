import type { DetectedTargets, Detector } from "../types";

/**
 * Applies only to Python projects (a `pyproject.toml` with `[project]` and no
 * `package.json`); `discoverWorkspace` keeps it off JS packages.
 *
 * Only `build` is inferred. A `test` target would need a test runner, and a
 * detector cannot tell whether one is installed or declared, so a project that
 * wants tests declares them in `project.json` or `vis.task.ts`.
 */

// Every Python file under the project, so both src layout and flat layout (a
// package at the project root) invalidate a cached result when they change.
const inputs = [
    "{projectRoot}/pyproject.toml",
    "{projectRoot}/uv.lock",
    "{projectRoot}/**/*.py",
    "{workspaceRoot}/pyproject.toml",
    "{workspaceRoot}/uv.lock",
];

export const pythonDetector: Detector = {
    configFiles: ["pyproject.toml"],
    detect: (): DetectedTargets => {
        return {
            targets: {
                build: {
                    cache: false,
                    command: "uv build",
                    description: "uv build (inferred)",
                    inputs,
                },
            },
        };
    },
    name: "python",
};
