import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseComposerJson } from "../../util/composer";
import type { DetectContext, DetectedTargets, Detector } from "../types";

/**
 * Applies only to Composer packages (a `composer.json` in a subdirectory); `discoverWorkspace`
 * keeps it off JS packages. Commands run in the package directory.
 *
 * - `validate` is `composer validate --strict`, which exits non-zero on warnings too.
 * - `test` is `composer run-script test`, present only when `scripts.test` exists. A script
 *   may be a string or an array, so presence is the test.
 * - `lint` is `composer run-script lint`, present only when `scripts.lint` exists.
 *
 * `scripts.format` is not turned into a target: a format script usually rewrites files, and
 * vis cannot tell it apart from a check, so a check that passes after rewriting would hide
 * the problem. Composer has no build step, so there is no `build` target.
 *
 * All checks are `type: "test"` with no outputs. POSIX only: not verified on Windows.
 */
const manifestInputs = ["{projectRoot}/composer.json", "{projectRoot}/composer.lock"];
const sourceInputs = [...manifestInputs, "{projectRoot}/src/**/*.php", "{projectRoot}/tests/**/*.php"];

/** The `scripts` map of the package, or no scripts when the file does not parse (the `validate` target reports that). */
const readScripts = (projectRoot: string): Record<string, unknown> => {
    try {
        const manifest = parseComposerJson(readFileSync(join(projectRoot, "composer.json"), "utf8"));
        const { scripts } = manifest;

        return typeof scripts === "object" && scripts !== null && !Array.isArray(scripts) ? (scripts as Record<string, unknown>) : {};
    } catch {
        return {};
    }
};

export const composerDetector: Detector = {
    configFiles: ["composer.json"],
    detect: (context: DetectContext): DetectedTargets => {
        const scripts = readScripts(context.projectRoot);
        const targets: DetectedTargets["targets"] = {
            validate: {
                command: "composer validate --strict",
                description: "composer validate (inferred)",
                inputs: manifestInputs,
                outputs: [],
                type: "test",
            },
        };

        if (scripts.test !== undefined) {
            targets.test = {
                command: "composer run-script test",
                description: "composer test script (inferred)",
                inputs: sourceInputs,
                outputs: [],
                type: "test",
            };
        }

        if (scripts.lint !== undefined) {
            targets.lint = {
                command: "composer run-script lint",
                description: "composer lint script (inferred)",
                inputs: sourceInputs,
                outputs: [],
                type: "test",
            };
        }

        return { targets };
    },
    name: "composer",
};
