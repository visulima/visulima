import { format, stripVTControlCharacters } from "node:util";

import { getStringWidth } from "..";

/**
 * Helper function to format ANSI strings for test output
 * @param ansiString The ANSI string to format
 * @returns An object with formatted representations of the string
 */
export const formatAnsiString = (ansiString: string): { ansi: string; json: string; lengthDifference: number; stripped: string; visible: string } => {
    const stripped = stripVTControlCharacters(ansiString);

    return {
        // Original ANSI string
        ansi: ansiString,
        // JSON stringified version to see all escape codes
        json: JSON.stringify(ansiString),
        // Length difference between ANSI and stripped string
        lengthDifference: ansiString.length - stripped.length,
        // String with ANSI codes stripped
        stripped,
        // String with ANSI escape codes shown as visible characters
        visible: ansiString.replaceAll("", String.raw`\u001B`),
    };
};

export interface ExpectationResult {
    // the matcher does not pass, so you don't need to print the diff yourself
    actual?: unknown;
    expected?: unknown;
    // If you pass these, they will automatically appear inside a diff when
    message: () => string;
    pass: boolean;
}

/**
 * Creates an expect matcher that provides detailed information about ANSI string comparison failures
 * @param actual The actual ANSI string
 * @param expected The expected ANSI string
 * @returns A detailed comparison result
 */
export const expectAnsiStrings = (actual: string, expected: string): ExpectationResult => {
    const actualFormatted = formatAnsiString(actual);
    const expectedFormatted = formatAnsiString(expected);

    return {
        message: () => {
            if (actual === expected) {
                return "ANSI strings are identical";
            }

            // If the visible content is the same but ANSI codes differ
            const strippedEqual = actualFormatted.stripped === expectedFormatted.stripped;

            return format(
                "ANSI string comparison failed:\n\n"
                + "Actual:\n"
                + "  - Visible content: %s\n"
                + "  - With escape codes: %s\n"
                + "  - JSON: %s\n"
                + "  - Length: %d\n\n"
                + "Expected:\n"
                + "  - Visible content: %s\n"
                + "  - With escape codes: %s\n"
                + "  - JSON: %s\n"
                + "  - Length: %d\n\n"
                + "%s\n",
                actualFormatted.stripped,
                actualFormatted.visible,
                actualFormatted.json,
                getStringWidth(actualFormatted.ansi),
                expectedFormatted.stripped,
                expectedFormatted.visible,
                expectedFormatted.json,
                getStringWidth(expectedFormatted.ansi),
                strippedEqual ? "✓ Visible content is identical, but escape codes differ" : "✗ Visible content differs",
            );
        },
        pass: actual === expected,
    };
};

/**
 * Helper function to compare ANSI strings and see the differences
 * @param actual The actual ANSI string
 * @param expected The expected ANSI string
 * @returns Details about the comparison
 */
export const compareAnsiStrings = (
    actual: string,
    expected: string,
): {
    actual: ReturnType<typeof formatAnsiString>;
    ansiEqual: boolean;
    expected: ReturnType<typeof formatAnsiString>;
    strippedEqual: boolean;
    summary: {
        actualLength: number;
        actualStrippedLength: number;
        ansiEqual: boolean;
        expectedLength: number;
        expectedStrippedLength: number;
        strippedEqual: boolean;
    };
} => {
    const actualFormatted = formatAnsiString(actual);
    const expectedFormatted = formatAnsiString(expected);

    const strippedEqual = actualFormatted.stripped === expectedFormatted.stripped;
    const ansiEqual = actual === expected;

    return {
        // Format information for both strings
        actual: actualFormatted,
        // Are the strings identical including ANSI codes?
        ansiEqual,
        expected: expectedFormatted,
        // Are the strings identical when ANSI codes are stripped?
        strippedEqual,
        // Summary information
        summary: {
            actualLength: actual.length,
            actualStrippedLength: actualFormatted.stripped.length,
            ansiEqual,
            expectedLength: expected.length,
            expectedStrippedLength: expectedFormatted.stripped.length,
            strippedEqual,
        },
    };
};
