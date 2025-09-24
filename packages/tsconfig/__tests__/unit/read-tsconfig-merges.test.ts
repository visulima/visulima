/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig/blob/develop/tests/specs/parse-tsconfig/extends/merges.spec.ts`
 *
 * MIT License
 * Copyright (c) Hiroki Osame &lt;hiroki.osame@gmail.com>
 */
import { symlinkSync } from "node:fs";
import { rm } from "node:fs/promises";

import { ensureDirSync, writeFileSync, writeJsonSync } from "@visulima/fs";
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

describe("parse-tsconfig merges", () => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();

        ensureDirSync(distribution);
        writeFileSync(join(distribution, "file.ts"), "");
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    describe("error handling", () => {
        it("invalid path", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "./non-existent.json",
            });

            expect(() => readTsConfig(join(distribution, "tsconfig.json"))).toThrow("ENOENT: No such file or directory, for './non-existent.json' found.");
        });

        it("invalid json", async () => {
            expect.assertions(1);

            writeFileSync(join(distribution, "tsconfig.empty.json"), "require(\"fs\")");
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "./tsconfig.empty.json",
            });

            expect(() => readTsConfig(join(distribution, "tsconfig.json"))).toThrow("Failed to parse tsconfig at:");
        });
    });

    it("empty file", async () => {
        expect.assertions(1);

        writeFileSync(join(distribution, "tsconfig.empty.json"), "");
        writeJsonSync(join(distribution, "tsconfig.json"), {
            extends: "./tsconfig.empty.json",
        });

        const expectedTsconfig = await getTscTsconfig(distribution);

        delete expectedTsconfig.files;

        const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

        expect(tsconfig).toStrictEqual(expectedTsconfig);
    });

    it("empty json", async () => {
        expect.assertions(1);

        writeJsonSync(join(distribution, "tsconfig.empty.json"), {});
        writeJsonSync(join(distribution, "tsconfig.json"), {
            extends: "./tsconfig.empty.json",
        });

        const expectedTsconfig = await getTscTsconfig(distribution);

        delete expectedTsconfig.files;

        const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

        expect(tsconfig).toStrictEqual(expectedTsconfig);
    });

    it("jsonc", async () => {
        expect.assertions(1);

        writeFileSync(
            join(distribution, "tsconfig.base.json"),
            `{
					// comment
					"compilerOptions": {
						"jsx": "react", // dangling comma
					},
				}`,
        );
        writeJsonSync(join(distribution, "tsconfig.json"), {
            extends: "./tsconfig.base.json",
        });

        const expectedTsconfig = await getTscTsconfig(distribution);

        delete expectedTsconfig.files;

        const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

        expect(tsconfig).toStrictEqual(expectedTsconfig);
    });

    it("references is ignored", async () => {
        expect.assertions(1);

        writeJsonSync(join(distribution, "tsconfig.base.json"), {
            compilerOptions: {
                jsx: "react",
                strict: true,
            },
            references: [
                {
                    path: "src",
                },
            ],
        });
        writeJsonSync(join(distribution, "tsconfig.json"), {
            extends: "./tsconfig.base.json",
        });

        const expectedTsconfig = await getTscTsconfig(distribution);

        delete expectedTsconfig.files;

        const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

        expect(tsconfig).toStrictEqual(expectedTsconfig);
    });

    describe("files", () => {
        it("inherits with relative path", async () => {
            expect.assertions(1);

            writeFileSync(join(distribution, "some-dir", "src", "a.ts"), "");
            writeFileSync(join(distribution, "some-dir", "src", "b.ts"), "");
            writeJsonSync(join(distribution, "some-dir", "tsconfig.base.json"), {
                files: ["src/a.ts"],
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "./some-dir/tsconfig.base.json",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);
            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });

        it("gets overwritten", async () => {
            expect.assertions(1);

            writeFileSync(join(distribution, "some-dir", "src", "a.ts"), "");
            writeFileSync(join(distribution, "some-dir", "src", "b.ts"), "");
            writeJsonSync(join(distribution, "some-dir", "tsconfig.base.json"), {
                files: ["src/a.ts"],
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "./some-dir/tsconfig.base.json",
                files: ["src/b.ts"],
            });

            const expectedTsconfig = await getTscTsconfig(distribution);
            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });
    });

    it("inherits from symlinked configs", async () => {
        expect.assertions(1);

        writeFileSync(join(distribution, "project", "src", "a.ts"), "");
        writeFileSync(join(distribution, "project", "src", "b.ts"), "");
        writeFileSync(join(distribution, "project", "src", "c.ts"), "");
        writeJsonSync(join(distribution, "project", "tsconfig.json"), {
            extends: "./symlink/tsconfig.base.json",
        });
        writeJsonSync(join(distribution, "symlink-source", "tsconfig.base.json"), {
            include: ["../src/*"],
        });

        symlinkSync(join(distribution, "symlink-source"), join(distribution, "project/symlink"));

        const expectedTsconfig = await getTscTsconfig(join(distribution, "project"));

        delete expectedTsconfig.files;

        const tsconfig = readTsConfig(join(distribution, "project", "tsconfig.json"));

        expect({
            ...tsconfig,
            // See https://github.com/privatenumber/get-tsconfig/issues/73

            include: tsconfig.include?.map((includePath) => `symlink/../${includePath}` as string),
        }).toStrictEqual(expectedTsconfig);
    });

    describe("include", () => {
        it("inherits with relative path", async () => {
            expect.assertions(1);

            writeFileSync(join(distribution, "src-a", "a.ts"), "");
            writeFileSync(join(distribution, "src-a", "b.ts"), "");
            writeFileSync(join(distribution, "src-a", "c.ts"), "");
            writeJsonSync(join(distribution, "src-a", "tsconfig.base.json"), {
                include: ["*"],
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "./src-a/tsconfig.base.json",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });

        it("gets overwritten", async () => {
            expect.assertions(1);

            writeFileSync(join(distribution, "src-a", "a.ts"), "");
            writeFileSync(join(distribution, "src-a", "b.ts"), "");
            writeFileSync(join(distribution, "src-a", "c.ts"), "");
            writeFileSync(join(distribution, "src-b", "a.ts"), "");
            writeFileSync(join(distribution, "src-b", "b.ts"), "");
            writeFileSync(join(distribution, "src-b", "c.ts"), "");
            writeJsonSync(join(distribution, "tsconfig.base.json"), {
                include: ["src-a"],
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "./tsconfig.base.json",
                include: ["src-b"],
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });
    });

    describe("baseUrl", () => {
        it("path becomes prefixed with ./", async () => {
            expect.assertions(1);

            writeFileSync(join(distribution, "src-a", "a.ts"), "");
            writeJsonSync(join(distribution, "tsconfig.json"), {
                compilerOptions: {
                    baseUrl: "src-a",
                },
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });

        it("gets inherited with relative path", async () => {
            expect.assertions(1);

            writeFileSync(join(distribution, "project", "src-a", "a.ts"), "");
            writeJsonSync(join(distribution, "project", "tsconfig.json"), {
                compilerOptions: {
                    baseUrl: "src-a",
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "./project/tsconfig.json",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });

        it("resolves parent baseUrl path", async () => {
            expect.assertions(1);

            writeFileSync(join(distribution, "a.ts"), "");
            writeJsonSync(join(distribution, "project", "tsconfig.json"), {
                compilerOptions: {
                    baseUrl: "..",
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "./project/tsconfig.json",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });

        it("resolves parent baseUrl & paths", async () => {
            expect.assertions(1);

            writeFileSync(join(distribution, "a.ts"), "");
            writeJsonSync(join(distribution, "project", "tsconfig.json"), {
                compilerOptions: {
                    baseUrl: ".",
                    paths: {
                        "@/*": ["src/*"],
                    },
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "./project/tsconfig.json",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });

        it("resolves parent baseUrl path defined in symlinked config", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "symlink-source", "tsconfig.json"), {
                compilerOptions: {
                    baseUrl: "..",
                },
            });
            writeJsonSync(join(distribution, "project", "tsconfig.json"), {
                extends: "./symlink/tsconfig.json",
            });
            writeFileSync(join(distribution, "project", "a.ts"), "");

            symlinkSync(join(distribution, "symlink-source"), join(distribution, "project", "symlink"));

            const expectedTsconfig = await getTscTsconfig(join(distribution, "project"));

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "project", "tsconfig.json"));

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });
    });

    it("nested extends", async () => {
        expect.assertions(1);

        writeJsonSync(join(distribution, "c.json"), {
            compileOnSave: true,
        });
        writeJsonSync(join(distribution, "some-dir", "some-dir", "b"), {
            compilerOptions: {
                module: "commonjs",
            },
            extends: "../../c.json",
        });
        writeJsonSync(join(distribution, "tsconfig.a.json"), {
            compilerOptions: {
                allowJs: true,
            },
            extends: "./some-dir/some-dir/b",
        });
        writeJsonSync(join(distribution, "tsconfig.json"), {
            extends: "./tsconfig.a.json",
        });

        const expectedTsconfig = await getTscTsconfig(distribution);

        delete expectedTsconfig.files;

        const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

        expect(tsconfig).toStrictEqual(expectedTsconfig);
    });

    it("extends array", async () => {
        expect.assertions(1);

        writeJsonSync(join(distribution, "tsconfig.a.json"), {
            compilerOptions: {
                allowJs: true,
                jsx: "react",
                strict: true,
            },
        });
        writeJsonSync(join(distribution, "tsconfig.b.json"), {
            compilerOptions: {
                jsx: "react-jsx",
            },
        });
        writeJsonSync(join(distribution, "tsconfig.json"), {
            compilerOptions: {
                allowJs: false,
            },
            extends: ["./tsconfig.a.json", "./tsconfig.b.json"],
        });

        const expectedTsconfig = await getTscTsconfig(distribution);

        delete expectedTsconfig.files;

        const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

        expect(tsconfig).toStrictEqual(expectedTsconfig);
    });

    it("watchOptions", async () => {
        expect.assertions(1);

        writeJsonSync(join(distribution, "tsconfig.base.json"), {
            watchOptions: {
                excludeDirectories: ["a", "b"],
                synchronousWatchDirectory: true,
            },
        });
        writeJsonSync(join(distribution, "tsconfig.json"), {
            extends: "./tsconfig.base.json",
            watchOptions: {
                excludeDirectories: ["c"],
                fallbackPolling: "fixedinterval",
            },
        });

        const expectedTsconfig = await getTscTsconfig(distribution);

        delete expectedTsconfig.files;

        const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

        expect(tsconfig).toStrictEqual(expectedTsconfig);
    });

    // Need to report this bug back to typescript
    // eslint-disable-next-line vitest/no-disabled-tests
    it.skip("inherits with relative path from subdirectory", async () => {
        expect.assertions(1);

        writeFileSync(join(distribution, "src-a", "a.ts"), "");
        writeFileSync(join(distribution, "src-a", "b.ts"), "");
        writeFileSync(join(distribution, "src-a", "c.ts"), "");
        writeJsonSync(join(distribution, "configs", "tsconfig.base.json"), {
            include: ["../src-a/*"],
        });

        writeJsonSync(join(distribution, "tsconfig.json"), {
            extends: "./configs/tsconfig.base.json",
        });

        const expectedTsconfig = await getTscTsconfig(distribution);

        delete expectedTsconfig.files;

        const parsedTsconfig = readTsConfig(join(distribution, "tsconfig.json"));

        expect({
            ...parsedTsconfig,

            include: parsedTsconfig.include?.map((includePath) => `configs/../${includePath}`),
        }).toStrictEqual(expectedTsconfig);
    });

    // eslint-disable-next-line no-template-curly-in-string
    describe("${configDir}", () => {
        it("should work in paths, include, excludes", async () => {
            expect.assertions(1);

            writeFileSync(join(distribution, "file.ts"), "");
            writeJsonSync(join(distribution, "tsconfig.json"), {
                compilerOptions: {
                    // eslint-disable-next-line no-template-curly-in-string
                    outDir: "${configDir}/dist",
                    paths: {
                        // eslint-disable-next-line no-template-curly-in-string
                        "@/*": ["${configDir}/*"],
                    },
                },
                // eslint-disable-next-line no-template-curly-in-string
                include: ["${configDir}/file.ts"],
            });

            writeFileSync(join(distribution, "extended", "file.ts"), "");
            writeJsonSync(join(distribution, "extended", "tsconfig.json"), {
                extends: "../tsconfig.json",
            });

            const expectedTsconfig = await getTscTsconfig(join(distribution, "extended"));

            delete expectedTsconfig.files;

            const parsedTsconfig = readTsConfig(join(distribution, "extended", "tsconfig.json"));

            // @ts-expect-error Symbol is private
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete parsedTsconfig.compilerOptions[implicitBaseUrlSymbol];

            /**
             * tsc should put the outDir in exclude but doesn't happen
             * when it's in extended tsconfig. I think this is a bug in tsc
             */
            expectedTsconfig.exclude = [join(distribution, "dist"), ...(expectedTsconfig.exclude as string[])];

            expect(parsedTsconfig).toStrictEqual(expectedTsconfig);
        });

        it("should support joins path", async () => {
            expect.assertions(1);

            writeFileSync(join(distribution, "file.ts"), "");
            writeJsonSync(join(distribution, "tsconfig.json"), {
                compilerOptions: {
                    // eslint-disable-next-line no-template-curly-in-string
                    baseUrl: "${configDir}/dist/src",
                    // eslint-disable-next-line no-template-curly-in-string
                    declarationDir: "${configDir}/dist/declaration",
                    // eslint-disable-next-line no-template-curly-in-string
                    outDir: "${configDir}-asdf/dist",
                    // eslint-disable-next-line no-template-curly-in-string
                    outFile: "${configDir}/dist/outfile.js",
                    paths: {
                        // eslint-disable-next-line no-template-curly-in-string
                        a: ["${configDir}_a/*"],
                        // eslint-disable-next-line no-template-curly-in-string
                        b: ["ignores/${configDir}/*"],
                    },
                    // eslint-disable-next-line no-template-curly-in-string
                    rootDir: "${configDir}/dist/src",
                    // eslint-disable-next-line no-template-curly-in-string
                    rootDirs: ["${configDir}/src", "${configDir}/static"],
                    // eslint-disable-next-line no-template-curly-in-string
                    tsBuildInfoFile: "${configDir}/dist/dist.tsbuildinfo",
                    // eslint-disable-next-line no-template-curly-in-string
                    typeRoots: ["${configDir}/src/type", "${configDir}/types"],
                },
                // eslint-disable-next-line no-template-curly-in-string
                include: ["${configDir}/file.ts"],
            });

            writeFileSync(join(distribution, "extended", "file.ts"), "");
            writeJsonSync(join(distribution, "extended", "tsconfig.json"), {
                extends: "../tsconfig.json",
            });

            const expectedTsconfig = await getTscTsconfig(join(distribution, "extended"));

            delete expectedTsconfig.files;

            const parsedTsconfig = readTsConfig(join(distribution, "extended", "tsconfig.json"));

            // @ts-expect-error Symbol is private
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete parsedTsconfig.compilerOptions[implicitBaseUrlSymbol];

            /**
             * tsc should put the outDir in exclude but doesn't happen
             * when it's in extended tsconfig. I think this is a bug in tsc
             */
            expectedTsconfig.exclude = [join(distribution, "-asdf/dist"), join(distribution, "dist/declaration"), ...(expectedTsconfig.exclude as string[])];

            expect(parsedTsconfig).toStrictEqual(expectedTsconfig);
        });

        it("should support parent path", async () => {
            expect.assertions(1);

            writeFileSync(join(distribution, "file-b.ts"), "");
            writeJsonSync(join(distribution, "tsconfig.json"), {
                compilerOptions: {
                    // eslint-disable-next-line no-template-curly-in-string
                    outDir: "${configDir}/../dist",
                },
                // eslint-disable-next-line no-template-curly-in-string
                include: ["${configDir}/../file-b.ts"],
            });

            writeJsonSync(join(distribution, "extended", "tsconfig.json"), {
                extends: "../tsconfig.json",
            });

            const expectedTsconfig = await getTscTsconfig(join(distribution, "extended"));

            delete expectedTsconfig.files;

            const parsedTsconfig = readTsConfig(join(distribution, "extended", "tsconfig.json"));

            // @ts-expect-error Symbol is private
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete parsedTsconfig.compilerOptions[implicitBaseUrlSymbol];

            expect(parsedTsconfig).toStrictEqual(expectedTsconfig);
        });
    });
});
