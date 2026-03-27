// Test cases from https://github.com/sindresorhus/is-fullwidth-code-point
import { describe, expect, it } from "vitest";

import isFullwidthCodePoint from "../../src/is-fullwidth-code-point";

describe(isFullwidthCodePoint, () => {
    it("should return true for Japanese fullwidth character", () => {
        expect.assertions(1);

        expect(isFullwidthCodePoint("あ".codePointAt(0) as number)).toBe(true);
    });

    it("should return true for Chinese fullwidth character", () => {
        expect.assertions(1);

        expect(isFullwidthCodePoint("谢".codePointAt(0) as number)).toBe(true);
    });

    it("should return true for Korean fullwidth character", () => {
        expect.assertions(1);

        expect(isFullwidthCodePoint("고".codePointAt(0) as number)).toBe(true);
    });

    it("should return false for NaN", () => {
        expect.assertions(1);

        expect(isFullwidthCodePoint(Number.NaN)).toBe(false);
    });

    it("should return false for ASCII character", () => {
        expect.assertions(1);

        expect(isFullwidthCodePoint("a".codePointAt(0) as number)).toBe(false);
    });

    it("should return true for wide emoji code point 0x1F251", () => {
        expect.assertions(1);

        expect(isFullwidthCodePoint(0x1_f2_51)).toBe(true);
    });

    it("should return true for wide CJK code point 0x1B11E", () => {
        expect.assertions(1);

        expect(isFullwidthCodePoint(0x1_b1_1e)).toBe(true);
    });

    it("should return false for narrow code point 0x201D", () => {
        expect.assertions(1);

        expect(isFullwidthCodePoint(0x20_1d)).toBe(false);
    });
});
