import { describe, expect, it } from "vitest";

import { styleMethods } from "../../src/css-code";

describe("css-code styleMethods", () => {
    it("should map a known ANSI 256 code to a hex foreground color", () => {
        expect.assertions(1);

        expect(styleMethods.fg(97)).toBe("color: #875faf;");
    });

    it("should map a known ANSI 256 code to a hex background color", () => {
        expect.assertions(1);

        expect(styleMethods.bg(97)).toBe("background-color: #875faf;");
    });

    it("should fall back to an empty foreground color for an unknown code", () => {
        expect.assertions(1);

        expect(styleMethods.fg(9999)).toBe("color: ;");
    });

    it("should fall back to an empty background color for an unknown code", () => {
        expect.assertions(1);

        expect(styleMethods.bg(9999)).toBe("background-color: ;");
    });
});
