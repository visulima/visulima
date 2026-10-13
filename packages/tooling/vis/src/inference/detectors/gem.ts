import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { DetectContext, DetectedTargets, Detector } from "../types";

/**
 * Applies to a gem directory: one with a `*.gemspec` at its top level (the `*.gemspec`
 * configFile entry matches it).
 *
 * Commands run in the gem directory:
 * - `build` is `gem build &lt;name>.gemspec`, uncached, since it writes the `.gem` file.
 * - `test` runs `bundle exec rake test` when a Rakefile exists.
 * - `format:check` runs `bundle exec rubocop --format quiet` when `.rubocop.yml` exists.
 *   rubocop exits 1 on any offense at or above its fail level, so the check fails on
 *   unformatted or non-compliant code. Without `-a` it never rewrites a file.
 *
 * `test` and `lint` are `type: "test"` checks with no outputs. POSIX only: the
 * Windows path is not verified.
 */
const SOURCES = ["{projectRoot}/lib/**/*", "{projectRoot}/*.gemspec", "{projectRoot}/Gemfile*"];

const gemspecs = (projectRoot: string): string[] => readdirSync(projectRoot).filter((entry) => entry.endsWith(".gemspec"));

export const gemDetector: Detector = {
    configFiles: ["*.gemspec"],
    detect: (context: DetectContext): DetectedTargets => {
        const targets: DetectedTargets["targets"] = {};
        const [gemspec, ...rest] = gemspecs(context.projectRoot);

        // Zero or several gemspecs: vis cannot tell which one `gem build` should build, so no build target.
        if (gemspec !== undefined && rest.length === 0) {
            targets.build = {
                cache: false,
                command: `gem build ${gemspec}`,
                description: "gem build (inferred)",
                inputs: SOURCES,
            };
        }

        if (existsSync(join(context.projectRoot, "Rakefile"))) {
            targets.test = {
                command: "bundle exec rake test",
                description: "rake test (inferred)",
                inputs: [...SOURCES, "{projectRoot}/Rakefile", "{projectRoot}/test/**/*"],
                outputs: [],
                type: "test",
            };
        }

        if (existsSync(join(context.projectRoot, ".rubocop.yml"))) {
            targets["format:check"] = {
                command: "bundle exec rubocop --format quiet",
                description: "rubocop (inferred)",
                inputs: [...SOURCES, "{projectRoot}/.rubocop.yml"],
                outputs: [],
                type: "test",
            };
        }

        return { targets };
    },
    name: "gem",
};
