import { TOOL_SIGNATURES } from "../../util/tool-signatures";
import type { DetectedTargets, Detector } from "../types";

export const prettierDetector: Detector = {
    configFiles: TOOL_SIGNATURES.prettier.configFiles,
    detect: ({ matchedConfigs }) => {
        const sharedInputs = [
            "{projectRoot}/src/**/*",
            "{projectRoot}/__tests__/**/*",
            ...matchedConfigs.map((file) => `{projectRoot}/${file}`),
            "{projectRoot}/package.json",
        ];

        const targets: DetectedTargets["targets"] = {
            // `--write` mutates files. We deliberately skip `type: "build"`
            // so it doesn't cache by default — a hash hit could otherwise
            // skip a re-format the user expected to run.
            format: {
                command: "prettier --write .",
                description: "prettier --write (inferred)",
            },
            "format:check": {
                command: "prettier --check .",
                description: "prettier --check (inferred)",
                inputs: sharedInputs,
                outputs: [],
                type: "build",
            },
        };

        return { targets };
    },
    fallbackDependency: TOOL_SIGNATURES.prettier.packageNames[0],
    name: "prettier",
};
