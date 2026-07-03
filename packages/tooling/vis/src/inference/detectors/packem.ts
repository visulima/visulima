import type { Detector } from "../types";

export const packemDetector: Detector = {
    configFiles: ["packem.config.ts", "packem.config.js", "packem.config.mjs", "packem.config.mts", "packem.config.cjs"],
    detect: ({ matchedConfigs }) => {
        return {
            targets: {
                build: {
                    command: "packem build",
                    description: "@visulima/packem build (inferred)",
                    inputs: [
                        "{projectRoot}/src/**/*",
                        `{projectRoot}/${matchedConfigs[0] ?? "packem.config.ts"}`,
                        "{projectRoot}/package.json",
                        "{projectRoot}/tsconfig.json",
                    ],
                    outputs: ["{projectRoot}/dist"],
                    type: "build",
                },
            },
        };
    },
    fallbackDependency: "@visulima/packem",
    name: "packem",
};
