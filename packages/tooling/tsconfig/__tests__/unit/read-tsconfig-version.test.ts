import { rm } from "node:fs/promises";

import { writeJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readTsConfig } from "../../src/read-tsconfig";

describe("readTsConfig with typescriptVersion option", () => {
    let directory: string;

    beforeEach(() => {
        directory = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(directory, { recursive: true });
    });

    it("does not apply unconditional defaults when typescriptVersion is omitted", () => {
        expect.assertions(1);

        writeJsonSync(join(directory, "tsconfig.json"), {});

        const parsed = readTsConfig(join(directory, "tsconfig.json"));

        expect(parsed).toStrictEqual({ compilerOptions: {} });
    });

    it("does not apply unconditional defaults when typescriptVersion=false", () => {
        expect.assertions(1);

        writeJsonSync(join(directory, "tsconfig.json"), {});

        const parsed = readTsConfig(join(directory, "tsconfig.json"), { typescriptVersion: false });

        expect(parsed).toStrictEqual({ compilerOptions: {} });
    });

    it("applies v6 unconditional defaults when typescriptVersion=6.0.0", () => {
        expect.assertions(1);

        writeJsonSync(join(directory, "tsconfig.json"), {});

        const parsed = readTsConfig(join(directory, "tsconfig.json"), { typescriptVersion: "6.0.0" });

        expect(parsed.compilerOptions).toMatchObject({
            alwaysStrict: true,
            libReplacement: false,
            module: "es2022",
            moduleResolution: "bundler",
            noUncheckedSideEffectImports: true,
            rootDir: ".",
            strict: true,
            target: "es2025",
            types: [],
        });
    });

    it("applies v5 unconditional defaults when typescriptVersion=5.4.0", () => {
        expect.assertions(1);

        writeJsonSync(join(directory, "tsconfig.json"), {});

        const parsed = readTsConfig(join(directory, "tsconfig.json"), { typescriptVersion: "5.4.0" });

        expect(parsed.compilerOptions?.target).toBe("es5");
    });

    it("applies v7 unconditional defaults when typescriptVersion=7.0.0", () => {
        expect.assertions(1);

        writeJsonSync(join(directory, "tsconfig.json"), {});

        const parsed = readTsConfig(join(directory, "tsconfig.json"), { typescriptVersion: "7.0.0" });

        expect(parsed.compilerOptions).toMatchObject({
            alwaysStrict: true,
            libReplacement: false,
            module: "esnext",
            moduleResolution: "bundler",
            noUncheckedSideEffectImports: true,
            rootDir: ".",
            stableTypeOrdering: true,
            strict: true,
            target: "es2025",
            types: [],
        });
    });

    it("auto-detects from sibling node_modules/typescript/package.json", () => {
        expect.assertions(1);

        writeJsonSync(join(directory, "tsconfig.json"), {});
        writeJsonSync(join(directory, "node_modules", "typescript", "package.json"), { name: "typescript", version: "6.0.0" });

        const parsed = readTsConfig(join(directory, "tsconfig.json"), { typescriptVersion: "auto" });

        expect(parsed.compilerOptions?.target).toBe("es2025");
    });

    it("preserves user-set fields when typescriptVersion is set", () => {
        expect.assertions(2);

        writeJsonSync(join(directory, "tsconfig.json"), {
            compilerOptions: {
                strict: false,
                target: "es2020",
            },
        });

        const parsed = readTsConfig(join(directory, "tsconfig.json"), { typescriptVersion: "6.0.0" });

        expect(parsed.compilerOptions?.strict).toBe(false);
        expect(parsed.compilerOptions?.target).toBe("es2020");
    });

    it("alwaysStrict defaults to true even when strict=false (v6 decoupling)", () => {
        expect.assertions(1);

        writeJsonSync(join(directory, "tsconfig.json"), {
            compilerOptions: {
                strict: false,
            },
        });

        const parsed = readTsConfig(join(directory, "tsconfig.json"), { typescriptVersion: "6.0.0" });

        expect(parsed.compilerOptions?.alwaysStrict).toBe(true);
    });
});
