import type { Detector } from "../types";

export const knipDetector: Detector = {
    configFiles: [
        "knip.config.ts",
        "knip.config.js",
        "knip.config.mjs",
        "knip.config.mts",
        "knip.config.cjs",
        "knip.json",
        "knip.jsonc",
        ".knip.json",
        ".knip.jsonc",
    ],
    detect: ({ matchedConfigs }) => ({
        targets: {
            // `knip` reports unused files/exports/deps. The bare target
            // name avoids the `lint` slot — knip is orthogonal to ESLint
            // and projects often run both in CI.
            knip: {
                command: "knip",
                description: "knip (inferred)",
                inputs: [
                    "{projectRoot}/src/**/*",
                    "{projectRoot}/__tests__/**/*",
                    "{projectRoot}/test/**/*",
                    "{projectRoot}/tests/**/*",
                    ...matchedConfigs.map((file) => `{projectRoot}/${file}`),
                    "{projectRoot}/package.json",
                    "{projectRoot}/tsconfig.json",
                ],
                outputs: [],
                type: "build",
            },
        },
    }),
    fallbackDependency: "knip",
    name: "knip",
};
