import type { Detector } from "../types";

export const apiExtractorDetector: Detector = {
    configFiles: ["api-extractor.json"],
    detect: ({ matchedConfigs }) => ({
        targets: {
            "api-extract": {
                command: "api-extractor run --local",
                description: "api-extractor (inferred)",
                inputs: [
                    "{projectRoot}/dist/**/*.d.ts",
                    "{projectRoot}/lib/**/*.d.ts",
                    ...matchedConfigs.map((file) => `{projectRoot}/${file}`),
                    "{projectRoot}/package.json",
                    "{projectRoot}/tsconfig.json",
                ],
                outputs: ["{projectRoot}/dist/*.api.json", "{projectRoot}/etc/*.api.md", "{projectRoot}/temp"],
                type: "build",
            },
        },
    }),
    fallbackDependency: "@microsoft/api-extractor",
    name: "api-extractor",
};
