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

    it("applies the v7 delta on top of v6 — module flips es2022 ⇒ esnext", () => {
        expect.assertions(4);

        const compilerOptions: TsConfigJson.CompilerOptions = {};

        applyVersionDefaults(compilerOptions, "7.0.0");

        // v6 derives module=es2022; v7 overrides it to esnext and adds
        // stableTypeOrdering, while inheriting the rest of the 6.0 defaults.
        expect(compilerOptions.module).toBe("esnext");
        expect((compilerOptions as { stableTypeOrdering?: boolean }).stableTypeOrdering).toBe(true);
        expect(compilerOptions.target).toBe("es2025");
        expect(compilerOptions.strict).toBe(true);
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

    it.each([
        ["6.0.0", "nodenext", { module: "nodenext", moduleResolution: "nodenext", target: "esnext" }],
        ["6.0.0", "node16", { module: "node16", moduleResolution: "node16", target: "es2022" }],
        ["7.0.0", "nodenext", { module: "nodenext", moduleResolution: "nodenext", target: "esnext" }],
        ["7.0.0", "node16", { module: "node16", moduleResolution: "node16", target: "es2022" }],
    ])("derives moduleResolution/target from a user-set node-style module at TS %s (module: %s)", (version, module, expected) => {
        expect.assertions(3);

        const compilerOptions: TsConfigJson.CompilerOptions = { module: module as TsConfigJson.CompilerOptions.Module };

        applyVersionDefaults(compilerOptions, version);

        // Node-style modules pin moduleResolution/target to what tsc derives —
        // never the es2025 + bundler combo tsc rejects (TS5095).
        expect(compilerOptions.module).toBe(expected.module);
        expect(compilerOptions.moduleResolution).toBe(expected.moduleResolution);
        expect(compilerOptions.target).toBe(expected.target);
    });

    it.each([["6.0.0"], ["7.0.0"]])("derives module/target from a user-set node-style moduleResolution at TS %s", (version) => {
        expect.assertions(3);

        const compilerOptions: TsConfigJson.CompilerOptions = { moduleResolution: "nodenext" };

        applyVersionDefaults(compilerOptions, version);

        // The mirror case: a user-set nodenext resolution implies module=nodenext
        // (not the default es2022/esnext) and target=esnext.
        expect(compilerOptions.moduleResolution).toBe("nodenext");
        expect(compilerOptions.module).toBe("nodenext");
        expect(compilerOptions.target).toBe("esnext");
    });

    it("no-ops on unparseable version strings", () => {
        expect.assertions(1);

        const compilerOptions: TsConfigJson.CompilerOptions = {};

        applyVersionDefaults(compilerOptions, "not-a-version");

        expect(compilerOptions).toStrictEqual({});
    });
});
