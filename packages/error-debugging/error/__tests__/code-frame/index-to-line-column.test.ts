import { describe, expect, it } from "vitest";

import indexToLineColumn from "../../src/code-frame/index-to-line-column";

describe("indexToPosition", () => {
    it("should return an object with line and column properties", () => {
        expect.assertions(1);

        const result = indexToLineColumn("Hello\nWorld", 6);

        expect(result).toStrictEqual({ column: 1, line: 2 });
    });

    it("should return {line: 1, column: 1} for textIndex = 0", () => {
        expect.assertions(1);

        const result = indexToLineColumn("Hello\nWorld", 0);

        expect(result).toStrictEqual({ column: 1, line: 1 });
    });

    it("should return {line: 0, column: 0} for empty text and textIndex = 0", () => {
        expect.assertions(1);

        const result = indexToLineColumn("", 0);

        expect(result).toStrictEqual({ column: 0, line: 0 });
    });

    it("should return {line: 0, column: 1} for textIndex < 0", () => {
        expect.assertions(1);

        const result = indexToLineColumn("Hello\nWorld", -1);

        expect(result).toStrictEqual({ column: 0, line: 1 });
    });

    it("should handle wrong input", () => {
        expect.assertions(8);

        // @ts-expect-error - Testing wrong input
        expect(indexToLineColumn()).toStrictEqual({ column: 0, line: 0 });
        // @ts-expect-error - Testing wrong input
        expect(indexToLineColumn(1)).toStrictEqual({ column: 0, line: 0 });
        // @ts-expect-error - Testing wrong input
        expect(indexToLineColumn("")).toStrictEqual({ column: 0, line: 0 });
        expect(indexToLineColumn("", null)).toStrictEqual({ column: 0, line: 0 });
        // @ts-expect-error - Testing wrong input
        expect(indexToLineColumn("a")).toStrictEqual({ column: 0, line: 0 });
        expect(indexToLineColumn("a", null)).toStrictEqual({ column: 0, line: 0 });
        expect(indexToLineColumn("a", 1)).toStrictEqual({ column: 0, line: 0 });
        expect(indexToLineColumn("a", 99)).toStrictEqual({ column: 0, line: 0 });
    });

    it.each([
        [
            0,
            {
                column: 1,
                line: 1,
            },
        ],
        [
            1,
            {
                column: 2,
                line: 1,
            },
        ],
        [
            2,
            {
                column: 3,
                line: 1,
            },
        ],
        [
            3, // that's \n - it sits on the same line
            {
                column: 4,
                line: 1,
            },
        ],
        [
            4,
            {
                column: 1,
                line: 2,
            },
        ],
        [
            5,
            {
                column: 2,
                line: 2,
            },
        ],
        [
            6,
            {
                column: 3,
                line: 2,
            },
        ],
        [
            7, // the \r\n's frontal "\r" sits on the same line #2
            {
                column: 4,
                line: 2,
            },
        ],
        [
            8, // its \n also sits on the same line #2
            {
                column: 5,
                line: 2,
            },
        ],
        [
            9,
            {
                column: 1,
                line: 3,
            },
        ],
        [
            10,
            {
                column: 2,
                line: 3,
            },
        ],
        [
            11,
            {
                column: 3,
                line: 3,
            },
        ],
        [
            12,
            {
                column: 4,
                line: 3,
            },
        ],
        [
            13,
            {
                column: 1,
                line: 4,
            },
        ],
        [
            14,
            {
                column: 2,
                line: 4,
            },
        ],
        [
            15,
            {
                column: 3,
                line: 4,
            },
        ],
    ])("should handle all possible line endings", (position, expected) => {
        expect.assertions(1);

        const result = indexToLineColumn("abc\ndef\r\nghi\rjkl", position);

        expect(result).toStrictEqual(expected);
    });

    it("should handle `skipChecks` option", () => {
        expect.assertions(1);

        const result = indexToLineColumn("abc\ndef\r\nghi\rjkl", 5, { skipChecks: true });

        expect(result).toStrictEqual({
            column: 2,
            line: 2,
        });
    });
});
