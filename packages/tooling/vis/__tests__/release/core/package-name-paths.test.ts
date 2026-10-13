import { describe, expect, it } from "vitest";

import { isValidPackageName } from "../../../src/release/core/security";

/**
 * Path-like names (Go module paths, Composer `vendor/package`) are valid package
 * names. Traversal, empty segments and shell characters are still rejected.
 */
describe("isValidPackageName path-like names", () => {
    it("accepts Go module paths and Composer vendor/package names", () => {
        expect.hasAssertions();

        expect(isValidPackageName("github.com/visulima/vis-go")).toBe(true);
        expect(isValidPackageName("visulima/cerebro")).toBe(true);
        expect(isValidPackageName("@scope/a/b")).toBe(true);
    });

    it("still rejects traversal, empty segments and shell characters", () => {
        expect.hasAssertions();

        expect(isValidPackageName("../etc")).toBe(false);
        expect(isValidPackageName("a//b")).toBe(false);
        expect(isValidPackageName("a/b;rm")).toBe(false);
        expect(isValidPackageName("a/")).toBe(false);
    });
});
