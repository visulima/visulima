import type { DetectedTargets, Detector } from "../types";

/**
 * Applies only to Python projects (a `pyproject.toml` with `[project]` and no
 * `package.json`); `discoverWorkspace` keeps it off JS packages.
 *
 * Commands run through uv, which is the tool that defines these projects (a uv
 * workspace). Checks are `type: "test"`: cacheable pass/fail with no outputs.
 */
const inputs = [
    "{projectRoot}/pyproject.toml",
    "{projectRoot}/uv.lock",
    "{projectRoot}/src/**/*",
    "{projectRoot}/tests/**/*",
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
                test: {
                    command: "uv run pytest",
                    description: "pytest (inferred)",
                    inputs,
                    type: "test",
                },
            },
        };
    },
    name: "python",
};
