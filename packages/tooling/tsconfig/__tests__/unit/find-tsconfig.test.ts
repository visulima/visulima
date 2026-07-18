import { utimesSync } from "node:fs";
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

            if (name === "findTsConfig") {
                // eslint-disable-next-line vitest/no-conditional-expect
                await expect(function_("/noMatch")).rejects.toThrow(expectedErrorMessage);
            } else {
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(() => function_("/noMatch")).toThrow(expectedErrorMessage);
            }
        });

        it("should not fall back to jsconfig.json when a custom configFileName is provided", async () => {
            expect.assertions(1);

            // Only a jsconfig.json exists, but a custom configFileName disables the fallback.
            writeJsonSync(join(distribution, "jsconfig.json"), {});

            const options = { configFileName: "tsconfig.custom.json" };
            const expectedErrorMessage = "ENOENT: No such file or directory, for 'tsconfig.custom.json' found.";

            if (name === "findTsConfig") {
                // eslint-disable-next-line vitest/no-conditional-expect
                await expect(function_(distribution, options)).rejects.toThrow(expectedErrorMessage);
            } else {
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(() => function_(distribution, options)).toThrow(expectedErrorMessage);
            }
        });

        it("should serve a cached result when cache is enabled and the file is unchanged", async () => {
            expect.assertions(1);

            const path = join(distribution, "tsconfig.json");

            writeJsonSync(path, { compilerOptions: { strict: true } });

            const cache = new Map<string, TsConfigResult>();
            const options = { cache };

            const first: TsConfigResult = (
                name === "findTsConfig" ? await function_(distribution, options) : function_(distribution, options)
            ) as TsConfigResult;
            const second: TsConfigResult = (
                name === "findTsConfig" ? await function_(distribution, options) : function_(distribution, options)
            ) as TsConfigResult;

            // Same object identity proves the cached entry was reused.
            expect(second).toBe(first);
        });

        it("should invalidate the cache when the file mtime changes", async () => {
            expect.assertions(2);

            const path = join(distribution, "tsconfig.json");

            writeJsonSync(path, { compilerOptions: { strict: true } });

            const cache = new Map<string, TsConfigResult>();
            const options = { cache };

            const first: TsConfigResult = (
                name === "findTsConfig" ? await function_(distribution, options) : function_(distribution, options)
            ) as TsConfigResult;

            // Rewrite with different content and bump the mtime into the future.
            writeJsonSync(path, { compilerOptions: { strict: false } });

            const future = new Date(Date.now() + 10_000);

            utimesSync(path, future, future);

            const second: TsConfigResult = (
                name === "findTsConfig" ? await function_(distribution, options) : function_(distribution, options)
            ) as TsConfigResult;

            expect(second).not.toBe(first);
            expect(second.config.compilerOptions?.strict).toBe(false);
        });

        it("replaces the stale entry in place instead of accumulating one per edit", async () => {
            expect.assertions(2);

            const path = join(distribution, "tsconfig.json");

            writeJsonSync(path, { compilerOptions: { strict: true } });

            const cache = new Map<string, TsConfigResult>();
            const options = { cache };

            // eslint-disable-next-line no-plusplus
            for (let index = 0; index < 3; index++) {
                writeJsonSync(path, { compilerOptions: { strict: index % 2 === 0 } });

                const future = new Date(Date.now() + (index + 1) * 10_000);

                utimesSync(path, future, future);

                // eslint-disable-next-line no-await-in-loop
                await (name === "findTsConfig" ? function_(distribution, options) : function_(distribution, options));
            }

            // Each edit overwrites the same key rather than minting a new one.
            expect(cache.size).toBe(1);

            const latest: TsConfigResult = (
                name === "findTsConfig" ? await function_(distribution, options) : function_(distribution, options)
            ) as TsConfigResult;

            expect(latest.config.compilerOptions?.strict).toBe(true);
        });
    });
});
