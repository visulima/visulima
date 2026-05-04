import type { Detector } from "../types";

export const graphqlCodegenDetector: Detector = {
    configFiles: [
        "codegen.ts",
        "codegen.js",
        "codegen.mjs",
        "codegen.mts",
        "codegen.cjs",
        "codegen.yml",
        "codegen.yaml",
        "codegen.json",
        ".graphqlrc",
        ".graphqlrc.json",
        ".graphqlrc.yml",
        ".graphqlrc.yaml",
        ".graphqlrc.ts",
        ".graphqlrc.js",
    ],
    detect: ({ matchedConfigs }) => ({
        targets: {
            codegen: {
                command: "graphql-codegen",
                description: "graphql-codegen (inferred)",
                inputs: [
                    "{projectRoot}/src/**/*",
                    "{projectRoot}/schema/**/*",
                    "{projectRoot}/**/*.graphql",
                    "{projectRoot}/**/*.gql",
                    ...matchedConfigs.map((file) => `{projectRoot}/${file}`),
                    "{projectRoot}/package.json",
                ],
                outputs: ["{projectRoot}/src/generated", "{projectRoot}/src/__generated__", "{projectRoot}/src/gql"],
                type: "build",
            },
        },
    }),
    fallbackDependency: "@graphql-codegen/cli",
    name: "graphql-codegen",
};
