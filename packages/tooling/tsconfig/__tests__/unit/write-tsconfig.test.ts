import { existsSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";

import { join } from "@visulima/path";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writeTsConfig, writeTsConfigSync } from "../../src/write-tsconfig";

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

            expect(existsSync(tsconfigFilePath)).toBe(true);
        });

        it("normalizes numeric enum compiler options to their string names", async () => {
            expect.assertions(1);

            // 99 = ScriptTarget.ESNext, 100 = ModuleResolutionKind.Bundler — the numeric shape a
            // resolved CompilerOptions object carries and that a tsconfig parser would reject.
            const tsConfig = { compilerOptions: { moduleResolution: 100 as never, target: 99 as never } };

            if (name === "writeTsConfig") {
                await (function_ as typeof writeTsConfig)(tsConfig, { cwd: distribution });
            } else {
                function_(tsConfig, { cwd: distribution });
            }

            const written = JSON.parse(readFileSync(join(distribution, "tsconfig.json"), "utf8")) as { compilerOptions: Record<string, unknown> };

            expect(written.compilerOptions).toStrictEqual({ moduleResolution: "bundler", target: "esnext" });
        });

        it("writes to a custom fileName and drops options removed in the target TypeScript major", async () => {
            expect.assertions(2);

            const tsConfig = { compilerOptions: { baseUrl: ".", strict: true, target: 99 as never } };

            if (name === "writeTsConfig") {
                await (function_ as typeof writeTsConfig)(tsConfig, { cwd: distribution, fileName: "tsconfig.build.json", typescriptMajor: 7 });
            } else {
                function_(tsConfig, { cwd: distribution, fileName: "tsconfig.build.json", typescriptMajor: 7 });
            }

            const buildConfigPath = join(distribution, "tsconfig.build.json");

            expect(existsSync(buildConfigPath)).toBe(true);

            const written = JSON.parse(readFileSync(buildConfigPath, "utf8")) as { compilerOptions: Record<string, unknown> };

            expect(written.compilerOptions).toStrictEqual({ strict: true, target: "esnext" });
        });
    });
});
