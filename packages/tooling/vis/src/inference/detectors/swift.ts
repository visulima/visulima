import { existsSync } from "node:fs";
import { join } from "node:path";

import type { DetectContext, DetectedTargets, Detector } from "../types";

/**
 * Applies only to Swift packages (a `Package.swift` in a directory found by
 * `swift.discover`); `discoverWorkspace` keeps it off JS packages.
 *
 * Commands run with the package directory as the working directory, so SwiftPM
 * finds the manifest without a path argument. Checks are `type: "test"`:
 * cacheable pass/fail with no outputs. `build` is uncached because `swift build`
 * writes `.build/`, which is not declared as an output.
 *
 * The format check runs `swift-format lint --strict`. It exits non-zero on lint
 * warnings in strict mode. Only the `Sources` and `Tests` directories that exist
 * are linted, because swift-format treats a missing path as a fatal error.
 * POSIX only: SwiftPM is not run on Windows here.
 */
const inputs = [
    "{projectRoot}/Package.swift",
    "{projectRoot}/Package.resolved",
    "{projectRoot}/Sources/**/*",
    "{projectRoot}/Tests/**/*",
    "{projectRoot}/.swift-format",
];

export const swiftDetector: Detector = {
    configFiles: ["Package.swift"],
    detect: (context: DetectContext): DetectedTargets => {
        const targets: DetectedTargets["targets"] = {
            build: {
                cache: false,
                command: "swift build",
                description: "swift build (inferred)",
                inputs,
            },
            test: {
                command: "swift test",
                description: "swift test (inferred)",
                inputs,
                outputs: [],
                type: "test",
            },
        };

        const sources = ["Sources", "Tests"].filter((directory) => existsSync(join(context.projectRoot, directory)));

        if (sources.length > 0) {
            targets.format = {
                command: `swift-format lint --strict --recursive ${sources.join(" ")}`,
                description: "swift-format lint (inferred)",
                inputs,
                outputs: [],
                type: "test",
            };
        }

        return { targets };
    },
    name: "swift",
};
