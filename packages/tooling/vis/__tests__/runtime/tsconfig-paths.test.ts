import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { resolveTsConfigPaths } from "../../src/runtime/ts-loader";

// `resolveTsConfigPaths` is a pure function (findTsConfigSync + the alias matcher)
// — no `module.registerHooks` — so it runs on any Node, unlike the load-hook
// integration test in ts-loader.test.ts which gate-skips below 22.15.
const fixtures = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__", "ts-loader");

const posix = (value: string | undefined): string | undefined => value?.replaceAll("\\", "/");

describe("resolveTsConfigPaths (canonical @visulima/tsconfig reader)", () => {
    it("resolves a wildcard alias against baseUrl", () => {
        expect.assertions(1);

        const resolved = resolveTsConfigPaths("@lib/helper", join(fixtures, "paths-alias", "src"));

        expect(posix(resolved)).toMatch(/paths-alias\/lib\/helper\.ts$/u);
    });

    it("resolves an exact alias to a data file", () => {
        expect.assertions(1);

        const resolved = resolveTsConfigPaths("@data/config", join(fixtures, "paths-alias", "src"));

        expect(posix(resolved)).toMatch(/paths-alias\/lib\/config\.yaml$/u);
    });

    it("resolves a paths alias inherited through `extends` (the canonical-reader win)", () => {
        expect.assertions(1);

        const resolved = resolveTsConfigPaths("@base/util", join(fixtures, "paths-extends", "src"));

        expect(posix(resolved)).toMatch(/paths-extends\/src\/util\.ts$/u);
    });

    it("returns undefined for a non-aliased bare specifier (lets node_modules fall through)", () => {
        expect.assertions(1);

        expect(resolveTsConfigPaths("react", join(fixtures, "paths-alias", "src"))).toBeUndefined();
    });
});
