import type { DetectedTargets, Detector } from "../types";

export const vitestDetector: Detector = {
    configFiles: ["vitest.config.ts", "vitest.config.js", "vitest.config.mjs", "vitest.config.mts", "vitest.config.cjs"],
    detect: ({ hasConfigFile, matchedConfigs }) => {
        const configRef = matchedConfigs[0] ? `{projectRoot}/${matchedConfigs[0]}` : undefined;
        const targets: DetectedTargets["targets"] = {
            test: {
                command: "vitest run",
                description: "vitest run (inferred)",
                inputs: [
                    "{projectRoot}/src/**/*",
                    "{projectRoot}/__tests__/**/*",
                    "{projectRoot}/test/**/*",
                    "{projectRoot}/tests/**/*",
                    ...configRef ? [configRef] : [],
                    "{projectRoot}/package.json",
                ],
                outputs: ["{projectRoot}/coverage"],
                type: "test",
            },
        };

        // Watch-mode is a long-running interactive process — only emit
        // it when a vitest config file actually exists, so dep-only
        // matches don't sprout a phantom watcher.
        if (hasConfigFile) {
            targets["test:watch"] = {
                command: "vitest",
                description: "vitest watch mode (inferred)",
                preset: "server",
            };
        }

        return { targets };
    },
    fallbackDependency: "vitest",
    name: "vitest",
};
