/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig`
 *
 * MIT License
 * Copyright (c) Hiroki Osame &lt;hiroki.osame@gmail.com>
 */
import type { TsConfigJson } from "type-fest";
import { describe, expect, it } from "vitest";

import { applyV5Defaults } from "../../../src/version-defaults/v5";

const apply = (compilerOptions: TsConfigJson.CompilerOptions): TsConfigJson.CompilerOptions => {
    const userSet = new Set(Object.keys(compilerOptions));

    applyV5Defaults(compilerOptions, userSet);

    return compilerOptions;
};

describe(applyV5Defaults, () => {
    it("sets target to es5 when not user-set and module does not dictate target", () => {
        expect.assertions(1);

        expect(apply({})).toStrictEqual({ target: "es5" });
    });

    it("preserves user-set target", () => {
        expect.assertions(1);

        expect(apply({ target: "es2020" })).toStrictEqual({ target: "es2020" });
    });

    it("does not set target when module=node16", () => {
        expect.assertions(1);

        expect(apply({ module: "node16" })).toStrictEqual({ module: "node16" });
    });

    it("does not set target when module=nodenext", () => {
        expect.assertions(1);

        expect(apply({ module: "nodenext" })).toStrictEqual({ module: "nodenext" });
    });
});
