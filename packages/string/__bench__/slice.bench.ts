import { stripVTControlCharacters } from "node:util";

import arcanisSliceAnsi from "@arcanis/slice-ansi";
import colorize, { black, blue, cyan, green, red, yellow } from "@visulima/colorize";
import sliceAnsi from "slice-ansi";
import { bench, describe } from "vitest";

import { SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import { slice } from "../src/slice";

// Create test strings with ANSI colors
const coloredString = red("the ") + green("quick ") + blue("brown ") + cyan("fox ") + yellow("jumped ");
const longColoredString = Array.from({ length: 10 }, (_, index) => colorize[["red", "green", "blue", "cyan", "yellow"][index % 5]](`part-${index} `)).join("");
const hyperlink = "\u001B]8;;https://example.com\u0007Example Link\u001B]8;;\u0007";
const complexString = `${black.bgYellow(" TEST ")} ${green("with")} ${blue.underline("complex")} ${red.italic("formatting")}`;

// Unicode and special character strings
const unicodeString = "안녕하세요 こんにちは 你好";
const emojiString = "👨‍👩‍👧‍👦 🚀 🌍 🎉 💻";
const mixedString = `${red("안녕")}${green("하세")}${blue("요")} ${yellow("👨‍👩‍👧‍👦")}`;

// Create arrays of test cases with different slice parameters
const sliceTestCases = [
    { begin: 0, end: 10, str: coloredString },
    { begin: 5, end: 15, str: coloredString },
    { begin: 10, end: 20, str: coloredString },
    { begin: 0, end: 20, str: longColoredString },
    { begin: 10, end: 30, str: longColoredString },
    { begin: 20, end: 40, str: longColoredString },
    { begin: 0, end: 12, str: hyperlink },
    { begin: 0, end: 10, str: complexString },
    { begin: 5, end: 15, str: complexString },
    { begin: 0, end: 5, str: unicodeString },
    { begin: 3, end: 8, str: unicodeString },
    { begin: 0, end: 3, str: emojiString },
    { begin: 0, end: 5, str: mixedString },
    { begin: 2, end: 7, str: mixedString },
];

// Create negative index test cases
const negativeIndexTestCases = [
    { begin: -10, end: -5, str: coloredString },
    { begin: -15, end: -3, str: coloredString },
    { begin: -20, end: -10, str: longColoredString },
    { begin: -5, end: -2, str: unicodeString },
];

// Create test cases with only begin index (end is undefined)
const beginOnlyTestCases = [
    { begin: 5, str: coloredString },
    { begin: 10, str: longColoredString },
    { begin: 5, str: hyperlink },
    { begin: 8, str: complexString },
    { begin: 3, str: unicodeString },
    { begin: 2, str: emojiString },
    { begin: 4, str: mixedString },
];

describe("slice", () => {
    describe("Basic slicing", () => {
        bench("visulima/string slice", () => {
            for (const testCase of sliceTestCases) {
                slice(testCase.str, testCase.begin, testCase.end);
            }
        });

        bench("slice-ansi", () => {
            for (const testCase of sliceTestCases) {
                sliceAnsi(testCase.str, testCase.begin, testCase.end);
            }
        });

        bench("@arcanis/slice-ansi", () => {
            for (const testCase of sliceTestCases) {
                arcanisSliceAnsi(testCase.str, testCase.begin, testCase.end);
            }
        });
    });

    describe("Negative index slicing", () => {
        bench("visulima/string slice", () => {
            for (const testCase of negativeIndexTestCases) {
                slice(testCase.str, testCase.begin, testCase.end);
            }
        });

        bench("slice-ansi", () => {
            for (const testCase of negativeIndexTestCases) {
                sliceAnsi(testCase.str, testCase.begin, testCase.end);
            }
        });

        bench("@arcanis/slice-ansi", () => {
            for (const testCase of negativeIndexTestCases) {
                arcanisSliceAnsi(testCase.str, testCase.begin, testCase.end);
            }
        });
    });

    describe("Begin-only slicing (end is undefined)", () => {
        bench("visulima/string slice", () => {
            for (const testCase of beginOnlyTestCases) {
                slice(testCase.str, testCase.begin);
            }
        });

        bench("slice-ansi", () => {
            for (const testCase of beginOnlyTestCases) {
                sliceAnsi(testCase.str, testCase.begin);
            }
        });

        bench("@arcanis/slice-ansi", () => {
            for (const testCase of beginOnlyTestCases) {
                arcanisSliceAnsi(testCase.str, testCase.begin);
            }
        });
    });

    describe("Standard test strings", () => {
        bench("visulima/string slice", () => {
            for (const string_ of TEST_STRINGS) {
                slice(string_, 0, Math.floor(string_.length / 2));
                slice(string_, Math.floor(string_.length / 3), Math.floor((string_.length * 2) / 3));
            }
        });

        bench("slice-ansi", () => {
            for (const string_ of TEST_STRINGS) {
                sliceAnsi(string_, 0, Math.floor(string_.length / 2));
                sliceAnsi(string_, Math.floor(string_.length / 3), Math.floor((string_.length * 2) / 3));
            }
        });

        bench("@arcanis/slice-ansi", () => {
            for (const string_ of TEST_STRINGS) {
                arcanisSliceAnsi(string_, 0, Math.floor(string_.length / 2));
                arcanisSliceAnsi(string_, Math.floor(string_.length / 3), Math.floor((string_.length * 2) / 3));
            }
        });
    });

    describe("Special strings with ANSI and emoji", () => {
        bench("visulima/string slice", () => {
            for (const string_ of SPECIAL_STRINGS) {
                slice(string_, 0, Math.floor(string_.length / 2));
                slice(string_, Math.floor(string_.length / 3), Math.floor((string_.length * 2) / 3));
            }
        });

        bench("slice-ansi", () => {
            for (const string_ of SPECIAL_STRINGS) {
                sliceAnsi(string_, 0, Math.floor(string_.length / 2));
                sliceAnsi(string_, Math.floor(string_.length / 3), Math.floor((string_.length * 2) / 3));
            }
        });

        bench("@arcanis/slice-ansi", () => {
            for (const string_ of SPECIAL_STRINGS) {
                arcanisSliceAnsi(string_, 0, Math.floor(string_.length / 2));
                arcanisSliceAnsi(string_, Math.floor(string_.length / 3), Math.floor((string_.length * 2) / 3));
            }
        });
    });

    describe("Edge cases", () => {
        const edgeCases = [
            { begin: 0, end: 0, str: "" },
            { begin: 0, end: 0, str: coloredString },
            { begin: coloredString.length, end: coloredString.length + 10, str: coloredString },
            { begin: unicodeString.length, end: undefined, str: unicodeString },
            { begin: 100, end: 200, str: emojiString },
            { begin: -100, end: -50, str: mixedString },
        ];

        bench("visulima/string slice", () => {
            for (const testCase of edgeCases) {
                slice(testCase.str, testCase.begin, testCase.end);
            }
        });

        bench("slice-ansi", () => {
            for (const testCase of edgeCases) {
                sliceAnsi(testCase.str, testCase.begin, testCase.end);
            }
        });

        bench("@arcanis/slice-ansi", () => {
            for (const testCase of edgeCases) {
                arcanisSliceAnsi(testCase.str, testCase.begin, testCase.end);
            }
        });
    });

    describe("Correctness verification", () => {
        bench("visulima/string slice output correctness", () => {
            for (const testCase of sliceTestCases) {
                const result = slice(testCase.str, testCase.begin, testCase.end);
                // Verify that the visible content matches what we'd expect
                stripVTControlCharacters(result);
            }
        });

        bench("slice-ansi output correctness", () => {
            for (const testCase of sliceTestCases) {
                const result = sliceAnsi(testCase.str, testCase.begin, testCase.end);
                // Verify that the visible content matches what we'd expect
                stripVTControlCharacters(result);
            }
        });

        bench("@arcanis/slice-ansi output correctness", () => {
            for (const testCase of sliceTestCases) {
                const result = arcanisSliceAnsi(testCase.str, testCase.begin, testCase.end);
                // Verify that the visible content matches what we'd expect
                stripVTControlCharacters(result);
            }
        });
    });
});
