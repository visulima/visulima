import type { Detector } from "../types";

export const oxlintDetector: Detector = {
    configFiles: [".oxlintrc.json", "oxlint.json"],
    detect: ({ matchedConfigs }) => {
        return {
            targets: {
                // Registers under `lint`. With eslint and biome ahead of it
                // in the registry, an eslint/biome project keeps its existing
                // command — oxlint only fills in for projects that use it as
                // their primary linter.
                lint: {
                    command: "oxlint",
                    description: "oxlint (inferred)",
                    inputs: [
                        "{projectRoot}/src/**/*",
                        "{projectRoot}/__tests__/**/*",
                        ...matchedConfigs.map((file) => `{projectRoot}/${file}`),
                        "{projectRoot}/package.json",
                    ],
                    outputs: [],
                    type: "build",
                },
            },
        };
    },
    fallbackDependency: "oxlint",
    name: "oxlint",
};
