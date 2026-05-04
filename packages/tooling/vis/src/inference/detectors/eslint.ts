import type { Detector } from "../types";

export const eslintDetector: Detector = {
    configFiles: [
        "eslint.config.ts",
        "eslint.config.js",
        "eslint.config.mjs",
        "eslint.config.mts",
        "eslint.config.cjs",
        ".eslintrc.json",
        ".eslintrc.js",
        ".eslintrc.cjs",
        ".eslintrc",
    ],
    detect: ({ matchedConfigs }) => {
        return {
            targets: {
                lint: {
                    command: "eslint .",
                    description: "eslint . (inferred)",
                    inputs: [
                        "{projectRoot}/src/**/*",
                        "{projectRoot}/__tests__/**/*",
                        "{projectRoot}/test/**/*",
                        "{projectRoot}/tests/**/*",
                        ...matchedConfigs.map((file) => `{projectRoot}/${file}`),
                        "{projectRoot}/package.json",
                    ],
                    // ESLint emits diagnostics, not files — empty outputs makes
                    // the success/failure result cacheable on the input hash.
                    outputs: [],
                    type: "build",
                },
            },
        };
    },
    fallbackDependency: "eslint",
    name: "eslint",
};
