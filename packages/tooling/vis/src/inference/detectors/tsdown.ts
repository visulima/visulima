import type { Detector } from "../types";

export const tsdownDetector: Detector = {
    configFiles: ["tsdown.config.ts", "tsdown.config.js", "tsdown.config.mjs", "tsdown.config.mts", "tsdown.config.cjs"],
    detect: ({ matchedConfigs }) => ({
        targets: {
            build: {
                command: "tsdown",
                description: "tsdown build (inferred)",
                inputs: [
                    "{projectRoot}/src/**/*",
                    `{projectRoot}/${matchedConfigs[0] ?? "tsdown.config.ts"}`,
                    "{projectRoot}/package.json",
                    "{projectRoot}/tsconfig.json",
                ],
                outputs: ["{projectRoot}/dist"],
                type: "build",
            },
        },
    }),
    fallbackDependency: "tsdown",
    name: "tsdown",
};
