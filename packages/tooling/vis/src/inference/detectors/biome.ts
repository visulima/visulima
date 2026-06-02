import { TOOL_SIGNATURES } from "../../util/tool-signatures";
import type { DetectedTargets, Detector } from "../types";

export const biomeDetector: Detector = {
    configFiles: TOOL_SIGNATURES.biome.configFiles,
    detect: ({ matchedConfigs }) => {
        const sharedInputs = [
            "{projectRoot}/src/**/*",
            "{projectRoot}/__tests__/**/*",
            ...matchedConfigs.map((file) => `{projectRoot}/${file}`),
            "{projectRoot}/package.json",
        ];

        const targets: DetectedTargets["targets"] = {
            // Biome owns both lint and format. We register both — when a
            // workspace also has eslint/prettier configs the earlier
            // detectors win the `lint`/`format` names; biome only fills
            // in whichever one is missing.
            format: {
                command: "biome format --write .",
                description: "biome format (inferred)",
            },
            lint: {
                command: "biome check .",
                description: "biome check (inferred)",
                inputs: sharedInputs,
                outputs: [],
                type: "build",
            },
        };

        return { targets };
    },
    fallbackDependency: TOOL_SIGNATURES.biome.packageNames[0],
    name: "biome",
};
