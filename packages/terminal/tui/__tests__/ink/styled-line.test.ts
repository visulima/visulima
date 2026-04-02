import { describe, expect, it } from "vitest";

import { StyledLine } from "../../src/ink/styled-line";
import { styledLineToString } from "../../src/ink/styled-line-serializer";
import { BOLD_MASK, DIM_MASK, FULL_WIDTH_MASK, INVERSE_MASK, ITALIC_MASK, UNDERLINE_MASK } from "../../src/ink/style-flags";

describe("StyledLine", () => {
    describe("empty", () => {
        it("should create an empty line of spaces", () => {
            const line = StyledLine.empty(5);

            expect(line.length).toBe(5);
            expect(line.getValue(0)).toBe(" ");
            expect(line.getValue(4)).toBe(" ");
            expect(line.getText()).toBe("     ");
        });

        it("should return zero-length for empty(0)", () => {
            const line = StyledLine.empty(0);

            expect(line.length).toBe(0);
            expect(line.getText()).toBe("");
        });

        it("should cache and clone empty lines", () => {
            const a = StyledLine.empty(10);
            const b = StyledLine.empty(10);

            expect(a.equals(b)).toBe(true);
            // They should be different instances (cloned)
            a.setChar(0, "X", 0);
            expect(b.getValue(0)).toBe(" ");
        });
    });

    describe("setChar", () => {
        it("should set a character at an index", () => {
            const line = StyledLine.empty(5);

            line.setChar(0, "A", 0);
            expect(line.getValue(0)).toBe("A");
            expect(line.getValue(1)).toBe(" ");
        });

        it("should set character with style flags", () => {
            const line = StyledLine.empty(5);

            line.setChar(0, "B", BOLD_MASK, "red");
            expect(line.getValue(0)).toBe("B");
            expect(line.getFormatFlags(0) & BOLD_MASK).toBeTruthy();
            expect(line.getFgColor(0)).toBe("red");
        });

        it("should set full-width character", () => {
            const line = StyledLine.empty(5);

            line.setChar(0, "\u4E16", FULL_WIDTH_MASK); // CJK char
            expect(line.getValue(0)).toBe("\u4E16");
            expect(line.getFullWidth(0)).toBe(true);
        });

        it("should handle out-of-bounds gracefully", () => {
            const line = StyledLine.empty(3);

            line.setChar(-1, "X", 0);
            line.setChar(3, "X", 0);
            expect(line.getText()).toBe("   ");
        });
    });

    describe("pushChar", () => {
        it("should append characters", () => {
            const line = new StyledLine();

            line.pushChar("H", 0);
            line.pushChar("i", 0);
            expect(line.length).toBe(2);
            expect(line.getText()).toBe("Hi");
        });

        it("should coalesce spans with same style", () => {
            const line = new StyledLine();

            line.pushChar("A", BOLD_MASK);
            line.pushChar("B", BOLD_MASK);
            line.pushChar("C", 0);
            expect(line.getSpans()).toHaveLength(2);
            expect(line.getSpans()[0]!.length).toBe(2);
        });
    });

    describe("clone", () => {
        it("should create a deep copy", () => {
            const original = StyledLine.empty(3);

            original.setChar(0, "X", BOLD_MASK, "red");

            const cloned = original.clone();

            expect(cloned.getValue(0)).toBe("X");
            expect(cloned.getFgColor(0)).toBe("red");

            // Mutation of clone should not affect original
            cloned.setChar(0, "Y", 0);
            expect(original.getValue(0)).toBe("X");
        });
    });

    describe("slice", () => {
        it("should extract a sub-line", () => {
            const line = StyledLine.empty(5);

            line.setChar(0, "A", 0);
            line.setChar(1, "B", 0);
            line.setChar(2, "C", 0);
            line.setChar(3, "D", 0);
            line.setChar(4, "E", 0);

            const sliced = line.slice(1, 4);

            expect(sliced.length).toBe(3);
            expect(sliced.getValue(0)).toBe("B");
            expect(sliced.getValue(2)).toBe("D");
        });

        it("should handle empty slice", () => {
            const line = StyledLine.empty(3);
            const sliced = line.slice(2, 2);

            expect(sliced.length).toBe(0);
        });
    });

    describe("combine", () => {
        it("should concatenate lines", () => {
            const a = new StyledLine();

            a.pushChar("H", 0);
            a.pushChar("e", 0);

            const b = new StyledLine();

            b.pushChar("l", 0);
            b.pushChar("o", 0);

            const combined = a.combine(b);

            expect(combined.length).toBe(4);
            expect(combined.getText()).toBe("Helo");
        });
    });

    describe("getTrimmedLength / trimEnd", () => {
        it("should trim trailing spaces", () => {
            const line = StyledLine.empty(10);

            line.setChar(0, "H", 0);
            line.setChar(1, "i", 0);

            expect(line.getTrimmedLength()).toBe(2);
            expect(line.trimEnd().getText()).toBe("Hi");
        });

        it("should not trim styled spaces", () => {
            const line = StyledLine.empty(5);

            line.setChar(0, "A", 0);
            line.setChar(1, " ", BOLD_MASK); // styled space

            expect(line.getTrimmedLength()).toBe(2);
        });

        it("should return 0 for all-space lines", () => {
            const line = StyledLine.empty(5);

            expect(line.getTrimmedLength()).toBe(0);
        });
    });

    describe("equals", () => {
        it("should return true for identical lines", () => {
            const a = StyledLine.empty(3);
            const b = StyledLine.empty(3);

            a.setChar(0, "X", BOLD_MASK, "red");
            b.setChar(0, "X", BOLD_MASK, "red");

            expect(a.equals(b)).toBe(true);
        });

        it("should return false for different content", () => {
            const a = StyledLine.empty(3);
            const b = StyledLine.empty(3);

            a.setChar(0, "X", 0);
            b.setChar(0, "Y", 0);

            expect(a.equals(b)).toBe(false);
        });

        it("should return false for different styles", () => {
            const a = StyledLine.empty(3);
            const b = StyledLine.empty(3);

            a.setChar(0, "X", BOLD_MASK);
            b.setChar(0, "X", ITALIC_MASK);

            expect(a.equals(b)).toBe(false);
        });
    });

    describe("iterator", () => {
        it("should yield character info", () => {
            const line = StyledLine.empty(2);

            line.setChar(0, "A", BOLD_MASK, "red");
            line.setChar(1, "B", 0);

            const chars = [...line];

            expect(chars).toHaveLength(2);
            expect(chars[0]!.value).toBe("A");
            expect(chars[0]!.formatFlags & BOLD_MASK).toBeTruthy();
            expect(chars[0]!.fgColor).toBe("red");
            expect(chars[0]!.hasStyles).toBe(true);
            expect(chars[1]!.value).toBe("B");
            expect(chars[1]!.hasStyles).toBe(false);
        });
    });
});

