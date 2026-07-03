import { describe, expect, expectTypeOf, it } from "vitest";

import { randomName } from "../../../src/commands/create/random-name";

describe(randomName, () => {
    it("should return a string in word-word format", () => {
        // `expectTypeOf` is compile-time only; only `expect()` counts toward assertion totals.
        expect.assertions(1);

        const name = randomName();

        expectTypeOf(name).toBeString();

        expect(name).toMatch(/^[a-z]+-[a-z]+$/);
    });

    it("should produce different names on successive calls (probabilistic)", () => {
        expect.assertions(1);

        const names = new Set(Array.from({ length: 20 }, () => randomName()));

        // With ~2700 words, collisions are extremely unlikely in 20 calls
        expect(names.size).toBeGreaterThan(1);
    });
});
