import { describe, expect, it } from "vitest";

import arrayify from "../../../src/utils/arrayify";

describe(arrayify, () => {
    it("should return an empty array when input is undefined", () => {
        expect.assertions(1);

        expect(arrayify(undefined)).toStrictEqual([]);
    });

    it("should return an array with one element when input is not an array", () => {
        expect.assertions(4);

        expect(arrayify(5)).toStrictEqual([5]);
        expect(arrayify("hello")).toStrictEqual(["hello"]);
        expect(arrayify(true)).toStrictEqual([true]);
        expect(arrayify(null)).toStrictEqual([null]);
    });

    it("should return the same array when input is already an array", () => {
        expect.assertions(1);

        const array = [1, 2, 3];

        expect(arrayify(array)).toBe(array);
    });

    it("should return an null array when input is null", () => {
        expect.assertions(1);

        expect(arrayify(null)).toStrictEqual([null]);
    });

    it("should return an array with multiple elements when input is a tuple", () => {
        expect.assertions(1);

        const tuple = [1, "hello", true];

        expect(arrayify(tuple)).toStrictEqual([1, "hello", true]);
    });

    it("should return an array with one element when input is a string", () => {
        expect.assertions(1);

        expect(arrayify("hello")).toStrictEqual(["hello"]);
    });
});
