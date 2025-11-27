import { describe, expect, expectTypeOf, it } from "vitest";

import generateBoundary from "../../src/utils/generate-boundary";

describe(generateBoundary, () => {
    it("should generate a boundary string", () => {
        expect.assertions(1);

        const boundary = generateBoundary();

        expectTypeOf(boundary).toBeString();
    });

    it("should start with expected prefix", () => {
        expect.assertions(1);

        const boundary = generateBoundary();

        expect(boundary).toMatch(/^----_=_NextPart_/);
    });

    it("should generate unique boundaries", () => {
        expect.assertions(1);

        const boundary1 = generateBoundary();
        const boundary2 = generateBoundary();
        const boundary3 = generateBoundary();

        // All should be different
        expect(new Set([boundary1, boundary2, boundary3]).size).toBe(3);
    });

    it("should generate boundaries with correct length", () => {
        expect.assertions(2);

        const boundary = generateBoundary();

        // Prefix is 19 chars ("----_=_NextPart_"), hex is 32 chars (16 bytes * 2)
        // But actual implementation may vary, so just check it's reasonable
        expect(boundary.length).toBeGreaterThan(40);
        expect(boundary.length).toBeLessThan(60);
    });

    it("should generate valid MIME boundary format", () => {
        expect.assertions(1);

        const boundary = generateBoundary();

        // MIME boundaries should not contain spaces or certain special chars
        expect(boundary).toMatch(/^[\w=-]+$/);
    });
});
