import { describe, expect, it } from "vitest";

import { randomName } from "../../src/commands/create/random-name";

describe("randomName", () => {
    it("should return a string in adjective-noun format", () => {
        expect.assertions(2);

        const name = randomName();

        expect(typeof name).toBe("string");
        expect(name).toMatch(/^[a-z]+-[a-z]+$/);
    });

    it("should produce different names on successive calls (probabilistic)", () => {
        expect.assertions(1);

        const names = new Set(Array.from({ length: 20 }, () => randomName()));

        // With 33 adjectives × 40 nouns = 1320 combos, 20 calls should produce at least 2 unique
        expect(names.size).toBeGreaterThan(1);
    });
});
