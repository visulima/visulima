import { existsSync, readFileSync } from "node:fs";
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
 * - `format:check` is a check-only formatter run through the project's own `vendor/bin`:
 *   - `laravel/pint` in `require-dev`: `vendor/bin/pint --test`, which exits non-zero when
 *     files would change.
 *   - else `squizlabs/php_codesniffer` in `require-dev` and a `phpcs.xml` or `phpcs.xml.dist`
 *     in the package: `vendor/bin/phpcs`, which exits non-zero on violations. Without a
 *     config file phpcs falls back to its built-in default standard (PSR-12 from 4.0, PEAR before),
 *     so no target is inferred for it.
 *   - otherwise no `format:check` target. The detector says so here rather than guessing a
 *     formatter.
 *
 * `scripts.format` is not turned into a target: a format script usually rewrites files, and
 * vis cannot tell it apart from a check, so a check that passes after rewriting would hide
 * the problem. Composer has no build step, so there is no `build` target.
 *
 * All checks are `type: "test"` with no outputs. The vendor binaries are not installed by vis:
 * when `vendor/bin` is missing the command still runs and fails, and that is the user's to fix
 * with `composer install`. POSIX only: not verified on Windows.
 */
const manifestInputs = ["{projectRoot}/composer.json", "{projectRoot}/composer.lock"];
const sourceInputs = [...manifestInputs, "{projectRoot}/src/**/*.php", "{projectRoot}/tests/**/*.php"];

interface ComposerManifestFacts {
    requireDev: Record<string, unknown>;
    scripts: Record<string, unknown>;
}

const asRecord = (value: unknown): Record<string, unknown> =>
    (typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/**
 * The `scripts` and `require-dev` maps of the package, or empty maps when the file does not
 * parse (the `validate` target reports that).
 */
const readManifest = (projectRoot: string): ComposerManifestFacts => {
    try {
        const manifest = parseComposerJson(readFileSync(join(projectRoot, "composer.json"), "utf8"));

        return { requireDev: asRecord(manifest["require-dev"]), scripts: asRecord(manifest.scripts) };
    } catch {
        return { requireDev: {}, scripts: {} };
    }
};

const phpcsConfigFiles = ["phpcs.xml", "phpcs.xml.dist"];

const detectFormatCheck = (projectRoot: string, requireDev: Record<string, unknown>): DetectedTargets["targets"][string] | undefined => {
    if (requireDev["laravel/pint"] !== undefined) {
        return {
            command: "vendor/bin/pint --test",
            description: "pint --test (inferred)",
            inputs: [...sourceInputs, "{projectRoot}/pint.json"],
            outputs: [],
            type: "test",
        };
    }

    if (requireDev["squizlabs/php_codesniffer"] !== undefined && phpcsConfigFiles.some((file) => existsSync(join(projectRoot, file)))) {
        return {
            command: "vendor/bin/phpcs",
            description: "phpcs (inferred)",
            inputs: [...sourceInputs, ...phpcsConfigFiles.map((file) => `{projectRoot}/${file}`)],
            outputs: [],
            type: "test",
        };
    }

    return undefined;
};

export const composerDetector: Detector = {
    configFiles: ["composer.json"],
    detect: (context: DetectContext): DetectedTargets => {
        const { requireDev, scripts } = readManifest(context.projectRoot);
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

        const formatCheck = detectFormatCheck(context.projectRoot, requireDev);

        if (formatCheck !== undefined) {
            targets["format:check"] = formatCheck;
        }

        return { targets };
    },
    name: "composer",
};
