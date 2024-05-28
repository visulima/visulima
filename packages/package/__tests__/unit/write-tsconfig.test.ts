import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";

import { join } from "@visulima/path";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writeTsConfig, writeTsConfigSync } from "../../src/tsconfig/write-tsconfig";

describe("tsconfig", () => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    describe.each([
        ["writeTsConfig", writeTsConfig],
        ["writeTsConfigSync", writeTsConfigSync],
    ])("%s", (name, function_) => {
        it("should write a tsconfig.json file", async () => {
            expect.assertions(1);

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "writeTsConfig") {
                await (function_ as typeof writeTsConfig)(
                    {
                        compilerOptions: {},
                    },
                    {
                        cwd: distribution,
                    },
                );
            } else {
                function_(
                    {
                        compilerOptions: {},
                    },
                    {
                        cwd: distribution,
                    },
                );
            }
            const tsconfigFilePath = join(distribution, "tsconfig.json");

            // eslint-disable-next-line security/detect-non-literal-fs-filename
            expect(existsSync(tsconfigFilePath)).toBeTruthy();
        });
    });
});
