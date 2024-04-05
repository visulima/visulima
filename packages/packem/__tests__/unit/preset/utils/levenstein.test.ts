import { describe, expect, it } from "vitest";

import findAlternatives from "../../../../src/utils/levenstein";

describe("findAlternatives", () => {
    it("should return an array of similar strings when input string has similar strings in the input array", () => {
        expect.assertions(1);

        const string = "papple";
        const array = ["banana", "orange", "pineapple", "grape"];

        const result = findAlternatives(string, array);

        expect(result).toStrictEqual(["pineapple"]);
    });

    it("should return an empty array when no similar strings are found in the input array", () => {
        expect.assertions(1);

        const string = "apple";
        const array = ["banana", "orange", "grape"];
        const expected = [];

        const result = findAlternatives(string, array);

        expect(result).toStrictEqual(expected);
    });

    it("should perform a case-insensitive search for similar strings", () => {
        expect.assertions(1);

        const string = "papple";
        const array = ["Banana", "Orange", "Pineapple", "Grape"];
        const expected = ["Pineapple"];

        const result = findAlternatives(string, array);

        expect(result).toStrictEqual(expected);
    });

    it("should return an empty array when the input array is empty", () => {
        expect.assertions(1);

        const string = "apple";
        const array = [];
        const expected = [];

        const result = findAlternatives(string, array);

        expect(result).toStrictEqual(expected);
    });

    it("should return an empty array when the input string is empty", () => {
        expect.assertions(1);

        const string = "";
        const array = ["banana", "orange", "pineapple", "grape"];
        const expected = [];

        const result = findAlternatives(string, array);

        expect(result).toStrictEqual(expected);
    });

    it("should return an empty array when the input string contains only whitespace characters", () => {
        expect.assertions(1);

        const string = "   ";
        const array = ["banana", "orange", "pineapple", "grape"];
        const expected = [];

        const result = findAlternatives(string, array);

        expect(result).toStrictEqual(expected);
    });
});
