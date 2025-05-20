import { describe, expect, it } from "vitest";

import { CSI } from "../../src/constants";
import { SCROLL_DOWN_1,SCROLL_UP_1, scrollDown, scrollUp } from "../../src/scroll";

describe("scroll utilities", () => {
    describe("scrollUp", () => {
        it("should return correct ANSI for scrollUp() (default 1)", () => {
            expect(scrollUp()).toBe(CSI + "S");
        });
        it("should return correct ANSI for scrollUp(1)", () => {
            expect(scrollUp(1)).toBe(CSI + "S");
        });
        it("should return correct ANSI for scrollUp(2)", () => {
            expect(scrollUp(2)).toBe(CSI + "2S");
        });
        it("should return empty string for scrollUp(0)", () => {
            expect(scrollUp(0)).toBe("");
        });
    });

    describe("scrollDown", () => {
        it("should return correct ANSI for scrollDown() (default 1)", () => {
            expect(scrollDown()).toBe(CSI + "T");
        });
        it("should return correct ANSI for scrollDown(1)", () => {
            expect(scrollDown(1)).toBe(CSI + "T");
        });
        it("should return correct ANSI for scrollDown(2)", () => {
            expect(scrollDown(2)).toBe(CSI + "2T");
        });
        it("should return empty string for scrollDown(0)", () => {
            expect(scrollDown(0)).toBe("");
        });
    });

    describe("scroll Constants", () => {
        it("sCROLL_UP_1 should be correct", () => {
            expect(SCROLL_UP_1).toBe(CSI + "S");
        });
        it("sCROLL_DOWN_1 should be correct", () => {
            expect(SCROLL_DOWN_1).toBe(CSI + "T");
        });
    });
});
