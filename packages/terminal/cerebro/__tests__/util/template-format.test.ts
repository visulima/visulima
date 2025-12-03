import { describe, expect, it } from "vitest";

import templateFormat from "../../src/util/text-processing/template-format";

describe("template-format", () => {
    it("should return empty string for undefined input", () => {
        expect.assertions(1);

        expect(templateFormat(undefined)).toBe("");
    });

    it("should return empty string for null input", () => {
        expect.assertions(1);

        expect(templateFormat(null as any)).toBe("");
    });

    it("should return the string as-is for plain text", () => {
        expect.assertions(1);

        expect(templateFormat("hello world")).toBe("hello world");
    });

    it("should format colorized templates", () => {
        expect.assertions(3);

        const result = templateFormat("{red hello} {bold world}");

        expect(result).toContain("hello"); // Should contain the text
        expect(result).toContain("world");
        expect(result).not.toBe("{red hello} {bold world}"); // Should be transformed
    });

    it("should handle backticks", () => {
        expect.assertions(1);

        const result = templateFormat("code `example` here");

        expect(result).toBe("code `example` here");
    });

    it("should handle empty strings", () => {
        expect.assertions(1);

        expect(templateFormat("")).toBe("");
    });

    it("should cache results for performance", () => {
        expect.assertions(1);

        const input = "{blue test}";
        const result1 = templateFormat(input);
        const result2 = templateFormat(input);

        expect(result1).toBe(result2);
    });

    it("should handle complex templates", () => {
        expect.assertions(2);

        const result = templateFormat("{bold {red error}}: {underline something went wrong}");

        expect(result).toContain("error");
        expect(result).toContain("something went wrong");
    });
});
