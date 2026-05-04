import type { Detector } from "../types";

export const bunDetector: Detector = {
    configFiles: ["bunfig.toml"],
    // No `fallbackDependency`: Bun is a runtime, not a published
    // package, and `bun-types` can appear in projects that simply test
    // type compatibility without using Bun for builds/tests.
    detect: ({ matchedConfigs }) => ({
        targets: {
            // Registers under `test`. With vitest and jest ahead of it
            // in the registry, projects that already use one keep their
            // command; this only fires when bun is the primary runner.
            test: {
                command: "bun test",
                description: "bun test (inferred)",
                inputs: [
                    "{projectRoot}/src/**/*",
                    "{projectRoot}/__tests__/**/*",
                    "{projectRoot}/test/**/*",
                    "{projectRoot}/tests/**/*",
                    ...matchedConfigs.map((file) => `{projectRoot}/${file}`),
                    "{projectRoot}/package.json",
                ],
                outputs: [],
                type: "test",
            },
        },
    }),
    name: "bun",
};
