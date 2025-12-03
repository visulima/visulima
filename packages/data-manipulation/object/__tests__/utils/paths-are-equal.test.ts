import { describe, expect, it } from "vitest";

import pathsAreEqual from "../../src/utils/paths-are-equal";

describe("paths-are-equal", () => {
    it("should return true when paths have identical structures and values", () => {
        expect.assertions(1);

        expect(pathsAreEqual("a.b.c", "a.b.c")).toBe(true);
    });

    it("should return true when paths have different structures but matching wildcards", () => {
        expect.assertions(1);

        expect(pathsAreEqual("a.b.c", "a.*.c")).toBe(true);
    });

    it("should return false when paths have different structures and no matching wildcards", () => {
        expect.assertions(1);

        expect(pathsAreEqual("a.b.c", "a.b.d")).toBe(false);
    });

    it("should handle wildcards in the middle of the path correctly", () => {
        expect.assertions(1);

        expect(pathsAreEqual("a.b.c.d", "a.*.c.d")).toBe(true);
    });

    it("should handle wildcards at the end of the path correctly", () => {
        expect.assertions(1);

        expect(pathsAreEqual("a.b.c", "a.b.*")).toBe(true);
    });

    it("should return true when both path and wildcardPath are empty", () => {
        expect.assertions(1);

        expect(pathsAreEqual("", "")).toBe(true);
    });

    it("should return false when path has extra segments compared to wildcardPath", () => {
        expect.assertions(1);

        expect(pathsAreEqual("a.b.c.d", "a.b.c")).toBe(false);
    });

    it("should return false when wildcardPath has extra segments compared to path", () => {
        expect.assertions(1);

        expect(pathsAreEqual("a.b.c", "a.b.c.d")).toBe(false);
    });

    it("should return true when wildcardPath contains only wildcards", () => {
        expect.assertions(1);

        expect(pathsAreEqual("a.b.c", "*.*.*")).toBe(true);
    });

    it("should handle paths containing special characters correctly", () => {
        expect.assertions(12);

        expect(pathsAreEqual("a.b-c.d_e", "a.b-c.d_e")).toBe(true);
        expect(pathsAreEqual("a.b-c.d_e", "a.*.d_e")).toBe(true);
        expect(pathsAreEqual("a.b-c.d_e", "a.b-c.*")).toBe(true);
        expect(pathsAreEqual("a.b-c.d_e", "*.b-c.d_e")).toBe(true);
        expect(pathsAreEqual("a.b-c.d_e", "*.b-c.*")).toBe(true);
        expect(pathsAreEqual("a.b-c.d_e", "*.*.*")).toBe(true);
        expect(pathsAreEqual("a.b-c.d_e", "a.*.*")).toBe(true);
        expect(pathsAreEqual("a.b-c.d_e", "*.*.d_e")).toBe(true);
        expect(pathsAreEqual("a.b-c.d_e", "*.*.d_f")).toBe(false);
        expect(pathsAreEqual("a.b-c.d_e", "a.b_c.d_e")).toBe(false);
        expect(pathsAreEqual("a.b-c.d_e", "a.b-c.d-f")).toBe(false);
        expect(pathsAreEqual("a.b-c.d_e", "a.b.c")).toBe(false);
    });
});
