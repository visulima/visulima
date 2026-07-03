/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig`
 *
 * MIT License
 * Copyright (c) Hiroki Osame &lt;hiroki.osame@gmail.com>
 */
import type { TsConfigJson } from "type-fest";
import { describe, expect, it } from "vitest";

import { applyV6Defaults } from "../../../src/version-defaults/v6";

const apply = (compilerOptions: TsConfigJson.CompilerOptions): TsConfigJson.CompilerOptions => {
    const userSet = new Set(Object.keys(compilerOptions));

    applyV6Defaults(compilerOptions, userSet);

    return compilerOptions;
};

describe(applyV6Defaults, () => {
    it("applies all v6 unconditional defaults on empty input", () => {
        expect.assertions(1);

        expect(apply({})).toStrictEqual({
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

    it("preserves user-set strict=false (does not flip to true)", () => {
        expect.assertions(1);

        const result = apply({ strict: false });

        expect(result.strict).toBe(false);
    });

    it("alwaysStrict defaults to true even when strict is explicitly false (decoupled in v6)", () => {
        expect.assertions(1);

        const result = apply({ strict: false });

        expect(result.alwaysStrict).toBe(true);
    });

    it("preserves user-set target", () => {
        expect.assertions(1);

        const result = apply({ target: "es2020" });

        expect(result.target).toBe("es2020");
    });

    it("preserves user-set module", () => {
        expect.assertions(1);

        const result = apply({ module: "nodenext" });

        expect(result.module).toBe("nodenext");
    });

    it("preserves user-set rootDir", () => {
        expect.assertions(1);

        const result = apply({ rootDir: "src" });

        expect(result.rootDir).toBe("src");
    });

    it("preserves user-set types", () => {
        expect.assertions(1);

        const result = apply({ types: ["node"] });

        expect(result.types).toStrictEqual(["node"]);
    });

    it("preserves user-set libReplacement", () => {
        expect.assertions(1);

        const result = apply({ libReplacement: true });

        expect(result.libReplacement).toBe(true);
    });
});
