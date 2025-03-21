import { blue, bold, green, inverse, italic, red, underline, yellow } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import type { CustomMatchers } from "../../../src/test/vitest";
import { toEqualAnsi } from "../../../src/test/vitest";

describe("aNSI string test utilities", () => {
    // Extend Vitest with our custom matcher
    expect.extend({ toEqualAnsi });

    it("should work with the expect syntax", () => {
        expect.assertions(1);
        expect(red("Test")).toEqualAnsi(red("Test"));
    });

    it("should fail with a detailed message when using expect syntax", () => {
        expect.assertions(3);
        // This test will fail, but we're testing the error message
        let errorMessage = "";

        try {
            expect(red("Hello")).toEqualAnsi(blue("Hello"));
        } catch (error) {
            errorMessage = String(error);
        }

        expect(errorMessage).toContain("ANSI string comparison failed");
        expect(errorMessage).toContain("Visible content is identical, but escape codes differ");
    });

    // Test the TypeScript interface works correctly
    it("should have the correct TypeScript interface", () => {
        expect.assertions(1);
        const matcher: CustomMatchers = {
            toEqualAnsi: () => {
                return { message: () => "", pass: true };
            },
        };

        expect(typeof matcher.toEqualAnsi).toBe("function");
    });

    describe("toEqualAnsi custom matcher", () => {
        it("should pass when ANSI strings are identical", () => {
            expect.assertions(1);
            const result = toEqualAnsi(red("Test"), red("Test"));
            expect(result.pass).toBeTruthy();
        });

        it("should fail when ANSI strings have different colors", () => {
            expect.assertions(1);
            const result = toEqualAnsi(red("Test"), blue("Test"));
            expect(result.pass).toBeFalsy();
        });

        it("should fail when ANSI strings have different content", () => {
            expect.assertions(1);
            const result = toEqualAnsi(red("Hello"), red("World"));
            expect(result.pass).toBeFalsy();
        });

        it("should provide detailed error message when strings differ", () => {
            expect.assertions(2);
            const result = toEqualAnsi(red("Test"), blue("Test"));

            // Call the message function to get the error message
            const message = result.message();

            expect(message).toContain("ANSI string comparison failed");
            expect(message).toContain("Visible content is identical, but escape codes differ");
        });

        it("should handle complex multi-colored strings", () => {
            expect.assertions(1);
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            const string1 = red("Error: ") + yellow("Something ") + green("went ") + blue("wrong!");
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            const string2 = red("Error: ") + yellow("Something ") + green("went ") + blue("wrong!");

            const result = toEqualAnsi(string1, string2);
            expect(result.pass).toBeTruthy();
        });

        it("should handle strings with multiple text decorations", () => {
            expect.assertions(1);
            const string1 = bold(italic(underline("Fancy")));
            const string2 = bold(italic(underline("Fancy")));

            const result = toEqualAnsi(string1, string2);
            expect(result.pass).toBeTruthy();
        });

        it("should handle different text decorations with same content", () => {
            expect.assertions(1);
            const string1 = bold(underline("Styled"));
            const string2 = italic(underline("Styled"));

            const result = toEqualAnsi(string1, string2);
            expect(result.pass).toBeFalsy();
        });

        it("should handle empty strings", () => {
            expect.assertions(1);
            const result = toEqualAnsi("", "");
            expect(result.pass).toBeTruthy();
        });

        it("should handle strings with special characters", () => {
            expect.assertions(1);
            const string1 = red("Line 1\nLine 2\tTabbed");
            const string2 = red("Line 1\nLine 2\tTabbed");

            const result = toEqualAnsi(string1, string2);
            expect(result.pass).toBeTruthy();
        });

        it("should handle strings with inverse styling", () => {
            expect.assertions(1);
            const string1 = inverse("Inverted");
            const string2 = inverse("Inverted");

            const result = toEqualAnsi(string1, string2);
            expect(result.pass).toBeTruthy();
        });
    });

    describe("real-world usage examples", () => {
        it("should work with error messages in different colors", () => {
            expect.assertions(1);
            // Simulate an error message with colored output
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            const actualError = red("Error: ") + yellow("File not found: ") + blue("example.txt");
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            const expectedError = red("Error: ") + yellow("File not found: ") + blue("example.txt");

            expect(actualError).toEqualAnsi(expectedError);
        });

        it("should detect differences in complex output", () => {
            expect.assertions(2);

            // Simulate a command-line output with multiple styles
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            const actualOutput = bold(green("✓")) + " Tests passed: " + bold("10") + "/" + bold("10");
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            const expectedOutput = bold(green("✓")) + " Tests passed: " + bold("9") + "/" + bold("10");

            const result = toEqualAnsi(actualOutput, expectedOutput);
            expect(result.pass).toBeFalsy();
            expect(result.message()).toContain("Visible content differs");
        });
    });
});
