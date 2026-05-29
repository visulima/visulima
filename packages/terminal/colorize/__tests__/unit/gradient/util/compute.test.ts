import { describe, expect, it } from "vitest";

import { computeSubSteps } from "../../../../src/gradient/util/compute";
import type { StopOutput } from "../../../../src/types";

const stop = (position: number): StopOutput => {
    return { color: [0, 0, 0], position };
};

describe(computeSubSteps, () => {
    it("should throw when the step count is not a number", () => {
        expect.assertions(1);

        expect(() => {
            computeSubSteps([stop(0), stop(1)], Number.NaN);
        }).toThrow("Invalid number of steps (< 2)");
    });

    it("should throw when fewer than two steps are requested", () => {
        expect.assertions(1);

        expect(() => {
            computeSubSteps([stop(0), stop(1)], 1);
        }).toThrow("Invalid number of steps (< 2)");
    });

    it("should throw when the step count is below the stop count", () => {
        expect.assertions(1);

        expect(() => {
            computeSubSteps([stop(0), stop(0.3), stop(0.6), stop(1)], 3);
        }).toThrow("Number of steps cannot be inferior to number of stops");
    });

    it("should distribute extra steps by incrementing the smallest substep", () => {
        expect.assertions(1);

        // Rounding undershoots (total 11 < 12), forcing the increment branch to run.
        expect(computeSubSteps([stop(0), stop(0.4), stop(0.5), stop(0.6), stop(1)], 12)).toStrictEqual([4, 2, 1, 4]);
    });

    it("should remove surplus steps by decrementing the largest substep", () => {
        expect.assertions(1);

        // Rounding overshoots (total 7 > 5), forcing the reduction branch to run.
        expect(computeSubSteps([stop(0), stop(0.1), stop(0.2), stop(0.3), stop(1)], 5)).toStrictEqual([1, 1, 1, 1]);
    });
});
