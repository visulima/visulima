import { describe, expect, it } from "vitest";

import { getStringWidth } from "../src";

describe("getStringWidth", () => {
    describe("basic functionality", () => {
        it("should calculate string width without truncation", () => {
            expect(getStringWidth("abc")).toBe(3);
            expect(getStringWidth("123")).toBe(3);
            expect(getStringWidth("abc123")).toBe(6);
            expect(getStringWidth("👍")).toBe(2);
            expect(getStringWidth("\u001B[1m")).toBe(0);
            expect(getStringWidth("\u0000")).toBe(0);
            expect(getStringWidth("\t")).toBe(8);
            expect(getStringWidth("あ")).toBe(2);
        });

        it("should respect width options", () => {
            expect(getStringWidth("abc", { regularWidth: 2 })).toBe(6);
            expect(getStringWidth("👍", { emojiWidth: 1 })).toBe(1);
            expect(getStringWidth("\t", { tabWidth: 4 })).toBe(4);
            expect(getStringWidth("あ", { fullWidthWidth: 1 })).toBe(2);
        });
    });
});
