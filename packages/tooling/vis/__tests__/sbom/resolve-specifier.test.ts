import { describe, expect, it } from "vitest";

import type { VersionIndex } from "../../src/sbom/resolve-specifier";
import { resolveSpecifier } from "../../src/sbom/resolve-specifier";

const buildIndex = (entries: [string, string[]][]): VersionIndex => {
    const index = new Map<string, Set<string>>();

    for (const [name, versions] of entries) {
        index.set(name, new Set(versions));
    }

    return index;
};

describe(resolveSpecifier, () => {
    it("should return the exact version when the specifier equals one already in the index", () => {
        expect.assertions(1);

        const index = buildIndex([["foo", ["1.2.3", "1.0.0"]]]);

        expect(resolveSpecifier("foo", "1.2.3", index)).toBe("1.2.3");
    });

    it("should pick the highest-satisfying version for a caret range", () => {
        expect.assertions(1);

        const index = buildIndex([["foo", ["1.0.0", "1.2.0", "2.0.0"]]]);

        expect(resolveSpecifier("foo", "^1.0.0", index)).toBe("1.2.0");
    });

    it("should honour prerelease versions when they are the only candidates", () => {
        expect.assertions(1);

        const index = buildIndex([["foo", ["2.0.0-beta.1"]]]);

        expect(resolveSpecifier("foo", "2.0.0-beta.1", index)).toBe("2.0.0-beta.1");
    });

    it("should return undefined when the name isn't in the index at all", () => {
        expect.assertions(1);

        expect(resolveSpecifier("ghost", "^1.0.0", buildIndex([]))).toBeUndefined();
    });

    it("should fall back to the first known version when the specifier is non-semver (e.g. workspace)", () => {
        expect.assertions(1);

        const index = buildIndex([["foo", ["1.0.0"]]]);

        // `workspace:^` doesn't satisfy any range, but we know foo@1.0.0 exists,
        // so the edge still lands somewhere rather than being dropped.
        expect(resolveSpecifier("foo", "workspace:^", index)).toBe("1.0.0");
    });

    it("should strip Yarn Berry's `npm:` protocol prefix before semver matching", () => {
        expect.assertions(2);

        const index = buildIndex([["foo", ["1.0.0", "2.0.0"]]]);

        expect(resolveSpecifier("foo", "npm:^1.0.0", index)).toBe("1.0.0");
        expect(resolveSpecifier("foo", "npm:2.0.0", index)).toBe("2.0.0");
    });
});
