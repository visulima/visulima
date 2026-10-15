import { describe, expect, it } from "vitest";

import {
    concat,
    copy,
    endsWith,
    equals,
    includesNeedle,
    indexOfNeedle,
    lastIndexOfNeedle,
    repeat,
    startsWith,
} from "../../src/index";

// Curated from the @std/bytes 1.0.6 suite (MIT, Copyright the Deno authors).

describe(concat, () => {
    it("joins arrays in order", () => {
        expect.hasAssertions();

        expect(concat([new Uint8Array([0, 1]), new Uint8Array([2]), new Uint8Array([3, 4])])).toStrictEqual(new Uint8Array([0, 1, 2, 3, 4]));
    });

    it("returns an empty array for no input", () => {
        expect.hasAssertions();

        expect(concat([])).toStrictEqual(new Uint8Array(0));
    });
});

describe(copy, () => {
    it("writes at the offset and returns the byte count", () => {
        expect.hasAssertions();

        const destination = new Uint8Array(4);

        expect(copy(new Uint8Array([7, 8]), destination, 1)).toBe(2);
        expect(destination).toStrictEqual(new Uint8Array([0, 7, 8, 0]));
    });

    it("truncates when the source does not fit", () => {
        expect.hasAssertions();

        const destination = new Uint8Array(2);

        expect(copy(new Uint8Array([1, 2, 3]), destination)).toBe(2);
        expect(destination).toStrictEqual(new Uint8Array([1, 2]));
    });

    it("clamps a negative or oversized offset", () => {
        expect.hasAssertions();

        const destination = new Uint8Array(2);

        expect(copy(new Uint8Array([9]), destination, -5)).toBe(1);
        expect(destination).toStrictEqual(new Uint8Array([9, 0]));
        expect(copy(new Uint8Array([9]), destination, 10)).toBe(0);
    });
});

describe(equals, () => {
    it("compares short arrays by content", () => {
        expect.hasAssertions();

        expect(equals(new Uint8Array([0, 1, 2]), new Uint8Array([0, 1, 2]))).toBe(true);
        expect(equals(new Uint8Array([0, 1, 2]), new Uint8Array([0, 1, 255]))).toBe(false);
        expect(equals(new Uint8Array([0, 1, 2]), new Uint8Array([0, 1]))).toBe(false);
    });

    it("compares long arrays through the 32-bit path", () => {
        expect.hasAssertions();

        const a = new Uint8Array(200).map((_, index) => index % 251);
        const b = new Uint8Array(a);

        expect(equals(a, b)).toBe(true);

        b[199] = 0xff;

        expect(equals(a, b)).toBe(false);
    });

    it("compares arrays with different byte offsets", () => {
        expect.hasAssertions();

        const backing = new Uint8Array(210).fill(3);
        const shifted = new Uint8Array(200).fill(3);

        expect(equals(backing.subarray(5, 205), shifted)).toBe(true);
        expect(equals(backing.subarray(6, 206), shifted)).toBe(true);
    });
});

describe(repeat, () => {
    it("repeats the sequence", () => {
        expect.hasAssertions();

        expect(repeat(new Uint8Array([1, 2]), 3)).toStrictEqual(new Uint8Array([1, 2, 1, 2, 1, 2]));
    });

    it("returns an empty array for a zero count", () => {
        expect.hasAssertions();

        expect(repeat(new Uint8Array([1]), 0)).toStrictEqual(new Uint8Array(0));
    });

    it("rejects negative and non-integer counts", () => {
        expect.hasAssertions();

        expect(() => repeat(new Uint8Array([1]), -1)).toThrow(RangeError);
        expect(() => repeat(new Uint8Array([1]), 1.5)).toThrow(RangeError);
    });
});

describe("startsWith and endsWith", () => {
    const source = new Uint8Array([0, 1, 2, 3]);

    it("matches a prefix and a suffix", () => {
        expect.hasAssertions();

        expect(startsWith(source, new Uint8Array([0, 1]))).toBe(true);
        expect(startsWith(source, new Uint8Array([1]))).toBe(false);
        expect(endsWith(source, new Uint8Array([2, 3]))).toBe(true);
        expect(endsWith(source, new Uint8Array([3, 2]))).toBe(false);
    });

    it("returns false when the pattern is longer than the source", () => {
        expect.hasAssertions();

        expect(startsWith(source, new Uint8Array(5))).toBe(false);
        expect(endsWith(source, new Uint8Array(5))).toBe(false);
    });
});

describe("indexOfNeedle, lastIndexOfNeedle and includesNeedle", () => {
    const source = new Uint8Array([1, 2, 1, 2, 3]);
    const needle = new Uint8Array([1, 2]);

    it("finds the first and last occurrence", () => {
        expect.hasAssertions();

        expect(indexOfNeedle(source, needle)).toBe(0);
        expect(lastIndexOfNeedle(source, needle)).toBe(2);
        expect(indexOfNeedle(source, new Uint8Array([9]))).toBe(-1);
        expect(lastIndexOfNeedle(source, new Uint8Array([9]))).toBe(-1);
    });

    it("honours a start index", () => {
        expect.hasAssertions();

        expect(indexOfNeedle(source, needle, 1)).toBe(2);
        expect(indexOfNeedle(source, needle, -2)).toBe(-1);
        expect(lastIndexOfNeedle(source, needle, 1)).toBe(0);
    });

    it("reports whether the needle is present", () => {
        expect.hasAssertions();

        expect(includesNeedle(source, needle)).toBe(true);
        expect(includesNeedle(source, needle, 3)).toBe(false);
    });
});
