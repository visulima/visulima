import { describe, expect, it } from "vitest";

import { resolveColor } from "../../src/react/styles";

describe(resolveColor, () => {
    it("should return 255 for undefined", () => {
        expect.assertions(1);

        expect(resolveColor(undefined)).toBe(255);
    });

    it("should pass through numeric values", () => {
        expect.assertions(3);

        expect(resolveColor(42)).toBe(42);
        expect(resolveColor(0)).toBe(0);
        expect(resolveColor(255)).toBe(255);
    });

    it("should resolve named colors", () => {
        expect.assertions(6);

        expect(resolveColor("red")).toBe(1);
        expect(resolveColor("green")).toBe(2);
        expect(resolveColor("blue")).toBe(4);
        expect(resolveColor("white")).toBe(7);
        expect(resolveColor("gray")).toBe(8);
        expect(resolveColor("grey")).toBe(8);
    });

    it("should resolve ansi256() syntax", () => {
        expect.assertions(2);

        expect(resolveColor("ansi256(42)")).toBe(42);
        expect(resolveColor("ansi256( 100 )")).toBe(100);
    });

    it("should resolve 6-digit hex colors", () => {
        expect.assertions(2);

        const result = resolveColor("#ff0000");

        // Red → should be in the 16-231 range (ANSI 256 cube)
        expect(result).toBeGreaterThanOrEqual(16);
        expect(result).toBeLessThanOrEqual(231);
    });

    it("should resolve 3-digit hex colors (#RGB shorthand)", () => {
        expect.assertions(1);

        const full = resolveColor("#ff0000");
        const short = resolveColor("#f00");

        expect(short).toBe(full);
    });

    it("should resolve 3-digit hex case-insensitively", () => {
        expect.assertions(2);

        expect(resolveColor("#F80")).toBe(resolveColor("#ff8800"));
        expect(resolveColor("#abc")).toBe(resolveColor("#aabbcc"));
    });

    it("should resolve rgb() syntax", () => {
        expect.assertions(1);

        const result = resolveColor("rgb(255,0,0)");

        expect(result).toBe(resolveColor("#ff0000"));
    });

    it("should resolve rgb() with spaces", () => {
        expect.assertions(1);

        const result = resolveColor("rgb( 255 , 128 , 0 )");

        expect(result).toBeGreaterThanOrEqual(16);
    });

    it("should return 255 for unrecognized strings", () => {
        expect.assertions(3);

        expect(resolveColor("not-a-color")).toBe(255);
        expect(resolveColor("")).toBe(255);
        expect(resolveColor("#GG0000")).toBe(255);
    });
});
