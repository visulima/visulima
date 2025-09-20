import { describe, expect, it } from "vitest";

import realignOriginalPosition from "../../src/utils/position-aligner";

describe(realignOriginalPosition, () => {
    it("should return null for empty or invalid inputs", () => {
        expect.assertions(3);

        expect(realignOriginalPosition("", 1, 1, "")).toBeNull();
        expect(realignOriginalPosition("code", 0, 0, "original")).toBeNull();
        expect(realignOriginalPosition("code", -1, -1, "original")).toBeNull();
    });

    it("should handle simple token-based alignment", () => {
        expect.assertions(3);

        const compiledCode = `
function test() {
    throw new Error("Test error message");
}
        `.trim();

        const originalCode = `
function test() {
    throw new Error("Test error message");
}
        `.trim();

        const result = realignOriginalPosition(compiledCode, 3, 22, originalCode);

        expect(result).toBeDefined();
        expect(result?.line).toBe(3);
        // The actual column position depends on where "Error" is found in the line
        expect(result?.column).toBeGreaterThan(0);
    });

    it("should handle whitespace differences", () => {
        expect.assertions(2);

        const compiledCode = `
function test(){
    throw new Error("Error message");
}
        `.trim();

        const originalCode = `
function test() {
    throw new Error("Error message");
}
        `.trim();

        const result = realignOriginalPosition(compiledCode, 3, 20, originalCode);

        expect(result).toBeDefined();
        expect(result?.line).toBe(3);
    });

    it("should handle multi-line constructs", () => {
        expect.assertions(3);

        const compiledCode = `
throw new Error(
    "Multi-line error message"
);
        `.trim();

        const originalCode = `
throw new Error("Multi-line error message");
        `.trim();

        const result = realignOriginalPosition(compiledCode, 2, 5, originalCode);

        expect(result).toBeDefined();
        // The actual line and column depend on the matching strategy
        expect(result?.line).toBeGreaterThan(0);
        expect(result?.column).toBeGreaterThan(0);
    });

    it("should handle different line endings", () => {
        expect.assertions(2);

        const compiledCode = "line1\r\nline2\r\nthrow new Error('test');";
        const originalCode = "line1\nline2\nthrow new Error('test');";

        const result = realignOriginalPosition(compiledCode, 3, 10, originalCode);

        expect(result).toBeDefined();
        expect(result?.line).toBe(3);
    });

    it("should return null when token is not found in original", () => {
        expect.assertions(1);

        const compiledCode = "throw new Error('compiled only');";
        const originalCode = "console.log('different code');";

        const result = realignOriginalPosition(compiledCode, 1, 15, originalCode);

        expect(result).toBeNull();
    });

    it("should handle large code blocks", () => {
        expect.assertions(3);

        const largeCompiledCode = `${"x".repeat(10_000)}throw new Error('test');`;
        const largeOriginalCode = `${"y".repeat(10_000)}throw new Error('test');`;

        const result = realignOriginalPosition(largeCompiledCode, 1, 10_010, largeOriginalCode);

        expect(result).toBeDefined();
        expect(result?.line).toBe(1);
        expect(result?.column).toBeGreaterThan(0);
    });

    it("should handle edge cases with line/column bounds", () => {
        expect.assertions(3);

        const compiledCode = "short line";
        const originalCode = "short line";

        // Test with column beyond line length
        const result = realignOriginalPosition(compiledCode, 1, 100, originalCode);

        expect(result).toBeDefined();
        expect(result?.line).toBe(1);
        expect(result?.column).toBeLessThanOrEqual(10); // Should be clamped to line length
    });
});
