/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig/blob/develop/tests/specs/parse-tsconfig/extends/resolves/relative-path.spec.ts`
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

import { readTsConfig } from "../../src/read-tsconfig";
import { getTscTsconfig, parseVersion } from "../helpers";

const typescriptVersion = parseVersion(tsVersion);

if (!typescriptVersion) {
    throw new Error(`Invalid TypeScript version format: ${tsVersion}`);
}

describe("relative path", () => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();

        writeFileSync(join(distribution, "file.ts"), "");
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should resolve extensionless file", async () => {
        expect.assertions(1);

        writeJsonSync(join(distribution, "asdf"), {
            compilerOptions: {
                allowJs: true,
                jsx: "react",
            },
        });
        writeJsonSync(join(distribution, "tsconfig.json"), {
            compilerOptions: {
                strict: true,
            },
            extends: "./asdf",
        });

        const expectedTsconfig = await getTscTsconfig(distribution);

        delete expectedTsconfig.files;

        const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

        expect(tsconfig).toStrictEqual(expectedTsconfig);
    });

    it("should resolve prefers exact match (extensionless file)", async () => {
        expect.assertions(1);

        writeJsonSync(join(distribution, "asdf"), {
            compilerOptions: {
                allowJs: true,
                jsx: "react",
            },
        });
        writeJsonSync(join(distribution, "asdf.json"), {
            compilerOptions: {
                allowJs: true,
                jsx: "react-native",
            },
        });
        writeJsonSync(join(distribution, "tsconfig.json"), {
            compilerOptions: {
                strict: true,
            },
            extends: "./asdf",
        });

        const expectedTsconfig = await getTscTsconfig(distribution);

        delete expectedTsconfig.files;

        const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

        expect(tsconfig).toStrictEqual(expectedTsconfig);
    });

    it("should resolve arbitrary extension", async () => {
        expect.assertions(1);

        writeJsonSync(join(distribution, "asdf.ts"), {
            compilerOptions: {
                allowJs: true,
                jsx: "react",
            },
        });
        writeJsonSync(join(distribution, "tsconfig.json"), {
            compilerOptions: {
                strict: true,
            },
            extends: "./asdf.ts",
        });

        const expectedTsconfig = await getTscTsconfig(distribution);

        delete expectedTsconfig.files;

        const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

        expect(tsconfig).toStrictEqual(expectedTsconfig);
    });

    it("should resolve parent directory", async () => {
        expect.assertions(1);

        writeJsonSync(join(distribution, "tests", "tsconfig.json"), {
            compilerOptions: {
                strict: true,
            },
            extends: "..",
        });
        writeFileSync(join(distribution, "tests", "file.ts"), "");
        writeJsonSync(join(distribution, "tsconfig.json"), {
            compilerOptions: {
                allowJs: true,
                jsx: "react",
            },
        });

        const testDirectory = `${distribution}/tests/`;
        const expectedTsconfig = await getTscTsconfig(testDirectory);

        delete expectedTsconfig.files;

        const tsconfig = readTsConfig(join(testDirectory, "tsconfig.json"), { tscCompatible: typescriptVersion });

        expect(tsconfig).toStrictEqual(expectedTsconfig);
    });

    it("should not resolve directory", async () => {
        expect.assertions(1);

        writeJsonSync(join(distribution, "directory", "tsconfig.json"), {
            compilerOptions: {
                jsx: "react",
            },
        });
        writeJsonSync(join(distribution, "tsconfig.json"), {
            extends: "./directory",
        });

        expect(() => readTsConfig(join(distribution, "tsconfig.json"))).toThrow("ENOENT: No such file or directory, for './directory' found.");
    });

    it("should not resolve directory even with package.json#tsconfig", async () => {
        expect.assertions(1);

        writeJsonSync(join(distribution, "directory", "package.json"), {
            tsconfig: "./tsconfig.json",
        });
        writeJsonSync(join(distribution, "directory", "tsconfig.json"), {
            compilerOptions: {
                jsx: "react",
            },
        });
        writeJsonSync(join(distribution, "tsconfig.json"), {
            extends: "./directory",
        });

        expect(() => readTsConfig(join(distribution, "tsconfig.json"))).toThrow("ENOENT: No such file or directory, for './directory' found.");
    });

    it("should resolve outDir in extends", async () => {
        expect.assertions(1);

        writeJsonSync(join(distribution, "a", "dep.json"), {
            compilerOptions: {
                jsx: "react-native",
                outDir: "dist",
            },
        });
        writeJsonSync(join(distribution, "tsconfig.json"), {
            extends: "./a/dep.json",
        });

        const expectedTsconfig = await getTscTsconfig(distribution);

        delete expectedTsconfig.files;

        const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

        expect(tsconfig).toStrictEqual(expectedTsconfig);
    });
});
