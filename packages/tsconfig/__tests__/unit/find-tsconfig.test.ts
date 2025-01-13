import { rm } from "node:fs/promises";

import { writeJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { TsConfigResult } from "../../src/find-tsconfig";
import { findTsConfig, findTsConfigSync } from "../../src/find-tsconfig";

describe("tsconfig", () => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    describe.each([
        ["findTsConfig", findTsConfig],
        ["findTsConfigSync", findTsConfigSync],
    ])("%s", (name, function_) => {
        it("should find the tsconfig.json file", async () => {
            expect.assertions(1);

            const path = join(distribution, "tsconfig.json");

            writeJsonSync(path, {});

            const result: TsConfigResult = (name === "findTsConfig" ? await function_(distribution) : function_(distribution)) as TsConfigResult;

            expect(result.config).toBeDefined();
        });

        it("should find the tsconfig.json file with custom name", async () => {
            expect.assertions(1);

            const options = {
                configFileName: "tsconfig.custom.json",
            };

            const path = join(distribution, options.configFileName);

            writeJsonSync(path, {});

            const result: TsConfigResult = (name === "findTsConfig" ? await function_(path, options) : function_(path, options)) as TsConfigResult;

            expect(result.config).toBeDefined();
        });

        it("should throw an error when the tsconfig.json file is not found", async () => {
            expect.assertions(1);

            const expectedErrorMessage = "ENOENT: No such file or directory, for 'tsconfig.json' or 'jsconfig.json' found.";

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "findTsConfig") {
                // eslint-disable-next-line vitest/no-conditional-expect
                await expect(function_("/noMatch")).rejects.toThrow(expectedErrorMessage);
            } else {
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(() => function_("/noMatch")).toThrow(expectedErrorMessage);
            }
        });
    });
});
