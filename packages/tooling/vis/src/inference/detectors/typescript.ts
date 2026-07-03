import type { Detector } from "../types";

export const typescriptDetector: Detector = {
    configFiles: ["tsconfig.json", "tsconfig.build.json"],
    detect: ({ matchedConfigs }) => {
        return {
            targets: {
                typecheck: {
                    command: "tsc --noEmit",
                    description: "tsc --noEmit (inferred)",
                    inputs: [
                        "{projectRoot}/src/**/*.ts",
                        "{projectRoot}/src/**/*.tsx",
                        "{projectRoot}/__tests__/**/*.ts",
                        "{projectRoot}/__tests__/**/*.tsx",
                        "{projectRoot}/test/**/*.ts",
                        "{projectRoot}/tests/**/*.ts",
                        ...matchedConfigs.map((file) => `{projectRoot}/${file}`),
                        "{projectRoot}/package.json",
                    ],
                    // `tsc --noEmit` produces no artefacts; an empty outputs
                    // list is what makes it cacheable as a "pass/fail" check.
                    outputs: [],
                    type: "build",
                },
            },
        };
    },
    fallbackDependency: "typescript",
    name: "typescript",
};
