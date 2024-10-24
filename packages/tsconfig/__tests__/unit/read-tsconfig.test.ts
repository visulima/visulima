/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig/blob/develop/tests/specs/parse-tsconfig/parses.spec.ts`
 *
 * MIT License
 * Copyright (c) Hiroki Osame <hiroki.osame@gmail.com>
 */
import { rm } from "node:fs/promises";

import { writeFileSync, writeJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { temporaryDirectory } from "tempy";
import { version as tsVersion } from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Options } from "../../src/read-tsconfig";
import { implicitBaseUrlSymbol, readTsConfig } from "../../src/read-tsconfig";
import { getTscTsconfig } from "../helpers";

// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
const typescriptVersion: Options["tscCompatible"] = (tsVersion.split(".")[0] + "." + tsVersion.split(".")[1]) as Options["tscCompatible"];

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

            writeFileSync(join(distribution, "tsconfig.json"), '"asdf"');

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
            // eslint-disable-next-line security/detect-object-injection
            delete tsconfig?.compilerOptions?.[implicitBaseUrlSymbol];

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        } finally {
            process.chdir(originalCwd);
        }
    });
});
