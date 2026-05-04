import type { DetectedTargets, Detector } from "../types";

export const oxfmtDetector: Detector = {
    configFiles: [".oxfmtrc.json", ".oxfmtrc.jsonc", "oxfmt.config.ts", "oxfmt.config.js", "oxfmt.config.mjs", "oxfmt.config.mts", "oxfmt.config.cjs"],
    detect: ({ matchedConfigs }) => {
        const sharedInputs = [
            "{projectRoot}/src/**/*",
            "{projectRoot}/__tests__/**/*",
            ...matchedConfigs.map((file) => `{projectRoot}/${file}`),
            "{projectRoot}/package.json",
        ];

        const targets: DetectedTargets["targets"] = {
            // `oxfmt` mutates files. We deliberately skip `type: "build"`
            // so it doesn't cache by default — same logic as prettier.
            format: {
                command: "oxfmt",
                description: "oxfmt (inferred)",
            },
            "format:check": {
                command: "oxfmt --check",
                description: "oxfmt --check (inferred)",
                inputs: sharedInputs,
                outputs: [],
                type: "build",
            },
        };

        return { targets };
    },
    fallbackDependency: "oxfmt",
    name: "oxfmt",
};
