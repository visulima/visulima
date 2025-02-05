import { describe, expect, it } from "vitest";

import { preserveAnsiCodes } from "../../../src/utils/preserve-ansi-codes";

describe("preserveAnsiCodes", () => {
    it("should preserve ANSI codes in text slice", () => {
        expect.assertions(1);

        const text = "\u001B[31mRed\u001B[0m \u001B[32mGreen\u001B[0m";
        const result = preserveAnsiCodes(text, 0, 3); // Slice "Red"
        expect(result).toBe("\u001B[31m\u001B[0m");
    });

    it("should handle text without ANSI codes", () => {
        expect.assertions(1);

        const text = "Hello World";
        const result = preserveAnsiCodes(text, 0, 5);
        expect(result).toBe("Hello");
    });

    it("should handle empty text", () => {
        expect.assertions(1);

        expect(preserveAnsiCodes("", 0, 0)).toBe("");
    });

    it("should handle text with nested ANSI codes", () => {
        expect.assertions(1);

        const text = "\u001B[1m\u001B[31mBold Red\u001B[0m";
        const result = preserveAnsiCodes(text, 0, 8);
        expect(result).toBe("\u001B[1m\u001B[31mBold Red\u001B[0m");
    });

    it("should handle text with multiple reset codes", () => {
        expect.assertions(1);

        const text = "\u001B[31mRed\u001B[0m\u001B[32mGreen\u001B[0m";
        const result = preserveAnsiCodes(text, 3, 7);
        expect(result).toBe("\u001B[31md\u001B[0m\u001B[32mG\u001B[0m");
    });

    it("should handle slicing in the middle of ANSI codes", () => {
        expect.assertions(1);

        const text = "Normal\u001B[31mRed\u001B[0mNormal";
        const result = preserveAnsiCodes(text, 4, 9);
        expect(result).toBe("al\u001B[31mRed\u001B[0m");
    });

    it("should handle overlapping ANSI codes", () => {
        expect.assertions(1);

        const text = "\u001B[1m\u001B[31mBold\u001B[0m\u001B[32mGreen\u001B[0m";
        const result = preserveAnsiCodes(text, 4, 10);
        expect(result).toBe("\u001B[1m\u001B[31md\u001B[0m\u001B[32mGre\u001B[0m");
    });
});
