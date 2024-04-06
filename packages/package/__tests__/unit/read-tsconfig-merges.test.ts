/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig/blob/develop/tests/specs/parse-tsconfig/extends/merges.spec.ts`
 *
 * MIT License
 * Copyright (c) Hiroki Osame <hiroki.osame@gmail.com>
 */
import { rm } from "node:fs/promises";

import { ensureDirSync, writeFileSync, writeJsonSync } from "@visulima/fs";
import { join } from "pathe";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readTsConfig } from "../../src/read-tsconfig";
import { getTscTsconfig } from "../helpers";

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

            writeFileSync(join(distribution, "tsconfig.empty.json"), 'require("fs")');
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

        const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: true });

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

        const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: true });

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
});
