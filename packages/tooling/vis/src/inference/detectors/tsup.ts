import type { Detector } from "../types";

export const tsupDetector: Detector = {
    configFiles: ["tsup.config.ts", "tsup.config.js", "tsup.config.mjs", "tsup.config.mts", "tsup.config.cjs"],
    detect: ({ matchedConfigs }) => ({
        targets: {
            build: {
                command: "tsup",
                description: "tsup build (inferred)",
                inputs: [
                    "{projectRoot}/src/**/*",
                    `{projectRoot}/${matchedConfigs[0] ?? "tsup.config.ts"}`,
                    "{projectRoot}/package.json",
                    "{projectRoot}/tsconfig.json",
                ],
                outputs: ["{projectRoot}/dist"],
                type: "build",
            },
        },
    }),
    fallbackDependency: "tsup",
    name: "tsup",
};
