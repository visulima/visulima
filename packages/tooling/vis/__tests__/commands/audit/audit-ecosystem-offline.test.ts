import { describe, expect, it } from "vitest";

import { nonNpmEcosystemsWithoutOffline } from "../../../src/commands/audit/handler";

/**
 * `--ecosystem cargo` run online used to skip cargo without a word. The helper
 * names the ecosystems that need `--offline`, so the handler can reject the run.
 */
describe("vis audit --ecosystem without --offline", () => {
    it("flags non-npm ecosystems online, including the cargo alias", () => {
        expect.assertions(2);

        expect(nonNpmEcosystemsWithoutOffline(["npm", "cargo", "pypi"], false)).toStrictEqual(["cargo", "pypi"]);
        expect(nonNpmEcosystemsWithoutOffline(["crates.io"], false)).toStrictEqual(["crates.io"]);
    });

    it("accepts npm online and any ecosystem offline", () => {
        expect.assertions(2);

        expect(nonNpmEcosystemsWithoutOffline(["npm"], false)).toStrictEqual([]);
        expect(nonNpmEcosystemsWithoutOffline(["npm", "cargo"], true)).toStrictEqual([]);
    });
});