describe("styledLineToString", () => {
    it("should serialize plain text", () => {
        const line = StyledLine.empty(5);

        line.setChar(0, "H", 0);
        line.setChar(1, "e", 0);
        line.setChar(2, "l", 0);
        line.setChar(3, "l", 0);
        line.setChar(4, "o", 0);

        expect(styledLineToString(line)).toBe("Hello");
    });

    it("should serialize bold text", () => {
        const line = new StyledLine();

        line.pushChar("B", BOLD_MASK);
        line.pushChar("o", BOLD_MASK);
        line.pushChar("l", BOLD_MASK);
        line.pushChar("d", BOLD_MASK);

        const result = styledLineToString(line);

        expect(result).toContain("\u001B[1m"); // bold on
        expect(result).toContain("Bold");
        expect(result).toContain("\u001B[22m"); // bold off (targeted reset)
    });

    it("should handle style transitions", () => {
        const line = new StyledLine();

        line.pushChar("A", BOLD_MASK);
        line.pushChar("B", ITALIC_MASK);

        const result = styledLineToString(line);

        expect(result).toContain("A");
        expect(result).toContain("B");
        // Should have both bold and italic escape codes
        expect(result).toContain("\u001B[1m"); // bold
    });

    it("should serialize foreground colors", () => {
        const line = new StyledLine();

        line.pushChar("R", 0, "red");

        const result = styledLineToString(line);

        expect(result).toContain("\u001B[31m"); // red fg
        expect(result).toContain("R");
    });

    it("should serialize background colors", () => {
        const line = new StyledLine();

        line.pushChar("B", 0, undefined, "blue");

        const result = styledLineToString(line);

        expect(result).toContain("\u001B[44m"); // blue bg
    });

    it("should handle hex colors", () => {
        const line = new StyledLine();

        line.pushChar("H", 0, "#ff0000");

        const result = styledLineToString(line);

        expect(result).toContain("\u001B[38;2;255;0;0m"); // RGB fg
    });

    it("should return empty string for empty line", () => {
        expect(styledLineToString(new StyledLine())).toBe("");
    });

    it("should handle inverse", () => {
        const line = StyledLine.empty(3);

        line.setInverted(0, true);

        const result = styledLineToString(line);

        expect(result).toContain("\u001B[7m"); // inverse on
    });

    it("should handle mixed styles with reset", () => {
        const line = new StyledLine();

        line.pushChar("B", BOLD_MASK);
        line.pushChar("N", 0); // back to normal — requires reset since bold can't be incrementally disabled

        const result = styledLineToString(line);

        expect(result).toContain("B");
        expect(result).toContain("N");
    });
});
