/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig/blob/develop/tests/specs/parse-tsconfig/parses.spec.ts`
 *
 * MIT License
 * Copyright (c) Hiroki Osame &lt;hiroki.osame@gmail.com>
 */
import { rm } from "node:fs/promises";

import { writeFileSync, writeJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { temporaryDirectory } from "tempy";
import { version as tsVersion } from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { implicitBaseUrlSymbol, readTsConfig } from "../../src/read-tsconfig";
import { getTscTsconfig, parseVersion } from "../helpers";

const typescriptVersion = parseVersion(tsVersion);

if (!typescriptVersion) {
    throw new Error(`Invalid TypeScript version format: ${tsVersion}`);
}

describe("parses tsconfig", () => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();

        writeFileSync(join(distribution, "file.ts"), "");
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    describe("errors", () => {
        it("non-existent path", async () => {
            expect.assertions(1);

            expect(() => readTsConfig("non-existent-path")).toThrow("Cannot resolve tsconfig at path: ");
        });

        it("empty file", async () => {
            expect.assertions(1);

            writeFileSync(join(distribution, "tsconfig.json"), "");

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const parsedTsconfig = readTsConfig(join(distribution, "tsconfig.json"));

            expect(parsedTsconfig).toStrictEqual(expectedTsconfig);
        });

        it("json invalid", async () => {
            expect.assertions(1);

            writeFileSync(join(distribution, "tsconfig.json"), "asdf");

            const parsedTsconfig = readTsConfig(join(distribution, "tsconfig.json"));

            expect(parsedTsconfig).toStrictEqual({
                compilerOptions: {},
            });
        });

        it("json non-object", async () => {
            expect.assertions(1);

            writeFileSync(join(distribution, "tsconfig.json"), "\"asdf\"");

            expect(() => readTsConfig(join(distribution, "tsconfig.json"))).toThrow("Failed to parse tsconfig at");
        });

        it("json empty", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "tsconfig.json"), {});

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const parsedTsconfig = readTsConfig(join(distribution, "tsconfig.json"));

            expect(parsedTsconfig).toStrictEqual(expectedTsconfig);
        });
    });

    it("parses a path", async () => {
        expect.assertions(1);

        writeJsonSync(join(distribution, "tsconfig.json"), {
            compilerOptions: {
                declaration: true,
                esModuleInterop: true,
                isolatedModules: true,
                module: "esnext",
                moduleResolution: "node10",
                outDir: "dist",
                rootDir: "root-dir",
                strict: true,
                target: "esnext",
            },
        });

        const parsedTsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });
        const expectedTsconfig = await getTscTsconfig(distribution);

        delete expectedTsconfig.files;

        expect(parsedTsconfig).toStrictEqual(expectedTsconfig);
    });

    it("implicit config", async () => {
        expect.assertions(1);

        writeJsonSync(join(distribution, "tsconfig.json"), {
            compilerOptions: {
                module: "preserve",
                target: "es2022",
            },
        });

        const parsedTsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });
        const expectedTsconfig = await getTscTsconfig(distribution);

        delete expectedTsconfig.files;

        expect(expectedTsconfig).toStrictEqual(parsedTsconfig);
    });

    describe("baseUrl", () => {
        it("relative path", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "tsconfig.json"), {
                compilerOptions: {
                    baseUrl: ".",
                },
            });

            const parsedTsconfig = readTsConfig(join(distribution, "tsconfig.json"));

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            expect(parsedTsconfig).toStrictEqual(expectedTsconfig);
        });

        it("absolute path", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "tsconfig.json"), {
                compilerOptions: {
                    baseUrl: process.platform === "win32" ? "C:\\" : "/",
                },
            });

            const parsedTsconfig = readTsConfig(join(distribution, "tsconfig.json"));

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            expect(parsedTsconfig).toStrictEqual(expectedTsconfig);
        });
    });

    describe("resolves", () => {
        it("handles missing extends", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "missing-package",
            });

            expect(() => readTsConfig(join(distribution, "tsconfig.json"))).toThrow("ENOENT: No such file or directory, for 'missing-package' found.");
        });

        describe("circularity", () => {
            it("self extend", async () => {
                expect.assertions(2);

                writeJsonSync(join(distribution, "tsconfig.json"), {
                    extends: "./tsconfig.json",
                });

                const errorMessage = "Circularity detected while resolving configuration";

                await expect(getTscTsconfig(distribution)).rejects.toThrow(errorMessage);

                expect(() => readTsConfig(join(distribution, "tsconfig.json"))).toThrow(errorMessage);
            });

            it("recursive", async () => {
                expect.assertions(1);

                writeJsonSync(join(distribution, "base.json"), {
                    extends: "./tsconfig.json",
                });
                writeJsonSync(join(distribution, "tsconfig.json"), {
                    extends: "./base.json",
                });

                expect(() => readTsConfig(join(distribution, "tsconfig.json"))).toThrow("Circularity detected while resolving configuration:");
            });
        });

        it("extends array with common base", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "base.json"), {});
            writeJsonSync(join(distribution, "tsconfig-b.json"), {
                extends: "./base.json",
            });
            writeJsonSync(join(distribution, "tsconfig-a.json"), {
                extends: "./base.json",
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: ["./tsconfig-a.json", "./tsconfig-b.json"],
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });
    });

    it("paths > prefix match > nested directory", async () => {
        expect.assertions(1);

        const fixturePath = join(distribution, "dir");

        writeJsonSync(join(fixturePath, "tsconfig.json"), {
            compilerOptions: {
                paths: {
                    "@/*": ["./*"],
                },
            },
            include: ["src"],
        });
        writeFileSync(join(fixturePath, "src", "a.ts"), "");

        const originalCwd = process.cwd();

        try {
            process.chdir(fixturePath);

            const expectedTsconfig = await getTscTsconfig(".");

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig("./tsconfig.json", {
                tscCompatible: typescriptVersion,
            });

            // @ts-expect-error - We're testing a private property
            delete tsconfig?.compilerOptions?.[implicitBaseUrlSymbol];

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        } finally {
            process.chdir(originalCwd);
        }
    });

    it("when extending a base config include and exclude get overwritten by base config", async () => {
        expect.assertions(1);

        writeJsonSync(join(distribution, "tsconfig.base.json"), {
            compileOnSave: false,
            compilerOptions: {
                allowImportingTsExtensions: true,
                allowSyntheticDefaultImports: true,
                baseUrl: ".",
                declaration: true,
                emitDecoratorMetadata: true,
                esModuleInterop: true,
                experimentalDecorators: true,
                forceConsistentCasingInFileNames: true,
                importHelpers: true,
                lib: ["ES2023"],
                module: "Node16",
                moduleResolution: "Node16",
                noEmit: true,
                noFallthroughCasesInSwitch: true,
                noImplicitOverride: true,
                noImplicitReturns: true,
                noPropertyAccessFromIndexSignature: true,
                resolveJsonModule: true,
                rootDir: ".",
                skipDefaultLibCheck: true,
                skipLibCheck: true,
                sourceMap: true,
                strict: true,
                target: "es2022",
                useUnknownInCatchVariables: true,
            },
            exclude: ["node_modules", "tmp"],
        });
        writeJsonSync(join(distribution, "configs", "tsconfig.jsx.json"), {
            compilerOptions: {
                isolatedModules: true,
                jsx: "preserve",
                jsxImportSource: "solid-js",
                lib: ["ESNext", "DOM", "DOM.Iterable"],
                module: "ESNext",
                moduleResolution: "bundler",
                target: "ES2022",
            },
        });
        writeJsonSync(join(distribution, "configs", "tsconfig.jsx.spec.json"), {
            compilerOptions: {
                outDir: "../../dist/out-tsc",
                types: ["vitest/globals", "vitest/importMeta", "vite/client", "vinxi/types/client", "node", "vitest", "@testing-library/jest-dom"],
            },
            extends: "./tsconfig.jsx.json",
        });
        writeJsonSync(join(distribution, "library", "tsconfig.base.json"), {
            compileOnSave: false,
            compilerOptions: {
                allowImportingTsExtensions: true,
            },
            exclude: ["node_modules", "tmp"],
        });
        writeJsonSync(join(distribution, "library", "tsconfig.json"), {
            compilerOptions: {},
            extends: "../tsconfig.base.json",
            files: [],
            include: [],
            references: [
                {
                    path: "./tsconfig.lib.json",
                },
                {
                    path: "./tsconfig.spec.json",
                },
            ],
        });
        writeJsonSync(join(distribution, "library", "tsconfig.spec.json"), {
            extends: ["./tsconfig.json", "../configs/tsconfig.jsx.spec.json"],
            include: [
                "vite.config.ts",
                "src/**/*.test.ts",
                "src/**/*.spec.ts",
                "src/**/*.test.tsx",
                "src/**/*.spec.tsx",
                "src/**/*.stories.tsx",
                "src/**/*.d.ts",
                "types/**/*.d.ts",
                ".storybook/**/*.ts",
                ".storybook/**/*.tsx",
            ],
        });
        writeJsonSync(join(distribution, "library", "tsconfig.lib.json"), {
            exclude: ["src/**/*.spec.ts", "src/**/*.test.ts", "src/**/*.spec.tsx", "src/**/*.test.tsx", "t.ts"],
            extends: ["./tsconfig.json", "../configs/tsconfig.jsx.json"],
            include: ["src/**/*.ts", "src/**/*.tsx", "types/**/*.d.ts"],
        });

        const parsedTsconfig = readTsConfig(join(distribution, "library", "tsconfig.lib.json"), { tscCompatible: typescriptVersion });
        const expectedTsconfig = await getTscTsconfig(distribution, "library/tsconfig.lib.json");

        delete expectedTsconfig.files;

        expect(parsedTsconfig).toStrictEqual(expectedTsconfig);
    });

    describe("rewriteRelativeImportExtensions", () => {
        it("sets allowImportingTsExtensions implicitly", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "tsconfig.json"), {
                compilerOptions: {
                    rewriteRelativeImportExtensions: true,
                },
            });

            const parsedTsconfig = readTsConfig(join(distribution, "tsconfig.json"));
            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            expect(parsedTsconfig).toStrictEqual(expectedTsconfig);
        });

        it("respects explicit allowImportingTsExtensions", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "tsconfig.json"), {
                compilerOptions: {
                    allowImportingTsExtensions: false,
                    rewriteRelativeImportExtensions: true,
                },
            });

            const parsedTsconfig = readTsConfig(join(distribution, "tsconfig.json"));
            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            expect(parsedTsconfig).toStrictEqual(expectedTsconfig);
        });

        it("does not set allowImportingTsExtensions when false", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "tsconfig.json"), {
                compilerOptions: {
                    rewriteRelativeImportExtensions: false,
                },
            });

            const parsedTsconfig = readTsConfig(join(distribution, "tsconfig.json"));
            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            expect(parsedTsconfig).toStrictEqual(expectedTsconfig);
        });
    });
});
