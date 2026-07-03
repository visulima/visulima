import { TOOL_SIGNATURES } from "../../util/tool-signatures";
import type { DetectedTargets, Detector } from "../types";

export const oxfmtDetector: Detector = {
    configFiles: TOOL_SIGNATURES.oxfmt.configFiles,
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
    fallbackDependency: TOOL_SIGNATURES.oxfmt.packageNames[0],
    name: "oxfmt",
};
