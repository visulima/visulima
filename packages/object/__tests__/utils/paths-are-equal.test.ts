import { describe, expect, it } from "vitest";

import pathsAreEqual from "../../src/utils/paths-are-equal";

describe("paths-are-equal", () => {
    // paths with identical structures and values should return true
    it("should return true when paths have identical structures and values", () => {
        expect.assertions(1);

        expect(pathsAreEqual("a.b.c", "a.b.c")).toBeTruthy();
    });

    // paths with different structures but matching wildcards should return true
    it("should return true when paths have different structures but matching wildcards", () => {
        expect.assertions(1);

        expect(pathsAreEqual("a.b.c", "a.*.c")).toBeTruthy();
    });

    // paths with different structures and no matching wildcards should return false
    it("should return false when paths have different structures and no matching wildcards", () => {
        expect.assertions(1);

        expect(pathsAreEqual("a.b.c", "a.b.d")).toBeFalsy();
    });

    // paths with wildcards in the middle should be handled correctly
    it("should handle wildcards in the middle of the path correctly", () => {
        expect.assertions(1);

        expect(pathsAreEqual("a.b.c.d", "a.*.c.d")).toBeTruthy();
    });

    // paths with wildcards at the end should be handled correctly
    it("should handle wildcards at the end of the path correctly", () => {
        expect.assertions(1);

        expect(pathsAreEqual("a.b.c", "a.b.*")).toBeTruthy();
    });

    // empty path and wildcardPath should return true
    it("should return true when both path and wildcardPath are empty", () => {
        expect.assertions(1);

        expect(pathsAreEqual("", "")).toBeTruthy();
    });

    // path with extra segments compared to wildcardPath should return false
    it("should return false when path has extra segments compared to wildcardPath", () => {
        expect.assertions(1);

        expect(pathsAreEqual("a.b.c.d", "a.b.c")).toBeFalsy();
    });

    // wildcardPath with extra segments compared to path should return false
    it("should return false when wildcardPath has extra segments compared to path", () => {
        expect.assertions(1);

        expect(pathsAreEqual("a.b.c", "a.b.c.d")).toBeFalsy();
    });

    // wildcardPath containing only wildcards should return true
    it("should return true when wildcardPath contains only wildcards", () => {
        expect.assertions(1);

        expect(pathsAreEqual("a.b.c", "*.*.*")).toBeTruthy();
    });

    // path containing special characters should be handled correctly
    it("should handle paths containing special characters correctly", () => {
        expect.assertions(1);

        expect(pathsAreEqual("a.b-c.d_e", "a.b-c.d_e")).toBeTruthy();
        expect(pathsAreEqual("a.b-c.d_e", "a.*.d_e")).toBeTruthy();
        expect(pathsAreEqual("a.b-c.d_e", "a.b-c.*")).toBeTruthy();
        expect(pathsAreEqual("a.b-c.d_e", "*.b-c.d_e")).toBeTruthy();
        expect(pathsAreEqual("a.b-c.d_e", "*.b-c.*")).toBeTruthy();
        expect(pathsAreEqual("a.b-c.d_e", "*.*.*")).toBeTruthy();
        expect(pathsAreEqual("a.b-c.d_e", "a.*.*")).toBeTruthy();
        expect(pathsAreEqual("a.b-c.d_e", "*.*.d_e")).toBeTruthy();
        expect(pathsAreEqual("a.b-c.d_e", "*.*.d_f")).toBeFalsy();
        expect(pathsAreEqual("a.b-c.d_e", "a.b_c.d_e")).toBeFalsy();
        expect(pathsAreEqual("a.b-c.d_e", "a.b-c.d-f")).toBeFalsy();
        expect(pathsAreEqual("a.b-c.d_e", "a.b.c")).toBeFalsy();
    });
});
