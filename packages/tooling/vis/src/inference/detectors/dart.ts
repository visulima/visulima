import type { DetectedTargets, Detector } from "../types";

/**
 * Applies to Dart pub workspace members (a `pubspec.yaml` listed under the root's
 * `workspace:`); `discoverWorkspace` keeps it off JS packages.
 *
 * Commands run in the member directory. `analyze` is the build target. `test` and
 * `format:check` are `type: "test"` checks with no outputs. `dart format` exits 1
 * when `--set-exit-if-changed` finds a file to change, so the check fails on
 * unformatted code.
 * POSIX only: the Windows path is not verified.
 */
const sources = ["{projectRoot}/**/*.dart", "{projectRoot}/pubspec.yaml", "{projectRoot}/pubspec.lock", "{projectRoot}/analysis_options.yaml"];

export const dartDetector: Detector = {
    configFiles: ["pubspec.yaml"],
    detect: (): DetectedTargets => {
        return {
            targets: {
                build: {
                    cache: false,
                    command: "dart analyze",
                    description: "dart analyze (inferred)",
                    inputs: sources,
                },
                "format:check": {
                    command: "dart format --output=none --set-exit-if-changed .",
                    description: "dart format --set-exit-if-changed (inferred)",
                    inputs: ["{projectRoot}/**/*.dart"],
                    outputs: [],
                    type: "test",
                },
                test: {
                    command: "dart test",
                    description: "dart test (inferred)",
                    inputs: sources,
                    outputs: [],
                    type: "test",
                },
            },
        };
    },
    name: "dart",
};
