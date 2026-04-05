import { describe, expect, it } from "vitest";

import { randomName, words } from "../../src/commands/create/random-name";

describe("randomName", () => {
    it("should return a string in word-word format", () => {
        expect.assertions(2);

        const name = randomName();

        expect(typeof name).toBe("string");
        expect(name).toMatch(/^[a-z]+-[a-z]+$/);
    });

    it("should produce different names on successive calls (probabilistic)", () => {
        expect.assertions(1);

        const names = new Set(Array.from({ length: 20 }, () => randomName()));

        // With ~2700 words, collisions are extremely unlikely in 20 calls
        expect(names.size).toBeGreaterThan(1);
    });

    it("should use words from the safe word list", () => {
        expect.assertions(2);

        const name = randomName();
        const [first, second] = name.split("-");

        expect(words).toContain(first);
        expect(words).toContain(second);
    });
});
