import type { DetectedTargets, Detector } from "../types";

export const jestDetector: Detector = {
    configFiles: ["jest.config.ts", "jest.config.js", "jest.config.mjs", "jest.config.mts", "jest.config.cjs", "jest.config.json"],
    detect: ({ hasConfigFile, matchedConfigs }) => {
        const configRef = matchedConfigs[0] ? `{projectRoot}/${matchedConfigs[0]}` : undefined;

        const targets: DetectedTargets["targets"] = {
            test: {
                command: "jest",
                description: "jest (inferred)",
                inputs: [
                    "{projectRoot}/src/**/*",
                    "{projectRoot}/__tests__/**/*",
                    "{projectRoot}/test/**/*",
                    "{projectRoot}/tests/**/*",
                    ...(configRef ? [configRef] : []),
                    "{projectRoot}/package.json",
                ],
                outputs: ["{projectRoot}/coverage"],
                type: "test",
            },
        };

        if (hasConfigFile) {
            targets["test:watch"] = {
                command: "jest --watch",
                description: "jest watch mode (inferred)",
                preset: "server",
            };
        }

        return { targets };
    },
    fallbackDependency: "jest",
    name: "jest",
};
