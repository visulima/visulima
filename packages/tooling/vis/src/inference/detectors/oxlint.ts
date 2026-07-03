import { TOOL_SIGNATURES } from "../../util/tool-signatures";
import type { Detector } from "../types";

export const oxlintDetector: Detector = {
    configFiles: TOOL_SIGNATURES.oxlint.configFiles,
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
    fallbackDependency: TOOL_SIGNATURES.oxlint.packageNames[0],
    name: "oxlint",
};
