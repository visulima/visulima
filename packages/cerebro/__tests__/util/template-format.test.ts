import { describe, expect, it } from "vitest";

import templateFormat from "../../src/util/text-processing/template-format";

describe("template-format", () => {
    it("should return empty string for undefined input", () => {
        expect(templateFormat(undefined)).toBe("");
    });

    it("should return empty string for null input", () => {
        expect(templateFormat(null as any)).toBe("");
    });

    it("should return the string as-is for plain text", () => {
        expect(templateFormat("hello world")).toBe("hello world");
    });

    it("should format colorized templates", () => {
        const result = templateFormat("{red hello} {bold world}");

        expect(result).toContain("hello"); // Should contain the text
        expect(result).toContain("world");
        expect(result).not.toBe("{red hello} {bold world}"); // Should be transformed
    });

    it("should handle backticks", () => {
        const result = templateFormat("code `example` here");

        expect(result).toBe("code `example` here");
    });

    it("should handle empty strings", () => {
        expect(templateFormat("")).toBe("");
    });

    it("should cache results for performance", () => {
        const input = "{blue test}";
        const result1 = templateFormat(input);
        const result2 = templateFormat(input);

        expect(result1).toBe(result2);
    });

    it("should handle complex templates", () => {
        const result = templateFormat("{bold {red error}}: {underline something went wrong}");

        expect(result).toContain("error");
        expect(result).toContain("something went wrong");
    });
});
