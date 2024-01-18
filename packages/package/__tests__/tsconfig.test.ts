import { existsSync } from "node:fs";
import { rm, rmdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { findTSConfig, writeTSConfig } from "../src/tsconfig";

const cwd = join(dirname(fileURLToPath(import.meta.url)), `../__fixtures__/tsconfig`);

vi.mock("get-tsconfig", async (importOriginal) => {
    const module = await importOriginal();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return {
        // @ts-expect-error - type mismatch
        ...module,
        getTsconfig: async (path: string | undefined, fileName: string) => {
            if (path.includes("noMatch")) {
                return null;
            }

            // @ts-expect-error - type mismatch
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return
            return module.getTsconfig(path, fileName);
        },
    };
});

describe("tsconfig", () => {
    describe("findTSConfig", () => {
        it("should find the tsconfig.json file", async () => {
            expect.assertions(1);

            const tsConfig = await findTSConfig(cwd);

            expect(tsConfig.config).toBeDefined();
        });

        it("should throw an error when the tsconfig.json file is not found", async () => {
            expect.assertions(1);

            await expect(async () => await findTSConfig(join(cwd, "noMatch"))).rejects.toThrow("Could not find a tsconfig.json or jsconfig.json file.");
        });
    });

    describe("writeTSConfig", () => {
        it("should write a tsconfig.json file", async () => {
            expect.assertions(1);

            await writeTSConfig(
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
