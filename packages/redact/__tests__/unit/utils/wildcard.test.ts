import { describe, expect, it } from "vitest";

import wildcard from "../../../src/utils/wildcard";

describe(wildcard, () => {
    it("should match exactly when no wildcard is given", () => {
        expect.assertions(1);

        const pattern = "test";
        const string = "test";

        expect(wildcard(string, pattern)).toBe(true);
    });

    it("should return false if the string doesn't match the pattern and no wildcard is given", () => {
        expect.assertions(1);

        const pattern = "test";
        const string = "testing";

        expect(wildcard(string, pattern)).toBe(false);
    });

    it("should return false if the string doesn't match the pattern and no wildcard is given, even when shorter", () => {
        expect.assertions(1);

        const pattern = "testing";
        const string = "";

        expect(wildcard(string, pattern)).toBe(false);
    });

    it("should match everything if the pattern is only wildcards", () => {
        expect.assertions(1);

        const pattern = "***";
        const string = "test";

        expect(wildcard(string, pattern)).toBe(true);
    });

    it("should match longer strings if the pattern ends with a wildcard", () => {
        expect.assertions(1);

        const pattern = "test*";
        const string = "testing";

        expect(wildcard(string, pattern)).toBe(true);
    });

    it("should match longer strings if the pattern begins with a wildcard", () => {
        expect.assertions(1);

        const pattern = "*ing";
        const string = "testing";

        expect(wildcard(string, pattern)).toBe(true);
    });

    it("should match longer strings if the pattern begins with multiple wildcards", () => {
        expect.assertions(1);

        const pattern = "***ing";
        const string = "testing";

        expect(wildcard(string, pattern)).toBe(true);
    });

    it("should match matching strings even if the pattern ends with a wildcard", () => {
        expect.assertions(1);

        const pattern = "test*";
        const string = "test";

        expect(wildcard(string, pattern)).toBe(true);
    });

    it("should match matching strings even if the pattern ends with multiple wildcards", () => {
        expect.assertions(1);

        const pattern = "test***";
        const string = "test";

        expect(wildcard(string, pattern)).toBe(true);
    });

    it("should match matching strings even if the pattern begins with a wildcard", () => {
        expect.assertions(1);

        const pattern = "*ing";
        const string = "testing";

        expect(wildcard(string, pattern)).toBe(true);
    });

    it("should not match strings that have extra characters at the end when the pattern doesn't end with a wildcard", () => {
        expect.assertions(1);

        const pattern = "*ing";
        const string = "ings";

        expect(wildcard(string, pattern)).toBe(false);
    });

    it("should not match strings that have extra characters at the beginning when the pattern doesn't begin with a wildcard", () => {
        expect.assertions(1);

        const pattern = "ing*";
        const string = "testing";

        expect(wildcard(string, pattern)).toBe(false);
    });

    it("should match strings that match the beginning and end with a wildcard in the middle", () => {
        expect.assertions(1);

        const pattern = "bow*ing";
        const string = "bowstring";

        expect(wildcard(string, pattern)).toBe(true);
    });

    it("should match matching strings even if there's a wildcard in the middle", () => {
        expect.assertions(1);

        const pattern = "test*ing";
        const string = "testing";

        expect(wildcard(string, pattern)).toBe(true);
    });

    it("should work with multiple wildcards in the middle", () => {
        expect.assertions(1);

        const pattern = "te*st*ing";
        const string = "tea string";

        expect(wildcard(string, pattern)).toBe(true);
    });

    it("should work with multiple wildcards in the middle and at the beginning", () => {
        expect.assertions(1);

        const pattern = "*test*ing";
        const string = "I'm testing";

        expect(wildcard(string, pattern)).toBe(true);
    });

    it("should work with multiple wildcards in the middle and at the end", () => {
        expect.assertions(1);

        const pattern = "te*st*ing*";
        const string = "tea stings";

        expect(wildcard(string, pattern)).toBe(true);
    });

    it("should move on if a wildcard doesn't continue to match but can later", () => {
        expect.assertions(1);

        const pattern = "*test*ing";
        const string = "I'm testing this thing";

        expect(wildcard(string, pattern)).toBe(true);
    });

    it("should handle wildcarding duplicate characters well", () => {
        expect.assertions(1);

        const pattern = "*||test*";
        const string = "|||||testing";

        expect(wildcard(string, pattern)).toBe(true);
    });

    it("should fail correctly with duplicate characters", () => {
        expect.assertions(1);

        const pattern = "*))))))*";
        const string = ")))))";

        expect(wildcard(string, pattern)).toBe(false);
    });

    it("should be able to see the same character as a wildcard", () => {
        expect.assertions(1);

        const pattern = "*zz";
        const string = "zzz";

        expect(wildcard(string, pattern)).toBe(true);
    });
});
