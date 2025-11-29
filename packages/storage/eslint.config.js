import { createConfig } from "@anolilab/eslint-config";

/** @type {import("@anolilab/eslint-config").PromiseFlatConfigComposer} */
export default createConfig(
    {
        ignores: [
            "dist",
            "node_modules",
            "coverage",
            "__fixtures__",
            "examples",
            "vitest.config.ts",
            "packem.config.ts",
            ".secretlintrc.cjs",
            "package.json",
            ".prettierrc.cjs",
            "**/README.md",
            "README.md",
        ],
    },
    {
        files: ["__tests__/**"],
        rules: {
            "no-underscore-dangle": [
                "error",
                {
                    allow: [
                        "__mockSend",
                        "__mockAbort",
                        "__mockPipeError",
                        "__mockdata",
                        "__delay",
                        "_chunkedUpload",
                        "_chunks",
                        "_totalSize",
                        "_getStatusCode",
                    ],
                },
            ],
            "radar/no-duplicate-string": "off",
            "vitest/prefer-called-exactly-once-with": "off",
            "vitest/require-mock-type-parameters": "off",
        },
    },
    {
        files: ["src/**"],
        rules: {
            "n/no-unsupported-features/node-builtins": "off",
        },
    },
    {
        files: ["src/openapi/*.ts", "src/storage/gcs/gcs-storage.ts", "src/handler/multipart/multipart.ts"],
        rules: {
            "sonarjs/file-name-differ-from-class": "off",
        },
    },
);
