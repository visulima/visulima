import { describe, expect, it } from "vitest";

import { nonNpmEcosystemsWithoutOffline, npmRequested, offlineNonNpmEcosystems } from "../../../src/commands/audit/handler";

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

describe("vis audit offline routing", () => {
    it("matches JavaScript lockfile packages only when npm is requested", () => {
        expect.assertions(4);

        expect(npmRequested(["npm"])).toBe(true);
        // Routing npm packages under the first --ecosystem reported them as Pub or crates.io hits.
        expect(npmRequested(["pub", "npm"])).toBe(true);
        expect(npmRequested(["cargo", "npm"])).toBe(true);
        expect(npmRequested(["pub"])).toBe(false);
    });

    it("lists each non-npm lockfile ecosystem once, under its canonical name", () => {
        expect.assertions(3);

        expect(offlineNonNpmEcosystems(["npm", "dart", "pub", "cargo", "crates.io"])).toStrictEqual(["Pub", "crates.io"]);
        expect(offlineNonNpmEcosystems(["nuget", "swift", "swifturl"])).toStrictEqual(["NuGet", "SwiftURL"]);
        expect(offlineNonNpmEcosystems(["npm"])).toStrictEqual([]);
    });
});
