import { describe, expect, it } from "vitest";

import { createRetryBudget } from "../src/commands/run/handler";

describe(createRetryBudget, () => {
    it("grants up to the requested amount and decrements remaining", () => {
        expect.assertions(3);

        const budget = createRetryBudget(5);

        expect(budget.claim(3)).toBe(3);
        expect(budget.remaining).toBe(2);
        expect(budget.claim(10)).toBe(2);
    });

    it("returns 0 once exhausted", () => {
        expect.assertions(2);

        const budget = createRetryBudget(2);

        budget.claim(2);

        expect(budget.remaining).toBe(0);
        expect(budget.claim(5)).toBe(0);
    });

    it("coerces negative limits and non-integers to safe ints", () => {
        expect.assertions(2);

        const negative = createRetryBudget(-4);

        expect(negative.remaining).toBe(0);

        const fractional = createRetryBudget(3.9);

        expect(fractional.remaining).toBe(3);
    });

    it("claim(0) is a no-op", () => {
        expect.assertions(2);

        const budget = createRetryBudget(5);

        expect(budget.claim(0)).toBe(0);
        expect(budget.remaining).toBe(5);
    });
});
