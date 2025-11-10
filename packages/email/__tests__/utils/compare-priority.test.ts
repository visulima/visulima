import { describe, expect, it } from "vitest";

import { comparePriority } from "../../src/utils/compare-priority.js";

describe(comparePriority, () => {
    it("should compare priorities correctly", () => {
        expect(comparePriority("high", "high")).toBe(0);
        expect(comparePriority("normal", "normal")).toBe(0);
        expect(comparePriority("low", "low")).toBe(0);

        expect(comparePriority("high", "normal")).toBeLessThan(0);
        expect(comparePriority("high", "low")).toBeLessThan(0);
        expect(comparePriority("normal", "low")).toBeLessThan(0);

        expect(comparePriority("normal", "high")).toBeGreaterThan(0);
        expect(comparePriority("low", "high")).toBeGreaterThan(0);
        expect(comparePriority("low", "normal")).toBeGreaterThan(0);
    });

    it("should sort priorities correctly", () => {
        const priorities = ["normal", "low", "high"] as const;
        const sorted = [...priorities].sort(comparePriority);

        expect(sorted).toEqual(["high", "normal", "low"]);
    });
});
