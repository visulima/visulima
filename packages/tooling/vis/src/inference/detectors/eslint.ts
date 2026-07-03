import { TOOL_SIGNATURES } from "../../util/tool-signatures";
import type { Detector } from "../types";

export const eslintDetector: Detector = {
    configFiles: TOOL_SIGNATURES.eslint.configFiles,
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
    fallbackDependency: TOOL_SIGNATURES.eslint.packageNames[0],
    name: "eslint",
};
