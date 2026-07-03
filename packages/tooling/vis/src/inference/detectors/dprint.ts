import { TOOL_SIGNATURES } from "../../util/tool-signatures";
import type { DetectedTargets, Detector } from "../types";

export const dprintDetector: Detector = {
    configFiles: TOOL_SIGNATURES.dprint.configFiles,
    detect: ({ matchedConfigs }) => {
        const sharedInputs = [
            "{projectRoot}/src/**/*",
            "{projectRoot}/__tests__/**/*",
            ...matchedConfigs.map((file) => `{projectRoot}/${file}`),
            "{projectRoot}/package.json",
        ];

        const targets: DetectedTargets["targets"] = {
            // `dprint fmt` mutates files — same reasoning as prettier/oxfmt:
            // skip `type: "build"` so a cache hit can't elide a re-format.
            format: {
                command: "dprint fmt",
                description: "dprint fmt (inferred)",
            },
            "format:check": {
                command: "dprint check",
                description: "dprint check (inferred)",
                inputs: sharedInputs,
                outputs: [],
                type: "build",
            },
        };

        return { targets };
    },
    fallbackDependency: TOOL_SIGNATURES.dprint.packageNames[0],
    name: "dprint",
};
