/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig`
 *
 * MIT License
 * Copyright (c) Hiroki Osame &lt;hiroki.osame@gmail.com>
 */
import type { TsConfigJson } from "type-fest";
import { describe, expect, it } from "vitest";

import { applyV7Defaults } from "../../../src/version-defaults/v7";

const apply = (compilerOptions: TsConfigJson.CompilerOptions): TsConfigJson.CompilerOptions => {
    const userSet = new Set(Object.keys(compilerOptions));

    applyV7Defaults(compilerOptions, userSet);

    return compilerOptions;
};

describe(applyV7Defaults, () => {
    it("applies the v7 delta over v6 on empty input", () => {
        expect.assertions(1);

        // v7 only changes `module` (es2022 ⇒ esnext) and adds `stableTypeOrdering`;
        // the remaining 6.0 defaults are contributed by the cumulative v6 pass.
        expect(apply({})).toStrictEqual({
            module: "esnext",
            moduleResolution: "bundler",
            stableTypeOrdering: true,
        });
    });

    it("preserves user-set module (does not flip to esnext)", () => {
        expect.assertions(1);

        const result = apply({ module: "nodenext" });

        expect(result.module).toBe("nodenext");
    });

    it("preserves user-set moduleResolution", () => {
        expect.assertions(1);

        const result = apply({ moduleResolution: "node16" });

        expect(result.moduleResolution).toBe("node16");
    });

    it("preserves user-set stableTypeOrdering=false", () => {
        expect.assertions(1);

        const result = apply({ stableTypeOrdering: false });

        expect(result.stableTypeOrdering).toBe(false);
    });
});
