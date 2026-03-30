import type { StyledChar } from "@alcalzone/ansi-tokenize";
import { describe, expect, it } from "vitest";

import { StyleMasks } from "../../src/core/cell";
import { CONTINUATION_CELL_CODE, packStyledChar, styledCharToAttributes } from "../../src/ink/ansi-to-cell";

const makeChar = (value: string, ...codes: string[]): StyledChar => ({
    fullWidth: false,
    styles: codes.map((code) => ({ code, endCode: "", type: "ansi" as const })),
    type: "char",
    value,
});

describe("ansi-to-cell", () => {
    describe("styledCharToAttributes", () => {
        it("should return defaults for unstyled char", () => {
            const result = styledCharToAttributes([]);

            expect(result).toStrictEqual({ bg: 255, fg: 255, styles: 0 });
        });

        it("should parse bold", () => {
            const result = styledCharToAttributes([{ code: "\x1b[1m", endCode: "\x1b[22m", type: "ansi" }]);

            expect(result.styles & StyleMasks.BOLD).toBe(StyleMasks.BOLD);
        });

        it("should parse italic + underline", () => {
            const result = styledCharToAttributes([
                { code: "\x1b[3m", endCode: "\x1b[23m", type: "ansi" },
                { code: "\x1b[4m", endCode: "\x1b[24m", type: "ansi" },
            ]);

            expect(result.styles & StyleMasks.ITALIC).toBe(StyleMasks.ITALIC);
            expect(result.styles & StyleMasks.UNDERLINE).toBe(StyleMasks.UNDERLINE);
        });

        it("should parse combined SGR codes", () => {
            // "\x1b[1;3m" = bold + italic in one sequence
            const result = styledCharToAttributes([{ code: "\x1b[1;3m", endCode: "", type: "ansi" }]);

            expect(result.styles & StyleMasks.BOLD).toBe(StyleMasks.BOLD);
            expect(result.styles & StyleMasks.ITALIC).toBe(StyleMasks.ITALIC);
        });

        it("should parse standard foreground colors", () => {
            // Red foreground: \x1b[31m
            const result = styledCharToAttributes([{ code: "\x1b[31m", endCode: "\x1b[39m", type: "ansi" }]);

            expect(result.fg).toBe(1); // red = 31 - 30 = 1
        });

        it("should parse standard background colors", () => {
            // Blue background: \x1b[44m
            const result = styledCharToAttributes([{ code: "\x1b[44m", endCode: "\x1b[49m", type: "ansi" }]);

            expect(result.bg).toBe(4); // blue = 44 - 40 = 4
        });

        it("should parse bright foreground colors", () => {
            // Bright cyan: \x1b[96m
            const result = styledCharToAttributes([{ code: "\x1b[96m", endCode: "\x1b[39m", type: "ansi" }]);

            expect(result.fg).toBe(14); // bright cyan = 96 - 90 + 8 = 14
        });

        it("should parse 256-color foreground", () => {
            // 256-color fg 196: \x1b[38;5;196m
            const result = styledCharToAttributes([{ code: "\x1b[38;5;196m", endCode: "\x1b[39m", type: "ansi" }]);

            expect(result.fg).toBe(196);
        });

        it("should parse 256-color background", () => {
            const result = styledCharToAttributes([{ code: "\x1b[48;5;21m", endCode: "\x1b[49m", type: "ansi" }]);

            expect(result.bg).toBe(21);
        });

        it("should parse RGB foreground to nearest 256-color", () => {
            // RGB(255, 0, 0) → nearest 256-color
            const result = styledCharToAttributes([{ code: "\x1b[38;2;255;0;0m", endCode: "\x1b[39m", type: "ansi" }]);

            // 255/51 = 5, 0/51 = 0 → 16 + 36*5 + 0 + 0 = 196
            expect(result.fg).toBe(196);
        });

        it("should handle reset code", () => {
            const result = styledCharToAttributes([
                { code: "\x1b[1m", endCode: "\x1b[22m", type: "ansi" },
                { code: "\x1b[0m", endCode: "", type: "ansi" },
            ]);

            expect(result.styles).toBe(0);
            expect(result.fg).toBe(255);
            expect(result.bg).toBe(255);
        });

        it("should handle default fg/bg reset codes", () => {
            const result = styledCharToAttributes([
                { code: "\x1b[31m", endCode: "\x1b[39m", type: "ansi" },
                { code: "\x1b[39m", endCode: "", type: "ansi" },
            ]);

            expect(result.fg).toBe(255);
        });
    });

    describe("packStyledChar", () => {
        it("should pack an ASCII character", () => {
            const [charCode, attrCode] = packStyledChar(makeChar("A"));

            expect(charCode).toBe(65);
            expect(attrCode).toBe((0 << 16) | (255 << 8) | 255);
        });

        it("should pack a styled character", () => {
            const [charCode, attrCode] = packStyledChar(makeChar("X", "\x1b[1m", "\x1b[31m", "\x1b[44m"));

            expect(charCode).toBe(88); // 'X'
            expect(attrCode & 0xff).toBe(1); // fg = red (1)
            expect((attrCode >> 8) & 0xff).toBe(4); // bg = blue (4)
            expect((attrCode >> 16) & 0xff).toBe(StyleMasks.BOLD); // bold
        });

        it("should handle empty value", () => {
            const [charCode] = packStyledChar(makeChar(""));

            expect(charCode).toBe(32); // fallback to space
        });
    });

    describe("CONTINUATION_CELL_CODE", () => {
        it("should be outside Unicode range", () => {
            expect(CONTINUATION_CELL_CODE).toBeGreaterThan(0x10_ff_ff);
        });
    });
});
