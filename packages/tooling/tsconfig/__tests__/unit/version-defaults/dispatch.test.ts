/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig`
 *
 * MIT License
 * Copyright (c) Hiroki Osame &lt;hiroki.osame@gmail.com>
 */
import type { TsConfigJson } from "type-fest";
import { describe, expect, it } from "vitest";

import { applyVersionDefaults } from "../../../src/version-defaults";

describe(applyVersionDefaults, () => {
    it("applies cumulative deltas in ascending major order — v6 overwrites v5's target", () => {
        expect.assertions(1);

        const compilerOptions: TsConfigJson.CompilerOptions = {};

        applyVersionDefaults(compilerOptions, "6.0.0");

        // v4 sets target=es3, v5 overwrites to es5, v6 overwrites to es2025.
        // Asserting the v6 outcome confirms cumulative dispatch is in the
        // expected order and that later majors win.
        expect(compilerOptions.target).toBe("es2025");
    });

    it("stops at the requested major — v5 does not apply v6 deltas", () => {
        expect.assertions(2);

        const compilerOptions: TsConfigJson.CompilerOptions = {};

        applyVersionDefaults(compilerOptions, "5.4.0");

        expect(compilerOptions.target).toBe("es5");
        expect(compilerOptions.strict).toBeUndefined();
    });

    it("preserves user-set fields across all majors", () => {
        expect.assertions(2);

        const compilerOptions: TsConfigJson.CompilerOptions = { target: "es2020" };

        applyVersionDefaults(compilerOptions, "6.0.0");

        // userSet snapshot is taken once before any delta runs, so neither v4,
        // v5 nor v6 may overwrite the user's explicit target.
        expect(compilerOptions.target).toBe("es2020");
        expect(compilerOptions.strict).toBe(true);
    });

    it("no-ops on unparseable version strings", () => {
        expect.assertions(1);

        const compilerOptions: TsConfigJson.CompilerOptions = {};

        applyVersionDefaults(compilerOptions, "not-a-version");

        expect(compilerOptions).toStrictEqual({});
    });
});
