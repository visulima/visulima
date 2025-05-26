import { describe, expect, it } from "vitest";

import { decodeSixelRepeat } from "../../src/sixel/repeat";

describe(decodeSixelRepeat, () => {
    describe("valid sequences", () => {
        it("should parse valid repeat with count and char", () => {
            expect.assertions(1);

            const result = decodeSixelRepeat("!10?", 0);

            expect(result).toStrictEqual({ cmd: { charToRepeat: "?", count: 10 }, consumed: 4 });
        });

        it("should parse valid repeat with missing count (defaults to 1)", () => {
            expect.assertions(1);

            const result = decodeSixelRepeat("!?", 0);

            expect(result).toStrictEqual({ cmd: { charToRepeat: "?", count: 1 }, consumed: 2 });
        });

        it("should parse valid repeat with count 0 (defaults to 1)", () => {
            expect.assertions(1);

            const result = decodeSixelRepeat("!0@", 0);

            expect(result).toStrictEqual({ cmd: { charToRepeat: "@", count: 1 }, consumed: 3 });
        });

        it("should parse valid repeat with max Sixel char '~'", () => {
            expect.assertions(1);

            const result = decodeSixelRepeat("!1~", 0);

            expect(result).toStrictEqual({ cmd: { charToRepeat: "~", count: 1 }, consumed: 3 });
        });

        it("should parse valid repeat with min Sixel char '?'", () => {
            expect.assertions(1);

            const result = decodeSixelRepeat("!1?", 0);

            expect(result).toStrictEqual({ cmd: { charToRepeat: "?", count: 1 }, consumed: 3 });
        });

        it("should parse valid repeat with large count", () => {
            expect.assertions(1);

            const result = decodeSixelRepeat("!999A", 0);

            expect(result).toStrictEqual({ cmd: { charToRepeat: "A", count: 999 }, consumed: 5 });
        });

        it("should parse valid repeat with char 'A' (ASCII 65)", () => {
            expect.assertions(1);

            const result = decodeSixelRepeat("!3A", 0);

            expect(result).toStrictEqual({ cmd: { charToRepeat: "A", count: 3 }, consumed: 3 });
        });
    });

    describe("invalid sequences", () => {
        it("should return null for empty or too short string", () => {
            expect.assertions(3);
            expect(decodeSixelRepeat("", 0)).toBeNull();
            expect(decodeSixelRepeat("!", 0)).toBeNull();
            expect(decodeSixelRepeat("!1", 0)).toBeNull(); // Missing char
        });

        it("should return null for wrong introducer", () => {
            expect.assertions(1);
            expect(decodeSixelRepeat("#10?", 0)).toBeNull();
        });

        it("should parse '!abc?' as count 1 for char 'a'", () => {
            expect.assertions(1);

            // 'a' is not a digit, so count defaults to 1. 'a' becomes the charToRepeat.
            const result = decodeSixelRepeat("!abc?", 0);

            expect(result).toStrictEqual({ cmd: { charToRepeat: "a", count: 1 }, consumed: 2 });
        });

        it("should return null for negative count (if sign parsing was added and resulted in negative)", () => {
            expect.assertions(1);
            // Current digit parser for count does not support signs.
            // If it did, and parseInt("-5") resulted in -5, then `count < 0` check would make it null.
            // This test is more of a placeholder if sign parsing for repeat counts is ever added.
            // For now, an input like "!-5?" is handled by the "non-digit -> charToRepeat" logic.
            // E.g., decodeSixelRepeat("!-5?", 0) -> count 1, char '-', consumed: 2 (as '-' is invalid Sixel char)
            // So, the above case would be: expect(decodeSixelRepeat("!-5?",0)).toBeNull(); because char '-' is invalid.
            expect(decodeSixelRepeat("!-5?", 0)).toBeNull(); // '-' is not a valid Sixel char (63-126)
        });

        it("should return null if charToRepeat is missing after count", () => {
            expect.assertions(1);
            expect(decodeSixelRepeat("!10", 0)).toBeNull();
        });

        it("should return null for invalid charToRepeat (outside '?' to '~')", () => {
            expect.assertions(4);
            expect(decodeSixelRepeat("!5 ", 0)).toBeNull(); // Space (ASCII 32)
            expect(decodeSixelRepeat("!5\u001B", 0)).toBeNull(); // ESC (ASCII 27)
            expect(decodeSixelRepeat("!5<", 0)).toBeNull(); // Char before '?' (ASCII 60)
            expect(decodeSixelRepeat("!5\u007F", 0)).toBeNull(); // DEL (ASCII 127)
        });
    });

    describe("edge cases for consumed length", () => {
        it("should correctly report consumed length with trailing characters", () => {
            expect.assertions(2);

            const result = decodeSixelRepeat("!?trailing", 0);

            expect(result?.consumed).toBe(2);

            const result2 = decodeSixelRepeat("!10?trailing", 0);

            expect(result2?.consumed).toBe(4);
        });
    });
});
