import { stripVTControlCharacters } from "node:util";

import { blue, green, red, yellow } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import { compareAnsiStrings, formatAnsiString } from "../../../src/test/utils";

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
    });
});
