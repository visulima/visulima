import type { StyledChar } from "@alcalzone/ansi-tokenize";
import { describe, expect, it } from "vitest";

import { sliceStyledChars, truncateStyledChars, wrapOrTruncateStyledChars, wrapStyledChars } from "../../src/ink/text-wrap";

const char = (value: string): StyledChar => ({
    fullWidth: false,
    styles: [],
    type: "char",
    value,
});

const chars = (text: string): StyledChar[] => [...text].map((c) => char(c));

const charsToString = (styledChars: StyledChar[]): string => styledChars.map((c) => c.value).join("");

const linesToStrings = (lines: StyledChar[][]): string[] => lines.map(charsToString);

describe("text-wrap (StyledChar)", () => {
    describe("sliceStyledChars", () => {
        it("should slice by visual width", () => {
            const result = sliceStyledChars(chars("hello"), 1, 4);

            expect(charsToString(result)).toBe("ell");
        });

        it("should slice from beginning", () => {
            const result = sliceStyledChars(chars("hello"), 0, 3);

            expect(charsToString(result)).toBe("hel");
        });

        it("should slice to end when no end given", () => {
            const result = sliceStyledChars(chars("hello"), 2);

            expect(charsToString(result)).toBe("llo");
        });
    });

    describe("truncateStyledChars", () => {
        it("should not truncate when text fits", () => {
            const result = truncateStyledChars(chars("hello"), 10);

            expect(charsToString(result)).toBe("hello");
        });

        it("should truncate at end by default", () => {
            const result = truncateStyledChars(chars("hello world"), 8);

            expect(charsToString(result)).toBe("hello w\u2026");
        });

        it("should truncate at start", () => {
            const result = truncateStyledChars(chars("hello world"), 8, { position: "start" });

            expect(charsToString(result)).toBe("\u2026o world");
        });

        it("should truncate at middle", () => {
            const result = truncateStyledChars(chars("hello world"), 8, { position: "middle" });
            const text = charsToString(result);

            expect(text).toContain("\u2026");
            expect(text.length).toBeLessThanOrEqual(8);
        });

        it("should return ellipsis for columns=1", () => {
            const result = truncateStyledChars(chars("hello"), 1);

            expect(charsToString(result)).toBe("\u2026");
        });

        it("should return empty for columns=0", () => {
            const result = truncateStyledChars(chars("hello"), 0);

            expect(result).toHaveLength(0);
        });
    });

    describe("wrapStyledChars", () => {
        it("should wrap text at word boundaries", () => {
            const result = wrapStyledChars(chars("hello world foo"), 8);
            const lines = linesToStrings(result);

            expect(lines[0]).toBe("hello");
            expect(lines[1]).toBe("world");
            expect(lines[2]).toBe("foo");
        });

        it("should handle newlines", () => {
            const result = wrapStyledChars(chars("hello\nworld"), 20);
            const lines = linesToStrings(result);

            expect(lines).toHaveLength(2);
            expect(lines[0]).toBe("hello");
            expect(lines[1]).toBe("world");
        });

        it("should break long words that exceed column width", () => {
            const result = wrapStyledChars(chars("abcdefghij"), 5);
            const lines = linesToStrings(result);

            expect(lines).toHaveLength(2);
            expect(lines[0]).toBe("abcde");
            expect(lines[1]).toBe("fghij");
        });

        it("should handle empty input", () => {
            const result = wrapStyledChars([], 10);

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveLength(0);
        });
    });

    describe("wrapOrTruncateStyledChars", () => {
        it("should wrap by default", () => {
            const result = wrapOrTruncateStyledChars(chars("hello world"), 6);

            expect(result.length).toBeGreaterThan(1);
        });

        it("should truncate with truncate mode", () => {
            const result = wrapOrTruncateStyledChars(chars("hello world"), 6, "truncate");

            expect(result).toHaveLength(1);
            expect(charsToString(result[0]!)).toContain("\u2026");
        });

        it("should truncate-start", () => {
            const result = wrapOrTruncateStyledChars(chars("hello world"), 6, "truncate-start");

            expect(result).toHaveLength(1);
            expect(charsToString(result[0]!).startsWith("\u2026")).toBe(true);
        });

        it("should truncate-middle", () => {
            const result = wrapOrTruncateStyledChars(chars("hello world"), 6, "truncate-middle");

            expect(result).toHaveLength(1);
            expect(charsToString(result[0]!)).toContain("\u2026");
        });
    });
});
