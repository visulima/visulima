import type { Detector } from "../types";

export const typedocDetector: Detector = {
    configFiles: ["typedoc.json", "typedoc.jsonc", "typedoc.config.ts", "typedoc.config.js", "typedoc.config.mjs", "typedoc.config.mts", "typedoc.config.cjs"],
    detect: ({ matchedConfigs }) => ({
        targets: {
            docs: {
                command: "typedoc",
                description: "typedoc (inferred)",
                inputs: [
                    "{projectRoot}/src/**/*",
                    ...matchedConfigs.map((file) => `{projectRoot}/${file}`),
                    "{projectRoot}/package.json",
                    "{projectRoot}/tsconfig.json",
                ],
                outputs: ["{projectRoot}/docs"],
                type: "build",
            },
        },
    }),
    fallbackDependency: "typedoc",
    name: "typedoc",
};
