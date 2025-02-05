import { describe, expect, it } from "vitest";

import { findRealPosition } from "../../../src/utils/find-real-position";

describe("findRealPosition", () => {
    it("should handle plain text without ANSI codes", () => {
        expect.assertions(2);

        expect(findRealPosition("Hello", 3)).toBe(3);
        expect(findRealPosition("Hello", 5)).toBe(5);
    });

    it.todo("should handle text with ANSI color codes", () => {
        expect.assertions(2);

        const text = "\u001B[31mRed\u001B[0m text";
        expect(findRealPosition(text, 3)).toBe(10); // "Red" is at position 10 due to ANSI codes
        expect(findRealPosition(text, 7)).toBe(15); // "text" starts at position 15
    });

    it("should handle text with multiple ANSI codes", () => {
        expect.assertions(1);

        const text = "\u001B[1m\u001B[31mBold Red\u001B[0m";
        expect(findRealPosition(text, 4)).toBe(13); // "Bold" is at position 13 due to multiple ANSI codes
    });

    it.todo("should handle text with wide characters", () => {
        expect.assertions(2);

        const text = "Hello 世界";
        expect(findRealPosition(text, 6)).toBe(6);
        expect(findRealPosition(text, 8)).toBe(8);
    });

    it("should handle empty text", () => {
        expect.assertions(2);

        expect(findRealPosition("", 0)).toBe(0);
        expect(findRealPosition("", 5)).toBe(0);
    });

    it.todo("should handle text with ANSI codes and wide characters", () => {
        expect.assertions(2);

        const text = "\u001B[31m世界\u001B[0m Hello";
        expect(findRealPosition(text, 2)).toBe(8);
        expect(findRealPosition(text, 7)).toBe(16);
    });

    it("should handle position beyond text length", () => {
        expect.assertions(1);

        const text = "Hello";
        expect(findRealPosition(text, 10)).toBe(5);
    });
});
