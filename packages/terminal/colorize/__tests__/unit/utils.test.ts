import { describe, expect, it } from "vitest";

import { clamp } from "../../src/util/clamp";
import { stringReplaceAll } from "../../src/util/string-replace-all";

describe("utils tests", () => {
    it(`clamp(3, 0, 2)`, () => {
        expect.assertions(1);

        const received = clamp(3, 0, 2);
        const expected = 2;

        expect(received).toStrictEqual(expected);
    });

    it(`clamp(0, 1, 2)`, () => {
        expect.assertions(1);

        const received = clamp(0, 1, 2);
        const expected = 1;

        expect(received).toStrictEqual(expected);
    });

    it("should replace all occurrences when search value is found multiple times", () => {
        expect.assertions(1);

        const string_ = "hello world hello";
        const searchValue = "hello";
        const replaceValue = "hi";
        const expected = "hi world hi";

        const result = stringReplaceAll(string_, searchValue, replaceValue);

        expect(result).toStrictEqual(expected);
    });

    it("should return the original string when search value is an empty string", () => {
        expect.assertions(1);

        const string_ = "hello world";
        const searchValue = "";
        const replaceValue = "hi";
        const expected = "hello world";

        const result = stringReplaceAll(string_, searchValue, replaceValue);

        expect(result).toStrictEqual(expected);
    });

    it("should return the original string when search value is not found", () => {
        expect.assertions(1);

        const string_ = "hello world";
        const searchValue = "hi";
        const replaceValue = "hey";
        const expected = "hello world";

        const result = stringReplaceAll(string_, searchValue, replaceValue);

        expect(result).toStrictEqual(expected);
    });

    it("should handle a search value longer than the string", () => {
        expect.assertions(1);

        const string_ = "hello";
        const searchValue = "hello world";
        const replaceValue = "hi";
        const expected = "hello";

        const result = stringReplaceAll(string_, searchValue, replaceValue);

        expect(result).toStrictEqual(expected);
    });

    it("should handle a replace value longer than the search value", () => {
        expect.assertions(1);

        const string_ = "hello world";
        const searchValue = "world";
        const replaceValue = "hello there";
        const expected = "hello hello there";

        const result = stringReplaceAll(string_, searchValue, replaceValue);

        expect(result).toStrictEqual(expected);
    });

    it("should handle a search value that overlaps with the replace value", () => {
        expect.assertions(1);

        const string_ = "hello world";
        const searchValue = "world";
        const replaceValue = "worldwide";
        const expected = "hello worldwide";

        const result = stringReplaceAll(string_, searchValue, replaceValue);

        expect(result).toStrictEqual(expected);
    });
});
