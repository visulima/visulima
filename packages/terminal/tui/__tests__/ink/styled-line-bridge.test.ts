import { styledCharsFromTokens, tokenize } from "@alcalzone/ansi-tokenize";
import { describe, expect, it } from "vitest";

import { ansiCodesToStyleInfo, styledCharsToStyledLine, styledLineToStyledChars } from "../../src/ink/styled-line-bridge";
import { BOLD_MASK, FULL_WIDTH_MASK, ITALIC_MASK } from "../../src/ink/style-flags";

describe("ansiCodesToStyleInfo", () => {
    it("should parse bold", () => {
        const styles = [{ code: "\u001B[1m", endCode: "\u001B[22m", type: "ansi" as const }];
        const result = ansiCodesToStyleInfo(styles);

        expect(result.formatFlags & BOLD_MASK).toBeTruthy();
    });

    it("should parse standard foreground color", () => {
        const styles = [{ code: "\u001B[31m", endCode: "\u001B[39m", type: "ansi" as const }];
        const result = ansiCodesToStyleInfo(styles);

        expect(result.fgColor).toBe("red");
    });

    it("should parse standard background color", () => {
        const styles = [{ code: "\u001B[44m", endCode: "\u001B[49m", type: "ansi" as const }];
        const result = ansiCodesToStyleInfo(styles);

        expect(result.bgColor).toBe("blue");
    });

    it("should parse bright foreground color", () => {
        const styles = [{ code: "\u001B[91m", endCode: "\u001B[39m", type: "ansi" as const }];
        const result = ansiCodesToStyleInfo(styles);

        expect(result.fgColor).toBe("ansi256(9)");
    });

    it("should parse multiple styles", () => {
        const styles = [
            { code: "\u001B[1m", endCode: "\u001B[22m", type: "ansi" as const },
            { code: "\u001B[3m", endCode: "\u001B[23m", type: "ansi" as const },
            { code: "\u001B[31m", endCode: "\u001B[39m", type: "ansi" as const },
        ];
        const result = ansiCodesToStyleInfo(styles);

        expect(result.formatFlags & BOLD_MASK).toBeTruthy();
        expect(result.formatFlags & ITALIC_MASK).toBeTruthy();
        expect(result.fgColor).toBe("red");
    });

    it("should return empty for no styles", () => {
        const result = ansiCodesToStyleInfo([]);

        expect(result.formatFlags).toBe(0);
        expect(result.fgColor).toBeUndefined();
        expect(result.bgColor).toBeUndefined();
    });
});

describe("styledCharsToStyledLine", () => {
    it("should convert plain text", () => {
        const tokens = tokenize("Hello");
        const chars = styledCharsFromTokens(tokens);
        const line = styledCharsToStyledLine(chars);

        expect(line.length).toBe(5);
        expect(line.getText()).toBe("Hello");
    });

    it("should convert styled text", () => {
        const tokens = tokenize("\u001B[1;31mBold Red\u001B[0m");
        const chars = styledCharsFromTokens(tokens);
        const line = styledCharsToStyledLine(chars);

        expect(line.length).toBe(8);
        expect(line.getText()).toBe("Bold Red");
        expect(line.getFormatFlags(0) & BOLD_MASK).toBeTruthy();
        expect(line.getFgColor(0)).toBe("red");
    });

    it("should handle empty input", () => {
        const line = styledCharsToStyledLine([]);

        expect(line.length).toBe(0);
    });

    it("should preserve full-width flag", () => {
        // Create a StyledChar with fullWidth manually
        const chars = [
            { fullWidth: true, styles: [], type: "char" as const, value: "\u4E16" },
            { fullWidth: false, styles: [], type: "char" as const, value: " " },
        ];
        const line = styledCharsToStyledLine(chars);

        expect(line.getFullWidth(0)).toBe(true);
        expect(line.getFullWidth(1)).toBe(false);
    });
});

describe("styledLineToStyledChars", () => {
    it("should convert plain text back", () => {
        const tokens = tokenize("Hello");
        const chars = styledCharsFromTokens(tokens);
        const line = styledCharsToStyledLine(chars);
        const backChars = styledLineToStyledChars(line);

        expect(backChars).toHaveLength(5);
        expect(backChars[0]!.value).toBe("H");
        expect(backChars[0]!.styles).toHaveLength(0);
    });

    it("should preserve bold in round-trip", () => {
        const tokens = tokenize("\u001B[1mBold\u001B[0m");
        const chars = styledCharsFromTokens(tokens);
        const line = styledCharsToStyledLine(chars);
        const backChars = styledLineToStyledChars(line);

        expect(backChars[0]!.value).toBe("B");
        expect(backChars[0]!.styles.some((s) => s.code === "\u001B[1m")).toBe(true);
    });

    it("should preserve colors in round-trip", () => {
        const tokens = tokenize("\u001B[31mRed\u001B[0m");
        const chars = styledCharsFromTokens(tokens);
        const line = styledCharsToStyledLine(chars);
        const backChars = styledLineToStyledChars(line);

        expect(backChars[0]!.value).toBe("R");
        expect(backChars[0]!.styles.some((s) => s.code === "\u001B[31m")).toBe(true);
    });

    it("should preserve fullWidth in round-trip", () => {
        const chars = [{ fullWidth: true, styles: [], type: "char" as const, value: "\u4E16" }];
        const line = styledCharsToStyledLine(chars);
        const backChars = styledLineToStyledChars(line);

        expect(backChars[0]!.fullWidth).toBe(true);
        expect(backChars[0]!.value).toBe("\u4E16");
    });
});

describe("round-trip: StyledChar -> StyledLine -> StyledChar", () => {
    it("should preserve values through conversion", () => {
        const tokens = tokenize("\u001B[1;4;31mStyled\u001B[0m plain");
        const original = styledCharsFromTokens(tokens);
        const line = styledCharsToStyledLine(original);
        const roundTripped = styledLineToStyledChars(line);

        expect(roundTripped).toHaveLength(original.length);

        for (let i = 0; i < original.length; i++) {
            expect(roundTripped[i]!.value).toBe(original[i]!.value);
            expect(roundTripped[i]!.fullWidth).toBe(original[i]!.fullWidth);
        }
    });
});
