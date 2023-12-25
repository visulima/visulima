import { describe, expect, it } from "vitest";

import arrayify from "../../src/util/arrayify";

describe("arrayify", () => {
    it("should return an empty array when input is undefined", () => {
        expect(arrayify(undefined)).toEqual([]);
    });

    it("should return an array with one element when input is not an array", () => {
        expect(arrayify(5)).toEqual([5]);
        expect(arrayify("hello")).toEqual(["hello"]);
        expect(arrayify(true)).toEqual([true]);
        expect(arrayify(null)).toEqual([null]);
    });

    it("should return the same array when input is already an array", () => {
        const arr = [1, 2, 3];

        expect(arrayify(arr)).toBe(arr);
    });

    it("should return an null array when input is null", () => {
        expect(arrayify(null)).toEqual([null]);
    });

    it("should return an array with multiple elements when input is a tuple", () => {
        const tuple = [1, "hello", true];

        expect(arrayify(tuple)).toEqual([1, "hello", true]);
    });

    it("should return an array with one element when input is a string", () => {
        expect(arrayify("hello")).toEqual(["hello"]);
    });
});
