import { stripVTControlCharacters } from "node:util";

import { blue, bold, dim, green, inverse, italic, red, underline, yellow } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import { compareAnsiStrings, expectAnsiStrings, formatAnsiString } from "../../../src/test/utils";

describe("aNSI string test utilities", () => {
    describe(formatAnsiString, () => {
        it("should format a simple ANSI string", () => {
            expect.assertions(5);

            const redText = red("Hello");
            const formatted = formatAnsiString(redText);

            expect(formatted.stripped).toBe("Hello");
            expect(formatted.ansi).toBe(redText);
            expect(formatted.json).toBe(JSON.stringify(redText));
            expect(formatted.visible).toContain(String.raw`\u001B`);
            expect(formatted.lengthDifference).toBeGreaterThan(0);
        });

        it("should handle complex ANSI strings with multiple colors", () => {
            expect.assertions(3);

            const complexText = red("Error: ") + yellow("Something ") + green("went ") + blue("wrong!");
            const formatted = formatAnsiString(complexText);

            expect(formatted.stripped).toBe("Error: Something went wrong!");
            expect(stripVTControlCharacters(formatted.ansi)).toBe("Error: Something went wrong!");
            expect(formatted.lengthDifference).toBeGreaterThan(0);
        });

        it("should handle strings without ANSI codes", () => {
            expect.assertions(4);

            const plainText = "Hello World";
            const formatted = formatAnsiString(plainText);

            expect(formatted.stripped).toBe(plainText);
            expect(formatted.ansi).toBe(plainText);
            expect(formatted.lengthDifference).toBe(0);
            expect(formatted.json).toBe(JSON.stringify(plainText));
        });

        it("should handle nested and combined styling", () => {
            expect.assertions(3);

            const nestedText = bold(`${red("Bold and red")} just bold`);
            const formatted = formatAnsiString(nestedText);

            expect(formatted.stripped).toBe("Bold and red just bold");
            expect(formatted.ansi).toBe(nestedText);
            expect(formatted.lengthDifference).toBeGreaterThan(0);
        });

        it("should handle multiple text decorations", () => {
            expect.assertions(3);

            const decoratedText = bold(italic(underline("Fancy text")));
            const formatted = formatAnsiString(decoratedText);

            expect(formatted.stripped).toBe("Fancy text");
            expect(formatted.lengthDifference).toBeGreaterThan(0);
            // The more decorations, the greater the difference should be
            expect(formatted.lengthDifference).toBeGreaterThan(formatted.stripped.length);
        });

        it("should handle empty strings", () => {
            expect.assertions(4);

            const emptyText = "";
            const formatted = formatAnsiString(emptyText);

            expect(formatted.stripped).toBe("");
            expect(formatted.ansi).toBe("");
            expect(formatted.lengthDifference).toBe(0);
            expect(formatted.json).toBe("\"\"");
        });

        it("should handle ANSI strings with special characters", () => {
            expect.assertions(2);

            const specialChars = red("Line 1\nLine 2\tTabbed\r\nWindows");
            const formatted = formatAnsiString(specialChars);

            expect(formatted.stripped).toBe("Line 1\nLine 2\tTabbed\r\nWindows");
            expect(formatted.ansi).toBe(specialChars);
        });
    });

    describe(compareAnsiStrings, () => {
        it("should correctly identify identical ANSI strings", () => {
            expect.assertions(3);

            const string1 = red("Test");
            const string2 = red("Test");

            const comparison = compareAnsiStrings(string1, string2);

            expect(comparison.ansiEqual).toBe(true);
            expect(comparison.strippedEqual).toBe(true);
            expect(comparison.summary.actualLength).toBe(comparison.summary.expectedLength);
        });

        it("should detect when visible content is the same but ANSI codes differ", () => {
            expect.assertions(3);

            const string1 = red("Hello World");
            const string2 = blue("Hello World");

            const comparison = compareAnsiStrings(string1, string2);

            expect(comparison.ansiEqual).toBe(false);
            expect(comparison.strippedEqual).toBe(true);
            expect(comparison.summary.actualStrippedLength).toBe(comparison.summary.expectedStrippedLength);
        });

        it("should detect when both visible content and ANSI codes differ", () => {
            expect.assertions(2);

            const string1 = red("Hello");
            const string2 = blue("World");

            const comparison = compareAnsiStrings(string1, string2);

            expect(comparison.ansiEqual).toBe(false);
            expect(comparison.strippedEqual).toBe(false);
        });

        it("should handle complex multi-color strings", () => {
            expect.assertions(2);

            const string1 = red("Error: ") + yellow("Something ") + green("went ") + blue("wrong!");

            const string2 = red("Error: ") + yellow("Something ") + green("went ") + blue("wrong!");

            const comparison = compareAnsiStrings(string1, string2);

            expect(comparison.ansiEqual).toBe(true);
            expect(comparison.strippedEqual).toBe(true);
        });

        it("should handle different styling with same content", () => {
            expect.assertions(3);

            const string1 = bold("Important");
            const string2 = italic("Important");

            const comparison = compareAnsiStrings(string1, string2);

            expect(comparison.ansiEqual).toBe(false);
            expect(comparison.strippedEqual).toBe(true);
            expect(comparison.summary.actualStrippedLength).toBe(comparison.summary.expectedStrippedLength);
        });

        it("should handle empty strings", () => {
            expect.assertions(4);

            const string1 = "";
            const string2 = "";
            const comparison = compareAnsiStrings(string1, string2);

            expect(comparison.ansiEqual).toBe(true);
            expect(comparison.strippedEqual).toBe(true);
            expect(comparison.summary.actualLength).toBe(0);
            expect(comparison.summary.expectedLength).toBe(0);
        });

        it("should handle one empty and one non-empty string", () => {
            expect.assertions(4);

            const string1 = "";
            const string2 = red("Not empty");

            const comparison = compareAnsiStrings(string1, string2);

            expect(comparison.ansiEqual).toBe(false);
            expect(comparison.strippedEqual).toBe(false);
            expect(comparison.summary.actualLength).toBe(0);
            expect(comparison.summary.expectedLength).toBeGreaterThan(0);
        });

        it("should handle strings with different text decorations", () => {
            expect.assertions(2);

            const string1 = bold(underline("Styled text"));

            const string2 = italic(dim("Styled text"));

            const comparison = compareAnsiStrings(string1, string2);

            expect(comparison.ansiEqual).toBe(false);
            expect(comparison.strippedEqual).toBe(true);
        });

        it("should handle strings with inverse styling", () => {
            expect.assertions(2);

            const string1 = inverse("Inverted");
            const string2 = "Inverted";

            const comparison = compareAnsiStrings(string1, string2);

            expect(comparison.ansiEqual).toBe(false);
            expect(comparison.strippedEqual).toBe(true);
        });
    });

    describe(expectAnsiStrings, () => {
        it("should return passing result for identical strings", () => {
            expect.assertions(2);

            const string1 = red("Test");
            const string2 = red("Test");

            const result = expectAnsiStrings(string1, string2);

            expect(result.pass).toBe(true);
            expect(result.message()).toBe("ANSI strings are identical");
        });

        it("should return failing result for different ANSI codes", () => {
            expect.assertions(3);

            const string1 = red("Test");
            const string2 = blue("Test");

            const result = expectAnsiStrings(string1, string2);

            expect(result.pass).toBe(false);
            expect(result.message()).toContain("ANSI string comparison failed");
            expect(result.message()).toContain("Visible content is identical, but escape codes differ");
        });

        it("should return failing result for different content", () => {
            expect.assertions(3);

            const string1 = red("Hello");
            const string2 = red("World");

            const result = expectAnsiStrings(string1, string2);

            expect(result.pass).toBe(false);
            expect(result.message()).toContain("ANSI string comparison failed");
            expect(result.message()).toContain("Visible content differs");
        });

        it("should include detailed information in failure message", () => {
            expect.assertions(7);

            const string1 = bold(red("Error"));
            const string2 = italic(blue("Error"));

            const result = expectAnsiStrings(string1, string2);

            expect(result.pass).toBe(false);

            const message = result.message();

            // Check that the message contains all the expected sections
            expect(message).toContain("Actual:");
            expect(message).toContain("Expected:");
            expect(message).toContain("Visible content:");
            expect(message).toContain("With escape codes:");
            expect(message).toContain("JSON:");
            expect(message).toContain("Length:");
        });
    });
});
