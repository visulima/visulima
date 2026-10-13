import { existsSync } from "node:fs";
import { join } from "node:path";

import type { DetectContext, DetectedTargets, Detector } from "../types";

/**
 * Applies only to Hex apps (a `mix.exs` in an umbrella member listed by the root's
 * `apps_path`); `discoverWorkspace` keeps it off JS packages.
 *
 * Commands run in the app directory, where its `mix.exs` lives. `build` is
 * `mix compile`, uncached, since it writes `_build`. `test` is `mix test`, which needs
 * a `test/` directory, and `format:check` is `mix format --check-formatted`, which needs
 * a `.formatter.exs`. A target whose precondition is missing is skipped, not guessed.
 * `mix format --check-formatted` exits non-zero on unformatted files and never rewrites
 * them. POSIX only: the Windows path is not verified.
 */
// Umbrella apps share the root's mix.lock and config/, so those are inputs at the workspace root too.
const inputs = [
    "{projectRoot}/mix.exs",
    "{projectRoot}/lib/**/*",
    "{projectRoot}/config/**/*",
    "{workspaceRoot}/mix.exs",
    "{workspaceRoot}/mix.lock",
    "{workspaceRoot}/config/**/*",
];

export const hexDetector: Detector = {
    configFiles: ["mix.exs"],
    detect: (context: DetectContext): DetectedTargets => {
        const targets: DetectedTargets["targets"] = {
            build: {
                cache: false,
                command: "mix compile",
                description: "mix compile (inferred)",
                inputs,
            },
        };

        if (existsSync(join(context.projectRoot, "test"))) {
            targets.test = {
                command: "mix test",
                description: "mix test (inferred)",
                inputs: [...inputs, "{projectRoot}/test/**/*"],
                outputs: [],
                type: "test",
            };
        }

        if (existsSync(join(context.projectRoot, ".formatter.exs"))) {
            targets["format:check"] = {
                command: "mix format --check-formatted",
                description: "mix format --check-formatted (inferred)",
                inputs: ["{projectRoot}/.formatter.exs", "{projectRoot}/**/*.ex", "{projectRoot}/**/*.exs"],
                outputs: [],
                type: "test",
            };
        }

        return { targets };
    },
    name: "hex",
};
