import { stripVTControlCharacters } from "node:util";

import { blue, bold, dim, green, inverse, italic, red, underline, yellow } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import { compareAnsiStrings, expectAnsiStrings, formatAnsiString } from "../../../src/test/utils";

describe("aNSI string test utilities", () => {
    describe("formatAnsiString", () => {
        it("should format a simple ANSI string", () => {
            const redText = red("Hello");
            const formatted = formatAnsiString(redText);

            expect(formatted.stripped).toBe("Hello");
            expect(formatted.ansi).toBe(redText);
            expect(formatted.json).toBe(JSON.stringify(redText));
            expect(formatted.visible).toContain("\\u001B");
            expect(formatted.lengthDifference).toBeGreaterThan(0);
        });

        it("should handle complex ANSI strings with multiple colors", () => {
            const complexText = red("Error: ") + yellow("Something ") + green("went ") + blue("wrong!");
            const formatted = formatAnsiString(complexText);

            expect(formatted.stripped).toBe("Error: Something went wrong!");
            expect(stripVTControlCharacters(formatted.ansi)).toBe("Error: Something went wrong!");
            expect(formatted.lengthDifference).toBeGreaterThan(0);
        });

        it("should handle strings without ANSI codes", () => {
            const plainText = "Hello World";
            const formatted = formatAnsiString(plainText);

            expect(formatted.stripped).toBe(plainText);
            expect(formatted.ansi).toBe(plainText);
            expect(formatted.lengthDifference).toBe(0);
            expect(formatted.json).toBe(JSON.stringify(plainText));
        });

        it("should handle nested and combined styling", () => {
            const nestedText = bold(red("Bold and red") + " just bold");
            const formatted = formatAnsiString(nestedText);

            expect(formatted.stripped).toBe("Bold and red just bold");
            expect(formatted.ansi).toBe(nestedText);
            expect(formatted.lengthDifference).toBeGreaterThan(0);
        });

        it("should handle multiple text decorations", () => {
            const decoratedText = bold(italic(underline("Fancy text")));
            const formatted = formatAnsiString(decoratedText);

            expect(formatted.stripped).toBe("Fancy text");
            expect(formatted.lengthDifference).toBeGreaterThan(0);
            // The more decorations, the greater the difference should be
            expect(formatted.lengthDifference).toBeGreaterThan(formatted.stripped.length);
        });

        it("should handle empty strings", () => {
            const emptyText = "";
            const formatted = formatAnsiString(emptyText);

            expect(formatted.stripped).toBe("");
            expect(formatted.ansi).toBe("");
            expect(formatted.lengthDifference).toBe(0);
            expect(formatted.json).toBe('""');
        });

        it("should handle ANSI strings with special characters", () => {
            const specialChars = red("Line 1\nLine 2\tTabbed\r\nWindows");
            const formatted = formatAnsiString(specialChars);

            expect(formatted.stripped).toBe("Line 1\nLine 2\tTabbed\r\nWindows");
            expect(formatted.ansi).toBe(specialChars);
        });
    });

    describe("compareAnsiStrings", () => {
        it("should correctly identify identical ANSI strings", () => {
            const string1 = red("Test");
            const string2 = red("Test");

            const comparison = compareAnsiStrings(string1, string2);

            expect(comparison.ansiEqual).toBeTruthy();
            expect(comparison.strippedEqual).toBeTruthy();
            expect(comparison.summary.actualLength).toBe(comparison.summary.expectedLength);
        });

        it("should detect when visible content is the same but ANSI codes differ", () => {
            const string1 = red("Hello World");
            const string2 = blue("Hello World");

            const comparison = compareAnsiStrings(string1, string2);

            expect(comparison.ansiEqual).toBeFalsy();
            expect(comparison.strippedEqual).toBeTruthy();
            expect(comparison.summary.actualStrippedLength).toBe(comparison.summary.expectedStrippedLength);
        });

        it("should detect when both visible content and ANSI codes differ", () => {
            const string1 = red("Hello");
            const string2 = blue("World");

            const comparison = compareAnsiStrings(string1, string2);

            expect(comparison.ansiEqual).toBeFalsy();
            expect(comparison.strippedEqual).toBeFalsy();
        });

        it("should handle complex multi-color strings", () => {
            const string1 = red("Error: ") + yellow("Something ") + green("went ") + blue("wrong!");
            const string2 = red("Error: ") + yellow("Something ") + green("went ") + blue("wrong!");

            const comparison = compareAnsiStrings(string1, string2);

            expect(comparison.ansiEqual).toBeTruthy();
            expect(comparison.strippedEqual).toBeTruthy();
        });

        it("should handle different styling with same content", () => {
            const string1 = bold("Important");
            const string2 = italic("Important");

            const comparison = compareAnsiStrings(string1, string2);

            expect(comparison.ansiEqual).toBeFalsy();
            expect(comparison.strippedEqual).toBeTruthy();
            expect(comparison.summary.actualStrippedLength).toBe(comparison.summary.expectedStrippedLength);
        });

        it("should handle empty strings", () => {
            const string1 = "";
            const string2 = "";

            const comparison = compareAnsiStrings(string1, string2);

            expect(comparison.ansiEqual).toBeTruthy();
            expect(comparison.strippedEqual).toBeTruthy();
            expect(comparison.summary.actualLength).toBe(0);
            expect(comparison.summary.expectedLength).toBe(0);
        });

        it("should handle one empty and one non-empty string", () => {
            const string1 = "";
            const string2 = red("Not empty");

            const comparison = compareAnsiStrings(string1, string2);

            expect(comparison.ansiEqual).toBeFalsy();
            expect(comparison.strippedEqual).toBeFalsy();
            expect(comparison.summary.actualLength).toBe(0);
            expect(comparison.summary.expectedLength).toBeGreaterThan(0);
        });

        it("should handle strings with different text decorations", () => {
            const string1 = bold(underline("Styled text"));
            const string2 = italic(dim("Styled text"));

            const comparison = compareAnsiStrings(string1, string2);

            expect(comparison.ansiEqual).toBeFalsy();
            expect(comparison.strippedEqual).toBeTruthy();
        });

        it("should handle strings with inverse styling", () => {
            const string1 = inverse("Inverted");
            const string2 = "Inverted";

            const comparison = compareAnsiStrings(string1, string2);

            expect(comparison.ansiEqual).toBeFalsy();
            expect(comparison.strippedEqual).toBeTruthy();
        });
    });

    describe("expectAnsiStrings", () => {
        it("should return passing result for identical strings", () => {
            const string1 = red("Test");
            const string2 = red("Test");

            const result = expectAnsiStrings(string1, string2);

            expect(result.pass).toBeTruthy();
            expect(result.message()).toBe("ANSI strings are identical");
        });

        it("should return failing result for different ANSI codes", () => {
            const string1 = red("Test");
            const string2 = blue("Test");

            const result = expectAnsiStrings(string1, string2);

            expect(result.pass).toBeFalsy();
            expect(result.message()).toContain("ANSI string comparison failed");
            expect(result.message()).toContain("Visible content is identical, but escape codes differ");
        });

        it("should return failing result for different content", () => {
            const string1 = red("Hello");
            const string2 = red("World");

            const result = expectAnsiStrings(string1, string2);

            expect(result.pass).toBeFalsy();
            expect(result.message()).toContain("ANSI string comparison failed");
            expect(result.message()).toContain("Visible content differs");
        });

        it("should include detailed information in failure message", () => {
            const string1 = bold(red("Error"));
            const string2 = italic(blue("Error"));

            const result = expectAnsiStrings(string1, string2);

            expect(result.pass).toBeFalsy();
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
