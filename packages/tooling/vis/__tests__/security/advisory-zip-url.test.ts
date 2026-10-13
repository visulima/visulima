import { describe, expect, it } from "vitest";

import { advisoryZipUrl } from "../../src/security/advisories";

/**
 * A crafted ecosystem name must not change where the advisory zip is fetched from.
 */
describe(advisoryZipUrl, () => {
    const source = new URL("https://osv-vulnerabilities.storage.googleapis.com/");

    it("resolves real OSV ecosystem names under the source", () => {
        expect.hasAssertions();

        expect(advisoryZipUrl(source, "npm").toString()).toBe("https://osv-vulnerabilities.storage.googleapis.com/npm/all.zip");
        expect(advisoryZipUrl(source, "crates.io").toString()).toBe("https://osv-vulnerabilities.storage.googleapis.com/crates.io/all.zip");
        expect(advisoryZipUrl(source, "Go").toString()).toBe("https://osv-vulnerabilities.storage.googleapis.com/Go/all.zip");
    });

    it("refuses traversal, separators and empty names", () => {
        expect.hasAssertions();

        for (const name of ["../npm", "npm/../../x", "a/b", String.raw`a\b`, "", ".hidden", "x y"]) {
            expect(() => advisoryZipUrl(source, name), name).toThrow(/not a valid OSV name/);
        }
    });

    it("keeps the path prefix of a source that has one", () => {
        expect.hasAssertions();

        const prefixed = new URL("https://mirror.example.test/osv/");

        expect(advisoryZipUrl(prefixed, "npm").toString()).toBe("https://mirror.example.test/osv/npm/all.zip");
    });
});
