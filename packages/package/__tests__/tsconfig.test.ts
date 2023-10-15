import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it, expect, vi } from "vitest";

import { findTSConfig, writeTSConfig } from "../src/tsconfig";
import { rm, rmdir } from "fs/promises";

const cwd = join(dirname(fileURLToPath(import.meta.url)), `../__fixtures__/tsconfig`);

vi.mock("get-tsconfig", async (importOriginal) => {
    const module = await importOriginal();

    return {
        // @ts-expect-error - type mismatch
        ...module,
        getTsconfig: async (cwd: string | undefined, fileName: string) => {
            if (cwd.includes("noMatch")) {
                return null;
            }

            // @ts-expect-error - type mismatch
            return module.getTsconfig(cwd, fileName);
        },
    };
});

describe("tsconfig", () => {
    describe("findTSConfig", () => {
        it("should find the tsconfig.json file", async () => {
            const tsConfig = await findTSConfig(cwd);

            expect(tsConfig.config).not.toBeUndefined();
        });

        it("should throw an error when the tsconfig.json file is not found", async () => {
            expect(async () => {
                return await findTSConfig(join(cwd, "noMatch"));
            }).rejects.toThrow("Could not find tsconfig.json");
        });
    });

    describe("writeTSConfig", () => {
        it("should write a tsconfig.json file", async () => {
            await writeTSConfig(
                {
                    compilerOptions: {},
                },
                {
                    cwd,
                },
            );

            const tsconfigFilePath = join(cwd, "tsconfig.json");

            expect(existsSync(tsconfigFilePath)).toBe(true);

            await rm(tsconfigFilePath);
            await rmdir(cwd);
        });
    });
});
