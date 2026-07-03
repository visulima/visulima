/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig/blob/develop/tests/specs/parse-tsconfig/extends/resolves/absolute-path.spec.ts`
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

describe("parse-tsconfig - absolute path", () => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();

        writeFileSync(join(distribution, "file.ts"), "");
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("absolute path", async () => {
        expect.assertions(1);

        writeJsonSync(join(distribution, "dep", "tsconfig.json"), {
            compilerOptions: {
                jsx: "react",
                strict: true,
            },
        });
        writeJsonSync(join(distribution, "tsconfig.json"), {
            extends: join(distribution, "dep", "tsconfig.json"),
        });

        const expectedTsconfig = await getTscTsconfig(distribution);

        delete expectedTsconfig.files;

        const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

        expect(tsconfig).toStrictEqual(expectedTsconfig);
    });

    it("no extension", async () => {
        expect.assertions(1);

        writeJsonSync(join(distribution, "dep/tsconfig.json"), {
            compilerOptions: {
                jsx: "react",
                strict: true,
            },
        });
        writeJsonSync(join(distribution, "tsconfig.json"), {
            extends: join(distribution, "dep/tsconfig"),
        });

        const expectedTsconfig = await getTscTsconfig(distribution);

        delete expectedTsconfig.files;

        const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

        expect(tsconfig).toStrictEqual(expectedTsconfig);
    });

    it("arbitrary extension", async () => {
        expect.assertions(1);

        writeJsonSync(join(distribution, "dep", "tsconfig.tsx"), {
            compilerOptions: {
                jsx: "react",
                strict: true,
            },
        });
        writeJsonSync(join(distribution, "tsconfig.json"), {
            extends: join(distribution, "dep/tsconfig.tsx"),
        });

        const expectedTsconfig = await getTscTsconfig(distribution);

        delete expectedTsconfig.files;

        const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

        expect(tsconfig).toStrictEqual(expectedTsconfig);
    });
});
