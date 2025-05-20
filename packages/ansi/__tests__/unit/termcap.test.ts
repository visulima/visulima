import { describe, expect, it } from "vitest";

import { DCS, SEP, ST } from "../../src/constants";
import { requestTermcap, requestTerminfo, XTGETTCAP } from "../../src/termcap";

describe("termcap/Terminfo XTGETTCAP", () => {
    it("should return an empty string if no capabilities are provided", () => {
        expect(XTGETTCAP()).toBe("");
    });

    it("should correctly encode a single capability", () => {
        // "Co" -> C (67 -> 43), o (111 -> 6F) -> "436F"
        const expectedHexCo = "436F";
        expect(XTGETTCAP("Co")).toBe(DCS + "+q" + expectedHexCo + ST);
    });

    it("should correctly encode multiple capabilities", () => {
        // "Co" -> "436F"
        // "li" -> l (108 -> 6C), i (105 -> 69) -> "6C69"
        const expectedHexCo = "436F";
        const expectedHexLi = "6C69";
        expect(XTGETTCAP("Co", "li")).toBe(DCS + "+q" + expectedHexCo + SEP + expectedHexLi + ST);
    });

    it("should handle capabilities with characters that result in single-digit hex", () => {
        // Example: Tab char (char code 9 -> 09 hex)
        // "T\t" -> T (84 -> 54), \t (9 -> 09) -> "5409"
        const expectedHexTab = "5409";
        expect(XTGETTCAP("T\t")).toBe(DCS + "+q" + expectedHexTab + ST);
    });

    it("should handle longer capability names", () => {
        // "colors" -> c(63) o(6F) l(6C) o(6F) r(72) s(73)
        const expectedHexColors = "636F6C6F7273";
        expect(XTGETTCAP("colors")).toBe(DCS + "+q" + expectedHexColors + ST);
    });

    it("aliases should point to XTGETTCAP", () => {
        expect(requestTermcap).toBe(XTGETTCAP);
        expect(requestTerminfo).toBe(XTGETTCAP);
    });

    it("requestTermcap should produce the same result", () => {
        const expectedHexCo = "436F";
        expect(requestTermcap("Co")).toBe(DCS + "+q" + expectedHexCo + ST);
    });
});
