import { existsSync } from "node:fs";
import { rm, rmdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import type { TsConfigResult } from "../../src/tsconfig";
import { findTsConfig, findTsConfigSync, writeTsConfig } from "../../src/tsconfig";

const cwd = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "__fixtures__", "tsconfig");

vi.mock("get-tsconfig", async (importOriginal) => {
    const module = await importOriginal();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return {
        // @ts-expect-error - type mismatch
        ...module,
        getTsConfig: async (path: string | undefined, fileName: string) => {
            if (path.includes("noMatch")) {
                return null;
            }

            // @ts-expect-error - type mismatch
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return module.getTsConfig(path, fileName);
        },
    };
});

describe("tsconfig", () => {
    describe.each([
        ["findTsConfig", findTsConfig],
        ["findTsConfigSync", findTsConfigSync],
    ])("%s", (name, function_) => {
        it("should find the tsconfig.json file", async () => {
            expect.assertions(1);

            const result: TsConfigResult = name === "findTsConfig" ? await function_(cwd) : function_(cwd);

            expect(result.config).toBeDefined();
        });

        it("should throw an error when the tsconfig.json file is not found", async () => {
            expect.assertions(1);

            const expectedErrorMessage = "Could not find a tsconfig.json or jsconfig.json file.";

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

    describe("writeTsConfig", () => {
        it("should write a tsconfig.json file", async () => {
            expect.assertions(1);

            await writeTsConfig(
                {
                    compilerOptions: {},
                },
                {
                    cwd,
                },
            );

            const tsconfigFilePath = join(cwd, "tsconfig.json");

            expect(existsSync(tsconfigFilePath)).toBeTruthy();

            await rm(tsconfigFilePath);
            await rmdir(cwd);
        });
    });
});
