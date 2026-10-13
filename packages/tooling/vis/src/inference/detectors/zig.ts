import type { DetectedTargets, Detector } from "../types";

/**
 * Applies only to Zig packages (a `build.zig.zon` in a package reached from the
 * workspace root's path dependencies); `discoverWorkspace` keeps it off JS packages.
 *
 * Commands run in the package directory, where `build.zig` lives. `build` writes
 * `zig-out/`, so it is uncached like the Gradle build. `test` and `format:check`
 * are `type: "test"` checks with no outputs. `zig fmt --check` exits 1 when a file
 * is not formatted, so the check fails rather than passing silently. POSIX only:
 * the Windows path is not verified.
 */
const sources = ["{projectRoot}/build.zig", "{projectRoot}/build.zig.zon", "{projectRoot}/src/**/*"];

export const zigDetector: Detector = {
    configFiles: ["build.zig.zon"],
    detect: (): DetectedTargets => {
        return {
            targets: {
                build: {
                    cache: false,
                    command: "zig build",
                    description: "zig build (inferred)",
                    inputs: sources,
                },
                "format:check": {
                    command: "zig fmt --check .",
                    description: "zig fmt --check (inferred)",
                    inputs: ["{projectRoot}/**/*.zig", "{projectRoot}/**/*.zon"],
                    outputs: [],
                    type: "test",
                },
                test: {
                    command: "zig build test",
                    description: "zig build test (inferred)",
                    inputs: sources,
                    outputs: [],
                    type: "test",
                },
            },
        };
    },
    name: "zig",
};
