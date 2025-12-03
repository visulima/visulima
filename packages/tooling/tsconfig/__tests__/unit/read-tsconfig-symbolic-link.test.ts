/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig/blob/master/tests/specs/parse-tsconfig/extends/resolves/symbolic-link.spec.ts`
 *
 * MIT License
 * Copyright (c) Hiroki Osame &lt;hiroki.osame@gmail.com>
 */
import { rm, symlink } from "node:fs/promises";
import path from "node:path";

import { ensureDirSync, writeFileSync, writeJsonSync } from "@visulima/fs";
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

const validate = async (directoryPath: string) => {
    const expectedTsconfig = await getTscTsconfig(directoryPath);

    delete expectedTsconfig.files;

    const tsconfig = readTsConfig(path.join(directoryPath, "tsconfig.json"), { tscCompatible: typescriptVersion });

    expect(tsconfig).toStrictEqual(expectedTsconfig);
};

describe("symbolic link", () => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();

        ensureDirSync(distribution);
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("extends symlink to file", async () => {
        expect.assertions(1);

        writeFileSync(join(distribution, "file.ts"), "");
        writeJsonSync(join(distribution, "tsconfig.json"), {
            compilerOptions: {
                strict: true,
            },
            extends: "./tsconfig.symlink.json",
        });
        writeJsonSync(join(distribution, "tsconfig.symlink-source.json"), {
            compilerOptions: {
                allowJs: true,
                jsx: "react",
            },
        });

        await symlink(join(distribution, "tsconfig.symlink-source.json"), join(distribution, "tsconfig.symlink.json"));

        await validate(distribution);
    });

    it("extends file from symlink to directory", async () => {
        expect.assertions(1);

        writeFileSync(join(distribution, "file.ts"), "");
        writeJsonSync(join(distribution, "symlink-source", "tsconfig.json"), {
            compilerOptions: {
                allowJs: true,
                jsx: "react",
            },
        });
        writeJsonSync(join(distribution, "tsconfig.json"), {
            compilerOptions: {
                strict: true,
            },
            extends: "./symlink/tsconfig.json",
        });

        await symlink(join(distribution, "symlink-source"), join(distribution, "symlink"));

        await validate(distribution);
    });

    it("extends from symlink to file in origin directory", async () => {
        expect.assertions(1);

        writeFileSync(join(distribution, "project", "file.ts"), "");
        writeJsonSync(join(distribution, "project", "tsconfig.base.json"), {
            compilerOptions: {
                allowJs: true,
                jsx: "react",
            },
        });
        writeJsonSync(join(distribution, "symlink-source", "tsconfig.main.json"), {
            compilerOptions: {
                strict: true,
            },
            extends: "./tsconfig.base.json",
        });

        await symlink(join(distribution, "symlink-source", "tsconfig.main.json"), join(distribution, "project", "tsconfig.json"));

        await validate(join(distribution, "project"));
    });

    it("extends from file in symlinked directory to file in origin directory", async () => {
        expect.assertions(1);

        writeFileSync(join(distribution, "project", "file.ts"), "");
        writeJsonSync(join(distribution, "project", "tsconfig.json"), {
            compilerOptions: {
                importHelpers: true,
            },
            extends: "./symlink/tsconfig.main.json",
        });
        writeJsonSync(join(distribution, "project", "tsconfig.base.json"), {
            compilerOptions: {
                allowJs: true,
                jsx: "react",
            },
        });
        writeJsonSync(join(distribution, "symlink-source", "tsconfig.main.json"), {
            compilerOptions: {
                strict: true,
            },
            extends: "../tsconfig.base.json",
        });

        await symlink(join(distribution, "symlink-source"), join(distribution, "project", "symlink"));

        await validate(join(distribution, "project"));
    });
});
